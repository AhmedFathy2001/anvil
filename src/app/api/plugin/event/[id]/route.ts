import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, tiles } from '@/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/plugin/event/[id] — lightweight event + tile rundown for the plugin's
// schedule detail view. Anonymous (mirrors the schedule list endpoint), so anyone
// who can see the event in the upcoming list can drill in.
//
// Trims tile rows to fields the plugin actually renders (label, position, type,
// stat goals) so we don't ship admin-only metadata.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const tileRows = await db
    .select({
      id: tiles.id,
      position: tiles.position,
      label: tiles.label,
      icon: tiles.icon,
      description: tiles.description,
      tileType: tiles.tileType,
      requiredAmount: tiles.requiredAmount,
      trackedStat: tiles.trackedStat,
      statType: tiles.statType,
      statGoal: tiles.statGoal,
      trackingMode: tiles.trackingMode,
      optional: tiles.optional,
    })
    .from(tiles)
    .where(eq(tiles.eventId, id))
    .orderBy(tiles.position);

  return NextResponse.json({
    id: event.id,
    name: event.name,
    boardSize: event.boardSize,
    startDate: event.startDate,
    endDate: event.endDate,
    forceEndedAt: event.forceEndedAt,
    tiles: tileRows.map((t) => ({
      id: t.id,
      position: t.position,
      label: t.label,
      icon: t.icon,
      description: t.description,
      tileType: t.tileType,
      requiredAmount: t.requiredAmount,
      trackedStat: t.trackedStat,
      statType: t.statType,
      statGoal: t.statGoal,
      trackingMode: t.trackingMode,
      optional: t.optional === 1,
    })),
  });
}
