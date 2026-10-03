import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { tiles } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { verifyTileEditorForEvent } from '@/lib/auth';
import { assertEventEditable } from '@/lib/eventLock';
import { diffTiles, logTileAudit } from '@/lib/tile-audit';
import { atLeast } from '@/lib/clanRoles';
import { tileBalanceRevision } from '@/lib/tileBalanceRevision';

// Set one thing on many tiles at once.
//
// Authoring a 150-tile board means the same edit over and over — twenty tiles that should all be
// worth 5, a whole tier that needs a category, a wave of tiles that should open on Saturday. Doing
// that one drawer at a time is twenty round trips and twenty chances to mistype.
//
// Only fields that are safe to change while a board is LIVE are accepted here: points, category,
// optional, automatic-crediting and the reveal time. A tile's label, kind and required amount stay
// frozen on a running event — those are the rules contestants are playing by, and changing them
// needs the deliberate per-tile admin override (see the PUT handler's liveOverride), not a
// twenty-at-once sweep.
const ALLOWED = ['points', 'category', 'optional', 'autoTrackDisabled', 'revealAt'] as const;
type AllowedField = (typeof ALLOWED)[number];

const MAX_TILES = 500;

interface PointChange {
  tileId: number;
  points: number;
}

async function applyReviewedPointChanges(
  eId: number,
  editor: { userId: number },
  rawChanges: unknown[],
  revision: unknown,
) {
  if (rawChanges.length === 0) {
    return NextResponse.json({ error: 'There are no point suggestions to apply.' }, { status: 400 });
  }
  if (rawChanges.length > MAX_TILES) {
    return NextResponse.json({ error: `That's more than ${MAX_TILES} tiles at once.` }, { status: 400 });
  }
  if (typeof revision !== 'string' || !revision) {
    return NextResponse.json({ error: 'This review is missing its board revision. Reopen it and try again.' }, { status: 400 });
  }

  const changes: PointChange[] = [];
  for (const value of rawChanges) {
    if (!value || typeof value !== 'object') {
      return NextResponse.json({ error: 'Every suggestion must name a tile and its points.' }, { status: 400 });
    }
    const { tileId, points } = value as { tileId?: unknown; points?: unknown };
    if (!Number.isInteger(tileId) || !Number.isInteger(points) || (points as number) < 0) {
      return NextResponse.json(
        { error: 'Every suggestion needs a valid tile id and whole-number points of 0 or more.' },
        { status: 400 },
      );
    }
    changes.push({ tileId: tileId as number, points: points as number });
  }

  if (new Set(changes.map((change) => change.tileId)).size !== changes.length) {
    return NextResponse.json({ error: 'A tile can only appear once in a point review.' }, { status: 400 });
  }

  const updatedAt = new Date().toISOString();
  const outcome = await db.transaction(async (tx) => {
    // Lock every row that contributed to the report. A concurrent single-tile save either lands
    // first (making the revision stale) or waits until this all-or-nothing update has completed.
    const board = await tx
      .select()
      .from(tiles)
      .where(eq(tiles.eventId, eId))
      .for('update');

    if (tileBalanceRevision(board) !== revision) {
      return { kind: 'stale' as const };
    }

    const byId = new Map(board.map((tile) => [tile.id, tile]));
    if (changes.some((change) => !byId.has(change.tileId))) {
      return { kind: 'missing' as const };
    }

    const changed = changes
      .map((change) => ({ before: byId.get(change.tileId)!, points: change.points }))
      .filter(({ before, points }) => before.points !== points);

    for (const change of changed) {
      await tx
        .update(tiles)
        .set({ points: change.points, updatedAt })
        .where(and(eq(tiles.eventId, eId), eq(tiles.id, change.before.id)));
    }

    return { kind: 'ok' as const, changed };
  });

  if (outcome.kind === 'stale') {
    return NextResponse.json(
      { error: 'The board changed while this review was open. Reopen the review to get fresh suggestions.' },
      { status: 409 },
    );
  }
  if (outcome.kind === 'missing') {
    return NextResponse.json({ error: 'One or more reviewed tiles are no longer on this board.' }, { status: 409 });
  }

  for (const change of outcome.changed) {
    logTileAudit({
      eventId: eId,
      action: 'updated',
      tileId: change.before.id,
      tileLabel: change.before.label,
      changedFields: diffTiles(change.before, { ...change.before, points: change.points }),
      actorUserId: editor.userId,
    });
  }

  return NextResponse.json({
    updated: outcome.changed.length,
    changes: outcome.changed.map((change) => ({ tileId: change.before.id, points: change.points })),
    updatedAt,
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);

  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, eId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const editor = await verifyTileEditorForEvent(eId);
  if (!editor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Finished events are read-only unless explicitly unlocked (lib/eventLock).
  const locked = await assertEventEditable(eId);
  if (locked) return locked;

  const body = (await request.json().catch(() => null)) as
    | { tileIds?: unknown; set?: Record<string, unknown>; changes?: unknown; revision?: unknown }
    | null;

  // A balance review sets a different point value on every tile. It gets its own atomic shape
  // instead of making N calls to the single-tile route (which could stop halfway through).
  if (Array.isArray(body?.changes)) {
    return applyReviewedPointChanges(eId, editor, body.changes, body.revision);
  }

  const tileIds = Array.isArray(body?.tileIds)
    ? body.tileIds.filter((id): id is number => Number.isInteger(id))
    : [];
  if (tileIds.length === 0) {
    return NextResponse.json({ error: 'Pick at least one tile.' }, { status: 400 });
  }
  if (tileIds.length > MAX_TILES) {
    return NextResponse.json({ error: `That's more than ${MAX_TILES} tiles at once.` }, { status: 400 });
  }

  const set = body?.set ?? {};
  const patch: Record<string, unknown> = {};
  for (const field of ALLOWED) {
    if (!(field in set)) continue;
    const value = set[field as AllowedField];

    if (field === 'points') {
      if (!Number.isInteger(value) || (value as number) < 0) {
        return NextResponse.json({ error: 'Points must be a whole number, 0 or more.' }, { status: 400 });
      }
    }
    if (field === 'optional' || field === 'autoTrackDisabled') {
      if (typeof value !== 'boolean') {
        return NextResponse.json({ error: `${field} must be true or false.` }, { status: 400 });
      }
      patch[field] = value ? 1 : 0;
      continue;
    }
    if (field === 'category' && value !== null && typeof value !== 'string') {
      return NextResponse.json({ error: 'Category must be text, or null to clear it.' }, { status: 400 });
    }
    if (field === 'revealAt' && value !== null && typeof value !== 'string') {
      return NextResponse.json({ error: 'Reveal time must be a date, or null to clear it.' }, { status: 400 });
    }
    patch[field] = value;
  }

  // revealState is not a column — it's the host's manual override of what the reveal engine decided,
  // written as revealedAt/closedAt exactly like the single-tile route does. Board-wide 'open these
  // now' is the mid-event control a staggered board otherwise lacks, so it lives here; admin-only,
  // because it changes what members can score right now rather than authoring a tile.
  const revealState = set.revealState;
  if (revealState !== undefined) {
    if (revealState !== 'live' && revealState !== 'hidden') {
      return NextResponse.json({ error: "revealState must be 'live' or 'hidden'." }, { status: 400 });
    }
    if (!atLeast(editor.role, 'admin')) {
      return NextResponse.json({ error: 'Revealing or hiding tiles is admin-only.' }, { status: 403 });
    }
    Object.assign(
      patch,
      revealState === 'live'
        ? { revealedAt: new Date().toISOString(), closedAt: null }
        : { revealedAt: null, closedAt: null },
    );
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
  }

  // Scoped to this event, so a stray id from another board can never be touched.
  const before = await db
    .select()
    .from(tiles)
    .where(and(eq(tiles.eventId, eId), inArray(tiles.id, tileIds)));
  if (before.length === 0) {
    return NextResponse.json({ error: 'None of those tiles are on this board.' }, { status: 404 });
  }

  const updatedAt = new Date().toISOString();
  await db
    .update(tiles)
    .set({ ...patch, updatedAt })
    .where(and(eq(tiles.eventId, eId), inArray(tiles.id, before.map((t) => t.id))));

  // One history entry per tile, same as a single edit would write — a bulk change should be as
  // traceable as the twenty individual ones it replaces.
  for (const tile of before) {
    logTileAudit({
      eventId: eId,
      action: 'updated',
      tileId: tile.id,
      tileLabel: tile.label,
      changedFields: diffTiles(tile, { ...tile, ...patch }),
      actorUserId: editor.userId,
    });
  }

  return NextResponse.json({ updated: before.length, tileIds: before.map((t) => t.id), updatedAt });
}
