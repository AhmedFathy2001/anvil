import { maskRaceTilesForSession } from '@/lib/raceHideAheadDb';
import { HIDDEN_RACE_TILE_LABEL, isRaceHidden } from '@/lib/raceHideAhead';
import { NextResponse } from 'next/server';
import { and, count, desc, eq, inArray, isNotNull, isNull, or, type SQL } from 'drizzle-orm';

import { db } from '@/db';
import { eventParticipants, submissions, teams, tiles } from '@/db/schema';
import { verifyAdminOrModerator } from '@/lib/auth';
import { eventForRequest } from '@/lib/eventScope';
import { attachmentsFor } from '@/lib/proofAttachmentsDb';
import { PROOF_FEED_PAGE_SIZE, parseProofFeedQuery } from '@/lib/proofFeedQuery';

/**
 * Every proof on one board, newest first — the "All proofs" feed (Admin → event → Proofs).
 *
 * Flagged proofs have a queue (Home, /admin/proofs). Everything else counted automatically and had
 * nowhere to be looked at except tile by tile. This is the browse: filter by team, tile, player or
 * flag state, a page at a time. Acting on a row reuses the existing submission routes (PATCH
 * clear-flag for "Looks fine", DELETE with a reason for "Remove"), so the rules there — the event
 * lock, the Discord notice, recomputing the tile — stay in one place.
 *
 * Moderation tier, the same as removing a proof: checking proofs is a moderator's job. Scoped
 * grants (one board's editor or treasurer) are not moderators and are refused.
 */
export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const eId = parseInt((await params).eventId, 10);
  if (!Number.isFinite(eId)) return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  // Whose event is this? Ids are global and this one came from the URL.
  const event = await eventForRequest(request, eId);
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await verifyAdminOrModerator())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = parseProofFeedQuery(new URL(request.url).searchParams);

  const [tileRows, teamRows, playerRows] = await Promise.all([
    db
      .select({ id: tiles.id, label: tiles.label, parentTileId: tiles.parentTileId })
      .from(tiles)
      .where(eq(tiles.eventId, eId))
      // "Also hide from event staff" (lib/raceHideAhead): a tile no team can see yet is a locked "?".
      .then((list) => maskRaceTilesForSession(event, list)),
    db.select({ id: teams.id, name: teams.name, color: teams.color }).from(teams).where(eq(teams.eventId, eId)),
    db
      .select({ id: eventParticipants.id, name: eventParticipants.name, teamId: eventParticipants.teamId })
      .from(eventParticipants)
      .where(eq(eventParticipants.eventId, eId)),
  ]);
  const filters = {
    teams: teamRows.map((t) => ({ id: t.id, name: t.name, color: t.color })),
    tiles: tileRows.filter((t) => t.parentTileId == null).map((t) => ({ id: t.id, label: t.label })),
    players: playerRows.map((p) => ({ id: p.id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name)),
  };
  if (tileRows.length === 0) {
    return NextResponse.json({ rows: [], total: 0, page: 1, pageSize: PROOF_FEED_PAGE_SIZE, filters });
  }

  // clan-scope: this clan -- every condition starts from this event's own tile ids.
  const conds: SQL[] = [inArray(submissions.tileId, tileRows.map((t) => t.id))];
  if (q.teamId) conds.push(eq(submissions.teamId, q.teamId));
  if (q.tileId) {
    // A combo's proof is its parts' (lib/combo): the parts ride along with it.
    conds.push(inArray(submissions.tileId, [q.tileId, ...tileRows.filter((t) => t.parentTileId === q.tileId).map((t) => t.id)]));
  }
  if (q.playerId) {
    conds.push(or(eq(submissions.creditPlayerId, q.playerId), eq(submissions.playerId, q.playerId))!);
  }
  if (q.flag === 'flagged') conds.push(isNotNull(submissions.flaggedReason));
  if (q.flag === 'unflagged') conds.push(isNull(submissions.flaggedReason));
  const where = and(...conds);

  const [rows, [{ c: total }]] = await Promise.all([
    db
      .select({
        id: submissions.id,
        tileId: submissions.tileId,
        teamId: submissions.teamId,
        playerId: submissions.playerId,
        creditPlayerId: submissions.creditPlayerId,
        amount: submissions.amount,
        imageUrl: submissions.imageUrl,
        note: submissions.note,
        source: submissions.source,
        flaggedReason: submissions.flaggedReason,
        createdAt: submissions.createdAt,
      })
      .from(submissions)
      .where(where)
      .orderBy(desc(submissions.createdAt), desc(submissions.id))
      .limit(PROOF_FEED_PAGE_SIZE)
      .offset((q.page - 1) * PROOF_FEED_PAGE_SIZE),
    db.select({ c: count() }).from(submissions).where(where),
  ]);

  const tileLabel = new Map(tileRows.map((t) => [t.id, t.label]));
  // Parts of a hidden combo were dropped with it; their proofs go with their combo's secret.
  const hiddenTile = (id: number) => !tileLabel.has(id) || tileRows.some((t) => t.id === id && isRaceHidden(t));
  const teamName = new Map(teamRows.map((t) => [t.id, t.name]));
  const playerName = new Map(playerRows.map((p) => [p.id, p.name]));

  const extras = await attachmentsFor(rows.map((r) => r.id));
  return NextResponse.json({
    rows: rows.map((r) => ({
      ...r,
      ...(hiddenTile(r.tileId) ? { imageUrl: null, note: null } : {}),
      attachments: hiddenTile(r.tileId) ? [] : extras.get(r.id) ?? [],
      tileLabel: hiddenTile(r.tileId) ? HIDDEN_RACE_TILE_LABEL : tileLabel.get(r.tileId) ?? 'Tile',
      teamName: teamName.get(r.teamId) ?? 'Team',
      playerName:
        (r.creditPlayerId ? playerName.get(r.creditPlayerId) : null) ??
        (r.playerId ? playerName.get(r.playerId) : null) ??
        null,
    })),
    total: Number(total),
    page: q.page,
    pageSize: PROOF_FEED_PAGE_SIZE,
    filters,
  });
}
