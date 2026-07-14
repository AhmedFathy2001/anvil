import { db } from '@/db';
import { submissions, completions, tiles, players } from '@/db/schema';
import { and, eq, gt, inArray, sql } from 'drizzle-orm';

/**
 * Team activity feed shaping for `GET /api/plugin/activity`. Turns the two append-only tables the
 * plugin already writes — {@link submissions} (every credited drop/kill/timed/etc.) and
 * {@link completions} (a tile finished) — into a single, cursor-paginated, player-attributed feed
 * the always-on sidebar renders newest-first.
 *
 * Design notes:
 *  - **Cursor** is `"s<lastSubId>_c<lastCompId>"` over the two tables' autoincrement ids. Both are
 *    monotonic, so "everything after the cursor" is a cheap indexed `id > ?` scan. Entry ids are
 *    namespaced (`s123` / `c45`) because the two id spaces overlap; the plugin dedups on that string.
 *  - **Idle is free**: the payload is deterministic for the same underlying rows, so the route wraps
 *    it in {@link jsonWithEtag} — an unchanged team → same cursor → same ETag → 304, no body.
 *  - **Bounded**: at most {@link PAGE} rows per table per call; `truncated` warns the client it may
 *    have skipped events (it should refetch the board rather than trust `progress` as complete).
 *  - Attribution comes from `submissions.creditPlayerId` (the player the game awarded the loot to).
 *    Stat/manual completions have no submission and stay unattributed (`player: null`).
 */

/** Max rows pulled per table per request. Keeps the payload (and the plugin's ingest) bounded. */
export const PAGE = 50;

/** How many recent events to backfill on a first call (no/blank cursor) so the feed isn't empty on open. */
const BACKFILL = 15;

export type ActivityKind = 'progress' | 'complete';

export interface ActivityEntry {
  /** Namespaced, globally-unique, monotonic-per-table id (`s<id>` submission, `c<id>` completion). Dedup key. */
  id: string;
  /** ISO timestamp of the underlying row (`submissions.createdAt` / `completions.completedAt`). */
  ts: string;
  /** Crediting RSN, or null for unattributed (stat/manual) completions. */
  player: string | null;
  tileId: number;
  tileLabel: string;
  kind: ActivityKind;
  /** Units credited by this event (drops/kills/gains); 0 for completions. */
  amount: number;
  /** True when the caller themselves credited this event — lets the panel style/label its own actions. */
  isSelf: boolean;
}

export interface ActivityPayload {
  /** New high-water cursor to send back as `?since=` next poll. Null only when there's no active event. */
  cursor: string;
  /** Newest-last (ascending by id); the panel prepends so newest shows on top. */
  activity: ActivityEntry[];
  /**
   * Best-effort team submission SUM(amount) per tile that changed in this batch — lets the panel
   * bump a progress bar without a full board refetch. Authoritative current/goal still comes from
   * the board/config; pass/fail tiles (timed/value/lms) should be read from their `complete` event,
   * not this sum. Only tiles appearing in `activity` are present.
   */
  progress: Record<number, number>;
  /** True when either table hit {@link PAGE}: the client may have missed events and should refetch the board. */
  truncated: boolean;
}

interface Cursor {
  sub: number;
  comp: number;
}

/** Parse `"s<n>_c<n>"`; anything malformed/blank → {0,0} (a first-call backfill). */
export function parseCursor(raw: string | null | undefined): Cursor {
  if (!raw) return { sub: 0, comp: 0 };
  const m = /^s(\d+)_c(\d+)$/.exec(raw.trim());
  if (!m) return { sub: 0, comp: 0 };
  return { sub: Number(m[1]) || 0, comp: Number(m[2]) || 0 };
}

export function formatCursor(c: Cursor): string {
  return `s${c.sub}_c${c.comp}`;
}

/**
 * Build the activity payload for one team since a cursor. On a first call (cursor {0,0}) it returns
 * the last {@link BACKFILL} events as history (so the panel opens with context) rather than the
 * whole backlog. `selfPlayerId` marks the caller's own events.
 */
