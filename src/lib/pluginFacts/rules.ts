/**
 * The rule table a plugin with capability `rules` runs on (GET /api/plugin/rules).
 *
 * It tells the client only what it must decide ON THE SPOT: what deserves a screenshot (the frame is
 * gone by the time the site could answer) and what to say in chat right away. Which tile a fact
 * credits, and by how much, is the site's (lib/pluginFacts/match); a rule's `have`/`of` is just the
 * client's starting point for its instant chat line, corrected by every facts reply.
 *
 * Built from the exact config the plugin tracks (the config route's body), so the two never disagree.
 */
import { statKeys } from '@/lib/tileKinds';
import { kcNamesForKey } from '@/lib/pluginStats';
import { killTargetKey, type DropTile, type KillTile, type ValueTile } from '@/lib/pluginFacts/match';

export interface StatTileIn {
  tileId: number;
  label: string;
  statName: string;
  statType: 'skill' | 'boss' | 'kc' | string;
  currentAmount: number;
  goalAmount: number;
  partOf?: number | null;
}

export interface RulesConfigIn {
  trackedDrops?: (DropTile & { partOf?: number | null })[] | null;
  trackedKills?: KillTile[] | null;
  trackedValues?: ValueTile[] | null;
  trackedStats?: StatTileIn[] | null;
  completedTiles?: { tileId: number }[] | null;
}

export interface DropRule {
  t: number;
  label: string;
  have: number;
  of: number;
  /** Accepted source kinds; absent = anything but PvP. */
  src?: string[];
  /** Loot source names that count (wiki-named; the client compares without the "(qualifier)"). */
  npcs?: string[];
  /** The client may count this tile itself for its chat line: one item = one credit, capped at `of`. */
  simple: boolean;
}

export interface KillRule {
  t: number;
  label: string;
  have: number;
  of: number;
  unit: string;
  /** A cap counter: counted, never a chat line. */
  quiet?: boolean;
  /** Attach the client's view of its company (shared-kill credit). */
  coop?: boolean;
}

export interface ValueRule {
  t: number;
  label: string;
  /** A single haul at least this big counts; 0 for a running-total tile (every haul counts). */
  min: number;
  have: number;
  of: number;
  src?: string[];
}

export interface StatRule {
  t: number;
  label: string;
  /** "xp" (skill) or "kc" (boss / activity count). */
  on: 'xp' | 'kc';
  /** The game names that feed it (a composite tile lists several), as {@link statRuleName} spells them. */
  names: string[];
  have: number;
  of: number;
  /** Chat line every `step` gained; 0 = completion only (a small requirement). */
  step: number;
  /** XP only: announce a step only with gains in ≥ active[0] distinct minutes of the last active[1]. */
  active?: [number, number];
}

export interface RuleTable {
  v: 1;
  /** item id → drop rules (any hit is screenshot-worthy). */
  drops: Record<string, DropRule[]>;
  /** lowercase kill-target key → kill rules. */
  kills: Record<string, KillRule[]>;
  values: ValueRule[];
  stats: StatRule[];
  /** Kill proof policy: tiles with `of` ≥ min screenshot only on `frac` steps (and completion). */
  proof: { min: number; frac: number };
  /** Chat templates; {label} {have} {of} {unit} {pct} are filled in by the client. */
  say: Record<string, string>;
  /** Every drop tile is done (and there is at least one): the client stops counting item gains. */
  blackout: boolean;
}

/** Where a sustained-activity gate sits for XP lines: gains in 5 distinct minutes of the last 10. */
export const XP_ACTIVE: [number, number] = [5, 10];

/**
 * About a tenth of the requirement, rounded to a clean number (1 / 2 / 2.5 / 5 × a power of ten).
 * Small requirements announce completion only: under 10 for counts, under 10k for XP.
 */
export function statStep(of: number, on: 'xp' | 'kc'): number {
  if (!(of > 0) || of < (on === 'xp' ? 10_000 : 10)) return 0;
  const raw = of / 10;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  const nice = m < 1.5 ? 1 : m < 2.25 ? 2 : m < 3.75 ? 2.5 : m < 7.5 ? 5 : 10;
  return Math.max(1, Math.round(nice * p));
}

