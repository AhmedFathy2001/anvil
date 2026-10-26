// Hiscores footprint checks — the "A" level of proof (Jagex-confirmed), pure.
//
// Every credit implies a minimum change on the official hiscores: a plugin-credited Zulrah kill is a
// Zulrah KC, a proof that prints "Your Zulrah kill count is: 512" says the hiscores reached 512, an
// agility lap is Agility XP. The plugin is public and a request can be forged, but the hiscores are
// Jagex's, so a claim the hiscores never caught up with is the one thing worth a human look.
//
// THE RULES THAT KEEP THIS HONEST
//   - Compare hiscores reads only (the baseline and the account's last poll), never the plugin's live
//     overlay — that IS the claim.
//   - Only a SETTLED read counts: one taken after the plugin went quiet (lib/pollLadder), because the
//     hiscores catch up on logout, not mid-session.
//   - Unranked, unknown or partial means "can't check", never a contradiction.
//   - Exact checks (KC) flag any shortfall; plausibility checks (XP per lap) only under half.
//   - A result flags; it never blocks or removes a credit.

import type { HiscoresSnapshot } from '@/lib/hiscores';
import { computeEhpEhb } from '@/lib/efficiency';
import { hiscoresKeyForMonster } from '@/lib/killSource';

export const FOOTPRINT_SHORT_FLAG = 'footprint_short';
/** How long after the last plugin push a hiscores read must be to count as settled. */
export const SETTLE_MS = 20 * 60_000;
/** Plausibility checks flag only when the hiscores show less than this share of the minimum. */
export const PLAUSIBLE_SHARE = 0.5;

export type Verdict = 'ok' | 'short' | 'unchecked';

/** A boss/activity count from a snapshot; null when unranked or absent (unknown, not zero). */
export function kcOf(snap: HiscoresSnapshot | null | undefined, key: string): number | null {
  const v = snap?.bosses?.[key]?.score;
  return typeof v === 'number' && v >= 0 ? v : null;
}

function xpOf(snap: HiscoresSnapshot | null | undefined, skill: string): number | null {
  const v = snap?.skills?.[skill]?.xp;
  return typeof v === 'number' && v >= 0 ? v : null;
}

/**
 * The most a count can have grown since the baseline. An unranked baseline is read as 0 — the
 * largest gain it could hide — so a shortfall against it is real. An unranked/unknown current, or a
 * partial baseline that never saw the key, can't be checked.
 */
export function maxGain(baseline: HiscoresSnapshot | null, current: HiscoresSnapshot | null, key: string): number | null {
  const now = kcOf(current, key);
  if (now == null || !baseline) return null;
  const before = kcOf(baseline, key);
  if (before == null && baseline.partial) return null;
  return Math.max(0, now - (before ?? 0));
}

/** Exact: the credited count must fit inside the hiscores gain. */
export function checkCount(claimed: number, gain: number | null): Verdict {
  if (gain == null || claimed <= 0) return 'unchecked';
  return claimed <= gain ? 'ok' : 'short';
}

// ── Kill-count lines printed on a proof ──────────────────────────────────────────────────────────

const KC_LINE = /^Your (?:completed |subdued )?(.+?) (?:kill |chest |completion |completed |success |opened |harvest )?count is: ([\d,]+)/i;

/** The (hiscores key, count) pairs a proof's game lines state, for the names the hiscores track. */
export function kcLineClaims(lines: { text: string }[]): { key: string; kc: number }[] {
  const out: { key: string; kc: number }[] = [];
  for (const { text } of lines) {
    const m = KC_LINE.exec(text);
    if (!m) continue;
    const key = hiscoresKeyForMonster(m[1]);
    const kc = parseInt(m[2].replace(/,/g, ''), 10);
    if (key && Number.isFinite(kc)) out.push({ key, kc });
  }
  return out;
}

/**
 * A printed KC must be one the hiscores reached (≤ the settled read) and must be past the starting
 * line — a count at or below the baseline is a kill from before the event.
 */
export function checkKcLine(claim: { key: string; kc: number }, baseline: HiscoresSnapshot | null, current: HiscoresSnapshot | null): Verdict {
  const now = kcOf(current, claim.key);
  if (now == null) return 'unchecked';
  if (claim.kc > now) return 'short';
  const before = kcOf(baseline, claim.key);
  if (before != null && claim.kc <= before) return 'short';
  return 'ok';
}

// ── Agility laps ─────────────────────────────────────────────────────────────────────────────────

