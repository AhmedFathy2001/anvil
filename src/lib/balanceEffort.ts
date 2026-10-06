// Phase 2 of the board-balance auditor: the effort model. Estimates expected player-hours
// per tile as a [fast, average, slow] spread across player capability, then audits points
// against effort (points per expected hour) and accessibility (skill floors).
//
// Server-side only — the drop-rate dataset is ~800KB and lives in src/data. The admin API
// route runs this and the Tiles-tab panel fetches the result.
//
// Every number here is an estimate built from curated defaults (src/data/balanceRates.json,
// overridable via the balance_rates setting) and wiki drop rates. Rough by design: the goal
// is catching a 50-point Scythe tile next to an 800-point cow tile, not decimal precision.

import type { Tile } from '@/lib/types';
import { tileWeight } from '@/lib/utils';
import { BOSSES } from '@/lib/constants';
import defaultRates from '@/data/balanceRates.json';
import sourcedRates from '@/data/activityRates.json';
import npcDrops from '@/data/npcDrops.json'; // regenerate with `npm run data:drops`
import type { BalanceCheck } from '@/lib/boardBalance';
import { bundleSize, chancePerKill } from '@/lib/clogLuck';
import { raidSourcesByItem, raidUniqueChances } from '@/lib/raidLuck';
import { expectedCollectionHours, type DropEffortAction, type DropEffortRequirement } from '@/lib/dropEffort';
import { parseTileEffortConfig, type TileRaidEffortConfig } from '@/lib/tileEffortConfig';
import { isMissionTile } from '@/lib/eventRules';

export type Triplet = [number, number, number]; // fast, average, slow
export type Floor = 'anyone' | 'mid' | 'high' | 'elite';
const FLOOR_ORDER: Floor[] = ['anyone', 'mid', 'high', 'elite'];

// Difficulty is a modest execution premium. Attempt duration / success rate already prices most
// mechanical difficulty, so a large multiplier here would count the same failures twice. Floors
// map onto the 0–5 rubric used by the scoring design: routine=0, mid=1, high≈2.5, elite=4.
const FLOOR_EFFORT_MULTIPLIER: Record<Floor, number> = { anyone: 1, mid: 1.05, high: 1.125, elite: 1.2 };

// Nobody should ever be told to drop a hard tile to 2 points. A tile's suggested value is
// clamped up to this floor by difficulty — prestige has a price regardless of throughput.
const FLOOR_MIN_POINTS: Record<Floor, number> = { anyone: 5, mid: 15, high: 50, elite: 100 };

// Truly tiny tiles ("Kill a chicken") aren't useful points-per-hour benchmarks. Required amount
// 1 does NOT make a tile tiny: one Inferno, one LMS win or one rare drop can consume hours. The old
// count===1 shortcut was why a 20-hour one-drop tile received the same 15-point floor as a trivial
// completion instead of being priced from its effort.
const ONE_OFF_TINY_HOURS = 0.08;

// Realizability — the troll axis. Points measure value-vs-time and stay author-owned: a fairly
// EV-priced 800pt 3rd-age tile is STILL a lottery, because P(it lands inside one event) is a few
// percent — face value isn't realizable value, and deliberately camping it is throwing hours away.
// So we classify instead of repricing: expected successes in the window follow a Poisson process
// at the tile's modelled rate, and P(≥needed) grades the tile.
//
// The low-probability end splits by WHAT is uncertain, because the two cases need opposite advice:
//   - RNG-driven (drops, item sets, single-haul value) → 'lottery'. Leave the points; the fun is the
//     jackpot. Excluded from the over/underpaid flags + median, and board balance should read
//     EXPECTED points (face × P) rather than face.
//   - Throughput-driven (kill counts, XP goals, gains) → 'unreachable'. Nothing lucky about it:
//     "Kill 500 Bloodvelds" is a fixed rate that simply doesn't fit the window. These STAY in the
//     pts/hour analysis, because "too grindy for the points" is exactly the flag they deserve —
//     calling them lotteries used to exempt them from it.
// Poisson also flatters throughput tiles: it assumes variance = mean, when a kill count's real
// spread comes from hours played, not from the rate. Another reason not to price off it.
const CAMP_HOURS_PER_DAY = 4; // assumed serious-camp commitment per camper
const CAMPERS_PER_TILE = 2;
const DEFAULT_EVENT_DAYS = 10; // when the caller doesn't know the event window
const LOTTERY_P = 0.15;

/**
 * Is this tile's completion decided by a ROLL, or by hours? Mirrors boardBalance's 'RNG drops'
 * family so the two audits agree on what luck means: drops and value hauls ride the drop table;
 * kill counts, XP goals, gains and timed clears are throughput, however long they take.
 */
function isRngDriven(tile: Tile): boolean {
  const type = tile.tileType ?? 'standard';
  return type === 'drop' || type === 'value' || type === 'collection';
}
const LONG_SHOT_P = 0.5;

interface ActivityRate {
  killSeconds?: Triplet;
  // Agility courses: seconds per lap. Agility is the most deterministic grind in the game — a
  // course's lap time barely moves with gear or luck, only with attention — so a lap tile prices
  // far more tightly than a kill tile does.
  lapSeconds?: Triplet;
  attemptMinutes?: Triplet;
  successRate?: Triplet;
  floor?: Floor;
  // Raids only: typical bingo party size. A completed raid grants KC to *every* party member,
  // so a team earns `partySize` KC per raid instance — a team-sum KC goal costs 1/partySize the
  // raids one soloist would. Left unset (→ 1) for solo content, so this never discounts a boss.
  partySize?: number;
  // Group bosses (Corp, Nex, Nightmare): the kill time is a mass/team kill, but each drop goes to ONE
  // player of the group. Per player-hour a drop is lootSplit× rarer than the table's 1-in-d. Unset → 1.
  lootSplit?: number;
}
interface SkillRate {
  xpPerHour: Triplet;
  floor?: Floor;
}
export interface BalanceRates {
  skills: Record<string, SkillRate>;
  activities: Record<string, ActivityRate>;
  generic: { mobKillSeconds: Triplet; bossKillSeconds: Triplet; agilityLapSeconds?: Triplet };
  gated?: { superiorEncounterSeconds?: Triplet };
  lms: { gameMinutes: Triplet; placementMultiplier: Triplet };
}

