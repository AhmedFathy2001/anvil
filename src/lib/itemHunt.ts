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

import { bossKeyForName } from '@/lib/pluginStats';
import { BOSSES, RAIDS_ANY_MODE, SKILL_LABELS, bossMetricLabel, metricKeys } from '@/lib/constants';
import { dropCounts } from '@/lib/h2hRules';
import skillPets from '@/data/skillPets.json';
import { PET_BOSS_KEYS, PET_GROUPS } from '@/lib/petGroups';
import { sourceMatches } from '@/lib/pluginFacts/match';
import { itemIconUrl } from '@/lib/tileIcons';
import { type RushRules, type RushTally, rushFromInput, rushTotal } from '@/lib/bossRushRules';

/** 'rush': Boss Rush, kills + rare-drop bonuses - deaths at the chosen bosses (lib/bossRushRules). */
export type HuntRule = 'first' | 'most' | 'points' | 'rush';
/** Points hunts: does a second drop of the same item score again, or only each player's first? */
export type HuntRepeat = 'every' | 'first';
export const MAX_ITEM_POINTS = 1000;
export type HuntCountMode = 'drops' | 'quantity';
export type HuntConfirm = 'staff' | 'auto';
/**
 * 'date': runs to its end date. 'drops': ends once `n` have landed, across everyone ('all') or by
 * one player ('player', "first to N"). n = 1 across everyone is "when the first one lands".
 * 'all': ends when one player holds every row of the hunt; nobody does, it runs to the end date.
 */
export type HuntEnding = { kind: 'date' } | { kind: 'drops'; n: number; by: 'all' | 'player' } | { kind: 'all' };

export const MAX_ENDING_DROPS = 1000;

/** The "How it ends" and "Who confirms drops" choices, from a form or a stored config. */
export function huntSettingsFromInput(body: Record<string, unknown>): { ends: HuntEnding; confirm: HuntConfirm } {
  const e = (body.ends && typeof body.ends === 'object' ? body.ends : {}) as Record<string, unknown>;
  const n = typeof e.n === 'number' && Number.isFinite(e.n) ? Math.min(MAX_ENDING_DROPS, Math.max(1, Math.floor(e.n))) : 1;
  const ends: HuntEnding = e.kind === 'drops' ? { kind: 'drops', n, by: e.by === 'player' ? 'player' : 'all' } : e.kind === 'all' ? { kind: 'all' } : { kind: 'date' };
  return { ends, confirm: body.confirm === 'auto' ? 'auto' : 'staff' };
}

/** "at the end date", "after 3 drops", "when one player has 5", "when the first one lands". */
export function huntEndingWords(ends: HuntEnding): string {
  if (ends.kind === 'date') return 'at the end date';
  if (ends.kind === 'all') return 'when a player has all of them';
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
  /** Rule 'points': what one drop (or one piece, under 'quantity') of it scores. Absent = 1. */
  points?: number;
  /**
   * A bounty on this row, in the competition's prize currency: what the 1st, 2nd, 3rd… player to get
   * one is paid. Its length is how many players it pays. Each player claims it once. Absent = none.
   * Any rule; alongside the place prizes or instead of them (huntBountyClaims).
   */
  bounty?: number[];
  /** v2: the row is a pet. It counts from wherever it came, one at a time, like a v1 pet hunt's. */
  pet?: true;
  /**
   * v2: "Closest to it", the stat that shows progress toward this row (kills at its boss, XP in its
   * skill). null = nothing shown for it. Absent on every v1 config, which has the one stat below.
   */
  stat?: HuntRowStat | null;
}

/** One row's progress stat. `metric` is a lib/constants metricKeys list: a raid reads as its modes. */
export interface HuntRowStat {
  type: 'boss' | 'skill';
  metric: string;
}

/**
 * v1: one list of items, OR one group of pets, with one stat beside the count.
 * v2: one list of rows where a pet is just another row, each with its own progress stat. Stored v1
 * configs are read exactly as they were written (huntFromInput's v1 path); the form only writes v2.
 */
export interface HuntConfig {
  v: 1 | 2;
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
  /** Rule 'points': 'first' = only each player's first drop of each item scores. Absent = every drop. */
  repeat?: HuntRepeat;
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
  /**
   * Rule 'rush' (v2 only): the scoring and its targets (`killsOf` holds those the hiscores keep); the rows are the drops that score,
   * each with the points the host gave it.
   */
  rush?: RushRules;
}

export const MAX_HUNT_ITEMS = 12;
/** v2: rows in all. Items stay at MAX_HUNT_ITEMS (each one is an id the plugin is asked to report); pets ride free. */
export const MAX_HUNT_ROWS = 80;
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
  if (body.v === 2) return huntV2FromInput(body, opts);
  const target = body.target === 'pets' ? 'pets' : 'items';
  const rule: HuntRule = body.rule === 'most' ? 'most' : body.rule === 'first' ? 'first' : body.rule === 'points' ? 'points' : (null as never);
  if (!rule) return { ok: false, error: 'Pick the rule: first to get it, most by the end, or most points.' };
  if (rule === 'points' && target === 'pets') return { ok: false, error: 'Points are for item hunts: pick most by the end for pets.' };

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
      const pts = typeof it.points === 'number' && Number.isFinite(it.points) ? Math.round(it.points) : 1;
      const bounty = bountyFromInput(it.bounty);
      items.push({ id, name, sources, count: it.count === 'quantity' ? 'quantity' : 'drops', ...(rule === 'points' ? { points: Math.min(MAX_ITEM_POINTS, Math.max(1, pts)) } : {}), ...(bounty ? { bounty } : {}) });
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
      ...(rule === 'points' && body.repeat === 'first' ? { repeat: 'first' as const } : {}),
      ...huntSettingsFromInput(body),
      killsOf,
      xpSkill,
      ...(opts.lenient && typeof body.plannedEnd === 'string' ? { plannedEnd: body.plannedEnd } : {}),
    },
  };
}

