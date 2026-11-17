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

import { BOSSES, RAIDS_ANY_MODE, SKILL_LABELS, bossMetricLabel, metricKeys } from '@/lib/constants';
import { dropCounts } from '@/lib/h2hRules';
import { PET_BOSS_KEYS, PET_GROUPS } from '@/lib/petGroups';
import { sourceMatches } from '@/lib/pluginFacts/match';
import { itemIconUrl } from '@/lib/tileIcons';

export type HuntRule = 'first' | 'most';
export type HuntCountMode = 'drops' | 'quantity';
export type HuntConfirm = 'staff' | 'auto';
/**
 * 'date': runs to its end date. 'drops': ends once `n` have landed, across everyone ('all') or by
 * one player ('player', "first to N"). n = 1 across everyone is "when the first one lands".
 */
export type HuntEnding = { kind: 'date' } | { kind: 'drops'; n: number; by: 'all' | 'player' };

export const MAX_ENDING_DROPS = 1000;

/** The "How it ends" and "Who confirms drops" choices, from a form or a stored config. */
export function huntSettingsFromInput(body: Record<string, unknown>): { ends: HuntEnding; confirm: HuntConfirm } {
  const e = (body.ends && typeof body.ends === 'object' ? body.ends : {}) as Record<string, unknown>;
  const n = typeof e.n === 'number' && Number.isFinite(e.n) ? Math.min(MAX_ENDING_DROPS, Math.max(1, Math.floor(e.n))) : 1;
  const ends: HuntEnding = e.kind === 'drops' ? { kind: 'drops', n, by: e.by === 'player' ? 'player' : 'all' } : { kind: 'date' };
  return { ends, confirm: body.confirm === 'auto' ? 'auto' : 'staff' };
}

/** "at the end date", "after 3 drops", "when one player has 5", "when the first one lands". */
export function huntEndingWords(ends: HuntEnding): string {
  if (ends.kind === 'date') return 'at the end date';
  if (ends.by === 'player') return ends.n === 1 ? 'when the first one lands' : `when one player has ${ends.n.toLocaleString()}`;
  return ends.n === 1 ? 'when the first one lands' : `after ${ends.n.toLocaleString()} drops`;
}

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
  /**
   * target 'pets', narrowed: the pets of the group that count, by item id. Absent on a hunt for the
   * whole group, which is every hunt stored before a group could be narrowed. Read through huntPets.
   */
  petIds?: number[];
  rule: HuntRule;
  /** How it ends: at the end date, or as soon as enough drops have landed. Staff can always end it by hand. */
  ends: HuntEnding;
  /**
   * Who confirms the drops that decide the result. 'staff' (default): a plugin report alone never
   * ends the hunt or pays a prize. 'auto': the clan's own choice to count plugin reports as they
   * arrive. Held reports (dropFlag) and manual proofs wait for staff in both.
   */
  confirm: HuntConfirm;
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