export interface TileEffort {
  tileId: number;
  label: string;
  tileType: string;
  weight: number;
  /** Expected player-hours [fast, avg, slow]; Infinity = that band can't do it; null = unmodelled. */
  hours: Triplet | null;
  floor: Floor;
  /** Difficulty multiplier applied to hours to get effort-hours (from the tile's floor). */
  difficulty: number;
  /** Explicit 0–5 execution rating; null means the accessibility floor supplied the default. */
  skillRating: number | null;
  /** Hours the tile is PRICED against: avg band normally, a fast-leaning blend for high/elite
   *  tiles (teams assign gated tiles to whoever's closest to capable — nobody sends the average
   *  player to the Inferno), less any earlier cumulative milestone on the same board. */
  pricingHours: number | null;
  /** Pricing hours before cumulative-chain credit. */
  grossPricingHours: number | null;
  /** Earlier work automatically credited in a compatible 1 KC → 5 KC style chain. */
  overlapCreditHours: number;
  /** Raw points ÷ real average hours — throughput, shown for reference. null when unmodelled. */
  rawPtsPerHour: number | null;
  /** Points ÷ effort-hours (difficulty-adjusted) — the yardstick used for ranking and flags. */
  ptsPerHour: number | null;
  /** Sub-five-minute tile: too small to be a useful throughput benchmark; excluded from the median. */
  oneOff: boolean;
  /** P(the tile completes within the event window) at an assumed serious camp; null = unmodelled. */
  hitProbability: number | null;
  /**
   * Realizability class from hitProbability. Which low-probability class a tile lands in depends on
   * WHAT the uncertainty is: a rare drop is a 'lottery' (camp it all event and you may still get
   * nothing), while a kill/XP count that doesn't fit the window is 'unreachable' (perfectly
   * predictable, just too big). Opposite advice, so they can't share a label.
   */
  pClass: 'grind' | 'long-shot' | 'lottery' | 'unreachable' | null;
  /** Face points × hitProbability — what the tile is worth to a team plan. Null when unmodelled. */
  expectedPoints: number | null;
  suggestedPoints: number | null;
  /** Why bulk suggestion deliberately leaves this tile alone. null means it is eligible. */
  suggestionStatus: 'eligible' | 'unmodelled' | 'lottery' | 'unreachable' | 'needs-calibration';
  /** Why the tile couldn't be modelled, or which fallback was used. */
  note: string | null;
  /** The server's over/underpaid verdict — the only one the table may show (points boards, ≥5 graded). */
  pphFlag: 'over' | 'under' | null;
}

export interface EffortReport {
  perTile: TileEffort[];
  medianPtsPerHour: number | null;
  modelledCount: number;
  unmodelledCount: number;
  /** Current and proposed totals for auto-priceable tiles. These should remain equal. */
  suggestionBudget: number;
  suggestedBudget: number;
  /** Weight share whose floor is high/elite. */
  eliteShare: number;
  checks: BalanceCheck[];
}

// ---- Rates access -------------------------------------------------------------------

/**
 * Kill times, sourced. `npm run data:rates` derives these from a third-party EHB rate table (efficient
 * play → the fast band) and the wiki's money-making guides (a documented realistic method → the
 * slow band); see scripts/build-rates-dataset.mjs and THIRD_PARTY_NOTICES.md.
 *
 * They replace ONLY `killSeconds`, and only where the curated entry was that shape to begin with.
 * Accessibility floors stay curated because neither source has a notion of "can an average clan
 * member get here", and Gauntlet/raid entries keep their attempt-and-success-rate model, which
 * carries more than a kills-per-hour figure can.
 *
 * The precedence is: curated defaults ← sourced rates ← admin `balance_rates` override. An operator
 * who has tuned a rate for their own clan still wins, which is the whole point of the override.
 */
const SOURCED_ACTIVITIES: Record<string, ActivityRate> = (() => {
  const curated = (defaultRates as unknown as BalanceRates).activities;
  const sourced = (sourcedRates as { activities: Record<string, { killSeconds: number[] }> }).activities;
  const out: Record<string, ActivityRate> = {};
  for (const [key, entry] of Object.entries(sourced)) {
    const base = curated[key];
    if (!base || !Array.isArray(base.killSeconds) || entry.killSeconds?.length !== 3) continue;
    // Sorted: fast ≤ average ≤ slow is an invariant everything downstream relies on, and a sourced
    // row can arrive out of order (Spindel's fast band was slower than its slow one).
    out[key] = { ...base, killSeconds: [...entry.killSeconds].sort((a, b) => a - b) as Triplet };
  }
  return out;
})();

