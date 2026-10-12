// The pure half of the Forge fetch queue (lib/forgeFetchQueue): what a fetched row means, and which
// work entry it belongs to. No database and no `@/` imports, so it is tested directly
// (tests/forge-fetch-result.test.ts) — the parser and the RSN normaliser are passed in.

/** The sweep's own tagged fetch result (lib/hiscores SnapshotFetch), restated to keep this module pure. */
export type FetchResult<S> = { kind: 'value'; snapshot: S } | { kind: 'unranked' } | { kind: 'transient' };

export interface FetchedRow {
  id: number;
  rsnKey: string;
  outcome: string | null;
  body: string | null;
  fetchedAt: Date;
}

/**
 * A result older than this is dropped, not applied.
 *
 * The apply path compares a read against the account's last snapshot — less overall XP than last
 * time is taken as "a stranger has this name now" and parks the account. A read that sat in the
 * queue while a newer one was applied would trip exactly that. Normal drains run every few minutes,
 * so anything this old only exists because the drain was down, and the next request is cheap.
 */
export const MAX_RESULT_AGE_MS = 30 * 60_000;

/** Turn a stored row into the sweep's result. An unparseable body is a transient miss, never a throw. */
export function toFetchResult<S>(row: Pick<FetchedRow, 'outcome' | 'body'>, parse: (body: string) => S): FetchResult<S> {
  if (row.outcome === 'unranked') return { kind: 'unranked' };
  if (row.outcome !== 'ok' || !row.body) return { kind: 'transient' };
  try {
    return { kind: 'value', snapshot: parse(row.body) };
  } catch {
    return { kind: 'transient' };
  }
}

export interface ApplyPlan<E> {
  /** One per (entry, result). Several entries can share an RSN key; each gets the same read. */
  applies: { entry: E; rowId: number; fetchedAt: Date }[];
  /** Keys a result was applied for this drain — not worth queueing again this tick. */
  appliedKeys: Set<string>;
  /** Results too old to trust (see MAX_RESULT_AGE_MS). */
  stale: number;
  /** Results no current work entry wants: the account left every source between queue and fetch. */
  orphaned: number;
}

/**
 * Match fetched rows to work entries by normalised RSN. When a key was fetched twice the newest read
 * wins; the older one is simply superseded.
 */
export function planForgeApply<E extends { fetchRsn: string }>(
  rows: FetchedRow[],
  work: E[],
  keyOf: (rsn: string) => string,
  now: Date,
  maxAgeMs: number = MAX_RESULT_AGE_MS,
): ApplyPlan<E> {
  const newest = new Map<string, FetchedRow>();
  let stale = 0;
  for (const row of rows) {
    if (now.getTime() - row.fetchedAt.getTime() > maxAgeMs) {
      stale++;
      continue;
    }
    const prev = newest.get(row.rsnKey);
    if (!prev || row.fetchedAt > prev.fetchedAt) newest.set(row.rsnKey, row);
  }

  const byKey = new Map<string, E[]>();
  for (const entry of work) {
    const key = keyOf(entry.fetchRsn);
    const list = byKey.get(key);
    if (list) list.push(entry);
    else byKey.set(key, [entry]);
  }

  const applies: ApplyPlan<E>['applies'] = [];
  const appliedKeys = new Set<string>();
  let orphaned = 0;
  for (const [key, row] of newest) {
    const entries = byKey.get(key);
    if (!entries) {
      orphaned++;
      continue;
    }
    appliedKeys.add(key);
    for (const entry of entries) applies.push({ entry, rowId: row.id, fetchedAt: row.fetchedAt });
  }
  return { applies, appliedKeys, stale, orphaned };
}
