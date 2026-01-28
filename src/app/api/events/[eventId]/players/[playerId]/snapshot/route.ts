import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { getStatsByGamemode } from 'osrs-json-hiscores';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string; playerId: string }> }
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId, playerId } = await params;
  const eId = parseInt(eventId, 10);
  const pId = parseInt(playerId, 10);

  const player = await db.query.players.findFirst({
    where: and(eq(players.id, pId), eq(players.eventId, eId)),
  });
  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  const body = await request.json();
  const { stat, value, resetAll } = body;

  if (resetAll) {
    // Re-fetch full hiscores and store as new snapshot
    try {
      const currentStats = await getStatsByGamemode(player.name);
      const now = new Date().toISOString();

      await db
        .update(players)
        .set({
          statsSnapshot: JSON.stringify(currentStats),
          snapshotAt: now,
        })
        .where(eq(players.id, pId));

      return NextResponse.json({ success: true, snapshotAt: now });
    } catch {
      return NextResponse.json({ error: 'Failed to fetch hiscores for player' }, { status: 502 });
    }
  }

  if (stat && value !== undefined) {
    // Update a specific stat in the snapshot
    if (!player.statsSnapshot) {
      return NextResponse.json({ error: 'Player has no snapshot to update' }, { status: 400 });
    }

    // Fetch current hiscores to validate
    let currentStats;
    try {
      currentStats = await getStatsByGamemode(player.name);
    } catch {
      return NextResponse.json({ error: 'Failed to fetch current hiscores for validation' }, { status: 502 });
    }

    const snapshot = JSON.parse(player.statsSnapshot);

    // Navigate the stat path (e.g., "main.skills.attack.xp" or "main.bosses.zulrah.score")
    const parts = stat.split('.');
    let currentVal: number | undefined;
    let ref: Record<string, unknown> = currentStats as unknown as Record<string, unknown>;
    for (const p of parts) {
      ref = ref[p] as Record<string, unknown>;
    }
    currentVal = ref as unknown as number;

    if (typeof currentVal === 'number' && value > currentVal) {
      return NextResponse.json(
        { error: 'Snapshot value cannot exceed current hiscores value' },
        { status: 400 }
      );
    }

    // Update snapshot
    let snapRef: Record<string, unknown> = snapshot;
    for (let i = 0; i < parts.length - 1; i++) {
      snapRef = snapRef[parts[i]] as Record<string, unknown>;
    }
    snapRef[parts[parts.length - 1]] = value;

    await db
      .update(players)
      .set({ statsSnapshot: JSON.stringify(snapshot) })
      .where(eq(players.id, pId));

    return NextResponse.json({ success: true, stat, value });
  }

  return NextResponse.json({ error: 'Provide resetAll or stat+value' }, { status: 400 });
}
