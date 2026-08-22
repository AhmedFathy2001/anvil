// The item-by-item progress a player browses: which quests are done, and — once the combat-task
// walk is confirmed against a live client — which tasks. The counters live in lib/memberProgress;
// this is the list behind them.
//
// The client sends NAMES along with state, and we keep them. A dataset here would be a second place
// to be wrong about a game that ships new quests every few months, and it would list nothing at all
// for anything released since somebody last ran a build script.
//
// Pure — parsing, validation and filtering are arithmetic over a payload, so tests run them directly
// (tests/member-progress-items.test.ts).

export type ItemCategory = 'quest' | 'ca';

/** 0 = not started, 1 = in progress, 2 = finished — the game's own three states. */
export type ItemState = 0 | 1 | 2;

export interface ProgressItem {
  id: number;
  name: string;
  state: ItemState;
  /** The client's own grouping: a quest's difficulty, a combat task's boss. */
  group?: string | null;
}

const MAX_ITEMS = 1_000;
const MAX_NAME = 80;
const CATEGORIES: ItemCategory[] = ['quest', 'ca'];

export function isItemCategory(value: unknown): value is ItemCategory {
  return typeof value === 'string' && (CATEGORIES as string[]).includes(value);
}

/**
 * Clean an incoming list. Bad entries drop one at a time — a single malformed row shouldn't cost a
 * member the other two hundred — and the whole thing is capped so a broken client can't post a
 * novel.
 */
export function cleanItems(raw: unknown): ProgressItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: ProgressItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const id = typeof row.id === 'number' && Number.isFinite(row.id) ? Math.floor(row.id) : null;
    const name = typeof row.name === 'string' ? row.name.trim().slice(0, MAX_NAME) : '';
    if (id == null || id < 0 || !name || seen.has(id)) continue;
    const stateRaw = typeof row.state === 'number' ? Math.floor(row.state) : 0;
    if (stateRaw < 0 || stateRaw > 2) continue;
    seen.add(id);
    out.push({
      id,
      name,
      state: stateRaw as ItemState,
      group: typeof row.group === 'string' && row.group ? row.group.slice(0, 40) : null,
    });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

/** Serialise for storage, name-sorted so a stored payload is stable and diffable. */
export function serializeItems(items: ProgressItem[]): string {
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
  return JSON.stringify({ items: sorted });
}

/** Read a stored payload back. Anything unreadable is an empty list, never a throw. */
export function parseItems(payload: string | null | undefined): ProgressItem[] {
  if (!payload) return [];
  try {
    const parsed = JSON.parse(payload) as { items?: unknown };
    return cleanItems(parsed?.items);
  } catch {
    return [];
  }
}

export function countDone(items: ProgressItem[]): number {
  return items.filter((i) => i.state === 2).length;
}

export type ItemFilter = 'all' | 'done' | 'todo' | 'started';

/**
 * The list a browser shows: searched, filtered, and ordered so the interesting rows come first.
 *
 * Unfinished before finished, because the question people open this to answer is "what's left" far
 * more often than "what did I do".
 */
export function filterItems(
  items: ProgressItem[],
  opts: { search?: string; filter?: ItemFilter; group?: string | null } = {},
): ProgressItem[] {
  const needle = (opts.search ?? '').trim().toLowerCase();
  const filter = opts.filter ?? 'all';
  const group = opts.group ?? null;
  return items
    .filter((item) => {
      if (needle && !item.name.toLowerCase().includes(needle)) return false;
      if (group && (item.group ?? '') !== group) return false;
      if (filter === 'done') return item.state === 2;
      if (filter === 'todo') return item.state !== 2;
      if (filter === 'started') return item.state === 1;
      return true;
    })
    .sort((a, b) => a.state - b.state || a.name.localeCompare(b.name));
}

/** Every group present, in the order a filter row should offer them. */
export function itemGroups(items: ProgressItem[]): string[] {
  const groups = new Set<string>();
  for (const item of items) {
    if (item.group) groups.add(item.group);
  }
  return [...groups].sort((a, b) => a.localeCompare(b));
}
