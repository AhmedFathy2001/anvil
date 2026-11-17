// Item hunt: the fourth competition kind, beside Skill of the Week, Boss of the Week and the
// Efficiency race. Everyone on the roster is entered; the standings are DROPS, not a hiscores gain.
//
// A hunt is a row in weekly_competitions with type 'hunt' and its rules in the `hunt` column (JSON,
// HuntConfig below). `metric` holds the targets as a person reads them ("Uncut onyx from Zulrah"),
// so every surface that only knows type + metric still names the hunt correctly.
//
// WHAT COUNTS. A drop reported by the Anvil plugin (the same reports the highlight feed reads,
// POST /api/plugin/moments), or a manual proof: a screenshot with the kill count or XP at the drop,
// approved by staff. Both land in hunt_drops; nothing else scores.
//
// PURE: no database, no datasets. The form (a client component), the routes and the tests all read
// the rules from here. Source matching is the drop tiles' own (lib/pluginFacts/match sourceMatches).

import { BOSSES, RAIDS_ANY_MODE, SKILL_LABELS, bossMetricLabel } from '@/lib/constants';
import { dropCounts } from '@/lib/h2hRules';
import { PET_GROUPS } from '@/lib/petGroups';
import { sourceMatches } from '@/lib/pluginFacts/match';

export type HuntRule = 'first' | 'most';
export type HuntCountMode = 'drops' | 'quantity';

export interface HuntItem {
  id: number;
  name: string;
  /** Where a drop has to come from to count. Empty = any source. */
  sources: string[];
  /** 'drops' counts each drop once; 'quantity' adds up the stack (stackables). */
  count: HuntCountMode;
}

export interface HuntConfig {
  v: 1;
  target: 'items' | 'pets';
  items: HuntItem[];
  /** target 'pets': a lib/petGroups key; 'all' is "any pet". */
  petGroup: string | null;
  rule: HuntRule;
  /** rule 'first' only: the hunt ends the moment the first drop lands. */
  endOnFirst: boolean;
  /** Hiscores boss keys (comma-joined, lib/constants metricKeys) behind "kills at the source". */
  killsOf: string | null;
  /** Shown instead when there is no kill count to show: XP gained in this skill. */
  xpSkill: string | null;
  /**
   * Set when "end when the first one lands" closed the hunt early: the end it was planned to have.
   * A repeating hunt starts its next run from here, at full length, not from the early finish.
   */
  plannedEnd?: string | null;
}

export const MAX_HUNT_ITEMS = 12;
export const MAX_HUNT_SOURCES = 12;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export function isHunt(type: string | null | undefined): boolean {
  return type === 'hunt';
}

export function petGroupOf(key: string | null | undefined) {
  return PET_GROUPS.find((g) => g.key === key) ?? null;
}

/** The stored rules, or null when the column is empty or unreadable. */
export function parseHunt(raw: string | null | undefined): HuntConfig | null {
  if (!raw) return null;
  try {
    const checked = huntFromInput(JSON.parse(raw), { lenient: true });
    return checked.ok ? checked.config : null;
  } catch {
    return null;
  }
}

export function serializeHunt(config: HuntConfig): string {
  return JSON.stringify(config);
}

/**
 * Check what the create form posted. `lenient` is for re-reading a stored config: the same shape
 * rules, without the "you have to choose" refusals a person can still act on.
 */
