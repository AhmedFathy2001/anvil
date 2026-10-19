import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { events, tiles } from '@/db/schema';
import { requireClan } from '@/lib/clanContext';
import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import { eventForRequest } from '@/lib/eventScope';
import { getBoard, rowsForLibrary } from '@/lib/libraryBoards';
import { createProposal } from '@/lib/libraryProposals';
import type { Tile } from '@/lib/types';

// POST { eventId, note? } — "suggest my changes to Anvil": an event started from an Anvil board sends
// its current tiles as a suggested new version of that board, for staff to approve or reject.
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session || !atLeast(session.role, 'admin')) return NextResponse.json({ error: 'Admins only.' }, { status: 401 });
  const clan = await requireClan();
  const body = await request.json().catch(() => null);
  const eventId = Number(body?.eventId);
  if (!Number.isInteger(eventId) || !(await eventForRequest(request, eventId))) {
    return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
  }
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId), columns: { libraryBoardId: true } });
  if (!event?.libraryBoardId) return NextResponse.json({ error: 'This event wasn’t started from a library board.' }, { status: 400 });
  const rows = rowsForLibrary((await db.select().from(tiles).where(eq(tiles.eventId, eventId))) as unknown as Tile[]);
  // Nothing to review if the board is still Anvil's, tile for tile (order aside — the grid layout is
  // the event's own). Staff shouldn't have to open a suggestion to find it changes nothing.
  const board = await getBoard(event.libraryBoardId);
  const key = (r: unknown) => JSON.stringify(r, Object.keys(r as object).sort());
  const same = (a: unknown[], b: unknown[]) => a.length === b.length && JSON.stringify(a.map(key).sort()) === JSON.stringify(b.map(key).sort());
  if (board && same(rows.map(({ label, tileType, requiredAmount, items, targetNpcs, trackedStat, statGoal, timedActivity }) => ({ label, tileType, requiredAmount, items, targetNpcs, trackedStat, statGoal, timedActivity })), board.tiles.map(({ label, tileType, requiredAmount, items, targetNpcs, trackedStat, statGoal, timedActivity }) => ({ label, tileType, requiredAmount, items, targetNpcs, trackedStat, statGoal, timedActivity })))) {
    return NextResponse.json({ error: 'Your board still matches Anvil’s, so there’s nothing to suggest yet.' }, { status: 400 });
  }
  try {
    const id = await createProposal(session.userId, clan.id, {
      kind: 'board-edit',
      targetBoardId: event.libraryBoardId,
      payload: { tiles: rows },
      note: typeof body?.note === 'string' ? body.note : null,
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
