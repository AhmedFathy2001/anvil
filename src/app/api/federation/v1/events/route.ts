import { NextResponse } from 'next/server';
import { db } from '@/db';
import { submissions, tiles, teams, players, events, clanMembers } from '@/db/schema';
import { and, eq, isNull, inArray, sql } from 'drizzle-orm';
import { resolveFederationToken, getInstanceId, getFederationTier } from '@/lib/federation';
import { getSharedCredit, getAcceptFederatedWrites } from '@/lib/pluginConfig';
import { syncDropTileCompletion } from '@/lib/submissions';
import { rateLimit, rateLimitByKey, rateLimitHeaders } from '@/lib/rate-limit';
import { notifySubmission } from '@/lib/discord';
import { queueSubmissionNotification, flushPendingNotifications } from '@/lib/notifications';
import { isManagedMediaUrl } from '@/lib/storage';
import { getConnectionsForUser } from '@/lib/federationConnections';
import { fanOutCredit, computeServerFanout, type FanoutTarget } from '@/lib/federationRelay';
import { federationFetch } from '@/lib/federationSecurity';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Submission-backed tile kinds (the ones the completions pipeline credits from a submission). Stat
// (hiscores) tiles never flow through here — they're swept by the stats cron.
const SUBMISSION_TILE_TYPES = new Set([
  'drop', 'kill', 'pvp', 'gain', 'timed', 'deathless', 'diary', 'ca', 'lms', 'value', 'valuetotal',
]);
// Count-only tiles the plugin may auto-report without a screenshot (the proof lands on the completing
// ping). Drops and timed clears always need an image, exactly as on the web submissions route.
const COUNT_ONLY_TILE_TYPES = new Set([
  'kill', 'pvp', 'gain', 'deathless', 'lms', 'value', 'valuetotal',
]);

