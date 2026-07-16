import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, completions, events, players, tiles, teams } from '@/db/schema';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { normalizeRsn } from '@/lib/auth';
import { resolveFederationToken } from '@/lib/federation';
import { jsonWithEtag } from '@/lib/httpEtag';

export const dynamic = 'force-dynamic';

const ACTIVITY_LIMIT = 25;

// GET /api/federation/v1/activity — a small recent-completions feed for the caller's active event
// team, so a member's OTHER home site can aggregate it into the plugin sidebar (WIRE §10.2 `activity`).
// Federation-authed (Bearer federation token, board:read). Same team-resolution as /board, and kept
// ETag/304 (the feed rarely changes between the plugin's polls).
export async function GET(request: Request) {
  const ctx = await resolveFederationToken(request);
  if (!ctx) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide Authorization: Bearer <federationToken>' },
      { status: 401 },
    );
  }
  if (!ctx.scopes.includes('board:read')) {
    return NextResponse.json({ error: 'Token missing board:read scope' }, { status: 403 });
  }

  // Resolve the caller's owned, active members (with the same RSN/member-pin narrowing as /board).
  const ownedMembers = ctx.userId != null
    ? await db
        .select({ id: clanMembers.id, rsnNormalized: clanMembers.rsnNormalized })
        .from(clanMembers)
        .where(and(eq(clanMembers.userId, ctx.userId), isNull(clanMembers.leftAt)))
    : [];
  let memberIds = ownedMembers.map((m) => m.id);
  if (ctx.memberId != null && memberIds.includes(ctx.memberId)) memberIds = [ctx.memberId];
  const rsnHint = request.headers.get('X-RSN')?.trim() || new URL(request.url).searchParams.get('rsn');
  if (rsnHint) {
    const norm = normalizeRsn(rsnHint);
    const match = ownedMembers.find((m) => m.rsnNormalized === norm);
    if (match) memberIds = [match.id];
  }
  if (memberIds.length === 0) {
    return jsonWithEtag(request, { eventId: null, teamId: null, items: [] });
  }

  // Pick the caller's active-event team (mirrors /board's pick).
  const nowIso = new Date().toISOString();
  const playerRows = await db
    .select({
      teamId: players.teamId,
      eventId: players.eventId,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
    })
    .from(players)
    .innerJoin(events, eq(players.eventId, events.id))
    .where(inArray(players.clanMemberId, memberIds));
  const pick = playerRows.find((p) => p.teamId && !p.forceEndedAt && (!p.endDate || p.endDate > nowIso));
  if (!pick) {
    return jsonWithEtag(request, { eventId: null, teamId: null, items: [] });
  }

  const team = await db.query.teams.findFirst({ where: eq(teams.id, pick.teamId!) });

  const rows = await db
    .select({
      tileId: completions.tileId,
      completedAt: completions.completedAt,
      label: tiles.label,
      points: tiles.points,
    })
    .from(completions)
    .innerJoin(tiles, eq(completions.tileId, tiles.id))
    .where(eq(completions.teamId, pick.teamId!))
    .orderBy(desc(completions.completedAt))
    .limit(ACTIVITY_LIMIT);

  return jsonWithEtag(request, {
    eventId: pick.eventId,
    teamId: pick.teamId,
    teamName: team?.name ?? null,
    items: rows.map((r) => ({
      tileId: r.tileId,
      label: r.label,
      points: r.points ?? 0,
      completedAt: r.completedAt,
    })),
  });
}
