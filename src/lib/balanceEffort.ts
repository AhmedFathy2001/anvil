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

interface ActivityRate {
  killSeconds?: Triplet;
  attemptMinutes?: Triplet;
  successRate?: Triplet;
  floor?: Floor;
}
interface SkillRate {
  xpPerHour: Triplet;
  floor?: Floor;
}
export interface BalanceRates {
  skills: Record<string, SkillRate>;
  activities: Record<string, ActivityRate>;
  generic: { mobKillSeconds: Triplet; bossKillSeconds: Triplet };
  lms: { gameMinutes: Triplet; placementMultiplier: Triplet };
}

export interface TileEffort {
  tileId: number;
  label: string;
  weight: number;
  /** Expected player-hours [fast, avg, slow]; Infinity = that band can't do it; null = unmodelled. */
  hours: Triplet | null;
  floor: Floor;
  /** Points per expected hour at the average band; null when unmodelled/inaccessible. */
  ptsPerHour: number | null;
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
    lms: { ...base.lms, ...(o.lms as Partial<BalanceRates['lms']> | undefined) },
  };
}

// Boss hiscores key ("kreeArra") → display label ("Kree'Arra"), for stat-boss lookups.
const BOSS_LABEL_BY_KEY = new Map(BOSSES.map((b) => [b.key, b.label]));

function activityFor(rates: BalanceRates, name: string | null | undefined): ActivityRate | null {
  if (!name) return null;
  const k = name.trim().toLowerCase();
  return rates.activities[k] ?? rates.activities[k.replace(/^the /, '')] ?? null;
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

function killTriplet(rates: BalanceRates, source: string): { sec: Triplet; floor: Floor; defaulted: boolean } {
  const act = activityFor(rates, source);
  if (act?.killSeconds) return { sec: act.killSeconds, floor: act.floor ?? 'anyone', defaulted: false };
  return { sec: rates.generic.bossKillSeconds, floor: 'mid', defaulted: true };
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
    // boss KC goal
    const label = BOSS_LABEL_BY_KEY.get(tile.trackedStat) ?? tile.trackedStat;
    const { sec, floor, defaulted } = killTriplet(rates, label);
    return {
      hours: sec.map((s) => (tile.statGoal! * s) / 3600) as Triplet,
      floor,
      note: defaulted ? `no kill-time entry for ${label} — generic boss time used` : null,
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
    const act = targets?.map((t) => activityFor(rates, t)).find((a) => a?.killSeconds);
    const sec = act?.killSeconds ?? rates.generic.mobKillSeconds;
    return {
      hours: sec.map((s) => (tile.requiredAmount! * s) / 3600) as Triplet,
      floor: act?.floor ?? 'anyone',
      note: act ? null : 'generic mob kill time used',
    };
  }

  if (type === 'timed') {
    const act = activityFor(rates, tile.timedActivity);
    if (act?.attemptMinutes && act.successRate) {
      const hours = [0, 1, 2].map((b) =>
        act.successRate![b] > 0 ? (act.attemptMinutes![b] / 60) / act.successRate![b] : Infinity,
      ) as Triplet;
      return { hours, floor: act.floor ?? 'high', note: 'time-cap tightness not modelled — assumes a completion-level cap' };
    }
    if (act?.killSeconds) {
      return {
        hours: act.killSeconds.map((s) => s / 3600) as Triplet,
        floor: act.floor ?? 'mid',
        note: 'assumes the cap is reachable in one clear — cap tightness not modelled',
      };
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
    value: 'haul-value odds not modelled yet',
    valuetotal: 'haul-value odds not modelled yet',
  };
  return { hours: null, floor: 'anyone', note: UNMODELLED[type] ?? 'not modelled' };
}

// ---- Board-level audit --------------------------------------------------------------

export function analyzeEffort(
  tiles: Tile[],
  opts: { pointsMode: boolean; ratesOverride?: unknown },
): EffortReport {
  const rates = mergeRates(opts.ratesOverride);
  const scoringMode = opts.pointsMode ? 'points' : 'tiles';
  const scored = tiles.filter((t) => !t.optional);

  const perTile: TileEffort[] = scored.map((t) => {
    const { hours, floor, note } = estimateTile(t, rates);
    const weight = tileWeight(scoringMode, t.points ?? 1);
    const avg = hours && Number.isFinite(hours[1]) && hours[1] > 0 ? hours[1] : null;
    return {
      tileId: t.id,
      label: t.label,
      weight,
      hours,
      floor,
      ptsPerHour: avg ? weight / avg : null,
      suggestedPoints: null, // filled below once the board median is known
      note,
    };
  });

  const modelled = perTile.filter((t) => t.ptsPerHour != null);
  const pphSorted = modelled.map((t) => t.ptsPerHour!).sort((a, b) => a - b);
  const medianPph = pphSorted.length ? pphSorted[Math.floor(pphSorted.length / 2)] : null;

  if (medianPph && opts.pointsMode) {
    for (const t of perTile) {
      if (t.hours && Number.isFinite(t.hours[1]) && t.hours[1] > 0) {
        const raw = medianPph * t.hours[1];
        t.suggestedPoints = Math.max(1, raw >= 20 ? Math.round(raw / 5) * 5 : Math.round(raw));
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

  if (medianPph && opts.pointsMode && modelled.length >= 5) {
    const over = modelled.filter((t) => t.ptsPerHour! > medianPph * 3);
    const under = modelled.filter((t) => t.ptsPerHour! < medianPph / 3);
    if (over.length) {
      checks.push({
        id: 'pph-overpaid',
        level: 'warn',
        title: `${over.length} tile${over.length === 1 ? ' pays' : 's pay'} >3× the board's points-per-hour`,
        detail: `${over.slice(0, 4).map((t) => `"${t.label}"`).join(', ')}${over.length > 4 ? '…' : ''} — the meta becomes farming these. Suggested points shown in the effort table.`,
        tileIds: over.map((t) => t.tileId),
      });
    }
    if (under.length) {
      checks.push({
        id: 'pph-underpaid',
        level: 'warn',
        title: `${under.length} tile${under.length === 1 ? ' pays' : 's pay'} <⅓ of the board's points-per-hour`,
        detail: `${under.slice(0, 4).map((t) => `"${t.label}"`).join(', ')}${under.length > 4 ? '…' : ''} — nobody rational touches these. Raise their points or shrink the requirement.`,
        tileIds: under.map((t) => t.tileId),
      });
    }
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
