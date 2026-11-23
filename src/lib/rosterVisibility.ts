// Who a clan's public pages may name.
//
// Every character is public, with one exception: a person banned from the platform. The rule these
// helpers hold:
//
//   An INSIDER of the clan — someone with a live seat in it, its staff, platform staff — sees the
//   whole roster. Everyone else sees every character except those of a platform-banned owner.
//
// Counts and clan-wide totals are not names and stay whole; only rows that NAME a hidden character
// are dropped.
//
// PURE — tests/member-privacy.test.ts. The reads that feed it live in lib/clanInsider.

/** One spelling per character name: case, spaces, underscores and hyphens all compare equal. */
export function rsnKey(rsn: string): string {
  return rsn.trim().toLowerCase().replace(/[\s_ -]+/g, ' ');
}

export type HiddenNames = ReadonlySet<string>;

export function hiddenNameSet(rsns: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const r of rsns) out.add(rsnKey(r));
  return out;
}

export function isHiddenName(hidden: HiddenNames, rsn: string | null | undefined): boolean {
  return !!rsn && hidden.size > 0 && hidden.has(rsnKey(rsn));
}

/** Rows that name a character (`rsn`), without the hidden ones. */
export function withoutHiddenRows<T extends { rsn?: string | null }>(rows: T[], hidden: HiddenNames): T[] {
  return hidden.size === 0 ? rows : rows.filter((r) => !isHiddenName(hidden, r.rsn));
}

/** A record keyed by character name (streak weeks, flair by name), without the hidden keys. */
export function withoutHiddenKeys<V>(record: Record<string, V>, hidden: HiddenNames): Record<string, V> {
  if (hidden.size === 0) return record;
  return Object.fromEntries(Object.entries(record).filter(([rsn]) => !isHiddenName(hidden, rsn)));
}

/**
 * The same value with every array element that names a hidden character removed, however deep.
 *
 * For the page-sized view models (clan analytics, activity boards, luck boards) whose leaderboards
 * are arrays of `{ rsn, … }` nested under headings: one walk instead of a filter per board, so a
 * board added later is covered without anyone remembering to add its filter. Totals and counts are
 * untouched — they are numbers, not rows.
 */
export function withoutHiddenNames<T>(value: T, hidden: HiddenNames): T {
  if (hidden.size === 0) return value;
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) {
      return v
        .filter((el) => !(el && typeof el === 'object' && !Array.isArray(el) && isHiddenName(hidden, (el as { rsn?: unknown }).rsn as string)))
        .map(walk);
    }
    if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)]));
    }
    return v;
  };
  return walk(value) as T;
}

/**
 * May this character be listed on a person's "also plays" card (the persona) for this viewer?
 *
 * Listing a character under a person LINKS it to them. A clan insider sees the characters the clan
 * holds a seat for, plus every other one when the owner agreed to link them. Someone outside the
 * clan gets only the second kind — a seat in a clan they are not in is not theirs to learn about.
 */
export function personaCharacterVisible(c: {
  insider: boolean;
  seatedHere: boolean;
  /** players.linkAccountsPublicly, and the person is not banned. */
  linkable: boolean;
}): boolean {
  if (c.linkable) return true;
  return c.insider && c.seatedHere;
}