/**
 * Agility XP a single lap/floor is worth AT LEAST — deliberately below the real figure, so with the
 * half-share rule only a gross shortfall flags. Keys are lib/constants AGILITY_COURSES and
 * SEPULCHRE_TARGETS names verbatim. Absent = no check (Skullball, unknown names).
 */
const LAP_XP_FLOOR: Record<string, number> = {
  'Gnome Stronghold Agility': 80,
  'Shayzien Basic Agility Course': 130,
  'Draynor Village Rooftop': 110,
  'Al Kharid Rooftop': 180,
  'Agility Pyramid': 500,
  'Penguin Agility': 450,
  'Barbarian Outpost': 140,
  'Shayzien Advanced Agility Course': 430,
  'Varrock Rooftop': 210,
  'Ape Atoll Agility': 500,
  'Colossal Wyrm Agility Course (Basic)': 550,
  'Canifis Rooftop': 210,
  'Wilderness Agility': 450,
  'Werewolf Agility': 450,
  'Colossal Wyrm Agility Course (Advanced)': 800,
  'Falador Rooftop': 500,
  'Dorgesh-Kaan Agility': 1000,
  "Seers' Village Rooftop": 500,
  'Prifddinas Agility Course': 1150,
  'Pollnivneach Rooftop': 760,
  'Rellekka Rooftop': 680,
  'Ardougne Rooftop': 700,
  'Hallowed Sepulchre': 450,
  'Hallowed Sepulchre Floor 1': 450,
  'Hallowed Sepulchre Floor 2': 750,
  'Hallowed Sepulchre Floor 3': 1200,
  'Hallowed Sepulchre Floor 4': 2200,
  'Hallowed Sepulchre Floor 5': 4500,
  'Grand Hallowed Coffin': 9000,
};

/** The XP floor for one lap of a tile whose targets are these — the cheapest target, or null. */
export function lapXpFloor(targets: string[]): number | null {
  const floors = targets.map((t) => LAP_XP_FLOOR[t]);
  if (floors.length === 0 || floors.some((f) => f == null)) return null;
  return Math.min(...(floors as number[]));
}

/** Plausibility: the Agility XP gained must reach half of laps × the per-lap floor. */
export function checkLaps(laps: number, floor: number | null, baseline: HiscoresSnapshot | null, current: HiscoresSnapshot | null): Verdict {
  if (floor == null || laps <= 0) return 'unchecked';
  const now = xpOf(current, 'agility');
  const before = xpOf(baseline, 'agility');
  if (now == null || before == null) return 'unchecked';
  return now - before >= laps * floor * PLAUSIBLE_SHARE ? 'ok' : 'short';
}

// ── Integrity signals (per player, staff-only) ───────────────────────────────────────────────────

/**
 * Content people pay someone else to do. A first-ever kill of one of these during an event is the
 * shape of a service; it is a reason to look, not a finding.
 */
export const SERVICE_KEYS = [
  'tzKalZuk', 'solHeredit', 'tzTokJad', 'corruptedGauntlet',
  'chambersOfXericChallengeMode', 'theatreOfBloodHardMode', 'tombsOfAmascutExpertMode',
];

/** Service content with no ranked KC at the start and a ranked KC now. */
export function firstServiceKills(baseline: HiscoresSnapshot | null, current: HiscoresSnapshot | null, keys = SERVICE_KEYS): string[] {
  if (!baseline || baseline.partial) return [];
  return keys.filter((k) => kcOf(baseline, k) == null && (kcOf(current, k) ?? 0) > 0);
}

/**
 * Efficient hours (EHP + EHB) gained between two reads: the LEAST time that gain could have taken,
 * since both measure play at the best known rates. Main-account rates, the fastest, keep it a floor
 * for ironmen too.
 */
export function efficientHoursGained(from: HiscoresSnapshot, to: HiscoresSnapshot): number {
  const a = computeEhpEhb(from);
  const b = computeEhpEhb(to);
  return Math.max(0, b.ehp - a.ehp) + Math.max(0, b.ehb - a.ehb);
}

/** Over a window of at least this long, gaining ≥ LONG_HOURS_SHARE of it in efficient hours flags. */
export const LONG_HOURS_MIN_WINDOW_H = 20;
export const LONG_HOURS_SHARE = 0.75;

/** More hours of play than the window could hold for one person (≈18h a day), or null. */
export function longHours(from: HiscoresSnapshot, to: HiscoresSnapshot, windowHours: number): number | null {
  if (windowHours < LONG_HOURS_MIN_WINDOW_H) return null;
  const h = efficientHoursGained(from, to);
  return h >= windowHours * LONG_HOURS_SHARE ? h : null;
}
