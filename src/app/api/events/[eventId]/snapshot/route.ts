import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players, events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { getStatsByGamemode } from 'osrs-json-hiscores';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const eId = parseInt(eventId, 10);

  // Check for force reset flag
  const { searchParams } = new URL(request.url);
  const forceReset = searchParams.get('forceReset') === 'true';

  // Check if event has started
  const event = await db.query.events.findFirst({
    where: eq(events.id, eId),
  });
  const now = new Date();
  const eventStarted = event?.startDate && new Date(event.startDate) <= now;

  const eventPlayers = await db.query.players.findMany({
    where: eq(players.eventId, eId),
  });

  let snapshotted = 0;
  let refreshed = 0;
  const failed: string[] = [];
  const timestamp = now.toISOString();

  for (const player of eventPlayers) {
    try {
      const stats = await getStatsByGamemode(player.name);
      const statsJson = JSON.stringify(stats);

      // If player already has a baseline snapshot and event has started (and not force reset),
      // only update cachedStats (don't overwrite the baseline)
      if (player.statsSnapshot && eventStarted && !forceReset) {
        await db
          .update(players)
          .set({
            cachedStats: statsJson,
            lastStatsFetch: timestamp,
          })
          .where(eq(players.id, player.id));
        refreshed++;
      } else {
        // First snapshot, event hasn't started, or force reset - set baseline
        await db
          .update(players)
          .set({
            statsSnapshot: statsJson,
            snapshotAt: timestamp,
            cachedStats: statsJson,
            lastStatsFetch: timestamp,
          })
          .where(eq(players.id, player.id));
        snapshotted++;
      }
    } catch {
      failed.push(player.name);
    }
    // Small delay to avoid rate-limiting by Jagex
    await delay(1200);
  }

  return NextResponse.json({ snapshotted, refreshed, failed });
}
