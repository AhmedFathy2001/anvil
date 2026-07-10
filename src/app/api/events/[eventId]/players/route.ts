import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, players, events, teams, eventSignups } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { verifyAdmin, generatePlayerToken } from '@/lib/auth';
import { findOrCreateClanMember } from '@/lib/clan';

interface MemberInput {
  clanMemberId: number;
  name: string;
  discord: string | null;
  timezone: string | null;
}

// Create a player row for each member that doesn't have one yet. A member who ALREADY has a row
// that's unassigned (sitting in the draft pool) is ASSIGNED to the team when a team is given,
// instead of getting a duplicate row — this is what lets an admin put an already-enrolled/guest
// pool player onto a team after the draft. Members already on a team are left as-is.
async function upsertPlayers(
  eventId: number,
  members: MemberInput[],
  assignTeamId: number | null,
): Promise<(typeof players.$inferSelect)[]> {
  const memberIds = members.map((m) => m.clanMemberId);
  const existing = memberIds.length
    ? await db.select().from(players).where(and(eq(players.eventId, eventId), inArray(players.clanMemberId, memberIds)))
    : [];
  const byMember = new Map<number, typeof players.$inferSelect>();
  for (const p of existing) if (p.clanMemberId != null) byMember.set(p.clanMemberId, p);

  const pickedAt = assignTeamId != null ? new Date().toISOString() : null;
  const results: (typeof players.$inferSelect)[] = [];
  const toInsert: (typeof players.$inferInsert)[] = [];

  for (const m of members) {
    const row = byMember.get(m.clanMemberId);
    if (row) {
      if (assignTeamId != null && row.teamId == null) {
        const [updated] = await db
          .update(players)
          .set({ teamId: assignTeamId, pickedAt })
          .where(eq(players.id, row.id))
          .returning();
        results.push(updated);
      } else {
        results.push(row); // already in the pool, or already on a team — no duplicate
      }
    } else {
      toInsert.push({
        eventId,
        clanMemberId: m.clanMemberId,
        name: m.name,
        discord: m.discord,
        timezone: m.timezone,
        playerToken: generatePlayerToken(),
        teamId: assignTeamId,
        pickedAt,
      });
    }
  }
  if (toInsert.length > 0) {
    results.push(...(await db.insert(players).values(toInsert).returning()));
  }
  return results;
}

// Keep sign-ups and the pool consistent: adding someone as a player records an approved sign-up.
// Linked members attach to their users row; an unlinked in-game member gets a GUEST sign-up
// (userId null). An existing sign-up (any status) is left untouched so an admin's manual status
// decisions aren't silently overridden.
async function backfillApprovedSignups(eventId: number, clanMemberIds: number[]): Promise<void> {
  if (clanMemberIds.length === 0) return;
  const members = await db.select().from(clanMembers).where(inArray(clanMembers.id, clanMemberIds));
  for (const m of members) {
    // Dedup: linked → by (event, user); guest → by (event, clan member).
    const existing = await db.query.eventSignups.findFirst({
      where:
        m.userId != null
          ? and(eq(eventSignups.eventId, eventId), eq(eventSignups.userId, m.userId))
          : and(eq(eventSignups.eventId, eventId), eq(eventSignups.clanMemberId, m.id)),
    });
    if (existing) continue;
    await db
      .insert(eventSignups)
      .values({ eventId, userId: m.userId ?? null, clanMemberId: m.id, status: 'approved', profileData: '{}' })
      .catch(() => {}); // unique (event,user) race — ignore
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  const eventPlayers = await db
    .select()
    .from(players)
    .where(eq(players.eventId, id));

  return NextResponse.json(eventPlayers);
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
        .from(clanMembers)
        .where(inArray(clanMembers.id, fromIds.map((i) => i.clanMemberId)));
      for (const m of memberRows) {
        members.push({ clanMemberId: m.id, name: m.rsn, discord: null, timezone: null });
      }
    }
    for (const p of fromText) {
      const name = p.name.trim();
      const discord = p.discord?.trim() || null;
      const clanMemberId = await findOrCreateClanMember(name, { discordId: discord });
      members.push({ clanMemberId, name, discord, timezone: p.timezone?.trim() || null });
    }

    if (members.length === 0) {
      return NextResponse.json({ error: 'No valid players to import' }, { status: 400 });
    }
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
  const clanMemberId = await findOrCreateClanMember(trimmedName, { discordId: trimmedDiscord });
  members.push({ clanMemberId, name: trimmedName, discord: trimmedDiscord, timezone: timezone?.trim() || null });

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
  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get('playerId');

  if (!playerId) {
    return NextResponse.json({ error: 'playerId query parameter required' }, { status: 400 });
  }

  const pId = parseInt(playerId, 10);

  // Only allow deleting unpicked players
  const player = await db.query.players.findFirst({
    where: and(eq(players.id, pId), eq(players.eventId, eId)),
  });

  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  if (player.teamId !== null) {
    return NextResponse.json({ error: 'Cannot delete a player that has been drafted' }, { status: 400 });
  }

  await db.delete(players).where(and(eq(players.id, pId), eq(players.eventId, eId)));

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
  const { playerId, name, discord, timezone, teamId, clanMemberId } = await request.json();

  if (!playerId) {
    return NextResponse.json({ error: 'playerId is required' }, { status: 400 });
  }

  const pId = parseInt(playerId, 10);

  const player = await db.query.players.findFirst({
    where: and(eq(players.id, pId), eq(players.eventId, eId)),
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
      const member = await db.query.clanMembers.findFirst({ where: eq(clanMembers.id, cmId) });
      if (!member) {
        return NextResponse.json({ error: 'Linked account not found' }, { status: 404 });
      }
      updateData.clanMemberId = cmId;
      updateData.name = member.rsn; // the tracked RSN follows the swapped account
      // Wipe the stat baseline so the next hiscores tick re-baselines from the NEW account —
      // otherwise gains = (new account's current XP/KC) − (old account's baseline) = garbage.
      updateData.statsSnapshot = null;
      updateData.snapshotAt = null;
      updateData.cachedStats = null;
      updateData.lastStatsFetch = null;
      updateData.pluginStats = null;
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
    .update(players)
    .set(updateData)
    .where(eq(players.id, pId))
    .returning();

  return NextResponse.json(updated);
}
