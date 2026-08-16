import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, events, players, teams } from '@/db/schema';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { verifyAdmin, verifyCaptain, verifyUser, resolveTeamMembership } from '@/lib/auth';
import { getTeamForPick, countPicksTaken } from '@/lib/draft';
import { parseEventRules } from '@/lib/eventRules';
import { buildDraftBalance, dynamicNextTeam, picksTakenByTeam, spreadCapBlockReason, tierPickBlockReason, type DraftBalance } from '@/lib/draftBalance';
import { notifyDraftComplete } from '@/lib/discord';
import { syncTeamDiscordOnDraftCompleteFireAndForget } from '@/lib/discord-teams';
import { assertEventEditable } from '@/lib/eventLock';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  // Finished events are read-only unless explicitly unlocked (lib/eventLock).
  const lockedResponse = await assertEventEditable(eId);
  if (lockedResponse) return lockedResponse;
  const { playerId } = await request.json();

  if (!playerId) {
    return NextResponse.json({ error: 'playerId is required' }, { status: 400 });
  }

  // Auth: must be admin or captain of the picking team. Captaincy via legacy cookie or
  // the Discord web session (resolved against the team whose turn it is, below).
  const isAdmin = await verifyAdmin();
  const captain = await verifyCaptain();
  const webUser = !isAdmin && !captain ? await verifyUser() : null;

  if (!isAdmin && !captain && !webUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Load event
  const event = await db.query.events.findFirst({
    where: eq(events.id, eId),
  });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (event.draftStatus !== 'active') {
    return NextResponse.json({ error: 'Draft is not active' }, { status: 400 });
  }
  if (!event.draftOrder) {
    return NextResponse.json({ error: 'Draft order not set' }, { status: 400 });
  }

  const teamOrder: number[] = JSON.parse(event.draftOrder);

  // Validate all teams in draft order still exist
  const eventTeams = await db.select().from(teams).where(eq(teams.eventId, eId));
  const existingTeamIds = new Set(eventTeams.map(t => t.id));
  const invalidTeams = teamOrder.filter(id => !existingTeamIds.has(id));

  if (invalidTeams.length > 0) {
    return NextResponse.json({
      error: 'Draft order contains teams that no longer exist. Please reset and reconfigure the draft order.',
      invalidTeamIds: invalidTeams,
    }, { status: 400 });
  }

  // Determine current pick
  const eventPlayers = await db
    .select()
    .from(players)
    .where(eq(players.eventId, eId));
  // Turns taken = DISTINCT pick numbers (a multi-account person is one pick sharing one pickNumber).
  const pickedCount = countPicksTaken(eventPlayers);
  const unpicked = eventPlayers.filter((p) => p.teamId === null);

  if (unpicked.length === 0) {
    return NextResponse.json({ error: 'No players left in pool' }, { status: 400 });
  }

  // Balance modes (events.rules.balanceMode): 'dynamic-order' replaces fixed serpentine with
  // weakest-projected-team-picks-next; 'tiered-snake' keeps serpentine but polices S/A-tier
  // stacking below. Profile compute only runs when a mode needs it.
  const eventRules = parseEventRules(event.rules);
  const balanceMode = eventRules.balanceMode;
  let balance: DraftBalance | null = null;
  if (balanceMode === 'dynamic-order' || balanceMode === 'tiered-snake' || balanceMode === 'spread-cap') {
    try {
      balance = await buildDraftBalance(eId);
    } catch {
      balance = null; // profile hiccup → classic behaviour, never a stuck draft
    }
  }
  const expectedTeamId =
    balanceMode === 'dynamic-order' && balance
      ? dynamicNextTeam(balance, teamOrder, picksTakenByTeam(eventPlayers))
      : getTeamForPick(teamOrder, pickedCount);

  // Resolve which team this caller captains (cookie, or web session for the team on the clock).
  let captainTeamId: number | null = captain ? captain.teamId : null;
  if (!isAdmin && !captain && webUser) {
    const m = await resolveTeamMembership(eId, expectedTeamId);
    if (m?.isCaptain) captainTeamId = expectedTeamId;
  }

  // Validate it's the right team's turn (unless admin overriding)
  if (!isAdmin && captainTeamId !== expectedTeamId) {
    return NextResponse.json({ error: 'It is not your team\'s turn to pick' }, { status: 403 });
  }

  // Validate player is in pool
  const player = await db.query.players.findFirst({
    where: and(eq(players.id, playerId), eq(players.eventId, eId)),
  });
  if (!player) {
    return NextResponse.json({ error: 'Player not found in this event' }, { status: 404 });
  }
  if (player.teamId !== null) {
    return NextResponse.json({ error: 'Player has already been picked' }, { status: 400 });
  }

  // Tiered-snake coverage: no second S while a team has none (same for A). Admins can override —
  // they can already pick out of turn; the constraint is for captains.
  if (!isAdmin && balanceMode === 'tiered-snake' && balance) {
    const reason = tierPickBlockReason(balance, playerId, expectedTeamId, teamOrder);
    if (reason) {
      return NextResponse.json({ error: reason }, { status: 400 });
    }
  }

  // Spread cap: the pick may not put this team further than the configured pct above the average
  // roster. Binds hardest on whoever is already ahead, and lifts itself rather than stalling a
  // draft nobody can legally continue (see spreadCapBlockReason).
  if (!isAdmin && balanceMode === 'spread-cap' && balance) {
    const reason = spreadCapBlockReason(
      balance,
      playerId,
      expectedTeamId,
      teamOrder,
      eventRules.balanceSpreadCapPct,
    );
    if (reason) {
      return NextResponse.json({ error: reason }, { status: 400 });
    }
  }

  // Multi-account: one pick drafts the whole PERSON — every one of their still-unpicked accounts in
  // this event joins the SAME team, sharing this pick's number (guests have no owning user → just
  // themselves). The group leaves the pool together and counts as a single turn.
  const pickedMember = player.clanMemberId != null
    ? await db.query.clanMembers.findFirst({ where: eq(clanMembers.id, player.clanMemberId) })
    : null;
  const groupIds = [playerId];
  if (pickedMember?.userId != null) {
    const siblings = await db
      .select({ id: players.id })
      .from(players)
      .innerJoin(clanMembers, eq(players.clanMemberId, clanMembers.id))
      .where(and(eq(players.eventId, eId), eq(clanMembers.userId, pickedMember.userId), isNull(players.teamId)));
    for (const s of siblings) {
      if (s.id !== playerId) groupIds.push(s.id);
    }
  }

  // Make the pick — the picked player and every grouped sibling share teamId + pickNumber.
  const now = new Date().toISOString();
  await db
    .update(players)
    .set({
      teamId: expectedTeamId,
      pickNumber: pickedCount,
      pickedAt: now,
    })
    .where(and(inArray(players.id, groupIds), eq(players.eventId, eId), isNull(players.teamId)));

  // Check if pool is now empty → auto-complete draft
  const remainingPool = unpicked.length - groupIds.length;
  if (remainingPool === 0) {
    await db
      .update(events)
      .set({ draftStatus: 'completed' })
      .where(eq(events.id, eId));

    // Post the roster to Discord — but exactly once. The manual "End draft" action can also
    // complete a draft, and a double-clicked final pick could re-enter here; an atomic flip of
    // draftNotified 0→1 lets only the request that wins send the embed.
    const flipped = await db
      .update(events)
      .set({ draftNotified: 1 })
      .where(and(eq(events.id, eId), eq(events.draftNotified, 0)))
      .returning({ id: events.id });
    if (flipped.length > 0) {
      const eventTeams = await db.select().from(teams).where(eq(teams.eventId, eId));
      // Re-fetch players to include the just-picked player
      const allPlayers = await db.select().from(players).where(eq(players.eventId, eId));

      const teamsWithPlayers = eventTeams.map(team => ({
        name: team.name,
        color: team.color,
        players: allPlayers
          .filter(p => p.teamId === team.id)
          .map(p => p.name),
      }));

      notifyDraftComplete({
        eventName: event.name,
        teams: teamsWithPlayers,
        eventId: event.id,
      }).catch(() => {}); // Silently ignore errors

      // Auto-provision the team Discord channels + assign contestant roles now that rosters are
      // final. Same exactly-once guard as the roster post (draftNotified flip). No-op when the
      // team-sync feature is off. This is why finishing a draft by picking the last player used to
      // do nothing on Discord — only the manual "End draft" path called it.
      syncTeamDiscordOnDraftCompleteFireAndForget(eId);
    }
  }

  // Compute next pick info
  const nextPickNumber = pickedCount + 1;
  let nextTeamId: number | null = null;
  if (remainingPool > 0) {
    if (balanceMode === 'dynamic-order' && balance) {
      // Apply the pick we just made in-memory (profiles were computed pre-pick).
      const pickedProfile = balance.byPlayerId.get(playerId);
      if (pickedProfile) pickedProfile.teamId = expectedTeamId;
      const counts = picksTakenByTeam(eventPlayers);
      counts.set(expectedTeamId, (counts.get(expectedTeamId) ?? 0) + 1);
      nextTeamId = dynamicNextTeam(balance, teamOrder, counts);
    } else {
      nextTeamId = getTeamForPick(teamOrder, nextPickNumber);
    }
  }

  return NextResponse.json({
    success: true,
    pick: {
      playerId,
      playerName: player.name,
      teamId: expectedTeamId,
      pickNumber: pickedCount,
      pickedAt: now,
    },
    nextTeamId,
    poolRemaining: remainingPool,
    draftStatus: remainingPool === 0 ? 'completed' : 'active',
  });
}
