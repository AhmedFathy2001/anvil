// Phase 2 of the board-balance auditor: the effort model. Estimates expected player-hours
// per tile as a [fast, average, slow] spread across player capability, then audits points
// against effort (points per expected hour) and accessibility (skill floors).
//
// Server-side only — the drop-rate dataset is ~700KB and lives in src/data. The admin API
// route runs this and the Tiles-tab panel fetches the result.
//
// Every number here is an estimate built from curated defaults (src/data/balanceRates.json,
// overridable via the balance_rates setting) and wiki drop rates. Rough by design: the goal
// is catching a 50-point Scythe tile next to an 800-point cow tile, not decimal precision.

import type { Tile } from '@/lib/types';
import { tileWeight } from '@/lib/utils';
import { BOSSES } from '@/lib/constants';
import defaultRates from '@/data/balanceRates.json';
import npcDrops from '@/data/npcDrops.json';
import type { BalanceCheck } from '@/lib/boardBalance';

export type Triplet = [number, number, number]; // fast, average, slow
export type Floor = 'anyone' | 'mid' | 'high' | 'elite';
const FLOOR_ORDER: Floor[] = ['anyone', 'mid', 'high', 'elite'];

// Difficulty is a first-class input, not just a label. An hour of elite content is worth
// more points than an hour of AFK content, so we score points against *effort-hours*
// (wall-clock × this multiplier) rather than raw wall-clock. This is what stops a one-shot
// elite tile from being ranked as "overpaid" next to a chicken.
const FLOOR_EFFORT_MULTIPLIER: Record<Floor, number> = { anyone: 1, mid: 1.6, high: 2.5, elite: 4 };

// Nobody should ever be told to drop a hard tile to 2 points. A tile's suggested value is
// clamped up to this floor by difficulty — prestige has a price regardless of throughput.
const FLOOR_MIN_POINTS: Record<Floor, number> = { anyone: 5, mid: 15, high: 50, elite: 100 };

// One-shot / trivial tiles ("Complete Doom 1–8", "Kill a chicken") aren't grinds — their
// value is the difficulty of doing the thing once, not points-per-hour. We keep them in the
// table but exclude them from the board median and the over/underpaid flags, and never
// suggest lowering them (only lifting to the difficulty floor). A tile counts as one-off if
// it's a single completion, or if a single rep is under ~5 minutes of real time.
const ONE_OFF_TINY_HOURS = 0.08;

// Realizability — the troll axis. Points measure value-vs-time and stay author-owned: a fairly
// EV-priced 800pt 3rd-age tile is STILL a lottery, because P(it lands inside one event) is a few
// percent — face value isn't realizable value, and deliberately camping it is throwing hours away.
// So we classify instead of repricing: expected successes in the window follow a Poisson process
// at the tile's modelled rate, P(≥needed) decides grind / long-shot / lottery, and lottery tiles
// are excluded from the over/underpaid flags + median (their suggested points stay untouched).
// Board-level balance should read EXPECTED points (face × P), not face.
const CAMP_HOURS_PER_DAY = 4; // assumed serious-camp commitment per camper
const CAMPERS_PER_TILE = 2;
const DEFAULT_EVENT_DAYS = 10; // when the caller doesn't know the event window
const LOTTERY_P = 0.15;
const LONG_SHOT_P = 0.5;

interface ActivityRate {
  killSeconds?: Triplet;
  attemptMinutes?: Triplet;
  successRate?: Triplet;
  floor?: Floor;
  // Raids only: typical bingo party size. A completed raid grants KC to *every* party member,
  // so a team earns `partySize` KC per raid instance — a team-sum KC goal costs 1/partySize the
  // raids one soloist would. Left unset (→ 1) for solo content, so this never discounts a boss.
  partySize?: number;
}
interface SkillRate {
  xpPerHour: Triplet;
  floor?: Floor;
}
export interface BalanceRates {
  skills: Record<string, SkillRate>;
  activities: Record<string, ActivityRate>;
  generic: { mobKillSeconds: Triplet; bossKillSeconds: Triplet };
  gated?: { superiorEncounterSeconds?: Triplet };
  lms: { gameMinutes: Triplet; placementMultiplier: Triplet };
}