/** A stat name reduced to lowercase letters and digits ("Kree'Arra", "kree arra" → "kreearra"); the plugin folds the KC line / skill the same way. */
export function statRuleName(n: string): string {
  return n.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isSimpleDrop(d: DropTile): boolean {
  return !d.itemRequirements?.length && d.countMode !== 'distinct' && !(d.perKillCap ?? 0) && !(d.partySize ?? 0);
}


export function buildRuleTable(cfg: RulesConfigIn): RuleTable {
  const done = new Set((cfg.completedTiles ?? []).map((c) => c.tileId));
  const drops: Record<string, DropRule[]> = {};
  for (const d of cfg.trackedDrops ?? []) {
    const perItem = !!d.itemRequirements?.length;
    if (perItem ? done.has(d.tileId) : d.currentAmount >= d.requiredAmount) continue;
    const ids = perItem ? d.itemRequirements!.map((r) => r.itemId) : d.itemIds ?? [];
    const rule: DropRule = {
      t: d.tileId,
      label: d.label,
      have: d.currentAmount,
      of: d.requiredAmount,
      simple: isSimpleDrop(d),
      ...(d.acceptedSources?.length ? { src: d.acceptedSources } : {}),
      ...(d.sourceNpcs?.length ? { npcs: d.sourceNpcs } : {}),
    };
    for (const id of new Set(ids)) (drops[id] ??= []).push(rule);
  }

  const kills: Record<string, KillRule[]> = {};
  for (const k of cfg.trackedKills ?? []) {
    if (k.currentAmount >= k.requiredAmount) continue;
    const cap = k.capOf != null && k.capOf > 0;
    if (cap && done.has(k.capOf!)) continue;
    const rule: KillRule = {
      t: k.tileId,
      label: k.label,
      have: k.currentAmount,
      of: k.requiredAmount,
      unit: k.unit?.trim() || 'kill',
      ...(cap ? { quiet: true } : {}),
      ...((k.coopCredit ?? '').toLowerCase() === 'per-kill' || (k.coopMinMembers ?? 0) > 0 ? { coop: true } : {}),
    };
    for (const target of k.targetNpcs ?? []) {
      const key = killTargetKey(target);
      if (key && !(kills[key] ??= []).includes(rule)) kills[key].push(rule);
    }
  }

  const values: ValueRule[] = (cfg.trackedValues ?? [])
    .filter((v) => !v.completed)
    .map((v) => {
      const total = (v.mode ?? '').toLowerCase() === 'total';
      return {
        t: v.tileId,
        label: v.label,
        min: total ? 0 : v.thresholdGp,
        have: total ? Math.min(v.currentGp ?? 0, v.thresholdGp) : 0,
        of: v.thresholdGp,
        ...(v.sources?.length ? { src: v.sources } : {}),
      };
    });

  const stats: StatRule[] = [];
  for (const s of cfg.trackedStats ?? []) {
    if (done.has(s.tileId) || !(s.goalAmount > 0) || s.currentAmount >= s.goalAmount) continue;
    const on: 'xp' | 'kc' = s.statType === 'skill' ? 'xp' : 'kc';
    // A composite tile lists several keys; a boss key answers to every name its KC line can carry.
    const keys = statKeys(s.statName);
    const names = (on === 'kc' ? keys.flatMap((k) => { const n = kcNamesForKey(k); return n.length ? n : [k]; }) : keys)
      .map(statRuleName)
      .filter(Boolean);
    if (names.length === 0) continue;
    stats.push({
      t: s.tileId,
      label: s.label,
      on,
      names: [...new Set(names)],
      have: s.currentAmount,
      of: s.goalAmount,
      step: statStep(s.goalAmount, on),
      ...(on === 'xp' ? { active: XP_ACTIVE } : {}),
    });
  }

  const allDrops = cfg.trackedDrops ?? [];
  return {
    v: 1,
    blackout: allDrops.length > 0 && allDrops.every((d) => d.currentAmount >= d.requiredAmount),
    drops,
    kills,
    values,
    stats,
    proof: { min: 25, frac: 0.25 },
    say: {
      drop: 'Tracked drop: {label} ({have}/{of})',
      dropPlain: 'Tracked drop: {label}',
      kill: 'Tracked {unit}: {label} ({have}/{of})',
      value: 'Loot worth {gp} counted: {label}',
      xp: '{label}: {have}/{of} xp ({pct}%)',
      kc: '{label}: {have}/{of} ({pct}%)',
      done: 'Tile complete: {label}!',
    },
  };
}