// POST /api/federation/v1/events — cross-clan event ingest (WIRE §5, decision 1/2).
//
// A THIN WRAPPER over the EXISTING submissions pipeline: the plugin already resolved which tile a game
// event matches (client-side, decision 2) and submits the completion here authed with a federation
// token, wrapped with a fanout descriptor. We do NO server-side tile matching — we trust the plugin's
// tileId (same trust boundary as it already reporting the drop) but STILL resolve the crediting team
// from the TOKEN's own membership, so a token can only ever credit its own team, and STILL run the
// unchanged completion/anti-cheat pipeline (syncDropTileCompletion). Federation loosens nothing.
export async function POST(request: Request) {
  const rl = await rateLimit(request, 'federation-events', { limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many events — slow down.' }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  // ── Auth: federation token with events:write (WIRE §4/§8). 401 = bad token, 403 = wrong scope. ──
  const ctx = await resolveFederationToken(request);
  if (!ctx) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide Authorization: Bearer <federationToken>' },
      { status: 401 },
    );
  }
  if (!ctx.scopes.includes('events:write')) {
    return NextResponse.json({ error: 'Token missing events:write scope' }, { status: 403 });
  }

  let body: {
    eventId?: unknown;
    tileId?: unknown;
    amount?: unknown;
    imageUrl?: unknown;
    note?: unknown;
    itemId?: unknown;
    durationSeconds?: unknown;
    fanout?: { count?: unknown; instanceIds?: unknown; targets?: unknown };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventId = Number(body.eventId);
  const tileId = Number(body.tileId);
  if (!Number.isInteger(eventId) || eventId < 1 || !Number.isInteger(tileId) || tileId < 1) {
    return NextResponse.json({ error: 'eventId and tileId are required positive integers' }, { status: 400 });
  }

  // ── Fanout descriptor (WIRE §5): plugin-declared { count, instanceIds[] }. ──────────────────────
  const fanoutCount = Number(body.fanout?.count);
  const instanceIds = Array.isArray(body.fanout?.instanceIds)
    ? (body.fanout!.instanceIds as unknown[]).filter((x): x is string => typeof x === 'string')
    : null;
  if (!Number.isInteger(fanoutCount) || fanoutCount < 1 || !instanceIds) {
    return NextResponse.json(
      { error: 'fanout: { count:int>=1, instanceIds:string[] } is required' },
      { status: 400 },
    );
  }

  // ── Server-side fan-out targets (WIRE §10.4): the plugin submits its game event to its home site
  // ONCE, declaring which tile on which OTHER clan it matched (resolved client-side from each clan's
  // aggregated board). `targets` is present ONLY on the plugin's original submission — this is the
  // loop guard: a RELAYED event (minted by fanOutCredit below) carries only { count, instanceIds }
  // and no `targets`, so it never re-fans-out. Home does NO server-side tile matching; it just routes
  // each declared target to its clan with that clan's cached token. Absent → this is a leaf ingest.
  const relayTargets: FanoutTarget[] = Array.isArray(body.fanout?.targets)
    ? (body.fanout!.targets as unknown[]).flatMap((t) => {
        if (!t || typeof t !== 'object') return [];
        const o = t as { instanceId?: unknown; eventId?: unknown; tileId?: unknown };
        const eid = Number(o.eventId);
        const tid = Number(o.tileId);
        if (typeof o.instanceId !== 'string' || !Number.isInteger(eid) || !Number.isInteger(tid)) return [];
        return [{ instanceId: o.instanceId, eventId: eid, tileId: tid }];
      })
    : [];

  const ownInstanceId = await getInstanceId();
  const tier = getFederationTier();
  const isOrigin = relayTargets.length > 0; // this clan is the member's HOME, fanning out to others

  // ── §3 per-clan opt-out for INBOUND relayed writes. A leaf ingest (no `targets`) is a credit RELAYED
  // to us by another home; a clan may refuse those wholesale (still reads boards, takes no relayed
  // credit). Clean { credited:false } — never an error. ────────────────────────────────────────────
  if (!isOrigin && !(await getAcceptFederatedWrites())) {
    return NextResponse.json(
      { credited: false, reason: 'federation-writes-disabled' },
      { headers: rateLimitHeaders(rl) },
    );
  }

  // ── §3 rate-limit INBOUND relayed writes per (member, this clan) — a rogue relaying home can at worst
  // spam its own member's normal actions, bounded here. Identity is off the TOKEN, never client claim. ─
  const memberKey =
    ctx.userId != null ? `u:${ctx.userId}` : ctx.discordId ? `d:${ctx.discordId}` : `t:${ctx.tokenId}`;
  if (!isOrigin) {
    const inbound = await rateLimitByKey('federation-write-in', `${memberKey}:${ownInstanceId}`, {
      limit: 30,
      windowMs: 60_000,
    });
    if (!inbound.ok) {
      return NextResponse.json(
        { credited: false, reason: 'rate-limited' },
        { status: 429, headers: rateLimitHeaders(rl) },
      );
    }
  }

  // ── §7 SERVER-AUTHORITATIVE fan-out. NEVER trust the plugin's declared count/targets. On the origin
  // (home) path — and ONLY when this site is a TRUSTED (hosted) home (priority #1) — the count is
  // recomputed from the connections we ACTUALLY hold and each declared target is validated against them
  // (computeServerFanout). A self-host home is read-only in the mesh (never relays → count 1); a leaf
  // trusts the relaying hosted home's already-server-computed descriptor. ───────────────────────────
  const allConns = isOrigin && tier === 'hosted' && ctx.userId != null ? await getConnectionsForUser(ctx.userId) : [];
  const fanout = computeServerFanout({
    ownInstanceId,
    tier,
    isOrigin,
    relayTargets,
    connections: allConns,
    declaredCount: fanoutCount,
    declaredInstanceIds: instanceIds,
  });

  // ── sharedCredit enforcement (decision 1, WIRE §5). `exclusive` refuses any event the player is
  // simultaneously crediting elsewhere — using the SERVER count, not the plugin's. Clean 200. ────────
  if ((await getSharedCredit()) === 'exclusive' && fanout.count > 1) {
    return NextResponse.json(
      { credited: false, reason: 'exclusive' },
      { headers: rateLimitHeaders(rl) },
    );
  }

  // ── Resolve the crediting team from the TOKEN's identity (never client-declared). ───────────────
  // A federation token owns clan_members via userId (own-issued or member-exchange) and/or a pinned
  // memberId. An inert guest never reaches here (no events:write scope), so this only resolves real
  // members. We then require an ACTIVE enrollment on the target event — you can't credit a team
  // you're not on.
  const memberIdSet = new Set<number>();
  if (ctx.userId != null) {
    const owned = await db
      .select({ id: clanMembers.id })
      .from(clanMembers)
      .where(and(eq(clanMembers.userId, ctx.userId), isNull(clanMembers.leftAt)));
    for (const m of owned) memberIdSet.add(m.id);
  }
  if (ctx.memberId != null) memberIdSet.add(ctx.memberId);
  const memberIds = [...memberIdSet];
  if (memberIds.length === 0) {
    return NextResponse.json({ error: 'Token has no linked clan member' }, { status: 403 });
  }

  const nowIso = new Date().toISOString();
  const playerRows = await db
    .select({
      playerId: players.id,
      playerName: players.name,
      teamId: players.teamId,
      eventName: events.name,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
      startDate: events.startDate,
    })
    .from(players)
    .innerJoin(events, eq(players.eventId, events.id))
    .where(and(eq(players.eventId, eventId), inArray(players.clanMemberId, memberIds)));

  const enrollment = playerRows.find((p) => p.teamId != null);
  if (!enrollment) {
    return NextResponse.json({ error: 'Token is not enrolled on a team in this event' }, { status: 403 });
  }
  const teamId = enrollment.teamId!;

  // Live-event gate: no crediting an event that hasn't started or has ended/force-ended.
  if (enrollment.forceEndedAt || (enrollment.endDate && enrollment.endDate <= nowIso)) {
    return NextResponse.json({ error: 'Event is not active' }, { status: 400 });
  }
  if (enrollment.startDate && nowIso < enrollment.startDate) {
    return NextResponse.json({ error: 'Event has not started yet' }, { status: 400 });
  }

  // ── Tile: trust the plugin's tileId (no server-side matching) but verify it's in this event and is
  // a submission-backed kind. ─────────────────────────────────────────────────────────────────────
  const tile = await db.query.tiles.findFirst({
    where: and(eq(tiles.id, tileId), eq(tiles.eventId, eventId)),
  });
  if (!tile) {
    return NextResponse.json({ error: 'Tile not found in this event' }, { status: 404 });
  }
  if (!SUBMISSION_TILE_TYPES.has(tile.tileType)) {
    return NextResponse.json({ error: 'Tile does not accept submissions' }, { status: 400 });
  }

  const team = await db.query.teams.findFirst({
    where: and(eq(teams.id, teamId), eq(teams.eventId, eventId)),
  });
  if (!team) {
    return NextResponse.json({ error: 'Team not found in this event' }, { status: 404 });
  }

  // ── Amount validation (mirrors the web submissions route). ──────────────────────────────────────
  const amount = body.amount == null ? 1 : Number(body.amount);
  if (!Number.isInteger(amount) || amount < 1 || amount > 2_147_483_647) {
    return NextResponse.json({ error: 'amount must be a positive integer' }, { status: 400 });
  }
  const isValueTile = tile.tileType === 'value' || tile.tileType === 'valuetotal';
  if (!isValueTile && amount > 10000) {
    return NextResponse.json({ error: 'amount must be an integer between 1 and 10000' }, { status: 400 });
  }

  // ── note ────────────────────────────────────────────────────────────────────────────────────────
  let note: string | null = null;
  if (body.note != null) {
    if (typeof body.note !== 'string' || body.note.trim().length > 500) {
      return NextResponse.json({ error: 'note must be a string of at most 500 characters' }, { status: 400 });
    }
    note = body.note.trim() || null;
  }

  // ── Image/proof: count-only tiles may arrive imageless; drops & timed clears require managed media.
  const isCountOnly = COUNT_ONLY_TILE_TYPES.has(tile.tileType);
  let imageUrl: string | null = null;
  if (body.imageUrl != null && typeof body.imageUrl === 'string' && body.imageUrl.trim()) {
    let parsed: URL;
    try {
      parsed = new URL(body.imageUrl.trim());
    } catch {
      return NextResponse.json({ error: 'imageUrl must be a valid URL' }, { status: 400 });
    }
    if (!isManagedMediaUrl(parsed.toString())) {
      return NextResponse.json(
        { error: 'imageUrl must be an uploaded proof URL — upload via /api/upload first' },
        { status: 400 },
      );
    }
    imageUrl = body.imageUrl.trim();
  } else if (!isCountOnly) {
    return NextResponse.json({ error: 'Image is required for this tile' }, { status: 400 });
  }

  // ── Timed clears carry a duration instead of a count. ───────────────────────────────────────────
  let durationSeconds: number | null = null;
  if (tile.tileType === 'timed') {
    const d = Number(body.durationSeconds);
    if (!Number.isInteger(d) || d < 1 || d > 86400) {
      return NextResponse.json(
        { error: 'durationSeconds is required for timed tiles (1..86400)' },
        { status: 400 },
      );
    }
    durationSeconds = d;
  }

  // ── Per-item tracking: require + validate itemId when the tile is per-item. ─────────────────────
  let itemId: number | null = null;
  const tileItemRequirements = tile.itemRequirements
    ? (JSON.parse(tile.itemRequirements) as { itemId: number }[])
    : null;
  if (tileItemRequirements) {
    itemId = Number(body.itemId);
    if (!Number.isInteger(itemId) || !tileItemRequirements.some((r) => r.itemId === itemId)) {
      return NextResponse.json({ error: 'itemId is required and must be tracked by this tile' }, { status: 400 });
    }
  }

  // ── Feed the EXISTING pipeline: store the submission, then recompute completion. A RELAYED (leaf)
  // write is TAGGED with its source home instanceId (§3) so this clan can audit + reverse it later; a
  // native origin submission carries null. ────────────────────────────────────────────────────────
  const federatedSource = isOrigin
    ? null
    : instanceIds.find((id) => id !== ownInstanceId) ?? 'federation';
  const [submission] = await db
    .insert(submissions)
    .values({
      tileId,
      teamId,
      playerId: enrollment.playerId,
      creditPlayerId: enrollment.playerId, // credit the federating player themselves
      amount,
      imageUrl,
      note,
      itemId,
      durationSeconds,
      federatedSource,
    })
    .returning();

  const syncResult = await syncDropTileCompletion(tileId, teamId, { notifyCompletion: false });

  const totalResult = await db
    .select({ total: sql<number>`COALESCE(SUM(${submissions.amount}), 0)` })
    .from(submissions)
    .where(and(eq(submissions.tileId, tileId), eq(submissions.teamId, teamId)));
  const currentTotal = totalResult[0]?.total ?? 0;

  // Notifications: identical shape to the web submissions route (timed posts immediately; everything
  // else debounces). Fire-and-forget so the response isn't held on Discord.
  if (tile.tileType === 'timed') {
    notifySubmission({
      eventName: enrollment.eventName,
      tileLabel: tile.label,
      teamName: team.name,
      teamColor: team.color,
      creditPlayerName: enrollment.playerName,
      amount,
      currentTotal,
      requiredAmount: tile.requiredAmount,
      note,
      imageUrl,
      tileType: tile.tileType,
      durationSeconds,
      completed: syncResult?.isComplete ?? false,
    }).catch(() => {});
  } else {
    await queueSubmissionNotification({
      eventId,
      tileId,
      teamId,
      amount,
      currentTotal,
      requiredAmount: tile.requiredAmount,
      imageUrl,
      note,
      creditPlayerName: enrollment.playerName,
      completed: syncResult?.isComplete ?? false,
    });
    flushPendingNotifications().catch(() => {});
  }

  // ── Server-side fan-out relay (WIRE §10.4, hardened per FEDERATION_SECURITY.md priority #1 + §3/§7).
  // Runs ONLY when this site is a TRUSTED (hosted) home — a self-host home is read-only in the mesh and
  // NEVER write-relays (fanOutCredit also self-guards on `tier`). Targets are the SERVER-VALIDATED set
  // (each has a real cached connection), the count/instanceIds are SERVER-computed, and each relayed
  // write is rate-limited per (member, target clan). Best-effort + isolated per clan; a down/refusing
  // clan never affects the home credit or the others. ─────────────────────────────────────────────
  let relayed: { instanceId: string; credited: boolean; reason?: string }[] | undefined;
  if (isOrigin && tier === 'hosted' && fanout.validTargets.length > 0 && ctx.userId != null) {
    try {
      // §3 per-(member, target clan) rate limit — drop any target over budget before relaying.
      const allowedTargets: FanoutTarget[] = [];
      for (const t of fanout.validTargets) {
        const perTarget = await rateLimitByKey('federation-relay-out', `${ctx.userId}:${t.instanceId}`, {
          limit: 30,
          windowMs: 60_000,
        });
        if (perTarget.ok) allowedTargets.push(t);
      }
      if (allowedTargets.length > 0) {
        const results = await fanOutCredit({
          tier,
          connections: fanout.relayConnections,
          targets: allowedTargets,
          payload: { amount, imageUrl, note, itemId, durationSeconds },
          fanoutCount: fanout.count,
          instanceIds: fanout.instanceIds,
          fetchImpl: federationFetch, // §1 SSRF guard on every relayed /events POST
        });
        relayed = results.map((r) => ({ instanceId: r.instanceId, credited: r.credited, reason: r.reason }));
        log.info('federation.events.fanout', { instanceId: ownInstanceId, userId: ctx.userId, relayed: relayed.length });
      }
    } catch (err) {
      // Fan-out is best-effort — the home credit already succeeded; never fail the response on relay.
      log.warn('federation.events.fanout-fail', { instanceId: ownInstanceId, userId: ctx.userId }, err);
    }
  }

  return NextResponse.json(
    {
      credited: true,
      instanceId: ownInstanceId,
      submissionId: submission.id,
      completed: syncResult?.isComplete ?? false,
      ...(relayed ? { relayed } : {}),
    },
    { status: 201, headers: rateLimitHeaders(rl) },
  );
}