export interface TileEffort {
  tileId: number;
  label: string;
  weight: number;
  /** Expected player-hours [fast, avg, slow]; Infinity = that band can't do it; null = unmodelled. */
  hours: Triplet | null;
  floor: Floor;
  /** Difficulty multiplier applied to hours to get effort-hours (from the tile's floor). */
  difficulty: number;
  /** Hours the tile is PRICED against: avg band normally, a fast-leaning blend for high/elite
   *  tiles (teams assign gated tiles to whoever's closest to capable — nobody sends the average
   *  player to the Inferno). Null = unmodelled for pricing. */
  pricingHours: number | null;
  /** Raw points ÷ real average hours — throughput, shown for reference. null when unmodelled. */
  rawPtsPerHour: number | null;
  /** Points ÷ effort-hours (difficulty-adjusted) — the yardstick used for ranking and flags. */
  ptsPerHour: number | null;
  /** Single-completion / trivial tile: judged on difficulty, not throughput; excluded from the median. */
  oneOff: boolean;
  /** P(the tile completes within the event window) at an assumed serious camp; null = unmodelled. */
  hitProbability: number | null;
  /** Realizability class from hitProbability: grind ≥ 0.5 > long-shot ≥ 0.15 > lottery. */
  pClass: 'grind' | 'long-shot' | 'lottery' | null;
  /** Face points × hitProbability — what the tile is worth to a team plan. Null when unmodelled. */
  expectedPoints: number | null;
  suggestedPoints: number | null;
  /** Why the tile couldn't be modelled, or which fallback was used. */
  note: string | null;
}

export interface EffortReport {
  perTile: TileEffort[];
  medianPtsPerHour: number | null;
  modelledCount: number;
  unmodelledCount: number;
  /** Weight share whose floor is high/elite. */
  eliteShare: number;
  checks: BalanceCheck[];
}

// ---- Rates access -------------------------------------------------------------------

/** Shallow-merge admin overrides (settings `balance_rates`) over the curated defaults. */
export function mergeRates(overrides: unknown): BalanceRates {
  const base = defaultRates as unknown as BalanceRates;
  if (!overrides || typeof overrides !== 'object') return base;
  const o = overrides as Partial<Record<keyof BalanceRates, Record<string, unknown>>>;
  return {
    skills: { ...base.skills, ...(o.skills as BalanceRates['skills'] | undefined) },
    activities: { ...base.activities, ...(o.activities as BalanceRates['activities'] | undefined) },
    generic: { ...base.generic, ...(o.generic as Partial<BalanceRates['generic']> | undefined) },
    gated: { ...base.gated, ...(o.gated as BalanceRates['gated'] | undefined) },
    lms: { ...base.lms, ...(o.lms as Partial<BalanceRates['lms']> | undefined) },
  };
}

// Boss hiscores key ("kreeArra") → display label ("Kree'Arra"), for stat-boss lookups.
const BOSS_LABEL_BY_KEY = new Map(BOSSES.map((b) => [b.key, b.label]));

// Match activity names loosely: lowercase, drop a leading "the", strip colons and collapse
// whitespace. This is why "Chambers of Xeric Challenge Mode" (kill target), "chambers of
// xeric: challenge mode" (rate key), and the "CoX: CM" display label can all resolve to the
// same rate — before this, sub-mode raid tiles silently fell through to the generic boss time.
function normName(s: string): string {
  return s.trim().toLowerCase().replace(/^the\s+/, '').replace(/:/g, '').replace(/\s+/g, ' ').trim();
}
const normIndexCache = new WeakMap<object, Map<string, ActivityRate>>();
function activityIndex(rates: BalanceRates): Map<string, ActivityRate> {
  let idx = normIndexCache.get(rates.activities);
  if (!idx) {
    idx = new Map();
    for (const [k, v] of Object.entries(rates.activities)) idx.set(normName(k), v);
    normIndexCache.set(rates.activities, idx);
  }
  return idx;
}
function activityFor(rates: BalanceRates, name: string | null | undefined): ActivityRate | null {
  if (!name) return null;
  return activityIndex(rates).get(normName(name)) ?? null;
}
/** First curated rate that matches any of the candidate names (label, aliases, key). */
function activityForNames(rates: BalanceRates, names: (string | null | undefined)[]): ActivityRate | null {
  for (const n of names) {
    const a = activityFor(rates, n);
    if (a) return a;
  }
  return null;
}

