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
import { activityFor } from '@/lib/hiscoresActivities';
import gearMonsters from '@/data/gearMonsters.json';
import combatAchievements from '@/data/combatAchievements.json';

export const FOOTPRINT_SHORT_FLAG = 'footprint_short';
/** How long after the last plugin push a hiscores read must be to count as settled. */
export const SETTLE_MS = 20 * 60_000;
/** Plausibility checks flag only when the hiscores show less than this share of the minimum. */
export const PLAUSIBLE_SHARE = 0.5;

export type Verdict = 'ok' | 'short' | 'unchecked';

/**
 * A boss or activity count from a snapshot (activities by their path: clues, LMS, Collections
 * Logged); null when unranked or absent — unknown, not zero.
 */
export function kcOf(snap: HiscoresSnapshot | null | undefined, key: string): number | null {
  const activity = activityFor(key);
  let node: unknown = activity ? snap : snap?.bosses?.[key];
  for (const step of activity?.path ?? []) node = (node as Record<string, unknown> | undefined)?.[step];
  const v = (node as { score?: unknown } | undefined)?.score;
  return typeof v === 'number' && v >= 0 ? v : null;
}

/** Activity names a tile may carry that the hiscores list under their boss (the KC that moves). */
const COUNT_ALIASES: Record<string, string> = {
  'inferno': 'tzKalZuk', 'the inferno': 'tzKalZuk',
  'fight caves': 'tzTokJad', 'the fight caves': 'tzTokJad', 'tzhaar fight cave': 'tzTokJad',
  'fortis colosseum': 'solHeredit', 'colosseum': 'solHeredit',
};

/** Raid modes are separate hiscores counts; a drop or task "from the raid" moves whichever was run. */
const MODE_FAMILIES = [
  ['chambersOfXeric', 'chambersOfXericChallengeMode'],
  ['theatreOfBlood', 'theatreOfBloodHardMode'],
  ['tombsOfAmascut', 'tombsOfAmascutExpertMode'],
];

/** Keys plus their raid-mode siblings, for "did any of these move" questions. */
export function withModes(keys: string[]): string[] {
  const out = new Set(keys);
  for (const fam of MODE_FAMILIES) if (fam.some((k) => out.has(k))) fam.forEach((k) => out.add(k));
  return [...out];
}

