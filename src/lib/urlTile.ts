// The open tile lives in the address (?tile=ID): it deep-links, and Back closes the dialog instead
// of leaving the page. These are the pure rules; `useUrlTile` (hooks) does the history calls.

/** The tile id a `?tile=` value names, or null when it is missing or not a positive whole number. */
export function parseTileParam(raw: string | null | undefined): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export type TileUrlStep =
  /** Add a history entry: the first tile opened on this page view. */
  | { kind: 'push'; url: string }
  /** Rewrite the current entry: switching tile while one is open, or closing a deep-linked one. */
  | { kind: 'replace'; url: string }
  /** Step back over the entry we pushed on open. */
  | { kind: 'back' };

/**
 * What to do to the history when the open tile changes to `id` (null closes).
 * `pushedByUs` says whether the current `?tile=` entry is one this page pushed.
 */
export function tileUrlStep(href: string, id: number | null, pushedByUs: boolean): TileUrlStep {
  const url = new URL(href);
  const rel = () => `${url.pathname}${url.search}${url.hash}`;
  if (id == null) {
    if (pushedByUs) return { kind: 'back' };
    url.searchParams.delete('tile');
    return { kind: 'replace', url: rel() };
  }
  const alreadyOpen = url.searchParams.has('tile');
  url.searchParams.set('tile', String(id));
  return { kind: alreadyOpen ? 'replace' : 'push', url: rel() };
}
