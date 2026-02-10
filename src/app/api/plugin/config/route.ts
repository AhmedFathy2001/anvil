import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, tiles, teams, submissions } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { verifyPluginToken } from '@/lib/auth';
import crypto from 'crypto';

const CODEWORD_SECRET = process.env.CODEWORD_SECRET || 'bingo-codeword-secret';

function generateCodeword(playerId: number, eventId: number): string {
  const date = new Date().toISOString().slice(0, 10);
  const hmac = crypto.createHmac('sha256', CODEWORD_SECRET);
  hmac.update(`${playerId}:${eventId}:${date}`);
  return hmac.digest('hex').slice(0, 6).toUpperCase();
}

export async function GET(request: Request) {
  const auth = await verifyPluginToken(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized. Provide Authorization: Bearer <playerToken>' }, { status: 401 });
  }

  const event = await db.query.events.findFirst({
    where: eq(events.id, auth.eventId),
  });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, auth.teamId),
  });
  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  // Get drop tiles with tracked item IDs
  const dropTiles = await db.query.tiles.findMany({
    where: and(eq(tiles.eventId, auth.eventId), eq(tiles.tileType, 'drop')),
  });

  // Get current submission totals per tile for this team
  const teamSubmissions = await db
    .select({
      tileId: submissions.tileId,
      total: sql<number>`COALESCE(SUM(${submissions.amount}), 0)`,
    })
    .from(submissions)
    .where(eq(submissions.teamId, auth.teamId))
    .groupBy(submissions.tileId)
    .all();

  const submissionMap = Object.fromEntries(teamSubmissions.map(s => [s.tileId, s.total]));

  return NextResponse.json({
    event: {
      id: event.id,
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
    },
    team: {
      id: team.id,
      name: team.name,
      color: team.color,
    },
    player: {
      id: auth.playerId,
    },
    codeword: generateCodeword(auth.playerId, event.id),
    trackedDrops: dropTiles
      .filter(t => t.trackedItemIds) // only tiles with item IDs configured
      .map(t => ({
        tileId: t.id,
        label: t.label,
        itemIds: JSON.parse(t.trackedItemIds || '[]'),
        requiredAmount: t.requiredAmount ?? 1,
        currentAmount: submissionMap[t.id] ?? 0,
      })),
  });
}
