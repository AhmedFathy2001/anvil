import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, players, teams } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { getTeamForPick, getRoundForPick, getPickInRound } from '@/lib/draft';
import { loadEventProfiles, attachProfiles } from '@/lib/draftProfiles';
import { notifyDraftComplete } from '@/lib/discord';
import { syncTeamDiscordOnDraftCompleteFireAndForget } from '@/lib/discord-teams';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  const event = await db.query.events.findFirst({
    where: eq(events.id, id),
  });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const rawPlayers = await db
    .select()
    .from(players)
    .where(eq(players.eventId, id));
  // Surface each player's frozen sign-up answers so captains read them while drafting.
  const eventPlayers = attachProfiles(rawPlayers, await loadEventProfiles(id));

  const eventTeams = await db
    .select({
      id: teams.id,
      eventId: teams.eventId,
      name: teams.name,
      color: teams.color,
    })
    .from(teams)
    .where(eq(teams.eventId, id));

  // Drop ids of since-deleted teams so clients never render (or count) ghost entries.
  const existingTeamIds = new Set(eventTeams.map((t) => t.id));
  const teamOrder: number[] = (event.draftOrder ? JSON.parse(event.draftOrder) : []).filter(
    (tid: number) => existingTeamIds.has(tid),
  );
  const pickedPlayers = eventPlayers.filter((p) => p.teamId !== null);
  const currentPickNumber = pickedPlayers.length;
  const poolPlayers = eventPlayers.filter((p) => p.teamId === null);

  let currentTeamId: number | null = null;
  let round = 0;
  let pickInRound = 0;
  if (event.draftStatus === 'active' && teamOrder.length > 0 && poolPlayers.length > 0) {
    currentTeamId = getTeamForPick(teamOrder, currentPickNumber);
    round = getRoundForPick(teamOrder.length, currentPickNumber);
    pickInRound = getPickInRound(teamOrder.length, currentPickNumber);
  }

  return NextResponse.json({
    status: event.draftStatus,
    teamOrder,
    players: eventPlayers,
    teams: eventTeams,
    currentPickNumber,
    currentTeamId,
    round,
    pickInRound,
    totalPicked: pickedPlayers.length,
    poolRemaining: poolPlayers.length,
  });
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
  const id = parseInt(eventId, 10);
  const body = await request.json();
  const { action } = body;

  const event = await db.query.events.findFirst({
    where: eq(events.id, id),
  });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  switch (action) {
    case 'set-order': {
      // Draft order is locked once the draft is underway — changing it mid-draft would
      // break snake-order fairness (a team could be skipped or pick twice). Reset first.
      if (event.draftStatus !== 'none') {
        return NextResponse.json(
          { error: 'Draft order can only be changed before the draft starts.' },
          { status: 409 },
        );
      }
      const { teamOrder } = body;
      if (!Array.isArray(teamOrder) || teamOrder.length === 0) {
        return NextResponse.json({ error: 'teamOrder must be a non-empty array of team IDs' }, { status: 400 });
      }
      // The order must be a permutation of the event's teams — a team missing from the
      // snake order would simply never pick, and a stale/duplicate id breaks pick math.
      const eventTeams = await db.select().from(teams).where(eq(teams.eventId, id));
      const existingIds = new Set(eventTeams.map((t) => t.id));
      const unknown = teamOrder.filter((tid: number) => !existingIds.has(tid));
      const missing = eventTeams.filter((t) => !teamOrder.includes(t.id));
      const hasDupes = new Set(teamOrder).size !== teamOrder.length;
      if (unknown.length > 0 || missing.length > 0 || hasDupes) {
        return NextResponse.json(
          {
            error:
              missing.length > 0
                ? `Draft order is missing: ${missing.map((t) => t.name).join(', ')}. Every team must be in the order.`
                : 'Draft order contains unknown or duplicate teams. Re-save the order.',
          },
          { status: 400 },
        );
      }
      await db
        .update(events)
        .set({ draftOrder: JSON.stringify(teamOrder) })
        .where(eq(events.id, id));
      return NextResponse.json({ success: true, teamOrder });
    }

    case 'start': {
      if (event.draftStatus !== 'none' && event.draftStatus !== 'paused') {
        return NextResponse.json({ error: `Cannot start draft from status "${event.draftStatus}"` }, { status: 400 });
      }
      if (!event.draftOrder) {
        return NextResponse.json({ error: 'Draft order must be set before starting' }, { status: 400 });
      }

      // Validate all teams in draft order still exist
      const draftTeamOrder: number[] = JSON.parse(event.draftOrder);
      const eventTeams = await db.select().from(teams).where(eq(teams.eventId, id));
      const existingTeamIds = new Set(eventTeams.map(t => t.id));
      const invalidTeams = draftTeamOrder.filter(tid => !existingTeamIds.has(tid));

      if (invalidTeams.length > 0) {
        return NextResponse.json({
          error: 'Draft order contains teams that no longer exist. Please reset the draft order.',
          invalidTeamIds: invalidTeams,
        }, { status: 400 });
      }

      // Every team must be in the order — otherwise a team never gets a pick.
      const orderSet = new Set(draftTeamOrder);
      const missingTeams = eventTeams.filter((t) => !orderSet.has(t.id));
      if (missingTeams.length > 0) {
        return NextResponse.json({
          error: `Draft order is missing: ${missingTeams.map((t) => t.name).join(', ')}. Re-save the draft order first.`,
        }, { status: 400 });
      }

      const poolCount = await db
        .select()
        .from(players)
        .where(eq(players.eventId, id));
      const unpicked = poolCount.filter((p) => p.teamId === null);
      if (unpicked.length === 0) {
        return NextResponse.json({ error: 'No unpicked players in pool' }, { status: 400 });
      }
      await db
        .update(events)
        .set({ draftStatus: 'active' })
        .where(eq(events.id, id));
      return NextResponse.json({ success: true, status: 'active' });
    }

    case 'pause': {
      if (event.draftStatus !== 'active') {
        return NextResponse.json({ error: 'Draft is not active' }, { status: 400 });
      }
      await db
        .update(events)
        .set({ draftStatus: 'paused' })
        .where(eq(events.id, id));
      return NextResponse.json({ success: true, status: 'paused' });
    }

    case 'resume': {
      if (event.draftStatus !== 'paused') {
        return NextResponse.json({ error: 'Draft is not paused' }, { status: 400 });
      }
      await db
        .update(events)
        .set({ draftStatus: 'active' })
        .where(eq(events.id, id));
      return NextResponse.json({ success: true, status: 'active' });
    }

    case 'end': {
      if (event.draftStatus !== 'active' && event.draftStatus !== 'paused') {
        return NextResponse.json({ error: 'Draft is not in progress' }, { status: 400 });
      }
      await db
        .update(events)
        .set({ draftStatus: 'completed' })
        .where(eq(events.id, id));

      // Send Discord notification for draft completion
      const eventTeams = await db.select().from(teams).where(eq(teams.eventId, id));
      const eventPlayers = await db.select().from(players).where(eq(players.eventId, id));

      const teamsWithPlayers = eventTeams.map(team => ({
        name: team.name,
        color: team.color,
        players: eventPlayers
          .filter(p => p.teamId === team.id)
          .map(p => p.name),
      }));

      notifyDraftComplete({
        eventName: event.name,
        teams: teamsWithPlayers,
      }).catch(() => {}); // Silently ignore errors

      // Roster is final — provision per-team Discord roles/channels (if not already) and
      // give every contestant their bingo + team role. No-op when the feature is off.
      syncTeamDiscordOnDraftCompleteFireAndForget(id);

      return NextResponse.json({ success: true, status: 'completed' });
    }

    case 'reset': {
      // Clear all picks and reset draft status
      const eventPlayers = await db
        .select()
        .from(players)
        .where(eq(players.eventId, id));
      for (const p of eventPlayers) {
        await db
          .update(players)
          .set({ teamId: null, pickNumber: null, pickedAt: null })
          .where(eq(players.id, p.id));
      }
      await db
        .update(events)
        .set({ draftStatus: 'none', draftOrder: null })
        .where(eq(events.id, id));
      return NextResponse.json({ success: true, status: 'none' });
    }

    case 'resend-roster': {
      // Resend the draft complete notification to Discord
      const eventTeams = await db.select().from(teams).where(eq(teams.eventId, id));
      const eventPlayers = await db.select().from(players).where(eq(players.eventId, id));

      const teamsWithPlayers = eventTeams.map(team => ({
        name: team.name,
        color: team.color,
        players: eventPlayers
          .filter(p => p.teamId === team.id)
          .map(p => p.name),
      }));

      const success = await notifyDraftComplete({
        eventName: event.name,
        teams: teamsWithPlayers,
      });

      if (success) {
        return NextResponse.json({ success: true, message: 'Roster notification sent!' });
      } else {
        return NextResponse.json({ error: 'Failed to send notification. Check webhook configuration.' }, { status: 400 });
      }
    }

    case 'undo-pick': {
      // Only allow undo when draft is paused
      if (event.draftStatus !== 'paused') {
        return NextResponse.json({ error: 'Draft must be paused to undo picks' }, { status: 400 });
      }

      // Find the player with the highest pickNumber
      const eventPlayers = await db.select().from(players).where(eq(players.eventId, id));
      const pickedPlayers = eventPlayers.filter(p => p.pickNumber !== null);

      if (pickedPlayers.length === 0) {
        return NextResponse.json({ error: 'No picks to undo' }, { status: 400 });
      }

      // Find the last picked player
      const lastPicked = pickedPlayers.reduce((max, p) =>
        (p.pickNumber ?? -1) > (max.pickNumber ?? -1) ? p : max
      );

      // Reset their pick
      await db
        .update(players)
        .set({ teamId: null, pickNumber: null, pickedAt: null })
        .where(eq(players.id, lastPicked.id));

      return NextResponse.json({
        success: true,
        undone: {
          playerId: lastPicked.id,
          playerName: lastPicked.name,
          pickNumber: lastPicked.pickNumber,
        },
      });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