// ── v2: one list, a pet is a row ───────────────────────────────────────────────────────────

const ALL_PETS = PET_GROUPS.find((g) => g.key === 'all')?.items ?? [];
const PET_BY_ID = new Map(ALL_PETS.map((p) => [p.id, p]));

export function isPetId(id: number | null | undefined): boolean {
  return id != null && PET_BY_ID.has(id);
}

/**
 * The skill a skilling pet comes from, read off src/data/skillPets.json (the same map a skill week's
 * feed uses). The first skill that lists it: Smolcano is under Mining and Smithing, and has a boss
 * anyway. Slayer is left out: the pets it lists are boss pets, and their boss's kills say more.
 */
function petSkill(name: string): string | null {
  const skills = (skillPets as { skills?: Record<string, string[]> }).skills ?? {};
  for (const [skill, names] of Object.entries(skills)) {
    if (skill === 'slayer' || !SKILL_LABELS[skill]) continue;
    if (names.some((n) => norm(n) === norm(name))) return skill;
  }
  return null;
}

/**
 * "Closest to it" when nobody chose: a boss pet takes its boss's kills (lib/petGroups PET_BOSS_KEYS),
 * a skilling pet its skill's XP, an item the kills at its sources when every source is a hiscores
 * boss. Anything else has no honest number and gets none.
 */
export function autoRowStat(row: { id: number; name: string; sources: string[]; pet?: boolean }): HuntRowStat | null {
  if (row.pet || isPetId(row.id)) {
    const keys = PET_BOSS_KEYS[row.id];
    if (keys && keys.length > 0) return { type: 'boss', metric: keys.join(',') };
    const skill = petSkill(PET_BY_ID.get(row.id)?.name ?? row.name);
    return skill ? { type: 'skill', metric: skill } : null;
  }
  const killsOf = killsOfForItems([{ id: row.id, name: row.name, sources: row.sources, count: 'drops' }]);
  return killsOf ? { type: 'boss', metric: killsOf } : null;
}

/** A row stat as a form or a stored config gave it, checked: real boss keys, or a real skill (not Total). */
export function rowStatFromInput(raw: unknown): HuntRowStat | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.metric !== 'string') return null;
  if (r.type === 'skill') return r.metric !== 'overall' && SKILL_LABELS[r.metric] ? { type: 'skill', metric: r.metric } : null;
  if (r.type !== 'boss') return null;
  const keys = [...new Set(metricKeys(r.metric))];
  return keys.length > 0 && keys.every((k) => BOSSES.some((b) => b.key === k)) ? { type: 'boss', metric: keys.join(',') } : null;
}

/** "General Graardor kills", "Fishing XP", "Chambers of Xeric kills". */
export function rowStatLabel(stat: HuntRowStat | null | undefined): string | null {
  if (!stat) return null;
  if (stat.type === 'skill') return `${SKILL_LABELS[stat.metric] ?? stat.metric} XP`;
  const names = bossNames(stat.metric);
  return `${names.length <= 2 ? names.join(' + ') : `${names[0]} + ${names.length - 1} more`} kills`;
}

/** The short name the standings use: "Fishing", "General Graardor", "Callisto + 1". */
export function rowStatShort(stat: HuntRowStat): string {
  if (stat.type === 'skill') return SKILL_LABELS[stat.metric] ?? stat.metric;
  const names = bossNames(stat.metric);
  return names.length === 1 ? names[0] : `${names[0]} + ${names.length - 1}`;
}

/** The stat's single hiscores keys, as a row stores them: "boss:generalGraardor", "skill:fishing". */
export function rowStatKeys(stat: HuntRowStat | null | undefined): string[] {
  if (!stat) return [];
  return [...new Set(metricKeys(stat.metric))].map((k) => `${stat.type}:${k}`);
}

/** Every row stat key of a hunt: what the sweep reads for each entrant. Empty on a v1 hunt. */
export function huntRowStatKeys(config: HuntConfig | null): string[] {
  if (!config || config.v !== 2) return [];
  return [...new Set(config.items.flatMap((r) => rowStatKeys(r.stat)))];
}

/**
 * The hunt-wide stat of a v2 hunt, the one every v1 hunt has: what the hiscores sweep reads and the
 * plugin pushes live, what a held report's kill count is checked against, and the order of the
 * driest when no row has a drop rate. Every boss the rows show, added together; with no boss row,
 * the first row's skill.
 */
export function v2HuntStat(rows: HuntItem[]): { killsOf: string | null; xpSkill: string | null } {
  const keys = new Set<string>();
  let skill: string | null = null;
  for (const r of rows) {
    if (r.stat?.type === 'boss') for (const k of metricKeys(r.stat.metric)) keys.add(k);
    else if (r.stat?.type === 'skill' && !skill) skill = r.stat.metric;
  }
  return keys.size > 0 ? { killsOf: [...keys].join(','), xpSkill: null } : { killsOf: null, xpSkill: skill };
}

