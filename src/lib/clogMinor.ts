// A collection-log page's minor slots: the ones a bingo doesn't mean by "a unique" (bolt racks on
// Barrows, ToA's jewels and shrouds, a raid's kits). Built by scripts/build-clog-minor.mjs, whose
// header states the rule. Pure — the editor, the matcher and the tests all read it.

import data from '@/data/clogMinor.json';

const PAGES = (data as { pages: Record<string, number[]> }).pages;
const SETS = new Map(Object.entries(PAGES).map(([page, ids]) => [page, new Set(ids)]));
const EMPTY: ReadonlySet<number> = new Set();

/** The page's minor slot ids (empty for a page with none). */
export function clogMinorIds(page: string): ReadonlySet<number> {
  return SETS.get(page) ?? EMPTY;
}

/** Does this page have minor slots to leave out? */
export function pageHasMinor(page: string): boolean {
  return SETS.has(page);
}

/** The page's items without its minor slots (the whole list when it has none). */
export function pageUniques<T extends { id: number }>(page: string, items: readonly T[]): T[] {
  const minor = clogMinorIds(page);
  return minor.size === 0 ? [...items] : items.filter((it) => !minor.has(it.id));
}
