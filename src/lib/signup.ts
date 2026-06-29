import { BOSSES, SKILLS } from './constants';

// Canonical shape for the per-event signup profile. Stored as JSON in
// `eventSignups.profileData`. Captains read this when doing draft due diligence.
//
// All fields are optional at the type level so partial drafts (and prefills from a
// prior event) round-trip cleanly. The validator below is what guards writes — it
// clamps numeric ranges and drops any boss/skill keys that aren't in the shared
// constants (defends against stale prefills if we ever rename a key).
// A min–max estimate. Either bound may be omitted (open-ended), and min == max is a
// single value. Legacy signups stored a bare number here — the sanitizer coerces those
// to a point range so old rows round-trip.
export interface HoursRange {
  min?: number;
  max?: number;
}

export interface SignupProfile {
  // "Active" = hands-on content; "AFK" = afkable content they can run in the background.
  // The legacy dailyHours/weeklyHours fields were migrated into the active pair.
  activeDailyHours?: HoursRange;   // active hours per day, range (0–24)
  activeWeeklyHours?: HoursRange;  // active hours per week, range (0–168)
  afkDailyHours?: HoursRange;      // afk hours per day, range (0–24)
  afkWeeklyHours?: HoursRange;     // afk hours per week, range (0–168)
  timezone?: string;           // one of TIMEZONE_OPTIONS values, e.g. "UTC+1"
  bosses?: string[];          // BOSSES[].key list — bosses the player regularly does
  skills?: string[];          // SKILLS list — skills the player regularly trains
  notes?: string;             // free-text, capped at 1000 chars
}

const VALID_BOSS_KEYS = new Set(BOSSES.map((b) => b.key));
const VALID_SKILL_KEYS = new Set<string>(SKILLS);

const MAX_NOTES_LENGTH = 1000;

// Curated UTC-offset list for the optional signup timezone. Plain offsets (not IANA
// zones) keep the picker short and DST-agnostic — captains just want a rough sense of
// when someone plays. `value` is the canonical stored string; validation rejects
// anything not in this set.
export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'UTC-12', label: 'UTC−12' },
  { value: 'UTC-11', label: 'UTC−11' },
  { value: 'UTC-10', label: 'UTC−10 (Hawaii)' },
  { value: 'UTC-9', label: 'UTC−9 (Alaska)' },
  { value: 'UTC-8', label: 'UTC−8 (US Pacific)' },
  { value: 'UTC-7', label: 'UTC−7 (US Mountain)' },
  { value: 'UTC-6', label: 'UTC−6 (US Central)' },
  { value: 'UTC-5', label: 'UTC−5 (US Eastern)' },
  { value: 'UTC-4', label: 'UTC−4 (Atlantic)' },
  { value: 'UTC-3', label: 'UTC−3 (Brazil)' },
  { value: 'UTC-2', label: 'UTC−2' },
  { value: 'UTC-1', label: 'UTC−1' },
  { value: 'UTC+0', label: 'UTC+0 (UK / Portugal)' },
  { value: 'UTC+1', label: 'UTC+1 (Central Europe)' },
  { value: 'UTC+2', label: 'UTC+2 (Eastern Europe)' },
  { value: 'UTC+3', label: 'UTC+3 (Moscow)' },
  { value: 'UTC+3:30', label: 'UTC+3:30 (Iran)' },
  { value: 'UTC+4', label: 'UTC+4' },
  { value: 'UTC+5', label: 'UTC+5 (Pakistan)' },
  { value: 'UTC+5:30', label: 'UTC+5:30 (India)' },
  { value: 'UTC+6', label: 'UTC+6' },
  { value: 'UTC+7', label: 'UTC+7 (SE Asia)' },
  { value: 'UTC+8', label: 'UTC+8 (China / Singapore / Perth)' },
  { value: 'UTC+9', label: 'UTC+9 (Japan / Korea)' },
  { value: 'UTC+9:30', label: 'UTC+9:30 (AU Central)' },
  { value: 'UTC+10', label: 'UTC+10 (AU Eastern)' },
  { value: 'UTC+11', label: 'UTC+11' },
  { value: 'UTC+12', label: 'UTC+12 (New Zealand)' },
  { value: 'UTC+13', label: 'UTC+13' },
  { value: 'UTC+14', label: 'UTC+14' },
];

const VALID_TIMEZONES = new Set(TIMEZONE_OPTIONS.map((t) => t.value));

export function parseProfile(json: string | null | undefined): SignupProfile {
  if (!json) return {};
  try {
    const raw = JSON.parse(json);
    if (!raw || typeof raw !== 'object') return {};
    return sanitizeProfile(raw as Record<string, unknown>);
  } catch {
    return {};
  }
}

export function serializeProfile(profile: SignupProfile): string {
  return JSON.stringify(sanitizeProfile(profile as Record<string, unknown>));
}

