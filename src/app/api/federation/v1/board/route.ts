import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, events, players } from '@/db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { normalizeRsn } from '@/lib/auth';
import { resolveFederationToken } from '@/lib/federation';
import { getFederationEnabled } from '@/lib/pluginConfig';
import { buildBoard } from '@/app/api/plugin/board/route';
import { jsonWithEtag } from '@/lib/httpEtag';

export const dynamic = 'force-dynamic';

// GET /api/federation/v1/board — the board for the caller's active event, or a read-only preview of
// an explicit ?eventId=N. Federation-authed (Bearer federation token, board:read scope). Reuses the
// exact buildBoard() shape the plugin already renders, and keeps ETag/304 (WIRE §7 / FEDERATION.md).
//
// Multi-RSN: a token can own several accounts. An optional X-RSN header (or ?rsn=) narrows to one,
// exactly like the plugin token path; a member-pinned token narrows to its member.
export async function GET(request: Request) {
  // Master switch (WIRE §10.1): federation OFF must mean OFF for the INBOUND surface too — a
  // clan that left the network stops serving exchanges/reads/relays, so other homes' refreshes
  // drop it within one cycle instead of keeping a ghost connection alive.
  if (!(await getFederationEnabled())) {
    return NextResponse.json({ error: 'federation_disabled' }, { status: 403 });
  }

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

  const url = new URL(request.url);

  // The caller's owned, active clan_members — the set we scope the board to.
  const ownedMembers = ctx.userId != null
    ? await db
        .select({ id: clanMembers.id, rsnNormalized: clanMembers.rsnNormalized })
        .from(clanMembers)
        .where(and(eq(clanMembers.userId, ctx.userId), isNull(clanMembers.leftAt)))
    : [];

  let memberIds = ownedMembers.map((m) => m.id);
  // A member-pinned token resolves to just that member (if it's still owned/active).
  if (ctx.memberId != null && memberIds.includes(ctx.memberId)) memberIds = [ctx.memberId];
  // An RSN hint narrows to the matching account (the multi-RSN-on-one-token disambiguation).
  const rsnHint = request.headers.get('X-RSN')?.trim() || url.searchParams.get('rsn');
  if (rsnHint) {
    const norm = normalizeRsn(rsnHint);
    const match = ownedMembers.find((m) => m.rsnNormalized === norm);
    if (match) memberIds = [match.id];
  }

  // Explicit event id → read-only preview (interactive if the caller has a team on it). Still
  // requires a valid federation token, unlike the plugin route's anonymous ?eventId preview.
  const eventIdParam = url.searchParams.get('eventId');
  if (eventIdParam) {
    const eventId = Number(eventIdParam);
    if (!Number.isFinite(eventId) || eventId <= 0) {
      return NextResponse.json({ error: 'Invalid eventId' }, { status: 400 });
    }
    const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    const teamId = memberIds.length
      ? (
          await db.query.players.findFirst({
            where: and(eq(players.eventId, eventId), inArray(players.clanMemberId, memberIds)),
          })
        )?.teamId ?? null
      : null;
    return jsonWithEtag(request, await buildBoard(event, teamId));
  }

  // Default: the caller's own active event, scoped to their team (mirrors verifyPluginToken's pick).
  if (memberIds.length === 0) {
    return NextResponse.json({ error: 'No linked account for this token' }, { status: 404 });
  }
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
  const pick = playerRows.find(
    (p) => p.teamId && !p.forceEndedAt && (!p.endDate || p.endDate > nowIso),
  );
  if (!pick) {
    return NextResponse.json(
      { error: 'No active event enrollment for this token' },
      { status: 404 },
    );
  }
  const event = await db.query.events.findFirst({ where: eq(events.id, pick.eventId) });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  return jsonWithEtag(request, await buildBoard(event, pick.teamId));
}
