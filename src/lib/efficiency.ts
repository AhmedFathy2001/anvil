// Efficient hours played and efficient hours bossed: how long an account's XP and boss kills would
// take at good, documented rates. Our own model over our own rate tables.
//
// Rates: src/data/hourRates.json, built from the OSRS Wiki by scripts/build-rates-dataset.mjs
// (`npm run data:rates`). Skills carry XP-per-hour bands by level; bosses carry kills per hour.
// Each rate names its wiki page, and our own conservative fills for gaps are marked `estimated`.
//
// The model, kept deliberately simple so anyone can check a number by hand:
//
//   Hours played   For each skill, walk its level bands from 0 XP to the account's XP and add
//                  (XP in band ÷ band rate). Past 99 the top band's rate continues. Hitpoints is the
//                  exception: combat training already hands out a third of its XP as Hitpoints XP,
//                  so only Hitpoints XP beyond that passive share counts, at a third of the melee
//                  rate. Slayer is the other exception: a Slayer task trains combat while it trains
//                  Slayer, about 4 combat XP for every Slayer XP (Slayer XP is the monster's
//                  hitpoints; combat XP is 4 per point of damage). So that much of an account's
//                  Attack, Strength, Defence, Ranged and Magic XP is already paid for by its Slayer
//                  hours and is not counted again; the rest counts at the usual rates.
//   Hours bossed   Σ killcount ÷ kills per hour, for every boss with a rate. The skilling bosses
//                  (Wintertodt, Tempoross, Zalcano) are left out: their time is already in the
//                  Firemaking, Fishing, Mining and Runecraft hours their XP produces.
//
// Pure: no DB, deterministic for a snapshot and account type.

import rateData from '@/data/hourRates.json';
import { SKILLS } from '@/lib/constants';
import type { HiscoresSnapshot } from '@/lib/hiscores';

export const MAX_SKILL_EXP = 200_000_000;
export const SKILL_EXP_AT_99 = 13_034_431;
const HITPOINTS_START_XP = 1_154; // level 10

/** Account shapes with their own rate tables. Everything that isn't an ironman reads `main`. */
export type RateTable = 'main' | 'ironman';

export interface SkillBand {
  fromLevel: number;
  xpPerHour: number;
  source: string | null;
  estimated: boolean;
}
export interface BossRate {
  killsPerHour: number;
  source: string | null;
  estimated: boolean;
}

interface HourRates {
  version: number;
  skills: Record<RateTable, Record<string, SkillBand[]>>;
  bosses: Record<RateTable, Record<string, BossRate>>;
}

const RATES = rateData as unknown as HourRates;
export const RATES_VERSION = RATES.version;

/** Map an account type ('regular', 'ironman', 'hardcore', 'ultimate', 'group'…) onto a rate table. */
export function rateTableFor(accountType: string | null | undefined): RateTable {
  return accountType && /iron|hardcore|ultimate|group/i.test(accountType) ? 'ironman' : 'main';
}

/** XP needed for a level, from the game's own formula. */
export function xpForLevel(level: number): number {
  let points = 0;
  for (let n = 1; n < level; n++) points += Math.floor(n + 300 * Math.pow(2, n / 7));
  return Math.floor(points / 4);
}

interface XpBand {
  startXp: number;
  rate: number;
}

const bandCache = new Map<string, XpBand[]>();
function xpBands(table: RateTable, skill: string): XpBand[] {
  const key = `${table}:${skill}`;
  const hit = bandCache.get(key);
  if (hit) return hit;
  const bands = (RATES.skills[table]?.[skill] ?? RATES.skills.main[skill] ?? [])
    .filter((b) => b.xpPerHour > 0)
    .sort((a, b) => a.fromLevel - b.fromLevel)
    .map((b) => ({ startXp: b.fromLevel <= 1 ? 0 : xpForLevel(b.fromLevel), rate: b.xpPerHour }));
  if (bands.length && bands[0].startXp > 0) bands[0] = { ...bands[0], startXp: 0 };
  bandCache.set(key, bands);
  return bands;
}