function huntV2FromInput(body: Record<string, unknown>, opts: { lenient?: boolean }): { ok: true; config: HuntConfig } | { ok: false; error: string } {
  if (body.rule === 'rush') return rushFromBody(body, opts);
  const rule: HuntRule | null = body.rule === 'most' ? 'most' : body.rule === 'first' ? 'first' : body.rule === 'points' ? 'points' : null;
  if (!rule) return { ok: false, error: 'Pick the rule: first to get it, most by the end, or most points.' };
  const raw = Array.isArray(body.items) ? body.items : [];
  const items: HuntItem[] = [];
  const seen = new Set<number>();
  let plain = 0;
  for (const r of raw.slice(0, MAX_HUNT_ROWS)) {
    const it = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    const id = typeof it.id === 'number' && Number.isInteger(it.id) && it.id > 0 ? it.id : null;
    const given = typeof it.name === 'string' ? it.name.trim().slice(0, 80) : '';
    if (id == null || seen.has(id)) continue;
    // A pet is known by its id, whatever the form called it: a flag alone cannot make an item one.
    const pet = isPetId(id);
    const name = pet ? (PET_BY_ID.get(id)?.name ?? given) : given;
    if (!name) continue;
    if (!pet && ++plain > MAX_HUNT_ITEMS) return { ok: false, error: `A hunt holds up to ${MAX_HUNT_ITEMS} items (pets do not count toward that).` };
    seen.add(id);
    const sources: string[] = [];
    if (!pet) {
      const byKey = new Map<string, string>();
      for (const s of Array.isArray(it.sources) ? it.sources : []) {
        if (typeof s !== 'string' || !s.trim()) continue;
        if (!byKey.has(norm(s))) byKey.set(norm(s), s.trim().slice(0, 80));
      }
      sources.push(...[...byKey.values()].slice(0, MAX_HUNT_SOURCES));
      if (!opts.lenient && sources.length === 0 && it.anySource !== true) {
        return { ok: false, error: `Choose where ${name} counts from: one or more sources, or any source.` };
      }
    }
    const pts = typeof it.points === 'number' && Number.isFinite(it.points) ? Math.round(it.points) : 1;
    // Absent = picked for you; null = "Nothing"; anything else is checked, and an unreadable one is nothing.
    const stat = it.stat === undefined ? autoRowStat({ id, name, sources, pet }) : rowStatFromInput(it.stat);
    const bounty = bountyFromInput(it.bounty);
    items.push({
      id,
      name,
      sources,
      count: !pet && it.count === 'quantity' ? 'quantity' : 'drops',
      ...(rule === 'points' ? { points: Math.min(MAX_ITEM_POINTS, Math.max(1, pts)) } : {}),
      ...(pet ? { pet: true as const } : {}),
      ...(bounty ? { bounty } : {}),
      stat,
    });
  }
  if (items.length === 0) return { ok: false, error: 'Pick at least one item or pet to hunt.' };
  return {
    ok: true,
    config: {
      v: 2,
      target: 'items',
      items,
      petGroup: null,
      rule,
      ...(rule === 'points' && body.repeat === 'first' ? { repeat: 'first' as const } : {}),
      ...huntSettingsFromInput(body),
      ...v2HuntStat(items),
      ...(opts.lenient && typeof body.plannedEnd === 'string' ? { plannedEnd: body.plannedEnd } : {}),
    },
  };
}

/**
 * Boss Rush: the targets (any boss, raid mode or monster, by the name the game reports kills by),
 * the scoring, and the drops that score with the host's points for each (0 = listed, scores nothing
 * yet). `killsOf` is the targets the hiscores keep, for "every kill counts" and the starting line.
 * A row with no sources counts from anywhere. It always ends at the end date.
 */
function rushFromBody(body: Record<string, unknown>, opts: { lenient?: boolean }): { ok: true; config: HuntConfig } | { ok: false; error: string } {
  const rush = rushFromInput(body.rush);
  // Stored before any monster could be a target: hiscores boss keys, read back as their names.
  if (rush.targets.length === 0) {
    const legacy = Array.isArray(body.bosses) ? body.bosses : typeof body.killsOf === 'string' ? body.killsOf.split(',') : [];
    rush.targets = legacy.flatMap((k) => (typeof k === 'string' ? BOSSES.filter((b) => b.key === k.trim()).map((b) => b.label) : []));
  }
  if (rush.targets.length === 0) return { ok: false, error: 'Pick at least one boss, raid or monster for the rush.' };
  const keys = [...new Set(rush.targets.flatMap((t) => bossKeyForName(t) ?? []))];
  const items: HuntItem[] = [];
  const seen = new Set<number>();
  for (const r of (Array.isArray(body.items) ? body.items : []).slice(0, MAX_HUNT_ROWS)) {
    const it = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    const id = typeof it.id === 'number' && Number.isInteger(it.id) && it.id > 0 ? it.id : null;
    if (id == null || seen.has(id)) continue;
    const pet = isPetId(id);
    const name = pet ? (PET_BY_ID.get(id)?.name ?? '') : typeof it.name === 'string' ? it.name.trim().slice(0, 80) : '';
    if (!name) continue;
    seen.add(id);
    const sources = pet
      ? []
      : [...new Map((Array.isArray(it.sources) ? it.sources : []).filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => [norm(x), x.trim().slice(0, 80)])).values()].slice(0, MAX_HUNT_SOURCES);
    const pts = typeof it.points === 'number' && Number.isFinite(it.points) ? Math.round(it.points) : 1;
    items.push({ id, name, sources, count: 'drops', points: Math.min(MAX_ITEM_POINTS, Math.max(0, pts)), ...(pet ? { pet: true as const } : {}), stat: null });
  }
  return {
    ok: true,
    config: {
      v: 2,
      target: 'items',
      items,
      petGroup: null,
      rule: 'rush',
      // A second drop of the same item: scores again (default), or only each player's first.
      ...(body.repeat === 'first' ? { repeat: 'first' as const } : {}),
      ends: { kind: 'date' },
      confirm: body.confirm === 'auto' ? 'auto' : 'staff',
      killsOf: keys.length ? keys.join(',') : null,
      xpSkill: null,
      rush,
      ...(opts.lenient && typeof body.plannedEnd === 'string' ? { plannedEnd: body.plannedEnd } : {}),
    },
  };
}

