import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, events, players, teams } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { getTeamForPick, getRoundForPick, getPickInRound, countPicksTaken } from '@/lib/draft';
import { parseEventRules } from '@/lib/eventRules';
import { buildDraftBalance, dynamicNextTeam, picksTakenByTeam } from '@/lib/draftBalance';
import { loadEventProfiles, attachProfiles } from '@/lib/draftProfiles';
import { notifyDraftComplete, notifyDraftStart } from '@/lib/discord';
import { syncTeamDiscordOnDraftCompleteFireAndForget } from '@/lib/discord-teams';
import { assertEventEditable } from '@/lib/eventLock';

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
  // Strip the per-player login token before this leaves the server — this endpoint is public
  // (spectator/scoreboard views read it), and the token is a bearer credential for /api/player/login.
  const safeRaw = rawPlayers.map((row) => {
    const rest = { ...row };
    delete (rest as { playerToken?: unknown }).playerToken;
    // The frozen-stats blob is a server-only snapshot for gain math; clients only need `frozenAt`.
    delete (rest as { frozenStats?: unknown }).frozenStats;
    return rest;
  });
  // Owner (userId) per player so a multi-account pool can group a person's accounts into one card and
  // the draft board can show they draft together (guests have no owner → their own single entry).
  const memberIds = [...new Set(safeRaw.map((p) => p.clanMemberId).filter((x): x is number => x != null))];
  const ownerRows = memberIds.length
    ? await db.select({ id: clanMembers.id, userId: clanMembers.userId }).from(clanMembers).where(inArray(clanMembers.id, memberIds))
    : [];
  const ownerByMember = new Map(ownerRows.map((r) => [r.id, r.userId]));
  // Surface each player's frozen sign-up answers so captains read them while drafting.
  const eventPlayers = attachProfiles(safeRaw, await loadEventProfiles(id)).map((p) => ({
    ...p,
    ownerUserId: p.clanMemberId != null ? ownerByMember.get(p.clanMemberId) ?? null : null,
  }));

  const eventTeams = await db
    .select({
      id: teams.id,
      eventId: teams.eventId,
      name: teams.name,
      color: teams.color,
    })
    .from(teams)
    .where(eq(teams.eventId, id));

  // Drop ids of since-deleted teams so clients never render (or count) ghost entries, then append
  // any current team not yet placed in the saved order. This keeps the effective order in sync
  // with the team set: teams added or recreated after the order was last saved show up in the
  // preview and get a slot at draft start instead of silently vanishing. `set-order` still
  // persists an explicit arrangement when the admin saves one.
  const existingTeamIds = new Set(eventTeams.map((t) => t.id));
  const savedOrder: number[] = (event.draftOrder ? JSON.parse(event.draftOrder) : []).filter(
    (tid: number) => existingTeamIds.has(tid),
  );
  const orderedSet = new Set(savedOrder);
  const teamOrder: number[] = [
    ...savedOrder,
    ...eventTeams.filter((t) => !orderedSet.has(t.id)).map((t) => t.id),
  ];
  const pickedPlayers = eventPlayers.filter((p) => p.teamId !== null);
  // Turns taken (not player rows): a multi-account person is one pick sharing one pickNumber, so the
  // clock advances once per person. Equals pickedPlayers.length for single-account events.
  const currentPickNumber = countPicksTaken(eventPlayers);
  const poolPlayers = eventPlayers.filter((p) => p.teamId === null);

  const balanceMode = parseEventRules(event.rules).balanceMode;
  let currentTeamId: number | null = null;
  let round = 0;
  let pickInRound = 0;
  if (event.draftStatus === 'active' && teamOrder.length > 0 && poolPlayers.length > 0) {
    // Dynamic-order mode: whoever's projected weakest (among the fewest-picks teams) is on the
    // clock — must mirror the pick route exactly or the UI shows the wrong team.
    if (balanceMode === 'dynamic-order') {
      try {
        const balance = await buildDraftBalance(id);
        currentTeamId = dynamicNextTeam(balance, teamOrder, picksTakenByTeam(eventPlayers));
      } catch {
        currentTeamId = getTeamForPick(teamOrder, currentPickNumber);
      }
    } else {
      currentTeamId = getTeamForPick(teamOrder, currentPickNumber);
    }
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
    balanceMode,
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
  // Finished events are read-only unless explicitly unlocked (lib/eventLock).
  const lockedResponse = await assertEventEditable(id);
  if (lockedResponse) return lockedResponse;
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

      const eventTeams = await db.select().from(teams).where(eq(teams.eventId, id));
      if (eventTeams.length < 2) {
        return NextResponse.json({ error: 'Add at least 2 teams before starting the draft.' }, { status: 400 });
      }

      // Reconcile the saved order against the current teams: drop any deleted teams and append any
      // that aren't placed yet (created/recreated after the order was last saved). Self-healing, so
      // a stale order never blocks the start — the reconciled order is what we persist and run.
      const existingTeamIds = new Set(eventTeams.map((t) => t.id));
      const savedOrder: number[] = event.draftOrder ? JSON.parse(event.draftOrder) : [];
      const cleaned = savedOrder.filter((tid) => existingTeamIds.has(tid));
      const placed = new Set(cleaned);
      const draftTeamOrder: number[] = [
        ...cleaned,
        ...eventTeams.filter((t) => !placed.has(t.id)).map((t) => t.id),
      ];

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
        .set({ draftStatus: 'active', draftOrder: JSON.stringify(draftTeamOrder) })
        .where(eq(events.id, id));

      // Announce the draft start to Discord exactly once — the atomic flip guards against a
      // retried request or a start-from-paused re-posting the same embed. Reset clears it.
      const startFlipped = await db
        .update(events)
        .set({ draftStartNotified: 1 })
        .where(and(eq(events.id, id), eq(events.draftStartNotified, 0)))
        .returning({ id: events.id });
      if (startFlipped.length > 0) {
        notifyDraftStart({
          eventName: event.name,
          teamCount: draftTeamOrder.length,
        }).catch(() => {}); // Silently ignore errors
      }

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

      // Post the roster to Discord exactly once (see the pick route) — the atomic flip guards
      // against the pick auto-complete having already sent it.
      const flipped = await db
        .update(events)
        .set({ draftNotified: 1 })
        .where(and(eq(events.id, id), eq(events.draftNotified, 0)))
        .returning({ id: events.id });
      if (flipped.length > 0) {
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
      }

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
        .set({ draftStatus: 'none', draftOrder: null, draftNotified: 0, draftStartNotified: 0 })
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
