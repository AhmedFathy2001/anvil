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

// ── Account-type probe ───────────────────────────────────────────────────────────────────────────
//
// For an account the plugin has never reported a game mode for, walk the hiscores' mode tables:
// ironman, then ultimate, then hardcore. Each is its own table, so a step is one queued fetch.
//
// Membership alone is not enough: a de-ironed account stays on the ironman table, frozen at the
// moment it de-ironed, and a dead hardcore's hardcore entry stops moving. So a table counts only
// when its overall XP has kept up with the main table's — the account is still playing that mode.
//
// What the hiscores cannot say: an account missing from the ironman table is a regular account OR
// a group ironman (group modes have no individual tables). That case is recorded as "probed" with
// no type, rather than guessing "Regular" for somebody's GIM. The plugin's report always wins.
//
// A MODE ONLY EVER GOES DOWN — de-ironing, a hardcore death, an ultimate dropping the restriction —
// so a solo-iron mode, whoever set it, is RE-CHECKED now and then (RECHECK_AFTER_MS): start at the
// held mode's own table; still current keeps it, otherwise fall back to the ironman table, and an
// ironman table left behind means the account de-ironed. Missing from a table is never evidence of
// a change on a re-check (the mode is kept); only a frozen entry is. Regular and the group modes are
// never re-checked: regular cannot re-iron, and the hiscores cannot see group modes.

/** How long a solo-iron mode stands before the hiscores are asked again. */
export const RECHECK_AFTER_MS = 7 * 24 * 60 * 60_000;

export type ProbeMode = 'ironman' | 'ultimate' | 'hardcore';
export type ProbedType = 'normal' | 'ironman' | 'ultimate' | 'hardcore';

export type ProbeStep =
  /** Settled. `type` null = "not a solo ironman, mode unknown" (regular or group). */
  | { kind: 'done'; type: ProbedType | null }
  /** Fetch the next table. */
  | { kind: 'next'; mode: ProbeMode }
  /** Could not read this step; try the whole probe again later. */
  | { kind: 'retry' };

/** The modes the hiscores can confirm — and so the only ones worth re-checking. */
const SOLO_IRON = ['ironman', 'ultimate', 'hardcore'] as const;

export function isSoloIron(type: string | null | undefined): type is ProbeMode {
  return (SOLO_IRON as readonly string[]).includes(type ?? '');
}

/** The table a probe starts at: the held mode's own for a re-check, ironman for a first walk. */
export function probeStartMode(held: string | null | undefined): ProbeMode {
  return isSoloIron(held) ? held : 'ironman';
}

/**
 * One probe step. `tableXp` is the overall XP on the fetched mode table (null when the account is
 * not on it), `mainXp` the account's overall XP from the main table, `held` the mode the account has
 * right now (null = never typed: a first walk; a solo-iron mode = a re-check).
 */
export function nextProbeStep(
  mode: ProbeMode,
  outcome: 'ok' | 'unranked' | 'transient',
  tableXp: number | null,
  mainXp: number | null,
  held: string | null = null,
): ProbeStep {
  if (outcome === 'transient') return { kind: 'retry' };
  if (mainXp == null || mainXp <= 0) return { kind: 'retry' };
  const listed = outcome === 'ok' && tableXp != null && tableXp > 0;
  // Kept up: the mode table has at least what the main table had when we last read it. (Read a
  // little later, it can be ahead; never legitimately behind while the mode is still held.)
  const current = listed && tableXp >= mainXp;

  if (held != null) {
    // Typed by someone else (the plugin) mid-walk, as a mode the hiscores can't confirm: stop.
    if (!isSoloIron(held)) return { kind: 'done', type: null };
    // A re-check. Its own table first; the ironman table is the fallback.
    if (mode !== 'ironman') {
      if (current) return { kind: 'done', type: held };
      return { kind: 'next', mode: 'ironman' };
    }
    if (current) return { kind: 'done', type: 'ironman' };
    // Behind on the ironman table: de-ironed. Simply missing: no evidence either way — keep it.
    return { kind: 'done', type: listed ? 'normal' : held };
  }

  switch (mode) {
    case 'ironman':
      if (!listed) return { kind: 'done', type: null };
      return current ? { kind: 'next', mode: 'ultimate' } : { kind: 'done', type: 'normal' };
    case 'ultimate':
      return current ? { kind: 'done', type: 'ultimate' } : { kind: 'next', mode: 'hardcore' };
    case 'hardcore':
      return { kind: 'done', type: current ? 'hardcore' : 'ironman' };
  }
}