export const isRush = (config: HuntConfig | null | undefined): config is HuntConfig & { rush: RushRules } => config?.rule === 'rush' && !!config.rush;

/** A rush's targets the hiscores keep, as their keys. */
export function rushBossKeys(config: HuntConfig): string[] {
  return isRush(config) && config.killsOf ? config.killsOf.split(',').filter(Boolean) : [];
}

/** A rush's targets, by name. */
export function rushTargets(config: HuntConfig): string[] {
  return isRush(config) ? config.rush.targets : [];
}

/** A rush drop's points: what the host gave its row (0 until they do). */
export function rushDropPoints(config: HuntConfig, drop: Pick<HuntDrop, 'itemId'>): number {
  if (!isRush(config)) return 0;
  return config.items.find((it) => it.id === drop.itemId)?.points ?? 0;
}

/**
 * The rows a hunt counts, whatever version it is: a v2 hunt's list, a v1 item hunt's items, a v1 pet
 * hunt's pets as pet rows. A v1 row has no stat of its own (stat null): the hunt's one stat is it.
 */
export function huntRows(config: HuntConfig): HuntItem[] {
  if (config.v === 2) return config.items;
  if (config.target === 'pets') return huntPets(config).map((p) => ({ id: p.id, name: p.name, sources: [], count: 'drops' as const, pet: true as const, stat: null }));
  return config.items.map((it) => ({ ...it, stat: null }));
}

/** The item ids the plugin is asked to report for this hunt. Pets need none: the plugin reports every pet. */
export function huntReportItemIdsOf(config: HuntConfig): number[] {
  return config.target === 'items' ? config.items.filter((i) => !i.pet).map((i) => i.id) : [];
}

/** Is this drop a pet: any drop of a v1 pet hunt, or one of a v2 hunt's pet rows. */
export function dropIsPet(config: HuntConfig, itemId: number | null): boolean {
  return config.target === 'pets' || !!config.items.find((it) => it.id === itemId)?.pet;
}

// ── Words ─────────────────────────────────────────────────────────────────────────────────────

/** 'Item hunt' or 'Pet hunt': a v2 hunt of nothing but pets is a pet hunt too. */
export function huntKindWord(config: HuntConfig | null): string {
  if (isRush(config)) return 'Boss Rush';
  if (config?.v === 2) return config.items.length > 0 && config.items.every((it) => it.pet) ? 'Pet hunt' : 'Item hunt';
  return config?.target === 'pets' ? 'Pet hunt' : 'Item hunt';
}