/** Shallow-merge admin overrides (settings `balance_rates`) over the sourced + curated defaults. */
export function mergeRates(overrides: unknown): BalanceRates {
  const curatedBase = defaultRates as unknown as BalanceRates;
  const base: BalanceRates = {
    ...curatedBase,
    activities: { ...curatedBase.activities, ...SOURCED_ACTIVITIES },
  };
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

// One line off a wiki drop table: item id, 1-in-d rate, and the quantity — fixed (q) or a
// range (m–n). `r` is the number of rolls per kill, present only when the table rolls more
// than once. Only i and d matter to the model; the rest rides along for future use.
type DropEntry = { i: number; d: number; q?: number; m?: number; n?: number; r?: number };
type DropSource = {
  source: string;
  d: number;
  rolls: number;
  bundle: number;
  /** Hiscores/activity key for raid tables whose display source is a chest label. */
  bossKey?: string;
  /** Raid unique tables choose one reward conditional on the purple roll. */
  exclusive?: boolean;
  assumed?: boolean;
};

// itemId → NPC sources that drop it, cheapest (lowest 1-in-d) first. Built once per process.
let npcDropIndex: Map<number, DropSource[]> | null = null;
function npcItemSources(itemId: number): DropSource[] {
  if (!npcDropIndex) {
    npcDropIndex = new Map();
    for (const [source, drops] of Object.entries(npcDrops as unknown as Record<string, DropEntry[]>)) {
      for (const e of drops) {
        if (!e || typeof e.i !== 'number' || typeof e.d !== 'number' || e.d <= 0) continue;
        const list = npcDropIndex.get(e.i) ?? [];
        list.push({
          source,
          d: e.d,
          rolls: e.r && e.r > 0 ? e.r : 1,
          bundle: bundleSize(e),
        });
        npcDropIndex.set(e.i, list);
      }
    }
    for (const list of npcDropIndex.values()) list.sort((a, b) => a.d - b.d);
  }
  return npcDropIndex.get(itemId) ?? [];
}

type DropResolver = (itemId: number, raidConfig?: TileRaidEffortConfig | null) => DropSource[];

/** NPC tables plus context-adjusted raid tables, rebuilt per report because overrides vary by clan. */
function dropResolver(raidRatesOverride?: unknown): DropResolver {
  const raids = raidSourcesByItem(raidRatesOverride);
  const baseUniqueDenominators = raidUniqueChances(raidRatesOverride);
  return (itemId: number, raidConfig?: TileRaidEffortConfig | null) => {
    const npc = raidConfig?.mode ? [] : npcItemSources(itemId);
    const raid = (raids.get(itemId) ?? [])
      .filter((r) => !raidConfig?.mode || r.bossKey === raidConfig.mode)
      .map((r) => {
        const baseUnique = baseUniqueDenominators[r.bossKey];
        const adjustedDenominator = raidConfig?.uniqueDenominator && baseUnique > 0
          ? r.denominator * (raidConfig.uniqueDenominator / baseUnique)
          : r.denominator;
        return {
          source: r.source,
          d: adjustedDenominator,
          rolls: r.rolls,
          bundle: r.bundle,
          bossKey: r.bossKey,
          exclusive: true,
          assumed: r.assumed,
        };
      });
    return [...npc, ...raid];
  };
}

// Superior slayer monsters can't be farmed back-to-back: one "kill" costs ~200 on-task
// kills waiting for the spawn, gated further by task availability. The set is derived from
// the dataset itself — a source is a superior iff it drops the imbued heart (20724) — so it
// tracks dataset regens with zero curation.
const IMBUED_HEART_ID = 20724;
let superiorSet: Set<string> | null = null;
function isSuperiorSource(source: string): boolean {
  if (!superiorSet) {
    superiorSet = new Set(npcItemSources(IMBUED_HEART_ID).map((s) => s.source.toLowerCase()));
  }
  return superiorSet.has(source.trim().toLowerCase());
}

function sourceNames(source: DropSource): string[] {
  const boss = source.bossKey ? BOSSES.find((b) => b.key === source.bossKey) : null;
  return [source.source, source.bossKey, boss?.label, ...(boss?.aliases ?? [])].filter((s): s is string => !!s);
}

function sourceAllowed(source: DropSource, restrict: string[] | null): boolean {
  if (!restrict || restrict.length === 0) return true;
  const candidates = new Set(sourceNames(source).map(normName));
  return restrict.some((wanted) => candidates.has(normName(wanted)));
}

function sourcesForItem(
  itemId: number,
  restrict: string[] | null,
  resolveDrops: DropResolver,
  raidConfig?: TileRaidEffortConfig | null,
): DropSource[] {
  return resolveDrops(itemId, raidConfig).filter((source) =>
    // An explicit balance mode is intentionally separate from RuneLite's source name. For example,
    // tracking still receives "Tombs of Amascut" while balancing may pin the Expert table.
    raidConfig?.mode && source.bossKey === raidConfig.mode ? true : sourceAllowed(source, restrict),
  );
}

/** Chance at least one member receives the item from a shared raid completion. */
function partyHitChance(personalChance: number, partySize: number): number {
  const p = Math.max(0, Math.min(1, personalChance));
  return 1 - Math.pow(1 - p, Math.max(1, partySize));
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
type KillTriplet = { sec: Triplet; floor: Floor; defaulted: boolean; partySize: number; lootSplit: number };
const BOSS_NAMES = new Set(
  BOSSES.flatMap((boss) => [boss.key, boss.label, ...(boss.aliases ?? [])]).map(normName),
);

function killTripletForNames(
  rates: BalanceRates,
  names: (string | null | undefined)[],
  fallback: 'boss' | 'mob' = 'boss',
): KillTriplet {
  // Spawn-gated sources first: a superior "kill" costs a whole encounter (task kills +
  // task availability), not a respawn timer.
  for (const n of names) {
    if (n && isSuperiorSource(n)) {
      const sec = rates.gated?.superiorEncounterSeconds ?? [1500, 3000, 6000];
      return { sec, floor: 'mid', defaulted: false, partySize: 1, lootSplit: 1 };
    }
  }
  const act = activityForNames(rates, names);
  if (act?.killSeconds) {
    return { sec: act.killSeconds, floor: act.floor ?? 'anyone', defaulted: false, partySize: 1, lootSplit: Math.max(1, act.lootSplit ?? 1) };
  }
  // Attempt-model activities (CG, raids, Inferno) have no flat kill time — a "kill" costs
  // an attempt divided by the band's success rate (Infinity where that band can't finish).
  // partySize (raids only) is carried through so KC-count tiles can amortise the shared kill.
  if (act?.attemptMinutes && act.successRate) {
    const sec = [0, 1, 2].map((b) =>
      act.successRate![b] > 0 ? (act.attemptMinutes![b] * 60) / act.successRate![b] : Infinity,
    ) as Triplet;
    return { sec, floor: act.floor ?? 'high', defaulted: false, partySize: Math.max(1, act.partySize ?? 1), lootSplit: 1 };
  }
  return fallback === 'mob'
    ? { sec: rates.generic.mobKillSeconds, floor: 'anyone', defaulted: true, partySize: 1, lootSplit: 1 }
    : { sec: rates.generic.bossKillSeconds, floor: 'mid', defaulted: true, partySize: 1, lootSplit: 1 };
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

function jsonListSignature(raw: string | null | undefined): string {
  const values = parseJsonArray<string | number>(raw);
  return values ? values.map(String).map(normName).sort().join('|') : '';
}

/**
 * Cumulative objectives with the same key share their earlier work. This is deliberately narrow:
 * a speed task is NOT grouped with KC (the execution achievement stays additive), while 1 Zuk KC
 * and 5 Zuk KC are the same measurable progression and the latter should price only four more.
 */
function progressionStep(tile: Tile): { key: string; amount: number } | null {
  if (tile.trackedStat && tile.statGoal && tile.statGoal > 0) {
    const stats = tile.trackedStat.split(',').map(normName).sort().join('|');
    return { key: `stat:${tile.statType ?? 'boss'}:${tile.statBasis ?? 'gain'}:${stats}`, amount: tile.statGoal };
  }
  const type = tile.tileType ?? 'standard';
  const amount = tile.requiredAmount;
  if (!amount || amount <= 0) return null;
  if (type === 'drop' && !tile.itemRequirements) {
    const items = jsonListSignature(tile.trackedItemIds);
    if (!items) return null;
    return {
      key: `drop:${items}:${jsonListSignature(tile.sourceNpcs)}:${tile.perKillCap ?? ''}:${tile.timeThresholdSeconds ?? ''}`,
      amount,
    };
  }
  if (type === 'kill' || type === 'lap' || type === 'diary' || type === 'ca' || type === 'pvp') {
    const targets = jsonListSignature(tile.targetNpcs);
    if (!targets) return null;
    return {
      key: `${type}:${targets}:${tile.coopCredit ?? ''}:${tile.coopMinMembers ?? ''}:${tile.partySize ?? ''}:${tile.pvpMinLootValue ?? ''}`,
      amount,
    };
  }
  if (type === 'lms') {
    return { key: `lms:placement-${tile.timeThresholdSeconds ?? 1}`, amount };
  }
  if (type === 'gain') {
    const items = jsonListSignature(tile.trackedItemIds);
    return items ? { key: `gain:${items}`, amount } : null;
  }
  return null;
}

function killTripletForDropSource(
  rates: BalanceRates,
  source: DropSource,
  raidConfig?: TileRaidEffortConfig | null,
): KillTriplet {
  const names = sourceNames(source);
  const bossLike = !!source.bossKey || names.some((name) => BOSS_NAMES.has(normName(name)));
  // Most rows in npcDrops are ordinary monsters. Treating every unknown source as a boss made an
  // abyssal-demon drop cost 140 seconds per kill while a kill tile used 16 seconds for that same
  // monster. Known bosses keep the boss fallback; ordinary/shared Slayer and revenant drops use the
  // mob fallback until a curated source rate replaces it.
  const base = killTripletForNames(rates, names, bossLike ? 'boss' : 'mob');
  if (!source.bossKey || source.bossKey !== raidConfig?.mode || !raidConfig.completionMinutes) return base;
  const desiredAverageSeconds = raidConfig.completionMinutes * 60;
  const average = base.sec[1];
  if (!Number.isFinite(average) || average <= 0) {
    return { ...base, sec: [desiredAverageSeconds, desiredAverageSeconds, desiredAverageSeconds] };
  }
  const scale = desiredAverageSeconds / average;
  return { ...base, sec: base.sec.map((s) => s * scale) as Triplet };
}

function estimateTile(
  tile: Tile,
  rates: BalanceRates,
  resolveDrops: DropResolver,
): {
  hours: Triplet | null;
  floor: Floor;
  note: string | null;
  /** Players whose hours a completion consumes at once (a raid party) — widens the camp window. */
  campers?: number;
  /** Successes the tile needs when that isn't its raw count (a 500-item stack = one drop). */
  needed?: number;
} {
  const type = tile.tileType ?? 'standard';
  const effortConfig = parseTileEffortConfig(tile.effortConfig);
  const raidConfig = effortConfig?.raid ?? null;

  // Hiscores-polled stat tiles (stored as tileType 'standard' + trackedStat).
  // A MILESTONE ("reach a lifetime total") costs whatever each account still lacks — 0h for someone
  // already past it, the whole climb for a fresh account. Pricing it as a full in-event gain called
  // "Reach 99 Attack" a 130-hour unreachable tile. Unmodelled unless the author calibrates it.
  if (tile.trackedStat && tile.statGoal && tile.statBasis === 'milestone') {
    return { hours: null, floor: 'anyone', note: 'lifetime target — its cost depends on each account’s current total' };
  }
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
    // PLAYER-HOURS, like every other tile. A party of `partySize` earns that many KC per raid, so the
    // team runs statGoal/partySize raids — but each raid occupies all partySize players, so the
    // player-hours are statGoal × raid time either way. Dividing by the party priced raids in
    // party clock time (a third or a quarter of their real cost) against player-hour windows.
    return {
      hours: sec.map((s) => (tile.statGoal! * s) / 3600) as Triplet,
      floor,
      note: defaulted
        ? `no kill-time entry for ${label} — generic boss time used`
        : partySize > 1
          ? `raid KC — player-hours for a ~${partySize}-player party (each raid credits every member)`
          : null,
      campers: partySize,
    };
  }

  if (type === 'drop') {
    const restrict = parseJsonArray<string>(tile.sourceNpcs);
    const reqs = parseJsonArray<DropEffortRequirement>(tile.itemRequirements);
    let floor: Floor = 'anyone';
    let defaulted = false;
    let assumedRaidRate = false;
    let partyMax = 1;

    if (reqs && reqs.length > 0) {
      const bySource = new Map<string, { source: DropSource; byReq: Map<number, DropSource> }>();
      for (let i = 0; i < reqs.length; i++) {
        for (const source of sourcesForItem(reqs[i].itemId, restrict, resolveDrops, raidConfig)) {
          const key = `${source.bossKey ?? ''}\u0000${source.source.toLowerCase()}`;
          const action = bySource.get(key) ?? { source, byReq: new Map<number, DropSource>() };
          const held = action.byReq.get(i);
          // Duplicate rows can describe variants of the same table. Preserve the historical
          // optimistic authoring assumption by taking the best rate for that named source.
          if (!held || chancePerKill(source.d, source.rolls) > chancePerKill(held.d, held.rolls)) {
            action.byReq.set(i, source);
          }
          bySource.set(key, action);
        }
      }
      if (bySource.size === 0) {
        return { hours: null, floor: 'anyone', note: 'drop rate unknown for the required items' };
      }

      const actionsByBand: [DropEffortAction[], DropEffortAction[], DropEffortAction[]] = [[], [], []];
      for (const { source, byReq } of bySource.values()) {
        const kt = killTripletForDropSource(rates, source, raidConfig);
        const partySize = source.bossKey
          ? Math.max(1, tile.timeThresholdSeconds ?? kt.partySize)
          : 1;
        defaulted = defaulted || kt.defaulted;
        floor = maxFloor(floor, kt.floor);
        assumedRaidRate = assumedRaidRate || !!source.assumed;
        const outcomes = [...byReq.entries()].map(([requirement, drop]) => ({
          requirement,
          chance: partyHitChance(chancePerKill(drop.d, drop.rolls), partySize),
          quantity: tile.perKillCap === 1 ? 1 : drop.bundle,
        }));
        partyMax = Math.max(partyMax, partySize);
        for (let b = 0; b < 3; b++) {
          actionsByBand[b].push({
            source: source.source,
            // Player-hours: a raid occupies the whole party (whose combined chance is above), and a
            // group boss's drop goes to one of lootSplit players.
            hours: (kt.sec[b] / 3600) * partySize * kt.lootSplit,
            // One player's purple is exclusive; a party has several independent personal reward
            // rolls and can therefore land more than one relevant item in the same completion.
            exclusive: !!source.exclusive && partySize === 1,
            outcomes,
          });
        }
      }
      const hours = [0, 1, 2].map((b) =>
        expectedCollectionHours(reqs, tile.groupMode, actionsByBand[b]),
      );
      if (hours.some((h) => h == null)) {
        return { hours: null, floor, note: 'collection drop model could not reach every required set' };
      }
      const notes = [
        defaulted ? 'generic kill time used for some sources' : null,
        assumedRaidRate
          ? raidConfig?.uniqueDenominator
            ? 'raid unique chance uses this tile\'s effort calibration'
            : 'raid unique chance uses the clan raid_luck_rates assumption'
          : null,
        raidConfig?.completionMinutes ? 'raid duration uses this tile\'s expected completion time' : null,
      ].filter(Boolean);
      return { hours: hours as Triplet, floor, note: notes.length ? notes.join('; ') : null, campers: partyMax };
    }

    // Simple pool: any N drops from the tracked items. Combined rate per source-kill.
    const ids = parseJsonArray<number>(tile.trackedItemIds);
    if (!ids || ids.length === 0 || !tile.requiredAmount) {
      return { hours: null, floor: 'anyone', note: 'no tracked items — submissions are manual-ish' };
    }
    // Group pool items by source and choose the source with the best expected time in each player
    // band. Comparing denominators alone can choose a common but extremely slow source.
    const bySource = new Map<string, { source: DropSource; byItem: Map<number, DropSource> }>();
    for (const id of ids) {
      for (const source of sourcesForItem(id, restrict, resolveDrops, raidConfig)) {
        const key = `${source.bossKey ?? ''}\u0000${source.source.toLowerCase()}`;
        const cur = bySource.get(key) ?? { source, byItem: new Map<number, DropSource>() };
        const held = cur.byItem.get(id);
        const value = chancePerKill(source.d, source.rolls) * source.bundle;
        const heldValue = held ? chancePerKill(held.d, held.rolls) * held.bundle : -1;
        if (!held || value > heldValue) cur.byItem.set(id, source);
        bySource.set(key, cur);
      }
    }
    if (bySource.size === 0) return { hours: null, floor: 'anyone', note: 'drop rate unknown for the tracked items' };
    const hours: Triplet = [Infinity, Infinity, Infinity];
    let usedAssumedRaidRate = false;
    let usedDefault = false;
    let poolNeeded: number | undefined;
    let poolParty = 1;
    for (const { source, byItem } of bySource.values()) {
      const drops = [...byItem.values()];
      const kt = killTripletForDropSource(rates, source, raidConfig);
      const partySize = source.bossKey
        ? Math.max(1, tile.timeThresholdSeconds ?? kt.partySize)
        : 1;
      const chances = drops.map((d) => partyHitChance(chancePerKill(d.d, d.rolls), partySize));
      // DROPS, not items. A stack counts once per drop: 500 thrownaxes from one 500–1000 drop is ONE
      // drop to wait for, not 500 / 750 of one. So: drops needed = ceil(amount / typical stack).
      const dropChance = tile.perKillCap === 1
        ? source.exclusive && partySize === 1
          ? Math.min(1, chances.reduce((sum, p) => sum + p, 0))
          : 1 - chances.reduce((none, p) => none * (1 - p), 1)
        : chances.reduce((sum, p) => sum + p, 0);
      if (dropChance <= 0) continue;
      const stack = tile.perKillCap === 1
        ? 1
        : drops.reduce((sum, d, i) => sum + chances[i] * d.bundle, 0) / chances.reduce((sum, p) => sum + p, 0);
      const dropsNeeded = Math.max(1, Math.ceil(tile.requiredAmount / Math.max(1, stack)));
      // Player-hours: a raid occupies its whole party; a group boss's drop goes to one of lootSplit.
      const playerHoursPerKill = (b: number) => (kt.sec[b] / 3600) * partySize * kt.lootSplit;
      for (let b = 0; b < 3; b++) {
        const candidate = (dropsNeeded / dropChance) * playerHoursPerKill(b);
        if (candidate < hours[b]) {
          hours[b] = candidate;
          if (b === 1) poolNeeded = dropsNeeded;
        }
      }
      poolParty = Math.max(poolParty, partySize);
      floor = maxFloor(floor, kt.floor);
      usedDefault = usedDefault || kt.defaulted;
      usedAssumedRaidRate = usedAssumedRaidRate || !!source.assumed;
    }
    if (!hours.some(Number.isFinite)) return { hours: null, floor, note: 'no usable rate for the tracked items' };
    const notes = [
      usedDefault ? 'generic kill time used for some sources' : null,
      usedAssumedRaidRate
        ? raidConfig?.uniqueDenominator
          ? 'raid unique chance uses this tile\'s effort calibration'
          : 'raid unique chance uses the clan raid_luck_rates assumption'
        : null,
      raidConfig?.completionMinutes ? 'raid duration uses this tile\'s expected completion time' : null,
    ].filter(Boolean);
    return {
      hours,
      floor,
      note: notes.length ? notes.join('; ') : null,
      campers: poolParty,
      needed: poolNeeded,
    };
  }

  if (type === 'kill') {
    const targets = parseJsonArray<string>(tile.targetNpcs);
    if (!tile.requiredAmount) return { hours: null, floor: 'anyone', note: 'no required amount' };
    const choices = (targets?.length ? targets : ['']).map((target) => {
      const bossLike = BOSS_NAMES.has(normName(target));
      return {
        target,
        rate: killTripletForNames(rates, [target], bossLike ? 'boss' : 'mob'),
      };
    });
    // A multi-target tile means ANY listed target counts. Price the fastest valid choice per band;
    // never let the presence of one superior Slayer monster force the whole "Bloodvelds" family
    // to use the 50-minute superior-encounter rate when ordinary Bloodvelds are also allowed.
    // Player-hours: a raid kill occupies the whole party, so no party discount (see the KC path).
    const hours = [0, 1, 2].map((band) =>
      Math.min(...choices.map(({ rate }) => (tile.requiredAmount! * rate.sec[band]) / 3600)),
    ) as Triplet;
    const averageChoice = choices.reduce((best, choice) => (choice.rate.sec[1] < best.rate.sec[1] ? choice : best));
    return {
      hours,
      floor: averageChoice.rate.floor,
      campers: averageChoice.rate.partySize,
      note: averageChoice.rate.partySize > 1
        ? `raid — player-hours for a ~${averageChoice.rate.partySize}-player party`
        : averageChoice.rate.defaulted
          ? 'generic mob kill time used'
          : null,
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

  if (type === 'lap') {
    if (!tile.requiredAmount) return { hours: null, floor: 'anyone', note: 'no required amount' };
    const courses = parseJsonArray<string>(tile.targetNpcs);
    // Multi-course tiles let a team run whichever course is cheapest, so price the FASTEST
    // listed one — the same "player picks the easy path" assumption the kill model makes.
    const curated = (courses ?? [])
      .map((c) => activityFor(rates, c)?.lapSeconds)
      .filter((s): s is Triplet => !!s);
    const fallback = rates.generic.agilityLapSeconds ?? [45, 58, 75];
    const sec: Triplet = curated.length
      ? ([0, 1, 2].map((b) => Math.min(...curated.map((s) => s[b]))) as Triplet)
      : fallback;
    return {
      hours: sec.map((s) => (tile.requiredAmount! * s) / 3600) as Triplet,
      // The Agility level gate is the real barrier, not the lap time: the level a course needs
      // is what decides who can touch the tile, and the curated floors carry it.
      floor: (courses ?? []).map((c) => activityFor(rates, c)?.floor).find(Boolean) ?? 'anyone',
      note: curated.length ? null : 'generic agility lap time used',
    };
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

function minimumSuggestedPoints(tile: TileEffort): number {
  // A hard speed task is an achievement over and above merely completing the encounter. This is
  // the explicit 150-point prestige floor behind the 65-minute Inferno benchmark; an ordinary
  // elite completion keeps the 100-point floor.
  if (tile.tileType === 'timed' && tile.floor === 'elite') return 150;
  return FLOOR_MIN_POINTS[tile.floor];
}

function suggestionStatus(tile: TileEffort): TileEffort['suggestionStatus'] {
  if (tile.pricingHours == null) return 'unmodelled';
  if (tile.pClass === 'lottery') return 'lottery';
  // Points cannot make a deterministic objective fit inside the event. Suggest shrinking it, not
  // turning it into a five-digit tile that consumes the whole board's score budget.
  if (tile.pClass === 'unreachable') return 'unreachable';
  // A manually supplied end-to-end estimate deliberately supersedes a generic source fallback.
  const manuallyCalibrated = /manual calibration/.test(tile.note ?? '');
  if (!manuallyCalibrated && /generic/.test(tile.note ?? '')) return 'needs-calibration';
  return 'eligible';
}

/**
 * Divide the candidates' EXISTING point budget by marginal difficulty-adjusted effort.
 *
 * Suggestions must not mint 100k extra points merely because the board contains long-tailed
 * grinds. Existing points define the event's scale; effort decides how that fixed pool is
 * redistributed. Lower difficulty floors are applied with a water-filling pass, then the small
 * rounding remainder is assigned where it introduces the least error so the budget remains exact.
 */
function allocateSuggestionBudget(candidates: TileEffort[]): void {
  if (candidates.length === 0) return;
  const budget = candidates.reduce((sum, tile) => sum + tile.weight, 0);
  const rows = candidates.map((tile) => ({
    tile,
    score: Math.max(1e-9, tile.pricingHours! * tile.difficulty),
    floor: minimumSuggestedPoints(tile),
    exact: 0,
    points: 0,
  }));
  const floorTotal = rows.reduce((sum, row) => sum + row.floor, 0);

  // A tiny author budget cannot satisfy every prestige floor. In that unusual case retain the
  // exact budget and allocate from effort with a universal 1-point minimum instead of inflating it.
  if (floorTotal > budget) {
    for (const row of rows) row.floor = budget >= rows.length ? 1 : 0;
  }

  let remaining = budget;
  let active = [...rows];
  while (active.length > 0) {
    const scoreTotal = active.reduce((sum, row) => sum + row.score, 0);
    const scale = remaining / scoreTotal;
    const belowFloor = active.filter((row) => row.score * scale < row.floor);
    if (belowFloor.length === 0) {
      for (const row of active) row.exact = row.score * scale;
      break;
    }
    const fixed = new Set(belowFloor);
    for (const row of belowFloor) {
      row.exact = row.floor;
      remaining -= row.floor;
    }
    active = active.filter((row) => !fixed.has(row));
  }

  // Nice five-point values first (whole points below 20), then repair the rounding delta exactly.
  for (const row of rows) {
    row.points = row.exact >= 20 ? Math.round(row.exact / 5) * 5 : Math.max(row.floor, Math.round(row.exact));
  }
  let delta = budget - rows.reduce((sum, row) => sum + row.points, 0);
  while (delta !== 0) {
    const direction = Math.sign(delta);
    let magnitude = Math.abs(delta) >= 5 ? 5 : 1;
    let step = direction * magnitude;
    let options = rows.filter((row) => row.points + step >= row.floor);
    // Several rows can each sit only 1–4 points above their floor after five-point rounding.
    // Repair those one point at a time instead of giving up with an over-budget result.
    if (options.length === 0 && magnitude === 5) {
      magnitude = 1;
      step = direction;
      options = rows.filter((row) => row.points + step >= row.floor);
    }
    if (options.length === 0) break;
    options.sort((a, b) => {
      const costA = Math.abs(a.points + step - a.exact) - Math.abs(a.points - a.exact);
      const costB = Math.abs(b.points + step - b.exact) - Math.abs(b.points - b.exact);
      return costA - costB || a.tile.tileId - b.tile.tileId;
    });
    options[0].points += step;
    delta -= step;
  }

  for (const row of rows) row.tile.suggestedPoints = row.points;
}

// ---- Board-level audit --------------------------------------------------------------

export function analyzeEffort(
  tiles: Tile[],
  opts: {
    pointsMode: boolean;
    ratesOverride?: unknown;
    raidRatesOverride?: unknown;
    eventDays?: number | null;
    /** Players per team — a team-tracked XP/KC goal is fed by all of them at once. */
    teamSize?: number | null;
  },
): EffortReport {
  const rates = mergeRates(opts.ratesOverride);
  const resolveDrops = dropResolver(opts.raidRatesOverride);
  const scoringMode = opts.pointsMode ? 'points' : 'tiles';
  // Optional tiles and MISSIONS are scored outside the board (missions are a bonus announced
  // mid-event — lib/boardScoring), so neither sets the board's prices nor gets repriced by them.
  const scored = tiles.filter((t) => !t.optional && !isMissionTile(t));

  const perTile: TileEffort[] = scored.map((t) => {
    const type = t.tileType ?? 'standard';
    const estimate = estimateTile(t, rates, resolveDrops);
    const floor = estimate.floor;
    let hours = estimate.hours;
    let note = estimate.note;
    const effortConfig = parseTileEffortConfig(t.effortConfig);
    if (effortConfig?.expectedHours != null) {
      const expected = effortConfig.expectedHours;
      const modelAverage = hours?.[1];
      if (hours && modelAverage != null && Number.isFinite(modelAverage) && modelAverage > 0) {
        const scale = expected / modelAverage;
        hours = hours.map((value) => Number.isFinite(value) ? value * scale : value) as Triplet;
      } else {
        // No usable native spread: a deliberately modest qualified-player band around the
        // author's average. The explicit S0–S5 premium still prices execution separately.
        hours = [expected * 0.8, expected, expected * 1.35];
      }
      note = [note, 'expected effort uses this tile\'s manual calibration'].filter(Boolean).join('; ');
    }
    const weight = tileWeight(scoringMode, t.points ?? 1);
    const avg = hours && Number.isFinite(hours[1]) && hours[1] > 0 ? hours[1] : null;
    const skillRating = effortConfig?.skillRating ?? null;
    const difficulty = skillRating != null ? 1 + 0.05 * skillRating : FLOOR_EFFORT_MULTIPLIER[floor];
    // Assignee-band pricing (plan A2): high/elite tiles price against 60/40 fast/avg — and when
    // the avg band literally can't do it (Infinity) but the fast band can, the fast band alone
    // carries the price: that's exactly the Inferno case, a real tile for the one who'll get it.
    const fast = hours && Number.isFinite(hours[0]) && hours[0] > 0 ? hours[0] : null;
    const gated = floor === 'high' || floor === 'elite';
    const pricingHours = gated && fast != null ? (avg != null ? 0.6 * fast + 0.4 * avg : fast) : avg;
    const effortAvg = pricingHours != null ? pricingHours * difficulty : null;
    // Only genuinely tiny work is excluded from the board's points/hour benchmark. A requirement
    // of one can still be hours of work (rare drop, LMS win, Inferno), so count alone says nothing.
    const count = t.statGoal ?? t.requiredAmount ?? null;
    const oneOff = avg != null && avg < ONE_OFF_TINY_HOURS;
    // Realizability: expected successes in the camp window at the pricing rate (the average band, or
    // the fast-leaning blend for high/elite tiles) → P(≥needed).
    // The window is player-hours, so it widens with the players a tile really draws on at once: a
    // raid party, or — for a team-tracked XP/KC GAIN — the whole team, whose every hour counts.
    const teamGain = !!t.trackedStat && t.statBasis !== 'milestone' && (t.trackingMode ?? 'team') === 'team';
    const campers = Math.max(
      CAMPERS_PER_TILE,
      estimate.campers ?? 1,
      teamGain && opts.teamSize ? Math.round(opts.teamSize) : 0,
    );
    const windowHours = CAMP_HOURS_PER_DAY * campers * Math.max(1, opts.eventDays ?? DEFAULT_EVENT_DAYS);
    let hitProbability: number | null = null;
    let pClass: TileEffort['pClass'] = null;
    if (pricingHours != null) {
      const needed = Math.max(1, estimate.needed ?? count ?? 1);
      hitProbability = poissonTail(needed, needed * (windowHours / pricingHours));
      pClass =
        hitProbability < LOTTERY_P
          ? isRngDriven(t)
            ? 'lottery'
            : 'unreachable'
          : hitProbability < LONG_SHOT_P
            ? 'long-shot'
            : 'grind';
    }
    return {
      tileId: t.id,
      label: t.label,
      tileType: type,
      weight,
      hours,
      floor,
      difficulty,
      skillRating,
      rawPtsPerHour: avg ? weight / avg : null,
      ptsPerHour: effortAvg ? weight / effortAvg : null,
      oneOff,
      pricingHours,
      grossPricingHours: pricingHours,
      overlapCreditHours: 0,
      hitProbability,
      pClass,
      expectedPoints: hitProbability != null ? weight * hitProbability : null,
      suggestedPoints: null, // filled below once the board median is known
      suggestionStatus: 'unmodelled', // finalised after marginal progression pricing
      note,
      pphFlag: null,
    };
  });

  // Marginal progression pricing. All completion odds/hours above remain the full tile requirement;
  // only the fairness denominator changes. That makes the report honest in both directions: "5 KC"
  // still says how long five kills take, while its points recommendation pays for four extra kills
  // when a 1-KC tile on the same board already awards the opener.
  const progressionGroups = new Map<string, { amount: number; effort: TileEffort }[]>();
  scored.forEach((tile, index) => {
    const step = progressionStep(tile);
    const effort = perTile[index];
    if (!step || effort.grossPricingHours == null) return;
    const group = progressionGroups.get(step.key) ?? [];
    group.push({ amount: step.amount, effort });
    progressionGroups.set(step.key, group);
  });
  for (const group of progressionGroups.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.amount - b.amount || a.effort.tileId - b.effort.tileId);
    let priorAmount = -Infinity;
    let priorGross = 0;
    for (const step of group) {
      const gross = step.effort.grossPricingHours!;
      if (step.amount > priorAmount && priorGross > 0 && gross > priorGross) {
        step.effort.overlapCreditHours = priorGross;
        step.effort.pricingHours = gross - priorGross;
        step.effort.rawPtsPerHour = step.effort.weight / step.effort.pricingHours;
        step.effort.ptsPerHour = step.effort.weight / (step.effort.pricingHours * step.effort.difficulty);
        step.effort.note = [
          step.effort.note,
          `${priorGross.toFixed(2)}h credited from an earlier cumulative milestone`,
        ].filter(Boolean).join('; ');
      }
      if (step.amount > priorAmount) {
        priorAmount = step.amount;
        priorGross = Math.max(priorGross, gross);
      }
    }
  }

  const modelled = perTile.filter((t) => t.ptsPerHour != null);
  // The median remains a diagnostic for CURRENT points. It no longer sets suggested values:
  // learning tomorrow's prices from today's bad prices was self-referential, and long-tailed
  // boards could mint several times their entire current score.
  const graded = modelled.filter((t) => !t.oneOff && t.pClass !== 'lottery');
  const pphSorted = graded.map((t) => t.ptsPerHour!).sort((a, b) => a - b);
  const mid = Math.floor(pphSorted.length / 2);
  const medianPph = pphSorted.length
    ? pphSorted.length % 2
      ? pphSorted[mid]
      : (pphSorted[mid - 1] + pphSorted[mid]) / 2
    : null;

  for (const tile of perTile) tile.suggestionStatus = suggestionStatus(tile);
  const suggestionCandidates = perTile.filter((tile) => tile.suggestionStatus === 'eligible');
  if (opts.pointsMode) allocateSuggestionBudget(suggestionCandidates);
  const suggestionBudget = suggestionCandidates.reduce((sum, tile) => sum + tile.weight, 0);
  const suggestedBudget = suggestionCandidates.reduce(
    (sum, tile) => sum + (tile.suggestedPoints ?? tile.weight),
    0,
  );

  const totalWeight = perTile.reduce((s, t) => s + t.weight, 0);
  const eliteWeight = perTile
    .filter((t) => t.floor === 'high' || t.floor === 'elite')
    .reduce((s, t) => s + t.weight, 0);
  const eliteShare = totalWeight ? eliteWeight / totalWeight : 0;

  const checks: BalanceCheck[] = [];
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  // A tile can honestly land in both the underpaid and the doesn't-fit lists — that pairing is the
  // clearest possible signal, so the copy names it instead of leaving two warnings looking redundant.
  const unreachableIds = new Set(perTile.filter((t) => t.pClass === 'unreachable').map((t) => t.tileId));

  if (medianPph && opts.pointsMode && graded.length >= 5) {
    const over = graded.filter((t) => t.ptsPerHour! > medianPph * 3);
    const under = graded.filter((t) => t.ptsPerHour! < medianPph / 3);
    for (const t of over) t.pphFlag = 'over';
    for (const t of under) t.pphFlag = 'under';
    const underAlsoUnreachable = under.filter((t) => unreachableIds.has(t.tileId)).length;
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
        detail:
          `${under.slice(0, 4).map((t) => `"${t.label}"`).join(', ')}${under.length > 4 ? '…' : ''} — too grindy for ` +
          `the points. Raise their points or shrink the requirement.` +
          (underAlsoUnreachable
            ? ` ${underAlsoUnreachable} of these also don't fit inside the event — shrinking those is the fix that solves both.`
            : ''),
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
        `${lotteries.slice(0, 4).map((t) => `"${t.label}"`).join(', ')}${lotteries.length > 4 ? '…' : ''} ` +
        `${lotteries.length === 1 ? 'is a drop-RNG tile that lands' : 'are drop-RNG tiles that land'} within the event ` +
        `with <${Math.round(LOTTERY_P * 100)}% odds even at a serious camp ` +
        `(~${CAMP_HOURS_PER_DAY}h/day × ${CAMPERS_PER_TILE} players). Their ${Math.round(face)} face points are ` +
        `≈${Math.round(expected)} expected — the points can stand (jackpots are fun), but nobody should be ` +
        `assigned to camp these, and board balance should count the expected value, not the face value.`,
      tileIds: lotteries.map((t) => t.tileId),
    });
  }

  // Throughput tiles that don't fit the window. Unlike lotteries these stay in the pts/hour
  // analysis, so a tile can legitimately appear here AND under "pays too little" — that pairing is
  // the useful signal: too big to finish, and underpaid for its size.
  const unreachable = perTile.filter((t) => t.pClass === 'unreachable');
  if (unreachable.length) {
    const worst = [...unreachable].sort((a, b) => (b.hours?.[1] ?? 0) - (a.hours?.[1] ?? 0));
    const windowHours = CAMP_HOURS_PER_DAY * CAMPERS_PER_TILE * Math.max(1, opts.eventDays ?? DEFAULT_EVENT_DAYS);
    checks.push({
      id: 'unreachable-tiles',
      level: 'warn',
      title: `${unreachable.length} tile${unreachable.length === 1 ? " doesn't" : "s don't"} fit inside the event`,
      detail:
        `${worst.slice(0, 4).map((t) => `"${t.label}"`).join(', ')}${unreachable.length > 4 ? '…' : ''} need more ` +
        `hours than the event has — about ${Math.round(worst[0].hours?.[1] ?? 0)}h for the biggest, against ` +
        `~${Math.round(windowHours)}h of serious camping (${CAMP_HOURS_PER_DAY}h/day × ${CAMPERS_PER_TILE} players). ` +
        `Nothing lucky about these: shrink the requirement or raise the points, because as they stand nobody finishes them.`,
      tileIds: unreachable.map((t) => t.tileId),
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

  // Order matters more than it looks: the generic-time caveat qualifies every points-per-hour
  // claim below it, so it leads. Warnings then info, and within each the ones naming specific tiles
  // before the board-shape observations — an author reads top-down and should hit the caveat before
  // the numbers it applies to.
  const RANK: Record<string, number> = {
    'rate-fallback': 0,
    'pph-underpaid': 1,
    'unreachable-tiles': 2,
    'pph-overpaid': 3,
    'inaccessible-average': 4,
  };
  checks.sort((a, b) => (RANK[a.id] ?? 50) - (RANK[b.id] ?? 50));

  return {
    perTile,
    medianPtsPerHour: medianPph,
    modelledCount: modelled.length,
    unmodelledCount: perTile.length - modelled.length,
    suggestionBudget,
    suggestedBudget,
    eliteShare,
    checks,
  };
}