export async function buildActivity(args: {
  teamId: number;
  selfPlayerId: number;
  /** Caller's RSN — completions attribute by name (not playerId), so self-matching a completion needs it. */
  selfRsn: string | null;
  since: Cursor;
}): Promise<ActivityPayload> {
  const { teamId, selfPlayerId, selfRsn, since } = args;
  const firstCall = since.sub === 0 && since.comp === 0;
  const limit = firstCall ? BACKFILL : PAGE;

  // --- submissions since cursor (attributed) -------------------------------------------------
  const subRows = await db
    .select({
      id: submissions.id,
      tileId: submissions.tileId,
      amount: submissions.amount,
      creditPlayerId: submissions.creditPlayerId,
      createdAt: submissions.createdAt,
    })
    .from(submissions)
    .where(and(eq(submissions.teamId, teamId), gt(submissions.id, since.sub)))
    .orderBy(firstCall ? sql`${submissions.id} desc` : submissions.id)
    .limit(limit);
  // First call pulls the newest N desc for recency; normalise to ascending-by-id like the delta path.
  if (firstCall) subRows.reverse();

  // --- completions since cursor --------------------------------------------------------------
  const compRows = await db
    .select({
      id: completions.id,
      tileId: completions.tileId,
      completedAt: completions.completedAt,
    })
    .from(completions)
    .where(and(eq(completions.teamId, teamId), gt(completions.id, since.comp)))
    .orderBy(firstCall ? sql`${completions.id} desc` : completions.id)
    .limit(limit);
  if (firstCall) compRows.reverse();

  const truncated = subRows.length >= limit || compRows.length >= limit;

  // --- resolve tile labels + crediting RSNs in bulk ------------------------------------------
  const tileIds = Array.from(new Set([...subRows.map((r) => r.tileId), ...compRows.map((r) => r.tileId)]));
  const labelById = new Map<number, string>();
  if (tileIds.length > 0) {
    const tileRows = await db
      .select({ id: tiles.id, label: tiles.label })
      .from(tiles)
      .where(inArray(tiles.id, tileIds));
    for (const t of tileRows) labelById.set(t.id, t.label);
  }

  const creditPlayerIds = Array.from(
    new Set(subRows.map((r) => r.creditPlayerId).filter((id): id is number => id != null)),
  );
  const rsnById = new Map<number, string>();
  if (creditPlayerIds.length > 0) {
    const pRows = await db
      .select({ id: players.id, name: players.name })
      .from(players)
      .where(inArray(players.id, creditPlayerIds));
    for (const p of pRows) rsnById.set(p.id, p.name);
  }

  // Completion attribution: the crediting player of the LATEST submission on each completed tile
  // (the finishing hand). Same approach as the config route's "completed by <who>".
  const completedTileIds = compRows.map((r) => r.tileId);
  const completedByTile = new Map<number, string>();
  if (completedTileIds.length > 0) {
    const creditRows = await db
      .select({ tileId: submissions.tileId, name: players.name })
      .from(submissions)
      .leftJoin(players, eq(submissions.creditPlayerId, players.id))
      .where(and(eq(submissions.teamId, teamId), inArray(submissions.tileId, completedTileIds)))
      .orderBy(submissions.createdAt); // ascending → last write per tile wins
    for (const r of creditRows) {
      if (r.name) completedByTile.set(r.tileId, r.name);
    }
  }

  // --- shape entries -------------------------------------------------------------------------
  const entries: ActivityEntry[] = [];
  for (const r of subRows) {
    entries.push({
      id: `s${r.id}`,
      ts: r.createdAt,
      player: r.creditPlayerId != null ? rsnById.get(r.creditPlayerId) ?? null : null,
      tileId: r.tileId,
      tileLabel: labelById.get(r.tileId) ?? `Tile #${r.tileId}`,
      kind: 'progress',
      amount: r.amount,
      isSelf: r.creditPlayerId != null && r.creditPlayerId === selfPlayerId,
    });
  }
  for (const r of compRows) {
    const who = completedByTile.get(r.tileId) ?? null;
    entries.push({
      id: `c${r.id}`,
      ts: r.completedAt,
      player: who,
      tileId: r.tileId,
      tileLabel: labelById.get(r.tileId) ?? `Tile #${r.tileId}`,
      kind: 'complete',
      amount: 0,
      isSelf: who != null && selfRsn != null && who === selfRsn,
    });
  }

  // Order newest-last by timestamp, tie-broken by namespaced id for a stable sequence.
  entries.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.id < b.id ? -1 : 1));

  // --- progress map: team SUM(amount) for each tile that had a submission in this batch -------
  const changedTileIds = Array.from(new Set(subRows.map((r) => r.tileId)));
  const progress: Record<number, number> = {};
  if (changedTileIds.length > 0) {
    const sums = await db
      .select({ tileId: submissions.tileId, total: sql<number>`coalesce(sum(${submissions.amount}), 0)` })
      .from(submissions)
      .where(and(eq(submissions.teamId, teamId), inArray(submissions.tileId, changedTileIds)))
      .groupBy(submissions.tileId);
    for (const s of sums) progress[s.tileId] = Number(s.total) || 0;
  }

  // --- advance the cursor to the high-water mark of what we returned -------------------------
  const maxSub = subRows.reduce((m, r) => Math.max(m, r.id), since.sub);
  const maxComp = compRows.reduce((m, r) => Math.max(m, r.id), since.comp);

  return {
    cursor: formatCursor({ sub: maxSub, comp: maxComp }),
    activity: entries,
    progress,
    truncated,
  };
}