// ---- Drop-rate lookup ---------------------------------------------------------------

type DropEntry = { i: number; d: number; q: number };
type DropSource = { source: string; d: number };

// itemId → sources that drop it, cheapest (lowest 1-in-d) first. Built once per process.
let dropIndex: Map<number, DropSource[]> | null = null;
function itemSources(itemId: number): DropSource[] {
  if (!dropIndex) {
    dropIndex = new Map();
    for (const [source, drops] of Object.entries(npcDrops as unknown as Record<string, DropEntry[]>)) {
      for (const e of drops) {
        if (!e || typeof e.i !== 'number' || typeof e.d !== 'number' || e.d <= 0) continue;
        const list = dropIndex.get(e.i) ?? [];
        list.push({ source, d: e.d });
        dropIndex.set(e.i, list);
      }
    }
    for (const list of dropIndex.values()) list.sort((a, b) => a.d - b.d);
  }
  return dropIndex.get(itemId) ?? [];
}

// Superior slayer monsters can't be farmed back-to-back: one "kill" costs ~200 on-task
// kills waiting for the spawn, gated further by task availability. The set is derived from
// the dataset itself — a source is a superior iff it drops the imbued heart (20724) — so it
// tracks dataset regens with zero curation.
const IMBUED_HEART_ID = 20724;
let superiorSet: Set<string> | null = null;
function isSuperiorSource(source: string): boolean {
  if (!superiorSet) {
    superiorSet = new Set(itemSources(IMBUED_HEART_ID).map((s) => s.source.toLowerCase()));
  }
  return superiorSet.has(source.trim().toLowerCase());
}

/** Best (cheapest) source for an item, optionally restricted to the tile's source filter. */
function bestSource(itemId: number, restrict: string[] | null): DropSource | null {
  const sources = itemSources(itemId);
  if (!restrict || restrict.length === 0) return sources[0] ?? null;
  const wanted = restrict.map((s) => s.trim().toLowerCase());
  return sources.find((s) => wanted.includes(s.source.toLowerCase())) ?? null;
}

// ---- Per-tile estimation ------------------------------------------------------------

const maxFloor = (a: Floor, b: Floor): Floor =>
  FLOOR_ORDER[Math.max(FLOOR_ORDER.indexOf(a), FLOOR_ORDER.indexOf(b))];

// When the average (or slow) band mathematically can't finish, the tile's effective floor
// rises regardless of what the activity entry declares.
function floorFromHours(hours: Triplet, declared: Floor): Floor {
  if (!Number.isFinite(hours[0])) return 'elite'; // nobody modelled can — flag as hardest
  if (!Number.isFinite(hours[1])) return maxFloor(declared, 'elite');
  if (!Number.isFinite(hours[2])) return maxFloor(declared, 'high');
  return declared;
}

// Resolves a kill-time triplet from the first of `names` that matches a curated rate. Boss KC
// tiles pass [label, ...aliases, key] so an abbreviated display label ("CoX: CM") still finds
// its rate via an alias; simple sources pass a single-element list.
type KillTriplet = { sec: Triplet; floor: Floor; defaulted: boolean; partySize: number };
function killTripletForNames(rates: BalanceRates, names: (string | null | undefined)[]): KillTriplet {
  // Spawn-gated sources first: a superior "kill" costs a whole encounter (task kills +
  // task availability), not a respawn timer.
  for (const n of names) {
    if (n && isSuperiorSource(n)) {
      const sec = rates.gated?.superiorEncounterSeconds ?? [1500, 3000, 6000];
      return { sec, floor: 'mid', defaulted: false, partySize: 1 };
    }
  }
  const act = activityForNames(rates, names);
  if (act?.killSeconds) return { sec: act.killSeconds, floor: act.floor ?? 'anyone', defaulted: false, partySize: 1 };
  // Attempt-model activities (CG, raids, Inferno) have no flat kill time — a "kill" costs
  // an attempt divided by the band's success rate (Infinity where that band can't finish).
  // partySize (raids only) is carried through so KC-count tiles can amortise the shared kill.
  if (act?.attemptMinutes && act.successRate) {
    const sec = [0, 1, 2].map((b) =>
      act.successRate![b] > 0 ? (act.attemptMinutes![b] * 60) / act.successRate![b] : Infinity,
    ) as Triplet;
    return { sec, floor: act.floor ?? 'high', defaulted: false, partySize: Math.max(1, act.partySize ?? 1) };
  }
  return { sec: rates.generic.bossKillSeconds, floor: 'mid', defaulted: true, partySize: 1 };
}
function killTriplet(rates: BalanceRates, source: string): KillTriplet {
  return killTripletForNames(rates, [source]);
}