// Coerce arbitrary input into a SignupProfile. Drops unknown fields, clamps numbers,
// filters boss/skill arrays to known keys.
export function sanitizeProfile(input: Record<string, unknown>): SignupProfile {
  const out: SignupProfile = {};

  // Active hours. Fall back to the legacy `dailyHours`/`weeklyHours` keys so pre-split
  // sign-ups (and prefills from them) migrate transparently into the active pair.
  const activeDaily = sanitizeHoursRange(input.activeDailyHours ?? input.dailyHours, 0, 24);
  if (activeDaily) out.activeDailyHours = activeDaily;
  const activeWeekly = sanitizeHoursRange(input.activeWeeklyHours ?? input.weeklyHours, 0, 168);
  if (activeWeekly) out.activeWeeklyHours = activeWeekly;
  const afkDaily = sanitizeHoursRange(input.afkDailyHours, 0, 24);
  if (afkDaily) out.afkDailyHours = afkDaily;
  const afkWeekly = sanitizeHoursRange(input.afkWeeklyHours, 0, 168);
  if (afkWeekly) out.afkWeeklyHours = afkWeekly;
  if (typeof input.timezone === 'string') {
    const tz = input.timezone.trim();
    if (VALID_TIMEZONES.has(tz)) out.timezone = tz;
  }
  if (Array.isArray(input.bosses)) {
    out.bosses = uniqueStrings(input.bosses).filter((k) => VALID_BOSS_KEYS.has(k));
  }
  if (Array.isArray(input.skills)) {
    out.skills = uniqueStrings(input.skills).filter((k) => VALID_SKILL_KEYS.has(k));
  }
  if (typeof input.notes === 'string') {
    const trimmed = input.notes.trim();
    if (trimmed) out.notes = trimmed.slice(0, MAX_NOTES_LENGTH);
  }

  return out;
}

// Coerce arbitrary input into an HoursRange, clamped to [lo, hi]. Accepts a legacy bare
// number (→ point range), or an object with optional min/max. A reversed range is
// normalized so min <= max. Returns undefined when nothing valid is present.
function sanitizeHoursRange(input: unknown, lo: number, hi: number): HoursRange | undefined {
  if (typeof input === 'number' && Number.isFinite(input)) {
    const v = clamp(input, lo, hi);
    return { min: v, max: v };
  }
  if (!input || typeof input !== 'object') return undefined;
  const obj = input as Record<string, unknown>;
  let min = typeof obj.min === 'number' && Number.isFinite(obj.min) ? clamp(obj.min, lo, hi) : undefined;
  let max = typeof obj.max === 'number' && Number.isFinite(obj.max) ? clamp(obj.max, lo, hi) : undefined;
  if (min !== undefined && max !== undefined && min > max) {
    [min, max] = [max, min];
  }
  if (min === undefined && max === undefined) return undefined;
  const out: HoursRange = {};
  if (min !== undefined) out.min = min;
  if (max !== undefined) out.max = max;
  return out;
}

// Human-readable range for display: "4–6", "5" (min == max), "4+" (min only),
// "≤6" (max only), or undefined when empty.
export function formatHoursRange(r: HoursRange | undefined | null): string | undefined {
  if (!r) return undefined;
  const { min, max } = r;
  if (min !== undefined && max !== undefined) return min === max ? `${min}` : `${min}–${max}`;
  if (min !== undefined) return `${min}+`;
  if (max !== undefined) return `≤${max}`;
  return undefined;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

function uniqueStrings(arr: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of arr) {
    if (typeof item === 'string' && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

// Window check: returns the reason the form is locked, or null if signups are open.
export function signupWindowState(event: {
  signupOpensAt: string | null;
  signupDeadline: string | null;
  startDate: string | null;
}): { open: boolean; reason: 'not_open_yet' | 'closed' | 'event_started' | null } {
  const now = Date.now();
  if (event.startDate && new Date(event.startDate).getTime() <= now) {
    return { open: false, reason: 'event_started' };
  }
  if (event.signupDeadline && new Date(event.signupDeadline).getTime() <= now) {
    return { open: false, reason: 'closed' };
  }
  if (event.signupOpensAt && new Date(event.signupOpensAt).getTime() > now) {
    return { open: false, reason: 'not_open_yet' };
  }
  return { open: true, reason: null };
}

// Edit window for an EXISTING sign-up. When the event has a payment deadline, players may
// keep editing their answers (and pay) right up to it — even after the sign-up deadline or
// event start. With no payment deadline set, editing follows the normal sign-up window.
// Creating a brand-new sign-up (or re-joining after withdrawal) still uses
// `signupWindowState`, not this — the payment grace period only extends EDITS.
export function signupEditState(event: {
  signupOpensAt: string | null;
  signupDeadline: string | null;
  startDate: string | null;
  paymentDeadline: string | null;
}): { open: boolean; reason: 'not_open_yet' | 'closed' | 'event_started' | null } {
  const base = signupWindowState(event);
  // Before the window opens at all, nothing's editable yet.
  if (base.reason === 'not_open_yet') return base;
  if (event.paymentDeadline) {
    const closed = new Date(event.paymentDeadline).getTime() <= Date.now();
    return closed ? { open: false, reason: 'closed' } : { open: true, reason: null };
  }
  return base;
}
