/**
 * A per-webhook drop filter from a request body: blank / missing / not a positive number = null (follow
 * the person's own drop settings), else a whole number of at least 1.
 */
export function filterNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 2_147_483_647) : null;
}

/** A per-webhook "either / both" choice: 'or' | 'and', anything else = null (follow the person's). */
export function filterMode(v: unknown): 'or' | 'and' | null {
  return v === 'or' || v === 'and' ? v : null;
}
