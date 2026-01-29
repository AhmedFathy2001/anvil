import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players, tiles } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { getStatsByGamemode } from 'osrs-json-hiscores';

// GET player's snapshot data for editing
export async function GET(
  _request: Request,
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

  // Get tracked stats for this event
  const eventTiles = await db.query.tiles.findMany({
    where: eq(tiles.eventId, eId),
  });
  const trackedStats = eventTiles
    .filter(t => t.trackedStat && t.statType)
    .map(t => ({ stat: t.trackedStat!, type: t.statType!, tileLabel: t.label }));

  // Parse snapshot and cached stats
  let snapshot = null;
  let cached = null;
  try {
    if (player.statsSnapshot) snapshot = JSON.parse(player.statsSnapshot);
    if (player.cachedStats) cached = JSON.parse(player.cachedStats);
  } catch {
    // Invalid JSON
  }

  // Build response with relevant stats only
  const stats: { stat: string; type: string; tileLabel: string; baseline: number; current: number; gained: number }[] = [];

  for (const { stat, type, tileLabel } of trackedStats) {
    let baseline = 0;
    let current = 0;

    if (type === 'skill') {
      baseline = snapshot?.skills?.[stat]?.xp ?? 0;
      current = cached?.skills?.[stat]?.xp ?? 0;
    } else if (type === 'boss') {
      const bSnap = snapshot?.bosses?.[stat]?.score ?? 0;
      const bCurr = cached?.bosses?.[stat]?.score ?? 0;
      baseline = bSnap < 0 ? 0 : bSnap;
      current = bCurr < 0 ? 0 : bCurr;
    }

    // Check if this stat is already in the list (dedupe)
    if (!stats.find(s => s.stat === stat)) {
      stats.push({
        stat,
        type,
        tileLabel,
        baseline,
        current,
        gained: Math.max(0, current - baseline),
      });
    }
  }

  return NextResponse.json({
    playerId: player.id,
    playerName: player.name,
    snapshotAt: player.snapshotAt,
    lastStatsFetch: player.lastStatsFetch,
    stats,
  });
}

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
  const { stat, statType, baseline, resetAll } = body;

  if (resetAll) {
    // Re-fetch full hiscores and store as new snapshot + cached
    try {
      const currentStats = await getStatsByGamemode(player.name);
      const now = new Date().toISOString();
      const statsJson = JSON.stringify(currentStats);

      await db
        .update(players)
        .set({
          statsSnapshot: statsJson,
          snapshotAt: now,
          cachedStats: statsJson,
          lastStatsFetch: now,
        })
        .where(eq(players.id, pId));

      return NextResponse.json({ success: true, snapshotAt: now });
    } catch {
      return NextResponse.json({ error: 'Failed to fetch hiscores for player' }, { status: 502 });
    }
  }

  if (stat && statType && baseline !== undefined) {
    // Update a specific stat's baseline in the snapshot
    if (!player.statsSnapshot) {
      return NextResponse.json({ error: 'Player has no snapshot to update' }, { status: 400 });
    }

    const snapshot = JSON.parse(player.statsSnapshot);

    // Update the baseline value
    if (statType === 'skill') {
      if (!snapshot.skills) snapshot.skills = {};
      if (!snapshot.skills[stat]) snapshot.skills[stat] = { rank: -1, level: 1, xp: 0 };
      snapshot.skills[stat].xp = baseline;
    } else if (statType === 'boss') {
      if (!snapshot.bosses) snapshot.bosses = {};
      if (!snapshot.bosses[stat]) snapshot.bosses[stat] = { rank: -1, score: 0 };
      snapshot.bosses[stat].score = baseline;
    } else {
      return NextResponse.json({ error: 'Invalid statType' }, { status: 400 });
    }

    await db
      .update(players)
      .set({ statsSnapshot: JSON.stringify(snapshot) })
      .where(eq(players.id, pId));

    return NextResponse.json({ success: true, stat, statType, baseline });
  }

  return NextResponse.json({ error: 'Provide resetAll or stat+statType+baseline' }, { status: 400 });
}
