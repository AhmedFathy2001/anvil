import { BOSSES, SKILLS } from './constants';

// Canonical shape for the per-event signup profile. Stored as JSON in
// `eventSignups.profileData`. Captains read this when doing draft due diligence.
//
// All fields are optional at the type level so partial drafts (and prefills from a
// prior event) round-trip cleanly. The validator below is what guards writes — it
// clamps numeric ranges and drops any boss/skill keys that aren't in the shared
// constants (defends against stale prefills if we ever rename a key).
export interface SignupProfile {
  dailyHours?: number;        // hours per day (0–24)
  weeklyHours?: number;       // hours per week (0–168)
  bosses?: string[];          // BOSSES[].key list — bosses the player regularly does
  skills?: string[];          // SKILLS list — skills the player regularly trains
  notes?: string;             // free-text, capped at 1000 chars
}

const VALID_BOSS_KEYS = new Set(BOSSES.map((b) => b.key));
const VALID_SKILL_KEYS = new Set<string>(SKILLS);

const MAX_NOTES_LENGTH = 1000;

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

  if (typeof input.dailyHours === 'number' && Number.isFinite(input.dailyHours)) {
    out.dailyHours = clamp(input.dailyHours, 0, 24);
  }
  if (typeof input.weeklyHours === 'number' && Number.isFinite(input.weeklyHours)) {
    out.weeklyHours = clamp(input.weeklyHours, 0, 168);
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
