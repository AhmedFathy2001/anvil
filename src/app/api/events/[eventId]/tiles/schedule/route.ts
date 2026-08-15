import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tiles } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { verifyTileEditorForEvent } from '@/lib/auth';
import { assertEventEditable } from '@/lib/eventLock';
import { diffTiles, logTileAudit } from '@/lib/tile-audit';
import { staggeredTimes } from '@/lib/tileAuthoring';

// Lay a run of reveal times across a scheduled board.
//
// A Showdown's whole plan is "first tile at 6, then one an hour" — a dozen tiles is a dozen visits
// to a drawer and a dozen chances to typo a date. The generic bulk PATCH can't do it: it writes ONE
// value to every tile, and evenly spaced reveals are by definition a different value each.
//
// The order is the tileIds order the caller sends, so "these eight, from 6pm, 90 minutes apart"
// means what it looks like on screen. Already-revealed tiles are refused rather than silently
// skipped: rewriting the plan for a tile that already opened would say nothing about what members
// saw, and quietly dropping it from the run would shift every time after it.
const MAX_TILES = 500;

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);

  const editor = await verifyTileEditorForEvent(eId);
  if (!editor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const locked = await assertEventEditable(eId);
  if (locked) return locked;

  const body = (await request.json().catch(() => null)) as
    | { tileIds?: unknown; startAt?: unknown; intervalMinutes?: unknown }
    | null;

  const tileIds = Array.isArray(body?.tileIds)
    ? body.tileIds.filter((id): id is number => Number.isInteger(id))
    : [];
  if (tileIds.length === 0) {
    return NextResponse.json({ error: 'Pick at least one tile.' }, { status: 400 });
  }
  if (tileIds.length > MAX_TILES) {
    return NextResponse.json({ error: `That's more than ${MAX_TILES} tiles at once.` }, { status: 400 });
  }

  const startAt = typeof body?.startAt === 'string' ? body.startAt : '';
  if (!startAt || Number.isNaN(new Date(startAt).getTime())) {
    return NextResponse.json({ error: 'Give the first reveal a valid date and time.' }, { status: 400 });
  }
  const intervalMinutes =
    typeof body?.intervalMinutes === 'number' && Number.isFinite(body.intervalMinutes)
      ? Math.round(body.intervalMinutes)
      : NaN;
  if (!Number.isFinite(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 10080) {
    return NextResponse.json({ error: 'The gap must be between 1 minute and a week.' }, { status: 400 });
  }

  // Scoped to this event, so a stray id from another board can never be touched.
  const rows = await db
    .select()
    .from(tiles)
    .where(and(eq(tiles.eventId, eId), inArray(tiles.id, tileIds)));
  if (rows.length === 0) {
    return NextResponse.json({ error: 'None of those tiles are on this board.' }, { status: 404 });
  }

  const byId = new Map(rows.map((t) => [t.id, t]));
  // Keep the caller's order; drop ids that aren't on this board rather than failing the whole run.
  const ordered = tileIds.map((id) => byId.get(id)).filter((t): t is (typeof rows)[number] => !!t);

  const alreadyOpen = ordered.filter((t) => t.revealedAt);
  if (alreadyOpen.length > 0) {
    return NextResponse.json(
      {
        error: `${alreadyOpen.length} of those tiles ${
          alreadyOpen.length === 1 ? 'is' : 'are'
        } already open to members — leave them out of the run.`,
      },
      { status: 409 },
    );
  }

  const times = staggeredTimes(new Date(startAt).toISOString(), intervalMinutes, ordered.length);
  const updatedAt = new Date().toISOString();

  for (const [i, tile] of ordered.entries()) {
    await db
      .update(tiles)
      .set({ revealAt: times[i], updatedAt })
      .where(and(eq(tiles.eventId, eId), eq(tiles.id, tile.id)));
    logTileAudit({
      eventId: eId,
      action: 'updated',
      tileId: tile.id,
      tileLabel: tile.label,
      changedFields: diffTiles(tile, { ...tile, revealAt: times[i] }),
      actorUserId: editor.userId,
    });
  }

  return NextResponse.json({
    updated: ordered.length,
    updatedAt,
    schedule: ordered.map((t, i) => ({ tileId: t.id, revealAt: times[i] })),
  });
}
