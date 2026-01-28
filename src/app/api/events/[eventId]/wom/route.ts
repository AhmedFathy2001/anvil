import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, teams, players } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { fetchWomTeams, fetchWomPlayers, matchTeamName, matchPlayerName } from '@/lib/wom';
import { verifyAdmin } from '@/lib/auth';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);

  const event = await db.query.events.findFirst({
    where: eq(events.id, eId),
  });

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  if (!event.womCompetitionId) {
    return NextResponse.json({ error: 'No WOM competition linked' }, { status: 404 });
  }

  try {
    // Fetch data from WOM
    const [womTeams, womPlayers] = await Promise.all([
      fetchWomTeams(event.womCompetitionId),
      fetchWomPlayers(event.womCompetitionId),
    ]);

    // Get local teams and players for matching
    const localTeams = await db.select().from(teams).where(eq(teams.eventId, eId));
    const localPlayers = await db.select().from(players).where(eq(players.eventId, eId));

    const localTeamNames = localTeams.map(t => t.name);
    const localPlayerNames = localPlayers.map(p => p.name);

    // Match WOM teams to local teams
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

    // Match WOM players to local players
    const playerStandings = womPlayers.map(wp => {
      const matchedName = matchPlayerName(wp.player, localPlayerNames);
      const localPlayer = matchedName ? localPlayers.find(p => p.name === matchedName) : null;
      const localTeam = localPlayer?.teamId ? localTeams.find(t => t.id === localPlayer.teamId) : null;

      return {
        rank: wp.rank,
        womPlayerName: wp.player,
        womTeamName: wp.team,
        localPlayerId: localPlayer?.id ?? null,
        localPlayerName: localPlayer?.name ?? null,
        localTeamId: localTeam?.id ?? null,
        localTeamName: localTeam?.name ?? null,
        gained: wp.gained,
      };
    });

    return NextResponse.json({
      competitionId: event.womCompetitionId,
      teams: teamStandings,
      players: playerStandings,
    });
  } catch (error) {
    console.error('WOM API error:', error);
    return NextResponse.json({ error: 'Failed to fetch WOM data' }, { status: 500 });
  }
}

// POST: Set or update WOM competition ID
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
  const { competitionId } = await request.json();

  const event = await db.query.events.findFirst({
    where: eq(events.id, eId),
  });

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
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
    .update(events)
    .set({ womCompetitionId: competitionId || null })
    .where(eq(events.id, eId));

  return NextResponse.json({ success: true, competitionId: competitionId || null });
}
