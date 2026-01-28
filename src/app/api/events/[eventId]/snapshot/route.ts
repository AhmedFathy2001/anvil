import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { getStatsByGamemode } from 'osrs-json-hiscores';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const eId = parseInt(eventId, 10);

  const eventPlayers = await db.query.players.findMany({
    where: eq(players.eventId, eId),
  });

  let snapshotted = 0;
  const failed: string[] = [];
  const now = new Date().toISOString();

  for (const player of eventPlayers) {
    try {
      const stats = await getStatsByGamemode(player.name);
      await db
        .update(players)
        .set({
          statsSnapshot: JSON.stringify(stats),
          snapshotAt: now,
        })
        .where(eq(players.id, player.id));
      snapshotted++;
    } catch {
      failed.push(player.name);
    }
    // Small delay to avoid rate-limiting by Jagex
    await delay(1200);
  }

  return NextResponse.json({ snapshotted, failed });
}