/** The pets a pet hunt counts: its group, or the ones picked out of it. Empty for an item hunt. */
export function huntPets(config: Pick<HuntConfig, 'target' | 'petGroup' | 'petIds'>): { id: number; name: string }[] {
  if (config.target !== 'pets') return [];
  const all = petGroupOf(config.petGroup)?.items ?? [];
  const picked = config.petIds;
  return picked ? all.filter((p) => picked.includes(p.id)) : all;
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
  let petIds: number[] | undefined;
  if (target === 'pets') {
    petGroup = typeof body.petGroup === 'string' ? body.petGroup : 'all';
    const group = petGroupOf(petGroup);
    if (!group) return { ok: false, error: 'Pick a pet group.' };
    // A list of pets narrows the group. Only pets of that group are taken, in the group's order, and
    // a list that names all of them is the whole group again, stored the way it always was. A list
    // with none left is refused, stored or not: read as "the whole group" it would count pets the
    // organiser left out.
    if (Array.isArray(body.petIds)) {
      const asked: unknown[] = body.petIds;
      const picked = group.items.filter((p) => asked.includes(p.id)).map((p) => p.id);
      if (picked.length === 0) return { ok: false, error: 'Pick at least one pet.' };
      if (picked.length < group.items.length) petIds = picked;
    }
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

  let killsOf =
    typeof body.killsOf === 'string' && body.killsOf.trim()
      ? body.killsOf.split(',').map((k) => k.trim()).filter((k) => BOSSES.some((b) => b.key === k)).join(',') || null
      : null;
  // A new pet hunt's kill count is not the form's to choose: asking for one gets the bosses the
  // chosen pets come from, or none. A stored hunt keeps what it was created with.
  if (target === 'pets' && killsOf && !opts.lenient) killsOf = killsOfForPets(huntPets({ target, petGroup, petIds }));
  const xpSkill =
    !killsOf && typeof body.xpSkill === 'string' && body.xpSkill !== 'overall' && SKILL_LABELS[body.xpSkill] ? body.xpSkill : null;

  return {
    ok: true,
    config: {
      v: 1,
      target,
      items,
      petGroup,
      ...(petIds ? { petIds } : {}),
      rule,
      ...huntSettingsFromInput(body),
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
 * "Tanzanite fang + Magic fang from Zulrah", "Any pet", "Skilling pets", "Olmlet + Lil' zik" for
 * pets picked out of a group. Stored as the competition's `metric`.
 */
export function huntTargetsLabel(config: HuntConfig): string {
  if (config.target === 'pets') {
    if (config.petIds) {
      const picked = huntPets(config);
      return (picked.slice(0, 3).map((p) => p.name).join(' + ') + (picked.length > 3 ? ` + ${picked.length - 3} more` : '')).slice(0, 160);
    }
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
  const picked = config.petIds ? huntPets(config) : null;
  const label = picked
    ? picked.slice(0, 2).map((p) => p.name).join(' + ') + (picked.length > 2 ? ' + more' : '')
    : config.target === 'pets' ? huntTargetsLabel(config) : config.items.map((i) => i.name).slice(0, 2).join(' + ') + (config.items.length > 2 ? ' + more' : '');
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
  if (stat.type !== 'boss') return SKILL_LABELS[stat.metric] ?? stat.metric;
  // One boss, or one raid in any mode, reads as it always has. A pet hunt can add up a dozen:
  // up to three are named, with a raid's two modes as the one raid, and past that only two.
  const names = bossNames(stat.metric);
  if (names.length === 1) return bossMetricLabel(stat.metric);
  return names.length <= 3 ? names.join(' + ') : `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

/**
 * The bosses behind a kill-count key list, by name, with both modes of a raid as the one raid:
 * "Chambers of Xeric", not "Chambers of Xeric + CoX: CM".
 */
export function bossNames(metric: string): string[] {
  const keys = metricKeys(metric);
  const names: string[] = [];
  const done = new Set<string>();
  for (const k of keys) {
    if (done.has(k)) continue;
    const raid = RAIDS_ANY_MODE.find((r) => metricKeys(r.key).includes(k) && metricKeys(r.key).every((rk) => keys.includes(rk)));
    if (raid) {
      for (const rk of metricKeys(raid.key)) done.add(rk);
      names.push(raid.label.replace(/\s*\(any mode\)$/i, ''));
    } else {
      done.add(k);
      names.push(BOSSES.find((b) => b.key === k)?.label ?? k);
    }
  }
  return names;
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

/** A pet hunt shows kills only while the chosen pets come from this many bosses or fewer. */
export const MAX_PET_KILL_BOSSES = 12;

/**
 * "Kills at the source" for a set of pets: the bosses they come from (lib/petGroups PET_BOSS_KEYS),
 * added together.
 *
 * None when a chosen pet has no boss on the hiscores (a skilling pet: the sum would say nothing
 * about the hunt for it), and none past MAX_PET_KILL_BOSSES: "any pet" is some sixty kill counts,
 * which reads as "total boss kills" and tells nobody who is dry. `bosses` and `noBoss` are there so
 * the form can say which of the two it was.
 */
export function petKills(pets: { id: number; name: string }[]): { killsOf: string | null; bosses: string[]; noBoss: string[] } {
  const keys = new Set<string>();
  const noBoss: string[] = [];
  for (const p of pets) {
    const own = PET_BOSS_KEYS[p.id];
    if (!own) noBoss.push(p.name);
    else for (const k of own) keys.add(k);
  }
  const joined = [...keys].join(',');
  const bosses = bossNames(joined);
  const ok = noBoss.length === 0 && bosses.length > 0 && bosses.length <= MAX_PET_KILL_BOSSES;
  return { killsOf: ok ? joined : null, bosses, noBoss };
}

export function killsOfForPets(pets: { id: number; name: string }[]): string | null {
  return petKills(pets).killsOf;
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
 * or not; a group takes the pets on its list, and a narrowed hunt only the ones picked (huntPets).
 * A pet follows its own source, so none is checked.
 */
export function matchHuntReport(config: HuntConfig, report: HuntReport): HuntHit | null {
  if (report.kind !== 'drop' && report.kind !== 'clog' && report.kind !== 'pet') return null;
  const name = report.itemName?.trim() || null;
  const quantity = Math.max(1, Math.floor(report.quantity ?? 1));
  const source = report.source?.trim() || null;

  if (config.target === 'pets') {
    const group = petGroupOf(config.petGroup);
    if (!group) return null;
    const pet = huntPets(config).find((p) => (report.itemId != null && p.id === report.itemId) || (name != null && norm(p.name) === norm(name)));
    if (pet) return { itemId: pet.id, itemName: pet.name, quantity: 1, source };
    // A pet line the plugin never got a name for: still a pet, so "any pet" counts it. Not once
    // pets were picked out of the list: it could be one that was left out.
    if (report.kind === 'pet' && group.key === 'all' && !config.petIds && report.itemId == null && name == null) {
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
  /**
   * 'counted' (in the standings), 'pending' (a member's proof waiting for staff), 'review' (a plugin
   * report held for staff, see dropFlag) or 'rejected'.
   */
  status: string;
  /** Staff have looked at this drop and said yes. A manual proof that counts always is. */
  confirmed: boolean;
  /** Why a plugin report was held for staff, in words. */
  flagReason: string | null;
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

/**
 * The drop that ends an "after N drops" hunt, with everything that had to land for it to do so.
 *
 * Walks the counted drops oldest first. Across everyone, the hunt is decided by the drop that
 * brings the total to N; by one player, by the drop that brings any one player to N. `deciding`
 * is every drop up to and including that one: the drops the result rests on.
 */
export function endingDrop(config: HuntConfig, drops: HuntDrop[], window: { startMs: number | null; endMs: number | null }): { at: string; deciding: HuntDrop[] } | null {
  if (config.ends.kind !== 'drops') return null;
  const counted = countedDrops(drops, window);
  const per = new Map<string, number>();
  let total = 0;
  for (let i = 0; i < counted.length; i++) {
    const d = counted[i];
    const w = dropWeight(config, d);
    total += w;
    per.set(d.rsnKey, (per.get(d.rsnKey) ?? 0) + w);
    const reached = config.ends.by === 'player' ? (per.get(d.rsnKey) ?? 0) >= config.ends.n : total >= config.ends.n;
    if (reached) return { at: d.occurredAt, deciding: counted.slice(0, i + 1) };
  }
  return null;
}

/**
 * The moment an "after N drops" hunt is over, or null while it is still running.
 *
 * With staff confirming (the default) a plugin report alone never ends a hunt: the report is the
 * client's word. The hunt ends at the deciding drop only once STAFF have confirmed every drop the
 * result rests on. With "count plugin drops automatically" the clan has chosen to take the reports
 * as they come, and the deciding drop ends it by itself.
 */
export function huntEndsAt(config: HuntConfig, drops: HuntDrop[], window: { startMs: number | null; endMs: number | null }): string | null {
  const end = endingDrop(config, drops, window);
  if (!end) return null;
  if (config.confirm === 'auto') return end.at;
  return end.deciding.every((d) => d.confirmed) ? end.at : null;
}

/**
 * "Enough drops reported: waiting for staff to confirm": the drops a staff-confirmed hunt is
 * waiting on before it can end. Empty when it is not waiting. The hunt keeps running and counting.
 */
export function awaitingConfirmation(config: HuntConfig, drops: HuntDrop[], window: { startMs: number | null; endMs: number | null }): HuntDrop[] {
  if (config.confirm === 'auto') return [];
  const end = endingDrop(config, drops, window);
  return end ? end.deciding.filter((d) => !d.confirmed) : [];
}

/**
 * The drops staff still have to confirm before prizes can be paid: every unconfirmed drop behind a
 * prize-winning place. Empty means the prize places rest only on drops staff have looked at.
 */
export function unconfirmedPrizeDrops(config: HuntConfig, rows: HuntRow[], prizePlaces: number): HuntDrop[] {
  // The clan chose to count plugin reports as they arrive: nothing waits on staff.
  if (config.confirm === 'auto') return [];
  return rows
    .slice(0, Math.max(0, prizePlaces))
    .filter((r) => r.count > 0)
    .flatMap((r) => r.drops.filter((d) => !d.confirmed));
}

/**
 * The key one plugin report is stored under, built HERE from what happened (the kind of report, the
 * item, the source, and the time in the ten-second buckets the plugin's own moment keys use), never
 * taken from the client. Unique per character per hunt, so a retry or a replayed queue lands on the
 * row it already made.
 */
export function serverDropKey(report: { kind: string; itemId: number | null; itemName: string | null; source: string | null }, atMs: number): string {
  const item = report.itemId != null ? String(report.itemId) : norm(report.itemName ?? '');
  return `${report.kind}|${item}|${norm(report.source ?? '')}|${Math.floor(atMs / 10_000)}`;
}

/** More plugin reports of one item than this inside BURST_WINDOW_MS is held for staff. */
export const BURST_LIMIT = 4;
export const BURST_WINDOW_MS = 10 * 60_000;

/**
 * Should a plugin report wait for staff before it counts? Returns the reason in words, or null.
 *
 * Every input is something the site already holds for the character. Nothing here drops a report:
 * a held one goes to staff with this sentence, and counts once they confirm it.
 *
 *   - the reported kill count is below the site's own reading for that boss, or far above it;
 *   - no kill at the source has been recorded since the hunt started, and the report does not say
 *     otherwise (the site's reading has not moved and the reported kill count is not past the
 *     starting line);
 *   - more of the same item in a short window than is plausible.
 *
 * The kill-count checks only run when the hunt tracks ONE hiscores boss (`singleBoss`): a sum over
 * several bosses says nothing about the count at any one of them.
 */
export function dropFlag(input: {
  reportedKc: number | null;
  /** The hunt shows kills for exactly one hiscores key, and this report came from that boss. */
  singleBoss: boolean;
  /** weekly_participants baseline / current for the tracked stat; null when not read yet. */
  baseline: number | null;
  current: number | null;
  /** Counted or held plugin drops of this item by this character inside BURST_WINDOW_MS. */
  recentSameItem: number;
}): string | null {
  if (input.recentSameItem >= BURST_LIMIT) {
    return `${input.recentSameItem + 1} of this item reported within ${Math.round(BURST_WINDOW_MS / 60_000)} minutes`;
  }
  if (!input.singleBoss || input.baseline == null || input.current == null) return null;
  const kc = input.reportedKc;
  if (kc != null && kc < input.current) {
    return `Reported at ${kc.toLocaleString()} kc, below the site's reading of ${input.current.toLocaleString()}`;
  }
  // The hiscores trail the game and the plugin's live count fills the gap, so "far" is generous:
  // a hundred kills and a fifth again on top of what the site last read.
  if (kc != null && kc > input.current + 100 + Math.floor(input.current * 0.2)) {
    return `Reported at ${kc.toLocaleString()} kc, far above the site's reading of ${input.current.toLocaleString()}`;
  }
  if (input.current <= input.baseline && (kc == null || kc <= input.baseline)) {
    return 'No kills at the source recorded since the hunt started';
  }
  return null;
}

/**
 * The standings.
 *
 *   most   count, highest first; a tie goes to whoever reached that count first.
 *   first  order of each player's first drop.
 *
 * A hunt that ends after N drops has its end pulled back to the deciding drop (huntEndsAt), and the
 * window then leaves out everything after it.
 *
 * Everyone without a drop follows, ordered by kills at the source (who is driest), then by name.
 */
export function rankHunt(
  config: HuntConfig,
  entrants: HuntEntrant[],
  drops: HuntDrop[],
  window: { startMs: number | null; endMs: number | null },
): HuntRow[] {
  const counted = countedDrops(drops, window);
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

/** "plugin", "plugin (confirmed by Olive)" or "manual proof (approved by Olive)". */
export function dropOriginWords(drop: Pick<HuntDrop, 'origin' | 'approvedBy'> & { confirmed?: boolean }): string {
  if (drop.origin === 'plugin') return drop.confirmed && drop.approvedBy ? `plugin (confirmed by ${drop.approvedBy})` : 'plugin';
  return drop.approvedBy ? `manual proof (approved by ${drop.approvedBy})` : 'manual proof';
}

/** Which number a manual proof has to state for this hunt. */
export function manualStatKind(config: HuntConfig): 'kc' | 'xp' | 'either' {
  if (config.killsOf) return 'kc';
  if (config.xpSkill) return 'xp';
  return 'either';
}

/** The picture that stands for a hunt: its first item, or the first pet it counts. */
export function huntIconUrl(config: HuntConfig | null): string | null {
  if (!config) return null;
  if (config.target === 'pets') {
    const first = huntPets(config)[0];
    return first ? itemIconUrl(first.id) : null;
  }
  return config.items[0] ? itemIconUrl(config.items[0].id) : null;
}

/** The same, straight from the stored column: for cards and lists that hold only the row. */
export function huntIconFor(hunt: string | null | undefined): string | null {
  return huntIconUrl(parseHunt(hunt));
}