function parseJsonArray<T>(raw: string | null | undefined): T[] | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as T[]) : null;
  } catch {
    return null;
  }
}

function estimateTile(tile: Tile, rates: BalanceRates): { hours: Triplet | null; floor: Floor; note: string | null } {
  const type = tile.tileType ?? 'standard';

  // Hiscores-polled stat tiles (stored as tileType 'standard' + trackedStat).
  if (tile.trackedStat && tile.statGoal) {
    if (tile.statType === 'skill') {
      const skill = rates.skills[tile.trackedStat];
      if (!skill) return { hours: null, floor: 'anyone', note: `no XP rate for ${tile.trackedStat}` };
      return {
        hours: skill.xpPerHour.map((r) => tile.statGoal! / r) as Triplet,
        floor: skill.floor ?? 'anyone',
        note: null,
      };
    }
    // boss KC goal. trackedStat may hold comma-separated keys (gains SUM across them); use the
    // first for the effort estimate. Resolve the rate through the boss's label + aliases so
    // abbreviated labels ("CoX: CM") and sub-mode names still find their curated rate.
    const firstKey = tile.trackedStat.split(',')[0].trim();
    const boss = BOSSES.find((b) => b.key === firstKey);
    const label = boss?.label ?? BOSS_LABEL_BY_KEY.get(firstKey) ?? firstKey;
    const names = boss ? [boss.label, ...(boss.aliases ?? []), boss.key] : [label];
    const { sec, floor, defaulted, partySize } = killTripletForNames(rates, names);
    // Raid KC is a team-sum goal: a party of `partySize` earns that many KC per raid instance,
    // so the team runs statGoal/partySize raids, not statGoal. Solo content has partySize 1.
    const raids = tile.statGoal! / partySize;
    return {
      hours: sec.map((s) => (raids * s) / 3600) as Triplet,
      floor,
      note: defaulted
        ? `no kill-time entry for ${label} — generic boss time used`
        : partySize > 1
          ? `raid KC — assumes a ~${partySize}-player party (each raid credits every member)`
          : null,
    };
  }

  if (type === 'drop') {
    const restrict = parseJsonArray<string>(tile.sourceNpcs);
    const reqs = parseJsonArray<{ itemId: number; requiredAmount: number; group?: string | null }>(tile.itemRequirements);
    let floor: Floor = 'anyone';
    let defaulted = false;
    let missing = 0;

    // Expected hours to collect one list of (itemId × count) requirements.
    const hoursForReqs = (rs: { itemId: number; requiredAmount: number }[]): Triplet | null => {
      const total: Triplet = [0, 0, 0];
      for (const r of rs) {
        const src = bestSource(r.itemId, restrict);
        if (!src) {
          missing += 1;
          return null;
        }
        const kt = killTriplet(rates, src.source);
        defaulted = defaulted || kt.defaulted;
        floor = maxFloor(floor, kt.floor);
        for (let b = 0; b < 3; b++) total[b] += r.requiredAmount * src.d * (kt.sec[b] / 3600);
      }
      return total;
    };

    if (reqs && reqs.length > 0) {
      // Item-set mode: ungrouped items always required; grouped sets are alternatives → min.
      const ungrouped = reqs.filter((r) => !r.group?.trim());
      const groups = new Map<string, typeof reqs>();
      for (const r of reqs) {
        const g = r.group?.trim()?.toLowerCase();
        if (!g) continue;
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g)!.push(r);
      }
      const baseHours = hoursForReqs(ungrouped);
      if (baseHours == null && ungrouped.length > 0) return { hours: null, floor, note: 'drop rate unknown for some items' };
      let setHours: Triplet | null = groups.size === 0 ? [0, 0, 0] : null;
      for (const set of groups.values()) {
        const h = hoursForReqs(set);
        if (h && (setHours == null || h[1] < setHours[1])) setHours = h;
      }
      if (setHours == null) return { hours: null, floor, note: 'drop rate unknown for some items' };
      const hours = [0, 1, 2].map((b) => (baseHours?.[b] ?? 0) + setHours![b]) as Triplet;
      return { hours, floor, note: defaulted ? 'generic kill time used for some sources' : null };
    }

    // Simple pool: any N drops from the tracked items. Combined rate per source-kill.
    const ids = parseJsonArray<number>(tile.trackedItemIds);
    if (!ids || ids.length === 0 || !tile.requiredAmount) {
      return { hours: null, floor: 'anyone', note: 'no tracked items — submissions are manual-ish' };
    }
    // Group pool items by their best source and take the source with the best combined rate.
    const bySource = new Map<string, { invD: number }>();
    for (const id of ids) {
      const src = bestSource(id, restrict);
      if (!src) continue;
      const cur = bySource.get(src.source) ?? { invD: 0 };
      cur.invD += 1 / src.d;
      bySource.set(src.source, cur);
    }
    if (bySource.size === 0) return { hours: null, floor: 'anyone', note: 'drop rate unknown for the tracked items' };
    let best: { source: string; kills: number } | null = null;
    for (const [source, { invD }] of bySource) {
      const kills = tile.requiredAmount / invD;
      if (!best || kills < best.kills) best = { source, kills };
    }
    const kt = killTriplet(rates, best!.source);
    floor = maxFloor(floor, kt.floor);
    return {
      hours: kt.sec.map((s) => (best!.kills * s) / 3600) as Triplet,
      floor,
      note: kt.defaulted ? `generic kill time used for ${best!.source}` : null,
    };
  }

  if (type === 'kill') {
    const targets = parseJsonArray<string>(tile.targetNpcs);
    if (!tile.requiredAmount) return { hours: null, floor: 'anyone', note: 'no required amount' };
    const known = targets?.find((t) => activityFor(rates, t) || isSuperiorSource(t));
    if (known) {
      const kt = killTriplet(rates, known);
      const reps = tile.requiredAmount! / kt.partySize; // raids credit the whole party
      return {
        hours: kt.sec.map((s) => (reps * s) / 3600) as Triplet,
        floor: kt.floor,
        note: kt.partySize > 1 ? `raid — assumes a ~${kt.partySize}-player party` : null,
      };
    }
    return {
      hours: rates.generic.mobKillSeconds.map((s) => (tile.requiredAmount! * s) / 3600) as Triplet,
      floor: 'anyone',
      note: 'generic mob kill time used',
    };
  }

  if (type === 'timed') {
    const act = activityFor(rates, tile.timedActivity);
    const cap = tile.timeThresholdSeconds ?? null;
    // Attempts multiplier from how tight the cap sits against a band's typical time:
    // comfortable → 1 try, at pace → a few, well under pace → out of reach for that band.
    const capFactor = (typicalSeconds: number): number => {
      if (cap == null || typicalSeconds <= 0) return 1;
      const r = cap / typicalSeconds;
      if (r >= 1.2) return 1;
      if (r >= 0.9) return 3;
      if (r >= 0.7) return 10;
      return Infinity;
    };
    if (act?.attemptMinutes && act.successRate) {
      const hours = [0, 1, 2].map((b) => {
        if (act.successRate![b] <= 0) return Infinity;
        const attemptSec = act.attemptMinutes![b] * 60;
        const factor = capFactor(attemptSec);
        return Number.isFinite(factor) ? ((attemptSec / 3600) / act.successRate![b]) * factor : Infinity;
      }) as Triplet;
      return { hours, floor: floorFromHours(hours, act.floor ?? 'high'), note: 'cap tightness roughly modelled from typical clear times' };
    }
    if (act?.killSeconds) {
      const hours = [0, 1, 2].map((b) => {
        const factor = capFactor(act.killSeconds![b]);
        return Number.isFinite(factor) ? (act.killSeconds![b] / 3600) * factor : Infinity;
      }) as Triplet;
      return { hours, floor: floorFromHours(hours, act.floor ?? 'mid'), note: 'cap tightness roughly modelled from typical clear times' };
    }
    return { hours: null, floor: 'high', note: `no attempt model for ${tile.timedActivity ?? 'activity'}` };
  }

  if (type === 'lms') {
    const cap = Math.max(1, tile.timeThresholdSeconds ?? 1);
    const games = Math.max(1, tile.requiredAmount ?? 1);
    const hours = [0, 1, 2].map((b) => {
      const p = Math.min(0.9, (cap / 24) * rates.lms.placementMultiplier[b]);
      return p > 0 ? (games / p) * (rates.lms.gameMinutes[b] / 60) : Infinity;
    }) as Triplet;
    return { hours, floor: 'mid', note: null };
  }

  const UNMODELLED: Record<string, string> = {
    standard: 'manual tile',
    gain: 'gather rates not modelled yet',
    deathless: 'deathless success rates not modelled yet',
    diary: 'diary progress depends on each account',
    ca: 'combat-task effort depends on each account',
    value: 'haul-value odds not modelled yet',
    pvp: 'PvP kill effort depends on the opposition',
    valuetotal: 'haul-value odds not modelled yet',
  };
  return { hours: null, floor: 'anyone', note: UNMODELLED[type] ?? 'not modelled' };
}