/** Hours to take a skill from 0 XP to `xp` at the band rates. */
export function skillHours(table: RateTable, skill: string, xp: number): number {
  const bands = xpBands(table, skill);
  if (!bands.length || !(xp > 0)) return 0;
  let hours = 0;
  for (let i = 0; i < bands.length; i++) {
    const from = bands[i].startXp;
    const to = i + 1 < bands.length ? bands[i + 1].startXp : Infinity;
    if (xp <= from) break;
    hours += (Math.min(xp, to) - from) / bands[i].rate;
  }
  return hours;
}

/** Hitpoints XP that combat training didn't already explain, in hours at a third of the melee rate. */
function hitpointsHours(table: RateTable, xp: Map<string, number>): number {
  const hp = xp.get('hitpoints') ?? 0;
  const combat = ['attack', 'strength', 'defence', 'ranged'].reduce((acc, s) => acc + (xp.get(s) ?? 0), 0);
  const passive = HITPOINTS_START_XP + combat / 3;
  const extra = hp - passive;
  if (!(extra > 0)) return 0;
  // Training Hitpoints deliberately means training melee: Hitpoints arrives at a third of that rate.
  return (skillHours(table, 'attack', hp) - skillHours(table, 'attack', passive)) * 3;
}

const TRAINABLE = SKILLS.filter((s) => s !== 'overall');

/** The skills a Slayer task trains alongside Slayer. */
export const COMBAT_SKILLS = ['attack', 'strength', 'defence', 'ranged', 'magic'] as const;
/** Combat XP earned per Slayer XP: Slayer XP is the monster's hitpoints, combat XP 4 per damage dealt. */
export const COMBAT_XP_PER_SLAYER_XP = 4;
/** Bosses whose kill count is skilling: counted in hours played through their XP, not in hours bossed. */
export const SKILLING_BOSSES = new Set(['wintertodt', 'tempoross', 'zalcano']);

/** The share of an account's combat XP its Slayer hours do NOT already explain (0 to 1). */
export function combatShareBeyondSlayer(xp: Map<string, number>): number {
  const combat = COMBAT_SKILLS.reduce((acc, s) => acc + (xp.get(s) ?? 0), 0);
  if (!(combat > 0)) return 1;
  const explained = (xp.get('slayer') ?? 0) * COMBAT_XP_PER_SLAYER_XP;
  return Math.max(0, 1 - explained / combat);
}

export interface EfficiencyResult {
  /** Efficient hours played. */
  ehp: number;
  /** Efficient hours bossed. */
  ehb: number;
  /** The part of `ehp` that is combat training (Attack, Strength, Defence, Ranged, Magic, Hitpoints). */
  combat: number;
  ehpBySkill: Record<string, number>;
  ehbByBoss: Record<string, number>;
  /** Hours from here to 99 in every skill, and to 200m in every skill. */
  ttm: number;
  tt200m: number;
}

export function experienceMap(snapshot: HiscoresSnapshot): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of TRAINABLE) {
    const xp = snapshot.skills?.[s]?.xp;
    out.set(s, typeof xp === 'number' && xp > 0 ? xp : 0);
  }
  return out;
}

export function killcountMap(snapshot: HiscoresSnapshot): Map<string, number> {
  const out = new Map<string, number>();
  for (const [boss, v] of Object.entries(snapshot.bosses ?? {})) {
    if (v && typeof v.score === 'number' && v.score > 0) out.set(boss, v.score);
  }
  return out;
}

function playedHours(table: RateTable, xp: Map<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  const beyondSlayer = combatShareBeyondSlayer(xp);
  for (const s of TRAINABLE) {
    const hours = s === 'hitpoints' ? hitpointsHours(table, xp) : skillHours(table, s, xp.get(s) ?? 0);
    out[s] = (COMBAT_SKILLS as readonly string[]).includes(s) ? hours * beyondSlayer : hours;
  }
  return out;
}

const COMBAT_HOUR_SKILLS = new Set<string>([...COMBAT_SKILLS, 'hitpoints']);
const combatHours = (bySkill: Record<string, number>) => Object.entries(bySkill).reduce((acc, [s, h]) => (COMBAT_HOUR_SKILLS.has(s) ? acc + h : acc), 0);

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

