import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { requireClan } from '@/lib/clanContext';
import { clanRoster, eventParticipants, events, teams } from '@/db/schema';
import { findRosterSeat, updateAccountOfSeat } from '@/lib/roster';
import { and, eq, inArray } from 'drizzle-orm';
import { verifyAdmin, verifyAdminOrModerator } from '@/lib/auth';
import { findOrCreateClanMember } from '@/lib/clan';
import { liveStatsForMembers } from '@/lib/liveStats';
import { effectiveSnapshotJson } from '@/lib/statTracking';
import { upsertPlayers, backfillApprovedSignups, accountCapError, type MemberInput } from '@/lib/enroll';
import { assertEventEditable } from '@/lib/eventLock';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  // Staff-only: this returns the full roster, which carries each player's login token (a bearer
  // credential for /api/player/login). It was previously world-readable — an unauthenticated
  // caller could harvest every token and take over any player. Consumed only by admin screens.
  const staff = await verifyAdminOrModerator();
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const eventPlayers = await db
    .select()
    .from(eventParticipants)
    .where(eq(eventParticipants.eventId, id));

  // Defense in depth: never serialize the login token, even to staff.
  const safe = eventPlayers.map((row) => {
    const rest: Record<string, unknown> = { ...row };
    delete rest.playerToken;
    return rest;
  });
  return NextResponse.json(safe);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const clan = await requireClan();

  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  // Finished events are read-only unless explicitly unlocked (lib/eventLock).
  const lockedResponse = await assertEventEditable(id);
  if (lockedResponse) return lockedResponse;
  const body = await request.json();

  // Optional ?teamId= — drop the new player(s) straight onto a team (admin adding someone after
  // the draft). Validated against this event; null (default) leaves them in the pool.
  const rawTeamId = new URL(request.url).searchParams.get('teamId');
  let assignTeamId: number | null = null;
  if (rawTeamId) {
    const tid = parseInt(rawTeamId, 10);
    const team = Number.isFinite(tid)
      ? await db.query.teams.findFirst({ where: and(eq(teams.id, tid), eq(teams.eventId, id)) })
      : null;
    if (!team) return NextResponse.json({ error: 'Team not found in this event' }, { status: 404 });
    assignTeamId = tid;
  }

  // Normalize both payload shapes into a uniform member list, then upsert (see upsertPlayers):
  //   - [{ clanMemberId }]  — picker-driven, links directly to the synced roster
  //   - [{ name, discord?, timezone? }] — legacy text import, still accepted for guests/manual rows
  const members: MemberInput[] = [];

  if (Array.isArray(body)) {
    type Item = { clanMemberId?: number; name?: string; discord?: string; timezone?: string };
    const items = body as Item[];

    const fromIds = items.filter((i): i is { clanMemberId: number } =>
      typeof i.clanMemberId === 'number' && Number.isFinite(i.clanMemberId),
    );
    const fromText = items.filter(
      (i) => typeof i.name === 'string' && i.name.trim().length > 0 && typeof i.clanMemberId !== 'number',
    ) as { name: string; discord?: string; timezone?: string }[];

    if (fromIds.length > 0) {
      const memberRows = await db
        .select()
        .from(clanRoster)
        .where(inArray(clanRoster.id, fromIds.map((i) => i.clanMemberId)));
      for (const m of memberRows) {
        members.push({ clanMemberId: m.id, name: m.rsn, discord: null, timezone: null });
      }
    }
    for (const p of fromText) {
      const name = p.name.trim();
      const discord = p.discord?.trim() || null;
      const clanMemberId = await findOrCreateClanMember(clan.id, name, { discordId: discord });
      members.push({ clanMemberId, name, discord, timezone: p.timezone?.trim() || null });
    }

    if (members.length === 0) {
      return NextResponse.json({ error: 'No valid players to import' }, { status: 400 });
    }
    const event = await db.query.events.findFirst({ where: eq(events.id, id) });
    const capErr = await accountCapError(id, event?.maxAccountsPerPerson ?? 1, members.map((m) => m.clanMemberId));
    if (capErr) return NextResponse.json({ error: capErr }, { status: 409 });
    const result = await upsertPlayers(id, members, assignTeamId);
    await backfillApprovedSignups(id, members.map((m) => m.clanMemberId));
    return NextResponse.json(result, { status: 201 });
  }

  // Single player (legacy text add).
  const { name, discord, timezone } = body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Player name is required' }, { status: 400 });
  }
  const trimmedName = name.trim();
  const trimmedDiscord = discord?.trim() || null;
  const clanMemberId = await findOrCreateClanMember(clan.id, trimmedName, { discordId: trimmedDiscord });
  members.push({ clanMemberId, name: trimmedName, discord: trimmedDiscord, timezone: timezone?.trim() || null });

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  const capErr = await accountCapError(id, event?.maxAccountsPerPerson ?? 1, [clanMemberId]);
  if (capErr) return NextResponse.json({ error: capErr }, { status: 409 });
  const result = await upsertPlayers(id, members, assignTeamId);
  await backfillApprovedSignups(id, [clanMemberId]);
  return NextResponse.json(result[0], { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, eId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  // Finished events are read-only unless explicitly unlocked (lib/eventLock).
  const lockedResponse = await assertEventEditable(eId);
  if (lockedResponse) return lockedResponse;
  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get('playerId');

  if (!playerId) {
    return NextResponse.json({ error: 'playerId query parameter required' }, { status: 400 });
  }

  const pId = parseInt(playerId, 10);

  // Only allow deleting unpicked players
  const player = await db.query.eventParticipants.findFirst({
    where: and(eq(eventParticipants.id, pId), eq(eventParticipants.eventId, eId)),
  });

  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  if (player.teamId !== null) {
    return NextResponse.json({ error: 'Cannot delete a player that has been drafted' }, { status: 400 });
  }

  await db.delete(eventParticipants).where(and(eq(eventParticipants.id, pId), eq(eventParticipants.eventId, eId)));

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, eId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  // Finished events are read-only unless explicitly unlocked (lib/eventLock).
  const lockedResponse = await assertEventEditable(eId);
  if (lockedResponse) return lockedResponse;
  const { playerId, name, discord, timezone, teamId, clanMemberId, frozen } = await request.json();

  if (!playerId) {
    return NextResponse.json({ error: 'playerId is required' }, { status: 400 });
  }

  const pId = parseInt(playerId, 10);

  const player = await db.query.eventParticipants.findFirst({
    where: and(eq(eventParticipants.id, pId), eq(eventParticipants.eventId, eId)),
  });

  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  const updateData: {
    name?: string;
    discord?: string | null;
    timezone?: string | null;
    teamId?: number | null;
    pickedAt?: string | null;
    pickNumber?: number | null;
    clanMemberId?: number;
    statsSnapshot?: string | null;
    snapshotAt?: string | null;
    cachedStats?: string | null;
    lastStatsFetch?: string | null;
    pluginStats?: string | null;
    frozenAt?: string | null;
    frozenStats?: string | null;
  } = {};

  if (name !== undefined) {
    if (typeof name === 'string' && name.trim()) {
      updateData.name = name.trim();
    } else {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    }
  }

  if (discord !== undefined) {
    updateData.discord = discord?.trim() || null;
  }

  if (timezone !== undefined) {
    updateData.timezone = timezone?.trim() || null;
  }

  // Swap which linked RuneScape account this player tracks (e.g. the RSN got banned and they play on
  // an alt). Re-points clanMemberId — the identity the RuneLite plugin matches — and follows the new
  // account's RSN so the hourly hiscores cron polls it too. Ungated: allowed mid-event, admin only.
  if (clanMemberId !== undefined && clanMemberId !== null) {
    const cmId = parseInt(String(clanMemberId), 10);
    if (!Number.isFinite(cmId)) {
      return NextResponse.json({ error: 'Invalid clanMemberId' }, { status: 400 });
    }
    if (cmId !== player.clanMemberId) {
      const member = await findRosterSeat(eq(clanRoster.id, cmId));
      if (!member) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }
      updateData.clanMemberId = cmId;
      updateData.name = member.rsn; // the tracked RSN follows the swapped account
      // Wipe the stat baseline so the next hiscores tick re-baselines from the NEW account —
      // otherwise gains = (new account's current XP/KC) − (old account's baseline) = garbage.
      // The real-time overlay is now member-scoped (clan_members.live_stats), so it's NOT touched
      // here — the swapped-in member carries its own correct live stats.
      updateData.statsSnapshot = null;
      updateData.snapshotAt = null;
      updateData.cachedStats = null;
      updateData.lastStatsFetch = null;

      // The RuneLite plugin resolves a player row via the Discord user's OWN linked accounts
      // (clanRoster.playerId), so the swapped-in account must belong to the same owner or the overlay
      // won't find it. If it's an unlinked ghost, link it to the player's current Discord owner so the
      // plugin resolves. If it already belongs to a DIFFERENT Discord user, leave it alone (don't
      // steal someone else's account) — the UI warns the admin about that case.
      const currentMember = player.clanMemberId != null
        ? await findRosterSeat(eq(clanRoster.id, player.clanMemberId))
        : null;
      const owner = currentMember?.claimedAt ? currentMember.playerId : null;
      if (owner != null && member.claimedAt == null) {
        await updateAccountOfSeat(cmId, { playerId: owner, claimedAt: currentMember!.claimedAt });
      }
    }
  }

  // Bench / sub-out toggle. Freezing pins the player's stat gain to a snapshot of their current stats
  // (frozenStats) and the hiscores sweep stops re-fetching them; their locked gain still counts toward
  // team-mode tiles and their contribution split stays put. Unfreezing clears both and resumes live
  // tracking on the next tick (baseline is untouched, so gains pick up from real current − baseline).
  if (frozen !== undefined) {
    if (frozen) {
      // Capture the EFFECTIVE current, not just cachedStats: a member grinding since the last 15-min
      // hiscores sweep has fresh gains only in their live plugin overlay (clan_members.live_stats).
      // Baking that in means benching them mid-grind keeps their real locked gain instead of dropping
      // the un-synced overlay portion (which would make the team total fall the instant they're subbed).
      const overlay = player.clanMemberId != null
        ? (await liveStatsForMembers([player.clanMemberId])).get(player.clanMemberId) ?? {}
        : {};
      updateData.frozenAt = new Date().toISOString();
      updateData.frozenStats = effectiveSnapshotJson(player.cachedStats, player.statsSnapshot, overlay);
    } else {
      updateData.frozenAt = null;
      updateData.frozenStats = null;
    }
  }

  // Roster edits — assign to a team, or remove (teamId: null → back to the pool). Allowed before
  // the draft and once it's complete, but never mid-draft where the snake pick flow owns picks.
  if (teamId !== undefined) {
    const event = await db.query.events.findFirst({ where: eq(events.id, eId) });
    if (event && (event.draftStatus === 'active' || event.draftStatus === 'paused')) {
      return NextResponse.json({ error: 'Cannot edit rosters while the draft is in progress.' }, { status: 409 });
    }
    if (teamId === null) {
      updateData.teamId = null;
      updateData.pickNumber = null;
      updateData.pickedAt = null;
    } else {
      const team = await db.query.teams.findFirst({ where: and(eq(teams.id, teamId), eq(teams.eventId, eId)) });
      if (!team) {
        return NextResponse.json({ error: 'Team not found in this event' }, { status: 404 });
      }
      updateData.teamId = teamId;
      updateData.pickedAt = new Date().toISOString();
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const [updated] = await db
    .update(eventParticipants)
    .set(updateData)
    .where(eq(eventParticipants.id, pId))
    .returning();

  return NextResponse.json(updated);
}