export function huntFromInput(
  input: unknown,
  opts: { lenient?: boolean } = {},
): { ok: true; config: HuntConfig } | { ok: false; error: string } {
  const body = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const target = body.target === 'pets' ? 'pets' : 'items';
  const rule: HuntRule = body.rule === 'most' ? 'most' : body.rule === 'first' ? 'first' : (null as never);
  if (!rule) return { ok: false, error: 'Pick the rule: first to get it, or most by the end.' };

  const items: HuntItem[] = [];
  let petGroup: string | null = null;
  if (target === 'pets') {
    petGroup = typeof body.petGroup === 'string' ? body.petGroup : 'all';
    if (!petGroupOf(petGroup)) return { ok: false, error: 'Pick a pet group.' };
  } else {
    const raw = Array.isArray(body.items) ? body.items : [];
    const seen = new Set<number>();
    for (const r of raw.slice(0, MAX_HUNT_ITEMS)) {
      const it = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
      const id = typeof it.id === 'number' && Number.isInteger(it.id) && it.id > 0 ? it.id : null;
      const name = typeof it.name === 'string' ? it.name.trim().slice(0, 80) : '';
      if (id == null || !name || seen.has(id)) continue;
      seen.add(id);
      const byKey = new Map<string, string>();
      for (const s of Array.isArray(it.sources) ? it.sources : []) {
        if (typeof s !== 'string' || !s.trim()) continue;
        if (!byKey.has(norm(s))) byKey.set(norm(s), s.trim().slice(0, 80));
      }
      const sources = [...byKey.values()].slice(0, MAX_HUNT_SOURCES);
      // The form sends anySource: true when the organiser chose "Any source" on purpose. No sources
      // and no such choice is an item nobody decided about.
      if (!opts.lenient && sources.length === 0 && it.anySource !== true) {
        return { ok: false, error: `Choose where ${name} counts from: one or more sources, or any source.` };
      }
      items.push({ id, name, sources, count: it.count === 'quantity' ? 'quantity' : 'drops' });
    }
    if (items.length === 0) return { ok: false, error: 'Pick at least one item to hunt.' };
  }

  const killsOf =
    typeof body.killsOf === 'string' && body.killsOf.trim()
      ? body.killsOf.split(',').map((k) => k.trim()).filter((k) => BOSSES.some((b) => b.key === k)).join(',') || null
      : null;
  const xpSkill =
    !killsOf && typeof body.xpSkill === 'string' && body.xpSkill !== 'overall' && SKILL_LABELS[body.xpSkill] ? body.xpSkill : null;

  return {
    ok: true,
    config: {
      v: 1,
      target,
      items,
      petGroup,
      rule,
      endOnFirst: rule === 'first' && body.endOnFirst === true,
      killsOf,
      xpSkill,
      ...(opts.lenient && typeof body.plannedEnd === 'string' ? { plannedEnd: body.plannedEnd } : {}),
    },
  };
}

// ── Words ─────────────────────────────────────────────────────────────────────────────────────

/** 'Item hunt' or 'Pet hunt'. */
export function huntKindWord(config: HuntConfig | null): string {
  return config?.target === 'pets' ? 'Pet hunt' : 'Item hunt';
}

export function huntRuleWords(config: HuntConfig | null): string {
  return config?.rule === 'most' ? 'most by the end' : 'first to get it';
}

function sourcesWords(sources: string[]): string {
  if (sources.length === 0) return ', any source';
  if (sources.length <= 2) return ` from ${sources.join(' or ')}`;
  return ` from ${sources[0]} or ${sources.length - 1} more`;
}

/**
 * The targets as a person reads them: "Uncut onyx from Zulrah", "Uncut onyx, any source",
 * "Tanzanite fang + Magic fang from Zulrah", "Any pet", "Skilling pets". Stored as the
 * competition's `metric`.
 */
export function huntTargetsLabel(config: HuntConfig): string {
  if (config.target === 'pets') {
    const group = petGroupOf(config.petGroup);
    return !group || group.key === 'all' ? 'Any pet' : group.label;
  }
  const shown = config.items.slice(0, 3);
  const more = config.items.length - shown.length;
  const sameSources = config.items.every(
    (it) => it.sources.map(norm).sort().join('|') === config.items[0].sources.map(norm).sort().join('|'),
  );
  const names = sameSources
    ? shown.map((it) => it.name).join(' + ') + (more > 0 ? ` + ${more} more` : '') + sourcesWords(config.items[0].sources)
    : shown.map((it) => it.name + sourcesWords(it.sources)).join(' + ') + (more > 0 ? ` + ${more} more` : '');
  return names.slice(0, 160);
}

/** "Uncut onyx from Zulrah · most by the end" */
export function huntLine(config: HuntConfig | null, metric: string): string {
  return `${config ? huntTargetsLabel(config) : metric} · ${huntRuleWords(config)}`;
}

/** "Item hunt: Tumeken's shadow from Tombs of Amascut · first to get it" */
export function huntTitleLine(config: HuntConfig | null, metric: string): string {
  return `${huntKindWord(config)}: ${huntLine(config, metric)}`;
}

/** A default name for the competition. */
export function defaultHuntTitle(config: HuntConfig): string {
  const label = config.target === 'pets' ? huntTargetsLabel(config) : config.items.map((i) => i.name).slice(0, 2).join(' + ') + (config.items.length > 2 ? ' + more' : '');
  return `${huntKindWord(config)}: ${label}`.slice(0, 100);
}