export function computeEfficiency(snapshot: HiscoresSnapshot, table: RateTable = 'main'): EfficiencyResult {
  const xp = experienceMap(snapshot);
  const ehpBySkill = playedHours(table, xp);

  const ehbByBoss: Record<string, number> = {};
  const bossRates = RATES.bosses[table] ?? RATES.bosses.main;
  for (const [boss, kc] of killcountMap(snapshot)) {
    if (SKILLING_BOSSES.has(boss)) continue;
    const rate = bossRates[boss]?.killsPerHour;
    if (rate && rate > 0) ehbByBoss[boss] = kc / rate;
  }

  const ehp = sum(ehpBySkill);
  const at = (target: number) => {
    const goal = new Map([...xp].map(([s, v]) => [s, Math.max(v, target)]));
    return sum(playedHours(table, goal)) - ehp;
  };
  return {
    ehp,
    ehb: sum(ehbByBoss),
    combat: combatHours(ehpBySkill),
    ehpBySkill,
    ehbByBoss,
    ttm: Math.max(0, at(SKILL_EXP_AT_99)),
    tt200m: Math.max(0, at(MAX_SKILL_EXP)),
  };
}

/** Just the two headline numbers (the old call shape; `ehp`/`ehb` are internal field names). */
export function computeEhpEhb(snapshot: HiscoresSnapshot, table: RateTable = 'main'): { ehp: number; ehb: number; combat: number } {
  // The hot-path version: no per-key breakdown, no time-to-goal sums.
  const bySkill = playedHours(table, experienceMap(snapshot));
  const ehp = sum(bySkill);
  const bossRates = RATES.bosses[table] ?? RATES.bosses.main;
  let ehb = 0;
  for (const [boss, kc] of killcountMap(snapshot)) {
    if (SKILLING_BOSSES.has(boss)) continue;
    const rate = bossRates[boss]?.killsPerHour;
    if (rate && rate > 0) ehb += kc / rate;
  }
  return { ehp, ehb, combat: combatHours(bySkill) };
}

/**
 * The model as it stood before Slayer's combat XP stopped counting twice and the skilling bosses
 * left hours bossed. Kept for one job: recognising a stored number that was written by it, so a
 * running efficiency competition's baseline can be moved to today's model (lib/efficiencyRebase).
 */
export function legacyEhpEhb(snapshot: HiscoresSnapshot, table: RateTable = 'main'): { ehp: number; ehb: number } {
  const xp = experienceMap(snapshot);
  let ehp = 0;
  for (const s of TRAINABLE) ehp += s === 'hitpoints' ? hitpointsHours(table, xp) : skillHours(table, s, xp.get(s) ?? 0);
  const bossRates = RATES.bosses[table] ?? RATES.bosses.main;
  let ehb = 0;
  for (const [boss, kc] of killcountMap(snapshot)) {
    const rate = bossRates[boss]?.killsPerHour;
    if (rate && rate > 0) ehb += kc / rate;
  }
  return { ehp, ehb };
}

/** Same numbers, named for what they are. */
export function computeEfficientHours(snapshot: HiscoresSnapshot, table: RateTable = 'main'): { ehp: number; ehb: number } {
  const { ehp, ehb } = computeEhpEhb(snapshot, table);
  return { ehp, ehb };
}

/** Kills per hour for a hiscores boss key, or null without a rate. */
export function bossKillsPerHour(boss: string, table: RateTable = 'main'): number | null {
  return (RATES.bosses[table] ?? RATES.bosses.main)[boss]?.killsPerHour ?? null;
}

/** The rate entry (with its wiki source) for a boss. */
export function bossRate(boss: string, table: RateTable = 'main'): BossRate | null {
  return (RATES.bosses[table] ?? RATES.bosses.main)[boss] ?? null;
}

/** XP per hour for a skill at a level (the band that level falls in). */
export function xpPerHourAt(skill: string, level: number, table: RateTable = 'main'): number | null {
  const bands = (RATES.skills[table]?.[skill] ?? RATES.skills.main[skill] ?? []).slice().sort((a, b) => a.fromLevel - b.fromLevel);
  let rate: number | null = null;
  for (const b of bands) if (b.fromLevel <= level) rate = b.xpPerHour;
  return rate ?? bands[0]?.xpPerHour ?? null;
}

/** Hours to gain `xp` in a skill starting from `fromXp` at the band rates. */
export function hoursForXp(skill: string, fromXp: number, xp: number, table: RateTable = 'main'): number {
  return skillHours(table, skill, fromXp + xp) - skillHours(table, skill, fromXp);
}
