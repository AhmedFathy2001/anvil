import { NextResponse } from 'next/server';
import { and, count, desc, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { clanRoster, clans, eventCohosts, tileSuggestions, users } from '@/db/schema';
import { verifyTileEditorForEvent, verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import { requireClan } from '@/lib/clanContext';
import { allows, parseBoardAccess } from '@/lib/cohostBoardAccess';
import { eventForRequest } from '@/lib/eventScope';

/**
 * Tiles a co-host clan suggests for the host's board (lib/cohostBoardAccess 'suggest').
 *   GET  — at the host's address, its tile editors see every suggestion; at a co-host's address,
 *          that clan sees its own.
 *   POST — someone of the co-host clan the host lets suggest: { title, details?, points? }.
 * Deciding one is /tile-suggestions/<id>.
 */

const MAX_PENDING_PER_CLAN = 25;

async function cohostSeat(eventId: number, clanId: number) {
  const [seat] = await db
    .select({ staffCanEditBoard: eventCohosts.staffCanEditBoard, boardAccess: eventCohosts.boardAccess })
    .from(eventCohosts)
    .where(and(eq(eventCohosts.eventId, eventId), eq(eventCohosts.clanId, clanId), eq(eventCohosts.status, 'accepted')))
    .limit(1);
  return seat ?? null;
}

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const eventId = Number((await params).eventId);
  if (!Number.isInteger(eventId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const select = {
    id: tileSuggestions.id,
    title: tileSuggestions.title,
    details: tileSuggestions.details,
    points: tileSuggestions.points,
    status: tileSuggestions.status,
    note: tileSuggestions.note,
    tileId: tileSuggestions.tileId,
    createdAt: tileSuggestions.createdAt,
    clanName: clans.name,
    by: users.displayName,
  };

  // The host's own address: its tile editors see the whole queue.
  if (await eventForRequest(request, eventId)) {
    if (!(await verifyTileEditorForEvent(eventId))) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    const rows = await db
      .select(select)
      .from(tileSuggestions)
      .innerJoin(clans, eq(clans.id, tileSuggestions.clanId))
      .leftJoin(users, eq(users.id, tileSuggestions.userId))
      .where(eq(tileSuggestions.eventId, eventId))
      .orderBy(desc(tileSuggestions.createdAt))
      .limit(200);
    return NextResponse.json({ suggestions: rows, host: true });
  }

  // A co-host's address: that clan's own suggestions, if it co-hosts the board.
  const [session, clan] = await Promise.all([verifyUser(), requireClan()]);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const seat = await cohostSeat(eventId, clan.id);
  if (!seat) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const rows = await db
    .select(select)
    .from(tileSuggestions)
    .innerJoin(clans, eq(clans.id, tileSuggestions.clanId))
    .leftJoin(users, eq(users.id, tileSuggestions.userId))
    .where(and(eq(tileSuggestions.eventId, eventId), eq(tileSuggestions.clanId, clan.id)))
    .orderBy(desc(tileSuggestions.createdAt))
    .limit(200);
  const access = parseBoardAccess(seat.boardAccess, seat.staffCanEditBoard);
  return NextResponse.json({ suggestions: rows, host: false, suggest: access.suggest });
}

export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const eventId = Number((await params).eventId);
  if (!Number.isInteger(eventId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const [session, clan] = await Promise.all([verifyUser(), requireClan()]);
  if (!session) return NextResponse.json({ error: 'Sign in first.' }, { status: 403 });
  const seat = await cohostSeat(eventId, clan.id);
  if (!seat) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const access = parseBoardAccess(seat.boardAccess, seat.staffCanEditBoard);
  const isStaff = atLeast(session.role, 'moderator') || session.canEditTiles;
  let may = allows(access, 'suggest', isStaff);
  if (may && access.suggest === 'players' && !isStaff) {
    // "Any of their players": somebody on this clan's roster, not anybody with a login.
    const [onRoster] = await db
      .select({ id: clanRoster.id })
      .from(clanRoster)
      .where(and(eq(clanRoster.clanId, clan.id), eq(clanRoster.playerId, session.playerId), isNull(clanRoster.leftAt)))
      .limit(1);
    may = !!onRoster;
  }
  if (!may) return NextResponse.json({ error: 'The host hasn’t opened suggestions to you on this board.' }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { title?: unknown; details?: unknown; points?: unknown };
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
  if (!title) return NextResponse.json({ error: 'Name the tile.' }, { status: 400 });
  const details = typeof body.details === 'string' && body.details.trim() ? body.details.trim().slice(0, 2000) : null;
  const points = Number.isInteger(body.points) && (body.points as number) > 0 && (body.points as number) <= 1000 ? (body.points as number) : null;

  const [{ n }] = await db
    .select({ n: count() })
    .from(tileSuggestions)
    .where(and(eq(tileSuggestions.eventId, eventId), eq(tileSuggestions.clanId, clan.id), eq(tileSuggestions.status, 'pending')));
  if (Number(n) >= MAX_PENDING_PER_CLAN) {
    return NextResponse.json({ error: `Your clan already has ${MAX_PENDING_PER_CLAN} suggestions waiting. Give the host a moment.` }, { status: 429 });
  }

  const [row] = await db
    .insert(tileSuggestions)
    .values({ eventId, clanId: clan.id, userId: session.userId, title, details, points })
    .returning();
  return NextResponse.json({ suggestion: row });
}
