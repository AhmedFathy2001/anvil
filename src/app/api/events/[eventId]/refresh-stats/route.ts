import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players, teams } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { verifyAdmin, verifyCaptain, verifyPlayer } from '@/lib/auth';
import { getStatsByGamemode } from 'osrs-json-hiscores';

const CAPTAIN_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
const PLAYER_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  const { playerId, teamId } = await request.json();

  const isAdmin = await verifyAdmin();
  const captain = await verifyCaptain();
  const player = await verifyPlayer();

  if (!isAdmin && !captain && !player) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // Single player refresh
  if (playerId) {
    const targetPlayer = await db.query.players.findFirst({
      where: and(eq(players.id, playerId), eq(players.eventId, eId)),
    });

    if (!targetPlayer) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Check permissions
    if (!isAdmin) {
      if (player && player.playerId !== playerId) {
        return NextResponse.json({ error: 'Can only refresh your own stats' }, { status: 403 });
      }
      if (captain && targetPlayer.teamId !== captain.teamId) {
        return NextResponse.json({ error: 'Player not on your team' }, { status: 403 });
      }

      // Check cooldown for non-admin
      if (targetPlayer.lastStatsFetch) {
        const lastFetch = new Date(targetPlayer.lastStatsFetch);
        const cooldown = player ? PLAYER_COOLDOWN_MS : CAPTAIN_COOLDOWN_MS;
        const elapsed = now.getTime() - lastFetch.getTime();

        if (elapsed < cooldown) {
          const remainingMs = cooldown - elapsed;
          const remainingMin = Math.ceil(remainingMs / 60000);
          return NextResponse.json({
            error: `Please wait ${remainingMin} minute(s) before refreshing again`,
            nextRefresh: new Date(lastFetch.getTime() + cooldown).toISOString(),
          }, { status: 429 });
        }
      }
    }

    // Fetch stats from Jagex
    try {
      const stats = await getStatsByGamemode(targetPlayer.name);
      await db.update(players)
        .set({
          cachedStats: JSON.stringify(stats),
          lastStatsFetch: nowIso,
        })
        .where(eq(players.id, playerId));

      return NextResponse.json({
        success: true,
        playerId,
        lastFetch: nowIso,
      });
    } catch {
      return NextResponse.json({ error: `Failed to fetch stats for ${targetPlayer.name}` }, { status: 500 });
    }
  }

  // Team refresh (captain or admin only)
  if (teamId) {
    if (!isAdmin && (!captain || captain.teamId !== teamId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const team = await db.query.teams.findFirst({
      where: and(eq(teams.id, teamId), eq(teams.eventId, eId)),
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const teamPlayers = await db.query.players.findMany({
      where: and(eq(players.teamId, teamId), eq(players.eventId, eId)),
    });

    // Check cooldown for captain (based on most recent team fetch)
    if (!isAdmin && captain) {
      const mostRecentFetch = teamPlayers
        .map(p => p.lastStatsFetch ? new Date(p.lastStatsFetch).getTime() : 0)
        .reduce((max, t) => Math.max(max, t), 0);

      if (mostRecentFetch > 0) {
        const elapsed = now.getTime() - mostRecentFetch;
        if (elapsed < CAPTAIN_COOLDOWN_MS) {
          const remainingMs = CAPTAIN_COOLDOWN_MS - elapsed;
          const remainingMin = Math.ceil(remainingMs / 60000);
          return NextResponse.json({
            error: `Please wait ${remainingMin} minute(s) before refreshing team again`,
            nextRefresh: new Date(mostRecentFetch + CAPTAIN_COOLDOWN_MS).toISOString(),
          }, { status: 429 });
        }
      }
    }

    const results: { playerId: number; name: string; success: boolean; error?: string }[] = [];

    for (const p of teamPlayers) {
      try {
        const stats = await getStatsByGamemode(p.name);
        await db.update(players)
          .set({
            cachedStats: JSON.stringify(stats),
            lastStatsFetch: nowIso,
          })
          .where(eq(players.id, p.id));

        results.push({ playerId: p.id, name: p.name, success: true });
      } catch {
        results.push({ playerId: p.id, name: p.name, success: false, error: 'Failed to fetch' });
      }
      await delay(1200);
    }

    return NextResponse.json({
      success: true,
      teamId,
      lastFetch: nowIso,
      results,
    });
  }

  // Admin: refresh all players in event
  if (isAdmin) {
    const allPlayers = await db.query.players.findMany({
      where: eq(players.eventId, eId),
    });

    const results: { playerId: number; name: string; success: boolean; error?: string }[] = [];

    for (const p of allPlayers) {
      try {
        const stats = await getStatsByGamemode(p.name);
        await db.update(players)
          .set({
            cachedStats: JSON.stringify(stats),
            lastStatsFetch: nowIso,
          })
          .where(eq(players.id, p.id));

        results.push({ playerId: p.id, name: p.name, success: true });
      } catch {
        results.push({ playerId: p.id, name: p.name, success: false, error: 'Failed to fetch' });
      }
      await delay(1200);
    }

    return NextResponse.json({
      success: true,
      lastFetch: nowIso,
      results,
    });
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}
