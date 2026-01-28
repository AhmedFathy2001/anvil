import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tiles, events } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  const { tileId, label, description, tileType, requiredAmount, trackedStat, statType, statGoal, trackingMode } = await request.json();

  if (!tileId) {
    return NextResponse.json({ error: 'tileId is required' }, { status: 400 });
  }

  // Verify tile belongs to this event
  const tile = await db.query.tiles.findFirst({
    where: and(eq(tiles.id, tileId), eq(tiles.eventId, eId)),
  });
  if (!tile) {
    return NextResponse.json({ error: 'Tile not found in this event' }, { status: 404 });
  }

  // Get event to check start date
  const event = await db.query.events.findFirst({
    where: eq(events.id, eId),
  });

  const now = new Date();
  const eventStarted = event?.startDate && new Date(event.startDate) <= now;

  // Build update set
  const updateSet: Record<string, unknown> = {
    // description is always editable
    description: description !== undefined ? (description || null) : tile.description,
    // stat tracking is always editable
    trackedStat: trackedStat !== undefined ? (trackedStat || null) : tile.trackedStat,
    statType: statType !== undefined ? (statType || null) : tile.statType,
    statGoal: statGoal !== undefined ? (statGoal || null) : tile.statGoal,
    trackingMode: trackingMode !== undefined ? trackingMode : tile.trackingMode,
  };

  // label, tileType, requiredAmount only editable before event start
  if (!eventStarted) {
    if (label !== undefined) updateSet.label = label || tile.label;
    if (tileType !== undefined) updateSet.tileType = tileType || 'standard';
    if (requiredAmount !== undefined) updateSet.requiredAmount = requiredAmount || null;
  }

  const [updated] = await db
    .update(tiles)
    .set(updateSet)
    .where(eq(tiles.id, tileId))
    .returning();

  return NextResponse.json(updated);
}
