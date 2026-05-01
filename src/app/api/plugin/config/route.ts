import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, tiles, teams, submissions } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { verifyPluginToken } from '@/lib/auth';
import { requireSecret } from '@/lib/env';
import crypto from 'crypto';

const CODEWORD_SECRET = requireSecret('CODEWORD_SECRET', 'dev-codeword-secret');

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

  // Stat-tracked tiles (skill XP / boss KC). The DB sometimes stores tile_type='standard'
  // for these — match on the presence of a trackedStat field instead.
  const allEventTiles = await db.query.tiles.findMany({ where: eq(tiles.eventId, auth.eventId) });
  const statTilesRaw = allEventTiles.filter((t) => t.trackedStat && t.trackedStat.length > 0);

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

  // Get per-item submission totals for tiles with itemRequirements
  const perItemSubmissions = await db
    .select({
      tileId: submissions.tileId,
      itemId: submissions.itemId,
      total: sql<number>`COALESCE(SUM(${submissions.amount}), 0)`,
    })
    .from(submissions)
    .where(eq(submissions.teamId, auth.teamId))
    .groupBy(submissions.tileId, submissions.itemId)
    .all();

  // Build a map: tileId -> { itemId -> total }
  const perItemMap = new Map<number, Map<number, number>>();
  for (const row of perItemSubmissions) {
    if (row.itemId == null) continue;
    if (!perItemMap.has(row.tileId)) perItemMap.set(row.tileId, new Map());
    perItemMap.get(row.tileId)!.set(row.itemId, Number(row.total));
  }

  return NextResponse.json({
    event: {
      id: event.id,
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
      forceEndedAt: event.forceEndedAt ?? null,
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
      .map(t => {
        const itemReqs = t.itemRequirements
          ? JSON.parse(t.itemRequirements) as { itemId: number; name: string; requiredAmount: number }[]
          : null;
        const tileItemTotals = perItemMap.get(t.id);

        return {
          tileId: t.id,
          label: t.label,
          itemIds: JSON.parse(t.trackedItemIds || '[]'),
          requiredAmount: t.requiredAmount ?? 1,
          currentAmount: submissionMap[t.id] ?? 0,
          ...(itemReqs ? {
            itemRequirements: itemReqs.map(req => ({
              itemId: req.itemId,
              name: req.name,
              requiredAmount: req.requiredAmount,
              currentAmount: tileItemTotals?.get(req.itemId) ?? 0,
            })),
          } : {}),
        };
      }),
  });
}