// P(X ≥ n) for X ~ Poisson(lambda): the chance a tile needing n successes lands inside the
// window when the window's expected success count is lambda. Log-space accumulation; normal
// approximation for huge n so a 5000-kill tile can't overflow the term loop.
function poissonTail(n: number, lambda: number): number {
  if (n <= 0) return 1;
  if (lambda <= 0) return 0;
  if (n > 2000) {
    const z = (lambda - n + 0.5) / Math.sqrt(lambda);
    // Abramowitz–Stegun erf approximation, plenty for a classification threshold.
    const t = 1 / (1 + 0.3275911 * Math.abs(z / Math.SQRT2));
    const erf =
      1 -
      (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
        t *
        Math.exp(-(z * z) / 2);
    return Math.max(0, Math.min(1, 0.5 * (1 + Math.sign(z) * erf)));
  }
  let logTerm = -lambda;
  let cdf = Math.exp(logTerm);
  for (let k = 1; k < n; k++) {
    logTerm += Math.log(lambda / k);
    cdf += Math.exp(logTerm);
  }
  return Math.max(0, Math.min(1, 1 - cdf));
}

// ---- Board-level audit --------------------------------------------------------------

export function analyzeEffort(
  tiles: Tile[],
  opts: { pointsMode: boolean; ratesOverride?: unknown; eventDays?: number | null },
): EffortReport {
  const rates = mergeRates(opts.ratesOverride);
  const scoringMode = opts.pointsMode ? 'points' : 'tiles';
  const scored = tiles.filter((t) => !t.optional);

  const perTile: TileEffort[] = scored.map((t) => {
    const { hours, floor, note } = estimateTile(t, rates);
    const weight = tileWeight(scoringMode, t.points ?? 1);
    const avg = hours && Number.isFinite(hours[1]) && hours[1] > 0 ? hours[1] : null;
    const difficulty = FLOOR_EFFORT_MULTIPLIER[floor];
    // Assignee-band pricing (plan A2): high/elite tiles price against 60/40 fast/avg — and when
    // the avg band literally can't do it (Infinity) but the fast band can, the fast band alone
    // carries the price: that's exactly the Inferno case, a real tile for the one who'll get it.
    const fast = hours && Number.isFinite(hours[0]) && hours[0] > 0 ? hours[0] : null;
    const gated = floor === 'high' || floor === 'elite';
    const pricingHours = gated && fast != null ? (avg != null ? 0.6 * fast + 0.4 * avg : fast) : avg;
    const effortAvg = pricingHours != null ? pricingHours * difficulty : null;
    // Single-completion or sub-5-minute tiles are one-offs: judged on difficulty, not throughput.
    const count = t.statGoal ?? t.requiredAmount ?? null;
    const oneOff = count === 1 || (avg != null && avg < ONE_OFF_TINY_HOURS);
    // Realizability: expected successes in the camp window at the avg-band rate → P(≥needed).
    const windowHours = CAMP_HOURS_PER_DAY * CAMPERS_PER_TILE * Math.max(1, opts.eventDays ?? DEFAULT_EVENT_DAYS);
    let hitProbability: number | null = null;
    let pClass: TileEffort['pClass'] = null;
    if (pricingHours != null) {
      const needed = Math.max(1, count ?? 1);
      hitProbability = poissonTail(needed, needed * (windowHours / pricingHours));
      pClass = hitProbability < LOTTERY_P ? 'lottery' : hitProbability < LONG_SHOT_P ? 'long-shot' : 'grind';
    }
    return {
      tileId: t.id,
      label: t.label,
      weight,
      hours,
      floor,
      difficulty,
      rawPtsPerHour: avg ? weight / avg : null,
      ptsPerHour: effortAvg ? weight / effortAvg : null,
      oneOff,
      pricingHours,
      hitProbability,
      pClass,
      expectedPoints: hitProbability != null ? weight * hitProbability : null,
      suggestedPoints: null, // filled below once the board median is known
      note,
    };
  });

  const modelled = perTile.filter((t) => t.ptsPerHour != null);
  // The median (and the over/underpaid flags) are set by grind tiles only — one-offs have
  // near-zero denominators that would blow up the benchmark, and lottery tiles are priced as
  // jackpots on purpose (EV math is meaningless as a flag in either direction). Difficulty-
  // adjusted throughout.
  const graded = modelled.filter((t) => !t.oneOff && t.pClass !== 'lottery');
  const pphSorted = graded.map((t) => t.ptsPerHour!).sort((a, b) => a - b);
  const medianPph = pphSorted.length ? pphSorted[Math.floor(pphSorted.length / 2)] : null;

  if (medianPph && opts.pointsMode) {
    for (const t of perTile) {
      if (t.pricingHours == null) continue;
      // Lottery tiles keep the author's points untouched — 1pt meme and 800pt jackpot are both
      // legitimate; the class label + expected points carry the information instead.
      if (t.pClass === 'lottery') continue;
      const floorMin = FLOOR_MIN_POINTS[t.floor];
      if (t.oneOff) {
        // Never dock a one-off on throughput grounds — only lift it to its difficulty floor.
        t.suggestedPoints = Math.max(floorMin, t.weight);
      } else {
        const raw = medianPph * t.pricingHours! * t.difficulty;
        const rounded = raw >= 20 ? Math.round(raw / 5) * 5 : Math.max(1, Math.round(raw));
        t.suggestedPoints = Math.max(floorMin, rounded);
      }
    }
  }

  const totalWeight = perTile.reduce((s, t) => s + t.weight, 0);
  const eliteWeight = perTile
    .filter((t) => t.floor === 'high' || t.floor === 'elite')
    .reduce((s, t) => s + t.weight, 0);
  const eliteShare = totalWeight ? eliteWeight / totalWeight : 0;

  const checks: BalanceCheck[] = [];
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  if (medianPph && opts.pointsMode && graded.length >= 5) {
    const over = graded.filter((t) => t.ptsPerHour! > medianPph * 3);
    const under = graded.filter((t) => t.ptsPerHour! < medianPph / 3);
    if (over.length) {
      checks.push({
        id: 'pph-overpaid',
        level: 'warn',
        title: `${over.length} tile${over.length === 1 ? ' pays' : 's pay'} >3× the board's points-per-effort-hour`,
        detail: `${over.slice(0, 4).map((t) => `"${t.label}"`).join(', ')}${over.length > 4 ? '…' : ''} — even after weighting for difficulty these are the farm meta. Suggested points shown in the effort table.`,
        tileIds: over.map((t) => t.tileId),
      });
    }
    if (under.length) {
      checks.push({
        id: 'pph-underpaid',
        level: 'warn',
        title: `${under.length} tile${under.length === 1 ? ' pays' : 's pay'} <⅓ of the board's points-per-effort-hour`,
        detail: `${under.slice(0, 4).map((t) => `"${t.label}"`).join(', ')}${under.length > 4 ? '…' : ''} — too grindy for the points. Raise their points or shrink the requirement.`,
        tileIds: under.map((t) => t.tileId),
      });
    }
  }

  // Surface the silent generic-time fallback: a tile with no curated rate is a rough guess,
  // not a modelled figure. Post-fix this catches genuinely unmodelled bosses, not raid modes.
  const fallback = perTile.filter((t) => t.note && /generic/.test(t.note));
  if (fallback.length) {
    checks.push({
      id: 'rate-fallback',
      level: 'info',
      title: `${fallback.length} tile${fallback.length === 1 ? ' uses' : 's use'} a generic time estimate`,
      detail: `No curated kill-time for ${fallback.slice(0, 4).map((t) => `"${t.label}"`).join(', ')}${fallback.length > 4 ? '…' : ''} — their effort is a placeholder. Add rates via the balance_rates setting for a sharper read.`,
      tileIds: fallback.map((t) => t.tileId),
    });
  }

  const lotteries = perTile.filter((t) => t.pClass === 'lottery');
  if (lotteries.length) {
    const face = lotteries.reduce((s, t) => s + t.weight, 0);
    const expected = lotteries.reduce((s, t) => s + (t.expectedPoints ?? 0), 0);
    checks.push({
      id: 'lottery-tiles',
      level: 'info',
      title: `${lotteries.length} lottery tile${lotteries.length === 1 ? '' : 's'} — jackpots, not plans`,
      detail:
        `${lotteries.slice(0, 4).map((t) => `"${t.label}"`).join(', ')}${lotteries.length > 4 ? '…' : ''} land ` +
        `within the event with <${Math.round(LOTTERY_P * 100)}% odds even at a serious camp ` +
        `(~${CAMP_HOURS_PER_DAY}h/day × ${CAMPERS_PER_TILE} players). Their ${Math.round(face)} face points are ` +
        `≈${Math.round(expected)} expected — the points can stand (jackpots are fun), but nobody should be ` +
        `assigned to camp these, and board balance should count the expected value, not the face value.`,
      tileIds: lotteries.map((t) => t.tileId),
    });
  }

  const blocked = perTile.filter((t) => t.hours && !Number.isFinite(t.hours[1]));
  if (blocked.length) {
    checks.push({
      id: 'inaccessible-average',
      level: 'warn',
      title: `${blocked.length} tile${blocked.length === 1 ? ' is' : 's are'} out of reach for the average player`,
      detail: `${blocked.slice(0, 4).map((t) => `"${t.label}"`).join(', ')}${blocked.length > 4 ? '…' : ''} — the success-rate model says a mid-level player effectively can't complete these (fine as elite chase tiles, but they carry ${pct(blocked.reduce((s, t) => s + t.weight, 0) / (totalWeight || 1))} of the board).`,
      tileIds: blocked.map((t) => t.tileId),
    });
  }

  if (eliteShare > 0.5 && scored.length >= 8) {
    checks.push({
      id: 'elite-gated',
      level: 'warn',
      title: `${pct(eliteShare)} of the board needs high-end PvMers`,
      detail: 'Over half the weight sits behind high/elite-floor content. Teams without stacked rosters are spectators — spread more weight across accessible tiles.',
    });
  } else if (eliteShare > 0.35 && scored.length >= 8) {
    checks.push({
      id: 'elite-gated',
      level: 'info',
      title: `${pct(eliteShare)} of the board needs high-end PvMers`,
      detail: 'A meaningful chunk of the weight is gated behind high/elite-floor content — intended for sweaty boards, worth knowing either way.',
    });
  }

  const leveraged = modelled.filter(
    (t) => t.hours && Number.isFinite(t.hours[2]) && t.hours[0] > 0 && t.hours[2] / t.hours[0] >= 4,
  );
  if (leveraged.length >= 3) {
    checks.push({
      id: 'skill-leverage',
      level: 'info',
      title: `${leveraged.length} tiles are far cheaper for elite players`,
      detail: 'Their fast-player time is 4×+ better than the slow estimate — teams with stacked rosters gain compounding advantage. Not wrong, just know the board rewards it.',
    });
  }

  return {
    perTile,
    medianPtsPerHour: medianPph,
    modelledCount: modelled.length,
    unmodelledCount: perTile.length - modelled.length,
    eliteShare,
    checks,
  };
}