/** The hiscores count a monster/activity name moves, or null when it moves none we can read. */
export function countKeyFor(name: string): string | null {
  return hiscoresKeyForMonster(name) ?? COUNT_ALIASES[name.trim().toLowerCase()] ?? null;
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
const CLUE_LINE = /^You have completed ([\d,]+) (beginner|easy|medium|hard|elite|master) Treasure Trails?/i;

/**
 * The (hiscores key, count) pairs a proof's game lines state, for the counts the hiscores track:
 * boss/raid KC lines and the treasure-trail tally.
 */
export function kcLineClaims(lines: { text: string }[]): { key: string; kc: number }[] {
  const out: { key: string; kc: number }[] = [];
  for (const { text } of lines) {
    const clue = CLUE_LINE.exec(text);
    const m = clue ? null : KC_LINE.exec(text);
    const key = clue ? `clues${clue[2][0].toUpperCase()}${clue[2].slice(1).toLowerCase()}` : m ? countKeyFor(m[1]) : null;
    const kc = parseInt((clue?.[1] ?? m?.[2] ?? '').replace(/,/g, ''), 10);
    if (key && Number.isFinite(kc)) out.push({ key, kc });
  }
  return out;
}

const CLOG_LINE = /^New item added to your collection log: (.+)$/i;

/** Items a proof's game lines say were new to the collection log. */
export function newClogItems(lines: { text: string }[]): string[] {
  return lines.flatMap(({ text }) => {
    const m = CLOG_LINE.exec(text);
    return m ? [m[1].trim().toLowerCase()] : [];
  });
}

const CA_LINE = /^Congratulations, you've completed an? \w+ combat task: (.+?)(?: \([\d,]+ points?\))?\.?$/i;
const CA_MONSTER = new Map(
  (combatAchievements as { tasks: { name: string; monster?: string | null }[] }).tasks
    .filter((t) => t.monster)
    .map((t) => [t.name.toLowerCase(), t.monster as string]),
);

/** Hiscores counts a proof's combat-task lines imply moved (each task needs its monster killed). */
export function caTaskKeys(lines: { text: string }[]): string[] {
  return lines.flatMap(({ text }) => {
    const m = CA_LINE.exec(text);
    const monster = m ? CA_MONSTER.get(m[1].trim().toLowerCase()) : null;
    const key = monster ? countKeyFor(monster) : null;
    return key ? [key] : [];
  });
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

// ── Mob kills: Hitpoints XP ───────────────────────────────────────────────────────────────────────

const MONSTER_HP = new Map<string, number>();
for (const m of (gearMonsters as { monsters: { n: string; hp?: number }[] }).monsters) {
  if (typeof m.hp !== 'number' || m.hp <= 0) continue;
  const k = m.n.toLowerCase();
  // A name covers every variant; the weakest is the floor.
  MONSTER_HP.set(k, Math.min(MONSTER_HP.get(k) ?? Infinity, m.hp));
}

/** Least hitpoints across a kill tile's monsters, or null when any is unknown. */
export function killHpFloor(targets: string[]): number | null {
  const hps = targets.map((t) => MONSTER_HP.get(t.trim().toLowerCase()));
  if (hps.length === 0 || hps.some((h) => h == null)) return null;
  return Math.min(...(hps as number[]));
}

/** Every combat style grants 1.33 Hitpoints XP per damage, and a kill is at least its HP in damage. */
const HP_XP_PER_DAMAGE = 1.33;

/**
 * Plausibility for kills of monsters off the hiscores: Hitpoints XP must reach half of
 * kills × HP × 1.33 (half, because a shared kill splits the damage). A maxed Hitpoints can't move.
 */
export function checkMobKills(kills: number, hpFloor: number | null, baseline: HiscoresSnapshot | null, current: HiscoresSnapshot | null): Verdict {
  if (hpFloor == null || kills <= 0) return 'unchecked';
  const now = xpOf(current, 'hitpoints');
  const before = xpOf(baseline, 'hitpoints');
  if (now == null || before == null || now >= 200_000_000) return 'unchecked';
  return now - before >= kills * hpFloor * HP_XP_PER_DAMAGE * PLAUSIBLE_SHARE ? 'ok' : 'short';
}

// ── Gain tiles: skill XP per gathered item ───────────────────────────────────────────────────────

/**
 * Gathering-only items and the XP one is worth AT LEAST (a little under the real figure). The
 * plugin counts a gain only outside banks, trades and ground pickups, so these arrive by gathering.
 * Absent = no check — a cooked fish or a bar can be made several ways.
 */
const GAIN_XP: Record<number, { skill: string; xp: number }> = {
  3142: { skill: 'fishing', xp: 45 }, // raw karambwan
  383: { skill: 'fishing', xp: 95 }, // raw shark
  13439: { skill: 'fishing', xp: 105 }, // raw anglerfish
  7944: { skill: 'fishing', xp: 105 }, // raw monkfish
  377: { skill: 'fishing', xp: 80 }, // raw lobster
  371: { skill: 'fishing', xp: 90 }, // raw swordfish
  359: { skill: 'fishing', xp: 70 }, // raw tuna
  11934: { skill: 'fishing', xp: 115 }, // raw dark crab
  1511: { skill: 'woodcutting', xp: 22 }, // logs
  1521: { skill: 'woodcutting', xp: 33 }, // oak logs
  1519: { skill: 'woodcutting', xp: 60 }, // willow logs
  1517: { skill: 'woodcutting', xp: 90 }, // maple logs
  6333: { skill: 'woodcutting', xp: 75 }, // teak logs
  6332: { skill: 'woodcutting', xp: 110 }, // mahogany logs
  1515: { skill: 'woodcutting', xp: 155 }, // yew logs
  1513: { skill: 'woodcutting', xp: 220 }, // magic logs
  19669: { skill: 'woodcutting', xp: 340 }, // redwood logs
  440: { skill: 'mining', xp: 30 }, // iron ore
  453: { skill: 'mining', xp: 45 }, // coal
  444: { skill: 'mining', xp: 55 }, // gold ore
  447: { skill: 'mining', xp: 70 }, // mithril ore
  449: { skill: 'mining', xp: 85 }, // adamantite ore
  451: { skill: 'mining', xp: 110 }, // runite ore
  21347: { skill: 'mining', xp: 210 }, // amethyst
};

/** The XP a gain claim implies, per skill, or null when any item is one we can't price. */
export function gainXpFloor(gains: { itemId: number | null; amount: number }[], poolIds: number[]): Record<string, number> | null {
  const out: Record<string, number> = {};
  for (const g of gains) {
    // A submission without its item is priced at the cheapest item the tile tracks.
    const options = (g.itemId != null ? [g.itemId] : poolIds).map((id) => GAIN_XP[id]);
    if (options.length === 0 || options.some((o) => !o)) return null;
    const cheapest = options.reduce((a, b) => (b!.xp < a!.xp ? b : a))!;
    out[cheapest.skill] = (out[cheapest.skill] ?? 0) + g.amount * cheapest.xp;
  }
  return out;
}

/** Plausibility: each skill's XP gain must reach half of what the gathered items imply. */
export function checkGain(floors: Record<string, number> | null, baseline: HiscoresSnapshot | null, current: HiscoresSnapshot | null): Verdict {
  if (!floors || Object.keys(floors).length === 0) return 'unchecked';
  let verdict: Verdict = 'ok';
  for (const [skill, need] of Object.entries(floors)) {
    const now = xpOf(current, skill);
    const before = xpOf(baseline, skill);
    if (now == null || before == null || now >= 200_000_000) return 'unchecked';
    if (now - before < need * PLAUSIBLE_SHARE) verdict = 'short';
  }
  return verdict;
}

/**
 * Plausibility for credits that need a count to have MOVED at all — a repeat drop from a boss, an
 * LMS placement, a repeated combat task: nothing moved means none of them happened.
 */
export function checkMoved(keys: string[], baseline: HiscoresSnapshot | null, current: HiscoresSnapshot | null): Verdict {
  if (keys.length === 0) return 'unchecked';
  let known = 0;
  for (const k of withModes(keys)) {
    const now = kcOf(current, k);
    if (now == null) return 'unchecked'; // could have moved without showing
    const before = kcOf(baseline, k) ?? (baseline?.partial ? null : 0);
    if (before == null) return 'unchecked';
    if (now !== before) return 'ok';
    known++;
  }
  return known > 0 ? 'short' : 'unchecked';
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

/** A timed run this much faster than the player's pre-event best is worth a look. */
export const PB_JUMP_SHARE = 0.6;

/** The pre-event PB map key: hiscores key + team size (0 = the activity has no sizes). */
export const pbKey = (key: string, teamSize: number) => `${key}|${teamSize}`;

/**
 * Timed runs far faster than the player's best from before the event. A run is compared with the PB
 * for its own party size, or the sizeless PB; no pre-event PB means no comparison (a first-ever time
 * says nothing about who set it).
 */
export function pbJumps(
  before: Record<string, number>,
  runs: { key: string; partySize: number | null; seconds: number }[],
): { key: string; pbSeconds: number; runSeconds: number }[] {
  const out = new Map<string, { key: string; pbSeconds: number; runSeconds: number }>();
  for (const r of runs) {
    const centis = before[pbKey(r.key, r.partySize ?? 0)] ?? before[pbKey(r.key, 0)];
    if (!centis || r.seconds <= 0) continue;
    const pbSeconds = centis / 100;
    if (r.seconds >= pbSeconds * PB_JUMP_SHARE) continue;
    const prev = out.get(r.key);
    if (!prev || r.seconds < prev.runSeconds) out.set(r.key, { key: r.key, pbSeconds, runSeconds: r.seconds });
  }
  return [...out.values()];
}

/** Enough history on both sides before an hour-of-day comparison means anything. */
export const SCHEDULE_MIN_PRIOR = 30;
export const SCHEDULE_MIN_EVENT = 15;
/** Share of event activity in hours the player was never active in before. */
export const SCHEDULE_OFF_SHARE = 0.5;

/**
 * How much of the event's activity falls in UTC hours the player's earlier activity never touched
 * (an hour counts as theirs if they were active in it or either neighbour), or null when either side
 * is too thin to say.
 */
export function scheduleShift(priorHours: number[], eventHours: number[]): number | null {
  if (priorHours.length < SCHEDULE_MIN_PRIOR || eventHours.length < SCHEDULE_MIN_EVENT) return null;
  const active = new Set<number>();
  for (const h of priorHours) for (const d of [-1, 0, 1]) active.add((h + d + 24) % 24);
  const off = eventHours.filter((h) => !active.has(h)).length / eventHours.length;
  return off >= SCHEDULE_OFF_SHARE ? off : null;
}

/** Sightings from two countries this close together are not a trip. */
export const TWO_COUNTRIES_MS = 3 * 3_600_000;

/** Two countries a player's plugin connected from within a few hours of each other, or null. */
export function twoCountries(rows: { country: string | null; first: number; last: number }[]): [string, string] | null {
  const known = rows.filter((r) => r.country);
  for (let i = 0; i < known.length; i++) {
    for (let j = i + 1; j < known.length; j++) {
      const a = known[i];
      const b = known[j];
      if (a.country === b.country) continue;
      const gap = Math.max(a.first, b.first) - Math.min(a.last, b.last); // < 0 when they overlap
      if (gap < TWO_COUNTRIES_MS) return [a.country!, b.country!];
    }
  }
  return null;
}