export function huntRuleWords(config: HuntConfig | null): string {
  if (isRush(config)) return 'kills + drops - deaths';
  return config?.rule === 'points' ? 'most points by the end' : config?.rule === 'most' ? 'most by the end' : 'first to get it';
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
  if (isRush(config)) {
    const names = config.rush.targets;
    return (names.slice(0, 3).join(' + ') + (names.length > 3 ? ` + ${names.length - 3} more` : '')).slice(0, 160) || 'Boss Rush';
  }
  if (config.target === 'pets') {
    if (config.petIds) {
      const picked = huntPets(config);
      return (picked.slice(0, 3).map((p) => p.name).join(' + ') + (picked.length > 3 ? ` + ${picked.length - 3} more` : '')).slice(0, 160);
    }
    const group = petGroupOf(config.petGroup);
    return !group || group.key === 'all' ? 'Any pet' : group.label;
  }
  // A v2 list with pets in it: a pet has no source to name, so each row reads on its own.
  if (config.v === 2 && config.items.some((it) => it.pet)) {
    const shown = config.items.slice(0, 3);
    const more = config.items.length - shown.length;
    return (shown.map((it) => (it.pet ? it.name : it.name + sourcesWords(it.sources))).join(' + ') + (more > 0 ? ` + ${more} more` : '')).slice(0, 160);
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
  if (isRush(config)) return `Boss Rush: ${huntTargetsLabel(config)}`.slice(0, 100);
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
  /** 'death' only: the raid it happened in (lib/raidNpcs), when the killer named was a raid's own. */
  raid?: string | null;
  /** 'death' only: the monsters within a few tiles when it happened (the plugin's look around), so a
   *  death to a boss's minion or mechanic counts at that boss (Blood reavers at Nex). */
  near?: string[] | null;
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
  // A v2 pet row is a v1 pet hunt's pet: it follows its own source, and comes one at a time.
  if (item.pet) return { itemId: item.id, itemName: item.name, quantity: 1, source };
  if (item.sources.length > 0 && !sourceMatches(item.sources, source)) return null;
  return { itemId: item.id, itemName: item.name, quantity, source };
}

/** May a manual proof name this source for this item? Any source when the item is unrestricted. */
export function manualSourceAllowed(config: HuntConfig, itemId: number | null, source: string | null): boolean {
  if (config.target === 'pets') return true;
  const item = config.items.find((it) => it.id === itemId);
  if (!item) return false;
  if (item.pet) return true;
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
  /** Boss Rush: the kills that count (lib/bossRushRules kcSource), and deaths at a rush boss. */
  rush?: { kc: number; deaths: number; synergy?: number; adjust?: number };
  /** Stat gained since the hunt started (kills at the source, or XP), or null with nothing tracked. */
  statGain: number | null;
  /** v2: Due, as a fraction (1 = one drop expected by now; huntRowProgress). Null: no rate, or not read yet. */
  due?: number | null;
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
  due: number | null;
  /** How many of the hunt's rows they hold. */
  held: number;
  /** "When a player has all of them": when they first held every row; null otherwise. */
  completeAt: string | null;
  /** Boss Rush: what `count` is made of. */
  rush?: RushTally;
}

/** Kills (or XP) one drop of a row is expected to take, per row stat key: rates[rowId]["boss:generalGraardor"]. */
export type HuntRates = Record<number, Record<string, number>>;

export interface HuntRowProgress {
  id: number;
  name: string;
  /** "General Graardor", "Fishing"; null when the row shows nothing. */
  label: string | null;
  unit: 'kills' | 'xp' | null;
  /** Gained since the start; null with no stat, or no starting line read for it. */
  gain: number | null;
  /** This row's share of Due (a fraction); null when the row has no drop rate. */
  due: number | null;
  /** The drop rate behind `due`, for the hover: "1 in 5,000". Null with none. */
  rate: number | null;
}

/**
 * Each row's progress for one entrant, and their Due.
 *
 * A row's gain is its stat's gain since the start, every key added up (a raid's modes). Its share
 * of Due is that gain over the kills one drop is expected to take, key by key, so 2,140 Graardor
 * kills toward a 1 in 5,000 pet is 0.43. Due is the shares added together: 1 means one drop is
 * expected by now. Kills and XP are never added as raw numbers. A row with no rate in `rates` (a
 * skilling pet: the repo has no XP-based pet rate) adds nothing to Due and only shows its gain.
 * Due is null when no row has a rate, or the entrant's starting line is not read yet.
 */
export function huntRowProgress(
  config: HuntConfig,
  baseline: Record<string, number> | null | undefined,
  current: Record<string, number> | null | undefined,
  rates: HuntRates,
): { rows: HuntRowProgress[]; due: number | null } {
  let anyRated = false;
  let due = 0;
  const rows = huntRows(config).map((r): HuntRowProgress => {
    const keys = rowStatKeys(r.stat);
    const rowRates = rates[r.id] ?? {};
    const rated = keys.filter((k) => (rowRates[k] ?? 0) > 0);
    if (rated.length > 0) anyRated = true;
    const read = keys.length > 0 && !!baseline && !!current && keys.every((k) => typeof baseline[k] === 'number' && typeof current[k] === 'number');
    const gainOf = (k: string) => Math.max(0, (current?.[k] ?? 0) - (baseline?.[k] ?? 0));
    const gain = read ? keys.reduce((n, k) => n + gainOf(k), 0) : null;
    const share = read && rated.length > 0 ? rated.reduce((n, k) => n + gainOf(k) / rowRates[k], 0) : null;
    if (share != null) due += share;
    return {
      id: r.id,
      name: r.name,
      label: r.stat ? rowStatShort(r.stat) : null,
      unit: r.stat ? (r.stat.type === 'boss' ? 'kills' : 'xp') : null,
      gain,
      due: share,
      rate: rated.length === 1 ? rowRates[rated[0]] : rated.length > 1 ? Math.min(...rated.map((k) => rowRates[k])) : null,
    };
  });
  return { rows, due: anyRated && baseline && current ? due : null };
}

/** "61%": Due as the standings show it. */
export function dueWords(due: number): string {
  const pct = due * 100;
  // A pet at 1 in 2,500 is 0.04% a kill: whole percents read "0%" for everyone for days.
  if (pct > 0 && pct < 0.1) return '<0.1%';
  if (pct < 10) return `${+pct.toFixed(1)}%`;
  return `${Math.round(pct).toLocaleString('en-US')}%`;
}

/** 1.2M, 340K, 12,450: XP the way players say it. */
function shortXp(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 100_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString('en-US');
}

/** "General Graardor +2,140 kc", "Fishing +1.2M XP"; null for a row that shows nothing. */
export function rowProgressWords(p: Pick<HuntRowProgress, 'label' | 'unit' | 'gain'>): string | null {
  if (!p.label) return null;
  if (p.gain == null) return `${p.label}: not read yet`;
  return p.unit === 'kills' ? `${p.label} +${p.gain.toLocaleString('en-US')} kc` : `${p.label} +${shortXp(p.gain)} XP`;
}

/**
 * The plugin panel's two texts for one player of a v2 hunt (the mock's side panel): on the right
 * "8 pts · 2/3" for a player with drops, "61% due" for one without; under the name, their progress
 * on the rows they are still missing.
 */
export function huntPanelLine(
  config: HuntConfig,
  row: Pick<HuntRow, 'count' | 'held' | 'due' | 'drops'> & { rank?: number; rush?: RushTally },
  progress: HuntRowProgress[] | null,
): { figure: string | null; sub: string | null } {
  // The breakdown only once there is one: "0 kc" under every name says nothing.
  if (isRush(config)) {
    const r = row.rush;
    const any = !!r && (r.kc || r.bonus || r.synergy || r.adjust || r.deaths);
    return { figure: `${row.count.toLocaleString('en-US')} pts`, sub: any && r ? rushTallyWords(r) : null };
  }
  // "First to get it": one drop and they are finished, in their place. Progress no longer matters.
  if (config.rule === 'first' && row.count > 0 && row.rank != null) return { figure: firstDoneWords(row.rank), sub: null };
  const total = huntRows(config).length;
  const unit = config.rule === 'points' ? 'pts' : row.count === 1 ? 'drop' : 'drops';
  const figure = row.count > 0 ? `${row.count.toLocaleString('en-US')} ${config.rule === 'first' ? (row.count === 1 ? 'drop' : 'drops') : unit}${total > 1 ? ` · ${row.held}/${total}` : ''}` : row.due != null ? (row.due > 0 ? `${dueWords(row.due)} due` : 'no kc yet') : null;
  const have = new Set(row.drops.map((d) => d.itemId));
  const words = (progress ?? []).filter((p) => !have.has(p.id) && (p.gain ?? 0) > 0).map(rowProgressWords).filter((w): w is string => !!w);
  return { figure, sub: words.length > 0 ? words.slice(0, 2).join(' · ') : null };
}

/** "312 kc · +55 drops · -4 deaths": what a rush score is made of. */
export function rushTallyWords(t: RushTally): string {
  const parts = [`${t.kc.toLocaleString('en-US')} kc`];
  if (t.bonus) parts.push(`+${t.bonus.toLocaleString('en-US')} drops`);
  if (t.synergy) parts.push(`+${t.synergy.toLocaleString('en-US')} synergy`);
  if (t.adjust) parts.push(`${t.adjust > 0 ? '+' : ''}${t.adjust.toLocaleString('en-US')} by staff`);
  if (t.deaths) parts.push(`${t.deaths.toLocaleString('en-US')} ${t.deaths === 1 ? 'death' : 'deaths'}`);
  return parts.join(' · ');
}

export const huntRsnKey = (rsn: string) => norm(rsn);

/** How much one drop adds under the item's own count mode. "End after N drops" counts with this. */
export function dropWeight(config: HuntConfig, drop: Pick<HuntDrop, 'itemId' | 'quantity'>): number {
  if (config.target === 'pets') return 1;
  const item = config.items.find((it) => it.id === drop.itemId);
  return item?.count === 'quantity' ? Math.max(1, drop.quantity) : 1;
}

/** What one drop puts on the standings: its count, times the item's points on a points hunt. */
export function dropScore(config: HuntConfig, drop: Pick<HuntDrop, 'itemId' | 'quantity'>): number {
  if (isRush(config)) return rushDropPoints(config, drop);
  const n = dropWeight(config, drop);
  if (config.rule !== 'points') return n;
  return n * (config.items.find((it) => it.id === drop.itemId)?.points ?? 1);
}

/** A points hunt that scores each item once: a player's drops less the repeats, oldest kept. */
function scoringDrops(config: HuntConfig, mine: HuntDrop[]): HuntDrop[] {
  if ((config.rule !== 'points' && config.rule !== 'rush') || config.repeat !== 'first') return mine;
  const seen = new Set<number | string>();
  return mine.filter((d) => {
    const k = d.itemId ?? d.itemName ?? '';
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
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
 *
 * "When a player has all of them" is decided by the drop that gives one player the last row they
 * were missing, and rests on that player's drops up to it: whoever else was close changes nothing.
 */
export function endingDrop(config: HuntConfig, drops: HuntDrop[], window: { startMs: number | null; endMs: number | null }): { at: string; deciding: HuntDrop[] } | null {
  if (config.ends.kind === 'all') {
    const done = completionOf(config, countedDrops(drops, window));
    let first: { rsnKey: string; at: string } | null = null;
    for (const [rsnKey, at] of done) if (!first || Date.parse(at) < Date.parse(first.at)) first = { rsnKey, at };
    if (!first) return null;
    const winner = first;
    return { at: winner.at, deciding: countedDrops(drops, window).filter((d) => d.rsnKey === winner.rsnKey && Date.parse(d.occurredAt) <= Date.parse(winner.at)) };
  }
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
 * When each player first held every row, by rsn key: only the players who have. `counted` is
 * oldest first (countedDrops). A pet the plugin never named fills no row.
 */
export function completionOf(config: HuntConfig, counted: HuntDrop[]): Map<string, string> {
  const rows = new Set(huntRows(config).map((r) => r.id));
  const held = new Map<string, Set<number>>();
  const done = new Map<string, string>();
  if (rows.size === 0) return done;
  for (const d of counted) {
    if (d.itemId == null || !rows.has(d.itemId) || done.has(d.rsnKey)) continue;
    const mine = held.get(d.rsnKey) ?? new Set<number>();
    mine.add(d.itemId);
    held.set(d.rsnKey, mine);
    if (mine.size === rows.size) done.set(d.rsnKey, d.occurredAt);
  }
  return done;
}

/** How many of the hunt's rows a player holds: the "2 of 3" beside their name. */
export function rowsHeld(config: HuntConfig, mine: HuntDrop[]): number {
  const rows = new Set(huntRows(config).map((r) => r.id));
  return new Set(mine.filter((d) => d.itemId != null && rows.has(d.itemId)).map((d) => d.itemId)).size;
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
 * Everyone without a drop follows, ordered by Due (huntRowProgress: how much of the rows' drop
 * rates they have worked through) when the hunt has a rate to go on, else by kills at the source
 * (who is driest), then by name.
 *
 * "When a player has all of them": whoever held every row first is first, whatever the rule; the
 * rest rank by the rule as above.
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
  const complete = config.ends.kind === 'all' ? completionOf(config, counted) : null;

  const rows = entrants.map((e): HuntRow => {
    const mine = byRsn.get(huntRsnKey(e.rsn)) ?? [];
    const scoring = scoringDrops(config, mine);
    let count = 0;
    for (const d of scoring) count += dropScore(config, d);
    const rush = isRush(config) ? rushTotal(config.rush, e.rush?.kc ?? 0, e.rush?.deaths ?? 0, count, e.rush?.synergy ?? 0, e.rush?.adjust ?? 0) : undefined;
    if (rush) count = rush.total;
    return {
      rsn: e.rsn,
      rank: 0,
      count,
      drops: mine,
      firstAt: mine[0]?.occurredAt ?? null,
      lastAt: mine[mine.length - 1]?.occurredAt ?? null,
      // Drops are oldest first, so the last one is the one that brought the total to where it is.
      reachedAt: scoring[scoring.length - 1]?.occurredAt ?? null,
      statGain: e.statGain,
      due: e.due ?? null,
      held: rowsHeld(config, mine),
      completeAt: complete?.get(huntRsnKey(e.rsn)) ?? null,
      ...(rush ? { rush } : {}),
    };
  });

  const t = (s: string | null) => (s ? Date.parse(s) : Number.POSITIVE_INFINITY);
  // Due orders the driest only when some entrant has one: no row with a rate (or nobody's starting
  // line read yet) keeps the order every hunt had before.
  const byDue = entrants.some((e) => e.due != null);
  rows.sort((a, b) => {
    // A rush is one number, below zero too when the host lets it: the kills behind it break a tie.
    if (a.rush && b.rush) return b.count - a.count || b.rush.kc - a.rush.kc || t(a.reachedAt) - t(b.reachedAt) || a.rsn.localeCompare(b.rsn);
    if (complete && (a.completeAt != null || b.completeAt != null)) {
      if (a.completeAt == null || b.completeAt == null) return a.completeAt ? -1 : 1;
      return t(a.completeAt) - t(b.completeAt) || a.rsn.localeCompare(b.rsn);
    }
    const aIn = a.count > 0;
    const bIn = b.count > 0;
    if (aIn !== bIn) return aIn ? -1 : 1;
    if (aIn && bIn) {
      if (config.rule !== 'first') return b.count - a.count || t(a.reachedAt) - t(b.reachedAt) || a.rsn.localeCompare(b.rsn);
      return t(a.firstAt) - t(b.firstAt) || a.rsn.localeCompare(b.rsn);
    }
    if (byDue) return (b.due ?? 0) - (a.due ?? 0) || (b.statGain ?? 0) - (a.statGain ?? 0) || a.rsn.localeCompare(b.rsn);
    return (b.statGain ?? 0) - (a.statGain ?? 0) || a.rsn.localeCompare(b.rsn);
  });
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

/** "1st", "2nd", "11th". */
export function placeWords(place: number): string {
  const mod100 = place % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${place}th`;
  return `${place}${['th', 'st', 'nd', 'rd'][place % 10] ?? 'th'}`;
}

/**
 * A "first to get it" player with a drop: finished, in the place their first counting drop gave them
 * (rankHunt orders them by firstAt). "Done · 1st".
 */
export function firstDoneWords(rank: number): string {
  return `Done · ${placeWords(rank)}`;
}

/**
 * What "first to get it" means with several targets. A drop is never used up for everyone: any one
 * target finishes a player, places go by when each got their first, and whoever has none yet can
 * still take the next place.
 */
export function firstRuleWords(targets: number): string {
  return targets > 1
    ? `Any one of the ${targets} targets counts. A player is done once they get one, placed by when they got it. Everyone else can still place: the next to get any of them takes the next place.`
    : 'A player is done once they get it, placed by when they got it. Everyone else can still place: the next to get one takes the next place.';
}

// ── Bounties: per row, the first N players to get one ──────────────────────────────────────────

/** How many players one row's bounty may pay. */
export const MAX_BOUNTY_PLACES = 10;
/** The same guard the place prizes have (lib/weeklyPrizes): a typo must not reserve a number nobody meant. */
const MAX_BOUNTY_GP = 5_000_000_000;
/** The editor's default taper: each next place gets this much less. */
export const DEFAULT_BOUNTY_TAPER = 50;

/**
 * A row's bounty as stored: whole positive amounts, first place first, at most MAX_BOUNTY_PLACES. A
 * single number pays only the first. The list ends at the first place with no amount, so [20m, 0, 5m]
 * pays one place. Undefined when it pays nobody.
 */
export function bountyFromInput(raw: unknown): number[] | undefined {
  const list = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
  const out: number[] = [];
  for (const v of list.slice(0, MAX_BOUNTY_PLACES)) {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n) || n < 1) break;
    out.push(Math.min(MAX_BOUNTY_GP, Math.floor(n)));
  }
  return out.length ? out : undefined;
}

/**
 * The editor's fill: `first` for the first place and `n` places in all, each next one `taperPct`
 * percent less (null = the same for all). Rounded to a thousand once it is that big, so 20m tapers to
 * 10m and 5m, not 9,999,999. Staff can change any place by hand after; what is stored is the list.
 */
export function taperBounty(first: number, n: number, taperPct: number | null): number[] {
  const places = Math.max(0, Math.min(MAX_BOUNTY_PLACES, Math.floor(n)));
  const top = Math.max(0, Math.min(MAX_BOUNTY_GP, Math.floor(first)));
  if (top < 1 || places === 0) return [];
  const cut = taperPct == null ? 0 : Math.max(0, Math.min(100, taperPct)) / 100;
  const out: number[] = [];
  let amount = top;
  for (let i = 0; i < places; i++) {
    const rounded = amount >= 10_000 ? Math.round(amount / 1000) * 1000 : Math.round(amount);
    if (rounded < 1) break;
    out.push(rounded);
    amount *= 1 - cut;
  }
  return out;
}

/** The rows with a bounty on them. */
export function huntBountyRows(config: HuntConfig | null): HuntItem[] {
  return config ? huntRows(config).filter((r) => (r.bounty?.length ?? 0) > 0) : [];
}

/** The bounties as one comparable value: what a change to them is judged by (only staff who pay prizes may make one). */
export function huntBountyKey(config: HuntConfig | null): string {
  return JSON.stringify(huntBountyRows(config).map((r) => [r.id, r.bounty]));
}

/** Everything the bounties could pay, if every place of every one is claimed. */
export function huntBountyTotal(config: HuntConfig | null): number {
  return huntBountyRows(config).reduce((sum, r) => sum + (r.bounty ?? []).reduce((a, b) => a + b, 0), 0);
}

/** One place of one row's bounty, claimed by a drop. */
export interface BountyClaim {
  itemId: number;
  itemName: string;
  /** 1 = the first player to get this row. */
  place: number;
  amount: number;
  rsnKey: string;
  dropId: number;
  occurredAt: string;
}

/**
 * Who has claimed which bounty, place by place. Only COUNTED drops inside the window claim (a held
 * report or a waiting proof claims once staff approve it; a turned-down one never does), oldest
 * first, so the place a drop takes goes by when it happened. Each player claims a row's bounty once:
 * their second Baron is not the Baron's second place. `who` narrows it to the players who can be paid
 * (the prize settle's eligible list); everyone else's drops neither claim nor block a place.
 */
export function huntBountyClaims(
  config: HuntConfig,
  drops: HuntDrop[],
  window: { startMs: number | null; endMs: number | null },
  who?: Set<string>,
): BountyClaim[] {
  const rows = huntBountyRows(config);
  if (rows.length === 0) return [];
  const counted = countedDrops(drops, window).filter((d) => !who || who.has(d.rsnKey));
  const out: BountyClaim[] = [];
  for (const row of rows) {
    const amounts = row.bounty ?? [];
    const claimed = new Set<string>();
    for (const d of counted) {
      if (claimed.size >= amounts.length) break;
      if (d.itemId !== row.id || claimed.has(d.rsnKey)) continue;
      claimed.add(d.rsnKey);
      out.push({ itemId: row.id, itemName: row.name, place: claimed.size, amount: amounts[claimed.size - 1], rsnKey: d.rsnKey, dropId: d.id, occurredAt: d.occurredAt });
    }
  }
  return out;
}

/**
 * The drops behind claimed bounties that staff have not confirmed yet: the bounty settle waits on
 * them, as the place prizes wait on theirs (unconfirmedPrizeDrops). None when plugin drops count
 * automatically.
 */
export function unconfirmedBountyDrops(config: HuntConfig, claims: BountyClaim[], drops: HuntDrop[]): HuntDrop[] {
  if (config.confirm === 'auto' || claims.length === 0) return [];
  const ids = new Set(claims.map((c) => c.dropId));
  return drops.filter((d) => ids.has(d.id) && !d.confirmed);
}

/** Each bounty row with who has claimed it so far, in claim order: the page's and the panel's list. */
export function huntBountyBoard(
  config: HuntConfig,
  drops: HuntDrop[],
  window: { startMs: number | null; endMs: number | null },
  nameOf: (rsnKey: string) => string,
): { itemId: number; name: string; amounts: number[]; claimedBy: string[] }[] {
  const claims = huntBountyClaims(config, drops, window);
  return huntBountyRows(config).map((r) => ({
    itemId: r.id,
    name: r.name,
    amounts: r.bounty ?? [],
    claimedBy: claims.filter((c) => c.itemId === r.id).map((c) => nameOf(c.rsnKey)),
  }));
}

/** "20m / 10m / 5m": a row's bounty ladder, in the short gp words the posts use. */
export function bountyLadderWords(amounts: number[], gp: (n: number) => string): string {
  return amounts.map(gp).join(' / ');
}

/** "1 of 3 claimed (Minyol)" / "open": how far one row's bounty has gone. */
export function bountyClaimWords(amounts: number[], claimedBy: string[]): string {
  if (claimedBy.length === 0) return 'open';
  if (amounts.length === 1) return `claimed (${claimedBy[0]})`;
  return `${claimedBy.length} of ${amounts.length} claimed (${claimedBy.join(', ')})`;
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
  // A v2 list mixes boss rows and skill rows: the proof says whichever its row has.
  if (config.v === 2) return 'either';
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
