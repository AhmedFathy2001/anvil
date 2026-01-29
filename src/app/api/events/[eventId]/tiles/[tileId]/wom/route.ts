import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tiles, teams, players } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { fetchWomTeams, fetchWomPlayers, matchTeamName, matchPlayerName } from '@/lib/wom';
import { verifyAdmin } from '@/lib/auth';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string; tileId: string }> }
) {
  const { eventId, tileId } = await params;
  const eId = parseInt(eventId, 10);
  const tId = parseInt(tileId, 10);

  const tile = await db.query.tiles.findFirst({
    where: eq(tiles.id, tId),
  });

  if (!tile || tile.eventId !== eId) {
    return NextResponse.json({ error: 'Tile not found' }, { status: 404 });
  }

  if (!tile.womCompetitionId) {
    return NextResponse.json({ error: 'No WOM competition linked to this tile' }, { status: 404 });
  }

  try {
    const [womTeams, womPlayers] = await Promise.all([
      fetchWomTeams(tile.womCompetitionId),
      fetchWomPlayers(tile.womCompetitionId),
    ]);

    const localTeams = await db.select().from(teams).where(eq(teams.eventId, eId));
    const localPlayers = await db.select().from(players).where(eq(players.eventId, eId));

    const localTeamNames = localTeams.map(t => t.name);
    const localPlayerNames = localPlayers.map(p => p.name);

    const teamStandings = womTeams.map(wt => {
      const matchedName = matchTeamName(wt.name, localTeamNames);
      const localTeam = matchedName ? localTeams.find(t => t.name === matchedName) : null;

      return {
        rank: wt.rank,
        womTeamName: wt.name,
        localTeamId: localTeam?.id ?? null,
        localTeamName: localTeam?.name ?? null,
        color: localTeam?.color ?? null,
        playerCount: wt.players,
        totalGained: wt.totalGained,
        averageGained: wt.averageGained,
        mvp: wt.mvp,
      };
    });

    const playerStandings = womPlayers.map(wp => {
      const matchedName = matchPlayerName(wp.player, localPlayerNames);
      const localPlayer = matchedName ? localPlayers.find(p => p.name.toLowerCase() === matchedName.toLowerCase()) : null;
      const localTeam = localPlayer?.teamId ? localTeams.find(t => t.id === localPlayer.teamId) : null;

      return {
        rank: wp.rank,
        womPlayerName: wp.displayName || wp.player,
        womTeamName: wp.team,
        localPlayerId: localPlayer?.id ?? null,
        localPlayerName: localPlayer?.name ?? null,
        localTeamId: localTeam?.id ?? null,
        localTeamName: localTeam?.name ?? null,
        color: localTeam?.color ?? null,
        gained: wp.gained,
      };
    });

    return NextResponse.json({
      competitionId: tile.womCompetitionId,
      teams: teamStandings,
      players: playerStandings,
    });
  } catch (error) {
    console.error('WOM API error:', error);
    return NextResponse.json({ error: 'Failed to fetch WOM data' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string; tileId: string }> }
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId, tileId } = await params;
  const eId = parseInt(eventId, 10);
  const tId = parseInt(tileId, 10);
  const { competitionId } = await request.json();

  const tile = await db.query.tiles.findFirst({
    where: eq(tiles.id, tId),
  });

  if (!tile || tile.eventId !== eId) {
    return NextResponse.json({ error: 'Tile not found' }, { status: 404 });
  }

  // Validate competition ID by fetching from WOM
  if (competitionId) {
    try {
      await fetchWomTeams(competitionId);
    } catch {
      return NextResponse.json({ error: 'Invalid WOM competition ID' }, { status: 400 });
    }
  }

  await db
    .update(tiles)
    .set({ womCompetitionId: competitionId || null })
    .where(eq(tiles.id, tId));

  return NextResponse.json({ success: true, competitionId: competitionId || null });
}