/** "2 drops", "1 drop", "14 in all" is left to the caller; this is the count with its noun. */
export function huntCountWords(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? 'drop' : 'drops'}`;
}

/** The stat a hunt's participants carry a baseline for: kills at the source, else XP, else nothing. */
export function huntStat(config: HuntConfig | null): { type: 'boss' | 'skill'; metric: string } | null {
  if (!config) return null;
  if (config.killsOf) return { type: 'boss', metric: config.killsOf };
  if (config.xpSkill) return { type: 'skill', metric: config.xpSkill };
  return null;
}

export function huntStatLabel(config: HuntConfig | null): string | null {
  const stat = huntStat(config);
  if (!stat) return null;
  return stat.type === 'boss' ? bossMetricLabel(stat.metric) : SKILL_LABELS[stat.metric] ?? stat.metric;
}

/**
 * The hiscores boss a source name is, when it is one: "Zulrah" → 'zulrah', "Chambers of Xeric" →
 * both modes. Label match only, on purpose: a source that is not a hiscores boss has no kill count,
 * and the standings then show nothing rather than a wrong number.
 */
export function bossKeyForSource(source: string): string | null {
  const s = norm(source);
  const raid = RAIDS_ANY_MODE.find((r) => norm(r.label.replace(/\s*\(any mode\)$/i, '')) === s);
  if (raid) return raid.key;
  return BOSSES.find((b) => norm(b.label) === s)?.key ?? null;
}

/**
 * "Kills at the source" for a set of items: every chosen source has to be a hiscores boss, or there
 * is no honest sum to show. Any-source items give none (the organiser may pick a boss instead).
 */
export function killsOfForItems(items: HuntItem[]): string | null {
  const keys = new Set<string>();
  for (const it of items) {
    if (it.sources.length === 0) return null;
    for (const src of it.sources) {
      const key = bossKeyForSource(src);
      if (!key) return null;
      for (const k of key.split(',')) keys.add(k);
    }
  }
  return keys.size > 0 ? [...keys].join(',') : null;
}

// ── Matching one report ─────────────────────────────────────────────────────────────────────

/** One plugin report, as the moments ingest parsed it (lib/moments Observation, the fields used here). */
export interface HuntReport {
  kind: string;
  itemId?: number | null;
  itemName?: string | null;
  quantity?: number | null;
  source?: string | null;
  kc?: number | null;
  occurredAt: string;
  dedupKey: string;
}

export interface HuntHit {
  /** Null only for a pet the plugin could not name. */
  itemId: number | null;
  itemName: string;
  quantity: number;
  source: string | null;
}

/**
 * Is this report one of the hunt's targets, from a source the hunt accepts?
 *
 * ITEMS: a 'drop' (a loot event, or a collection-log unlock the plugin reports as one) or a 'clog'
 * line, matched by item id, else by name (a clog line carries only the name). A restricted item
 * counts only when the reported source is one of its sources, by the drop tiles' own matcher; a
 * report with no source counts only under "any source".
 *
 * PETS: a 'pet' report (or the pet arriving as a drop/log line). "Any pet" takes every one, named
 * or not; a group takes the pets on its list. A pet follows its own source, so none is checked.
 */
export function matchHuntReport(config: HuntConfig, report: HuntReport): HuntHit | null {
  if (report.kind !== 'drop' && report.kind !== 'clog' && report.kind !== 'pet') return null;
  const name = report.itemName?.trim() || null;
  const quantity = Math.max(1, Math.floor(report.quantity ?? 1));
  const source = report.source?.trim() || null;

  if (config.target === 'pets') {
    const group = petGroupOf(config.petGroup);
    if (!group) return null;
    const pet = group.items.find((p) => (report.itemId != null && p.id === report.itemId) || (name != null && norm(p.name) === norm(name)));
    if (pet) return { itemId: pet.id, itemName: pet.name, quantity: 1, source };
    // A pet line the plugin never got a name for: still a pet, so "any pet" counts it.
    if (report.kind === 'pet' && group.key === 'all' && report.itemId == null && name == null) {
      return { itemId: null, itemName: 'A pet', quantity: 1, source };
    }
    return null;
  }

  const item = config.items.find((it) => (report.itemId != null && it.id === report.itemId) || (name != null && norm(it.name) === norm(name)));
  if (!item) return null;
  if (item.sources.length > 0 && !sourceMatches(item.sources, source)) return null;
  return { itemId: item.id, itemName: item.name, quantity, source };
}

/** May a manual proof name this source for this item? Any source when the item is unrestricted. */
export function manualSourceAllowed(config: HuntConfig, itemId: number | null, source: string | null): boolean {
  if (config.target === 'pets') return true;
  const item = config.items.find((it) => it.id === itemId);
  if (!item) return false;
  if (item.sources.length === 0) return true;
  return sourceMatches(item.sources, source);
}

// ── One drop, reported more than once ────────────────────────────────────────────────────────

/** Same window lib/momentsStore uses for one drop seen twice (SAME_DROP_MS). */
export const SAME_DROP_MS = 90_000;
/** Two loot reports of the same item from the same source this close are one kill read twice. */
export const DOUBLE_FIRE_MS = 5_000;

export interface DropSighting {
  kind: string;
  itemId: number | null;
  itemName: string | null;
  source: string | null;
  kc: number | null;
  quantity: number;
  atMs: number;
  dedupKey: string;
}

function sameItem(a: DropSighting, b: DropSighting): boolean {
  if (a.itemId != null && b.itemId != null) return a.itemId === b.itemId;
  // A pet nobody named yet is whichever pet arrives beside it.
  if (a.itemId == null && a.kind === 'pet') return true;
  if (b.itemId == null && b.kind === 'pet') return true;
  return !!a.itemName && !!b.itemName && norm(a.itemName) === norm(b.itemName);
}

/**
 * Are these two reports the SAME drop?
 *
 * The game says everything more than once: a kill fires two loot events, a first-time drop also
 * fires a collection-log line, a pet fires its own line and then the log line that names it. The
 * plugin gives each occurrence a key (kind, source, item, ten-second bucket) and the same key is
 * always the same drop. Beyond the key:
 *
 *   - a loot report and a log line / pet line for one item, or two reports where one has no source
 *     yet, within SAME_DROP_MS are one drop (the rule lib/momentsStore sameDropNearby applies);
 *   - two loot reports that both name the same source are one drop only within DOUBLE_FIRE_MS (one
 *     kill read twice across a bucket edge). Further apart they are two kills, which is what lets
 *     "most by the end" count a common item properly;
 *   - two different named sources are always two drops.
 */
export function isSameDrop(a: DropSighting, b: DropSighting): boolean {
  if (a.dedupKey === b.dedupKey) return true;
  if (!sameItem(a, b)) return false;
  const gap = Math.abs(a.atMs - b.atMs);
  if (gap > SAME_DROP_MS) return false;
  if (a.source && b.source) {
    if (norm(a.source) !== norm(b.source)) return false;
    if (a.kind === b.kind) return gap <= DOUBLE_FIRE_MS;
  }
  return true;
}

/**
 * What a second sighting adds to the stored one: the source, kill count, name or id it was missing,
 * and the larger stack. Null when it adds nothing.
 */
export function mergeSighting(stored: DropSighting, next: DropSighting): Partial<Pick<DropSighting, 'itemId' | 'itemName' | 'source' | 'kc' | 'quantity'>> | null {
  const patch: Partial<Pick<DropSighting, 'itemId' | 'itemName' | 'source' | 'kc' | 'quantity'>> = {};
  if (stored.itemId == null && next.itemId != null) patch.itemId = next.itemId;
  if ((stored.itemId == null || !stored.itemName) && next.itemName) patch.itemName = next.itemName;
  if (!stored.source && next.source) patch.source = next.source;
  if (stored.kc == null && next.kc != null) patch.kc = next.kc;
  if (next.quantity > stored.quantity) patch.quantity = next.quantity;
  return Object.keys(patch).length > 0 ? patch : null;
}

// ── Standings ───────────────────────────────────────────────────────────────────────────────

export interface HuntDrop {
  id: number;
  /** Who it belongs to: the participant's normalised name. */
  rsnKey: string;
  itemId: number | null;
  itemName: string;
  quantity: number;
  source: string | null;
  /** Kill count at the drop, or XP in `statSkill` at the drop. */
  kc: number | null;
  xp: number | null;
  statSkill: string | null;
  /** 'reported' by the plugin, the 'site' own reading at the time, or 'stated' on a manual proof. */
  statBasis: string | null;
  occurredAt: string;
  origin: 'plugin' | 'manual';
  /** 'counted' | 'pending' | 'rejected' */
  status: string;
  approvedBy: string | null;
  screenshotUrl: string | null;
  note: string | null;
}

export interface HuntEntrant {
  rsn: string;
  /** Stat gained since the hunt started (kills at the source, or XP), or null with nothing tracked. */
  statGain: number | null;
}

export interface HuntRow {
  rsn: string;
  rank: number;
  /** What the rule counts: drops, or the stacks added up. */
  count: number;
  drops: HuntDrop[];
  firstAt: string | null;
  lastAt: string | null;
  /** When they reached their final count: the "most" tie-break. */
  reachedAt: string | null;
  statGain: number | null;
}

export const huntRsnKey = (rsn: string) => norm(rsn);

/** How much one drop adds under the item's own count mode. */
export function dropWeight(config: HuntConfig, drop: Pick<HuntDrop, 'itemId' | 'quantity'>): number {
  if (config.target === 'pets') return 1;
  const item = config.items.find((it) => it.id === drop.itemId);
  return item?.count === 'quantity' ? Math.max(1, drop.quantity) : 1;
}

/**
 * The drops that score: counted (not waiting on staff, not turned down), inside the window
 * (lib/h2hRules dropCounts: from the start, up to and including the end), oldest first.
 */
export function countedDrops(drops: HuntDrop[], window: { startMs: number | null; endMs: number | null }): HuntDrop[] {
  return drops
    .filter((d) => d.status === 'counted' && dropCounts(Date.parse(d.occurredAt), window.startMs, window.endMs))
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.id - b.id);
}

/** rule 'first' with "end when the first one lands": the moment the hunt is over, or null. */
export function endOnFirstAt(config: HuntConfig, drops: HuntDrop[], window: { startMs: number | null; endMs: number | null }): string | null {
  if (config.rule !== 'first' || !config.endOnFirst) return null;
  return countedDrops(drops, window)[0]?.occurredAt ?? null;
}

/**
 * The standings.
 *
 *   most   count, highest first; a tie goes to whoever reached that count first.
 *   first  order of each player's first drop. With "end when the first one lands" only that drop
 *          counts: anything after it happened once the hunt was over.
 *
 * Everyone without a drop follows, ordered by kills at the source (who is driest), then by name.
 */
export function rankHunt(
  config: HuntConfig,
  entrants: HuntEntrant[],
  drops: HuntDrop[],
  window: { startMs: number | null; endMs: number | null },
): HuntRow[] {
  let counted = countedDrops(drops, window);
  if (config.rule === 'first' && config.endOnFirst && counted.length > 0) {
    const stop = Date.parse(counted[0].occurredAt);
    counted = counted.filter((d) => Date.parse(d.occurredAt) <= stop).slice(0, 1);
  }
  const byRsn = new Map<string, HuntDrop[]>();
  for (const d of counted) byRsn.set(d.rsnKey, [...(byRsn.get(d.rsnKey) ?? []), d]);

  const rows = entrants.map((e): HuntRow => {
    const mine = byRsn.get(huntRsnKey(e.rsn)) ?? [];
    let count = 0;
    for (const d of mine) count += dropWeight(config, d);
    return {
      rsn: e.rsn,
      rank: 0,
      count,
      drops: mine,
      firstAt: mine[0]?.occurredAt ?? null,
      lastAt: mine[mine.length - 1]?.occurredAt ?? null,
      // Drops are oldest first, so the last one is the one that brought the total to where it is.
      reachedAt: mine[mine.length - 1]?.occurredAt ?? null,
      statGain: e.statGain,
    };
  });

  const t = (s: string | null) => (s ? Date.parse(s) : Number.POSITIVE_INFINITY);
  rows.sort((a, b) => {
    const aIn = a.count > 0;
    const bIn = b.count > 0;
    if (aIn !== bIn) return aIn ? -1 : 1;
    if (aIn && bIn) {
      if (config.rule === 'most') return b.count - a.count || t(a.reachedAt) - t(b.reachedAt) || a.rsn.localeCompare(b.rsn);
      return t(a.firstAt) - t(b.firstAt) || a.rsn.localeCompare(b.rsn);
    }
    return (b.statGain ?? 0) - (a.statGain ?? 0) || a.rsn.localeCompare(b.rsn);
  });
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

/** "got it at 1,204 kc" / "at 13,034,431 Woodcutting XP", or null when the drop carries neither. */
export function dropStatWords(drop: Pick<HuntDrop, 'kc' | 'xp' | 'statSkill'>): string | null {
  if (drop.kc != null) return `at ${drop.kc.toLocaleString()} kc`;
  if (drop.xp != null) return `at ${drop.xp.toLocaleString()} ${SKILL_LABELS[drop.statSkill ?? ''] ?? ''} XP`.replace(/\s+/g, ' ');
  return null;
}

/** "plugin" or "manual proof (approved by Olive)". */
export function dropOriginWords(drop: Pick<HuntDrop, 'origin' | 'approvedBy'>): string {
  if (drop.origin === 'plugin') return 'plugin';
  return drop.approvedBy ? `manual proof (approved by ${drop.approvedBy})` : 'manual proof';
}

/** Which number a manual proof has to state for this hunt. */
export function manualStatKind(config: HuntConfig): 'kc' | 'xp' | 'either' {
  if (config.killsOf) return 'kc';
  if (config.xpSkill) return 'xp';
  return 'either';
}
