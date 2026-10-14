import { resolvePluginClan } from '@/lib/auth';
import { noClanForPlugin } from '@/lib/pluginNoClan';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { eventParticipants, tiles, teams, events, completions, clanRoster, weeklyParticipants } from '@/db/schema';
import { findRosterSeat } from '@/lib/roster';
import { eq, and, inArray } from 'drizzle-orm';
import { pluginParticipantScope, resolvePluginMember, verifyPluginTokenUser } from '@/lib/auth';
import { applyAccountPush, isEmptyPush, readPushed, type PushBody } from '@/lib/accountPush';
import { accountForCharacter, accountStanding, playedCharacter } from '@/lib/pluginAccount';
import { statKeys } from '@/lib/tileKinds';
import { computeGainFromJson, isIndividualMode, isMilestoneBasis, milestoneStateFromJson, buildContributionSnapshot } from '@/lib/statTracking';
import { liveStatsForMembers } from '@/lib/liveStats';
import { getActiveWeeklyMetrics } from '@/lib/pluginConfig';
import { applyWeeklyValue } from '@/lib/weekly';
import { notifyTileCompletion } from '@/lib/discord';
import { evaluateCompletionGate, eventHasStarted } from '@/lib/completionGate';
import { handleBountyClaim } from '@/lib/revealEngine';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { log } from '@/lib/logger';

// Real-time boss-KC / skill-XP / activity ingest. The plugin posts {stats:[{name,kc}],
// skills:[{name,xp}], activities:[{key,value}]} with
// ABSOLUTE counts (no image), debounced to one push per key per 15 s. We resolve the caller's clan
// member from the account token (NO active bingo event required), store the max per key on
// clan_members.live_stats — the ONE member-scoped overlay read by both bingo tiles AND weekly
// SOTW/BOTW as max(hiscores, live) — then credit both immediately so a live kill/training burst
// lands before the 15-min hiscores sweep. The sweep is source of truth: it prunes a live entry once
// hiscores catches up. See lib/liveStats + lib/statTracking + the cron/stats sweep.

export async function POST(request: Request) {
  const clan = await resolvePluginClan(request);
  // No clan is not "nowhere to put it": the stats are the PERSON's, and their profile keeps them
  // with or without a clan. The account-only path takes the push when the token owns the character.
  if (!clan) return (await accountOnlyPush(request)) ?? noClanForPlugin();
  // Member-level auth: unlike verifyPluginToken this does NOT require a live bingo event, so a member
  // who's only in a weekly comp can still push live stats.
  const member = await resolvePluginMember(request);
  if (!member) {
    const own = await accountOnlyPush(request);
    if (own) return own;
    // LOGGED, because the symptom of this is silence. A client that is running, authenticated for
    // everything else, and refused here simply stops moving somebody's competition row — and with
    // no record of the refusal, the only evidence left is a leaderboard that looks frozen. That is
    // a day of guessing from the other end.
    log.warn('plugin-stats.refused', {
      clan: clan.slug,
      rsn: request.headers.get('X-RSN')?.trim() || null,
      reason: 'no-member',
    });
    return NextResponse.json({ error: 'Unauthorized. Provide Authorization: Bearer <accountToken> + X-RSN' }, { status: 401 });
  }

  // AFTER auth, and keyed on the PERSON rather than the address. Stat pushes are the highest-volume ingest there is — the plugin sends on skill and KC change — so
  // this sits well above real play and is still a hard ceiling on a tampered client.
  //
  // Several clanmates behind one household connection are one IP and must not share a budget, while
  // one tampered client is one token however many addresses it arrives from — so the identity is the
  // honest bucket. Same shape as the notify limit.
  const rl = await rateLimit(request, `plugin-stats:${member.userId}`, { limit: 120, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  let body: PushBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (isEmptyPush(body)) {
    // Same reason: a client sending empty bodies looks exactly like a client sending nothing.
    log.warn('plugin-stats.refused', { clan: clan.slug, clanMemberId: member.clanMemberId, reason: 'empty' });
    return NextResponse.json({ ok: true, updated: 0 });
  }
  const pushed = readPushed(body);
  if (Object.keys(pushed).length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  const nowIso = new Date().toISOString();

  // The account half — overlay + history — is shared with the no-clan path (lib/accountPush).
  // clan-scope: global -- the id came from a row this request already established, so the clan is settled upstream.
  const memberRow = await findRosterSeat(eq(clanRoster.id, member.clanMemberId));
  const accountId = memberRow?.accountId ?? member.accountId;
  const { live } = await applyAccountPush(accountId, pushed, nowIso);

  const updatedKeys = new Set(Object.keys(pushed));
  const completed: string[] = [];

  // ── Bingo credit: re-evaluate the member's active-event stat tiles so a real-time clear completes now.
  // Any seat this character holds, on a board the connected clan hosts or co-hosts — a co-host's
  // members sit on a HOST-clan seat, so the connected seat alone never found their board.
  // clan-scope: this clan -- boards the connected clan hosts or co-hosts (lib/auth pluginParticipantScope).
  const playerRows = await db
    .select({
      id: eventParticipants.id,
      teamId: eventParticipants.teamId,
      eventId: eventParticipants.eventId,
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .where(await pluginParticipantScope(member));
  // Pick the same way lib/auth does, and for the same reason: a member can be on a team for a board
  // that's running AND pre-drafted into one that starts in two months, and row order decides nothing.
  // This used to take the first row that merely hadn't ENDED, which let an event months away win —
  // and then credited its tiles off a live kill. Started boards come first; among them the freshest.
  const candidates = playerRows.filter(
    (p) => p.teamId && !p.forceEndedAt && (!p.endDate || p.endDate > nowIso),
  );
  candidates.sort((a, b) => {
    const sa = eventHasStarted(a);
    const sb = eventHasStarted(b);
    if (sa !== sb) return sa ? -1 : 1;
    return (b.startDate ?? '').localeCompare(a.startDate ?? '');
  });
  // Only a STARTED board takes credit. An unstarted one is a legitimate pick for context elsewhere
  // (the plugin shows its board), but nothing about it should score — see lib/completionGate.
  const activePlayer = candidates.find((p) => eventHasStarted(p));

  if (activePlayer) {
    const eventTiles = await db.select().from(tiles).where(eq(tiles.eventId, activePlayer.eventId));
    const statTiles = eventTiles.filter(
      (t) =>
        t.trackedStat &&
        (t.statType === 'boss' || t.statType === 'kc' || t.statType === 'skill') &&
        t.statGoal &&
        // Admin flipped this tile to manual — don't auto-credit from plugin-pushed stats.
        !t.autoTrackDisabled &&
        statKeys(t.trackedStat).some((k) => updatedKeys.has(k)),
    );

    if (statTiles.length > 0) {
      const teamPlayers = await db
        .select({
          id: eventParticipants.id,
          clanMemberId: eventParticipants.clanMemberId,
          statsSnapshot: eventParticipants.statsSnapshot,
          cachedStats: eventParticipants.cachedStats,
          frozenAt: eventParticipants.frozenAt,
          frozenStats: eventParticipants.frozenStats,
        })
        .from(eventParticipants)
        .where(and(eq(eventParticipants.eventId, activePlayer.eventId), eq(eventParticipants.teamId, activePlayer.teamId!)));
      // Every team player's live overlay (each is their own member; the pushing member's row reflects
      // the merge we just wrote). Gain = sum over keys of max(0, max(hiscores, live) − baseline).
      const teamLive = await liveStatsForMembers(teamPlayers.map((p) => p.clanMemberId));
      const gainFor = (p: (typeof teamPlayers)[number], keys: string[], statType: string): number => {
        // Benched players are pinned to frozenStats (no live overlay) so their locked gain still counts
        // toward the team total but never climbs.
        if (p.frozenAt) return computeGainFromJson(p.statsSnapshot, p.frozenStats, {}, keys, statType);
        const plug = (p.clanMemberId != null && teamLive.get(p.clanMemberId)) || {};
        return computeGainFromJson(p.statsSnapshot, p.cachedStats, plug, keys, statType);
      };

      const tileIds = eventTiles.map((t) => t.id);
      const existing = tileIds.length
        ? await db.select().from(completions).where(inArray(completions.tileId, tileIds))
        : [];
      const done = new Set(existing.map((c) => `${c.teamId}-${c.tileId}`));
      // clan-scope: global -- the id came from a row this request already established, so the clan is settled upstream.
      const event = await db.query.events.findFirst({ where: eq(events.id, activePlayer.eventId) });
      const team = await db.query.teams.findFirst({ where: eq(teams.id, activePlayer.teamId!) });

      for (const tile of statTiles) {
        const compKey = `${activePlayer.teamId}-${tile.id}`;
        if (done.has(compKey)) continue;
        // Event-rules gate: unrevealed/claimed tiles and lockout losses never credit, no matter
        // what the pushed stats say. Also freezes the rule-adjusted award for the insert below.
        const gate = event
          ? await evaluateCompletionGate({ event, tile, teamId: activePlayer.teamId! })
          : null;
        if (gate && !gate.allowed) continue;
        const keys = statKeys(tile.trackedStat);
        // A MILESTONE tile asks whether someone crossed a lifetime threshold during the event, and is
        // always settled per member — a team's lifetime totals summed together are meaningless (see
        // lib/statTracking.milestoneState). So it behaves like an individual tile here whatever the
        // tracking mode says, and the finisher is whoever became eligible and reached it.
        const milestone = isMilestoneBasis(tile.statBasis);
        const msFor = (p: (typeof teamPlayers)[number]) =>
          p.frozenAt
            ? milestoneStateFromJson(p.statsSnapshot, p.frozenStats, {}, keys, tile.statType!, tile.statGoal!)
            : milestoneStateFromJson(
                p.statsSnapshot,
                p.cachedStats,
                (p.clanMemberId != null && teamLive.get(p.clanMemberId)) || {},
                keys,
                tile.statType!,
                tile.statGoal!,
              );

        const individual = milestone || isIndividualMode(tile.trackingMode);
        // For an individual tile, the finisher is the player who reached the goal alone (attributed so the
        // activity feed can name them — a stat completion has no submission). Team tiles have no one player.
        const individualFinisher = milestone
          ? teamPlayers.find((p) => msFor(p).reached)
          : individual
            ? teamPlayers.find((p) => gainFor(p, keys, tile.statType!) >= tile.statGoal!)
            : undefined;
        const meets = individual
          ? individualFinisher != null
          : teamPlayers.reduce((sum, p) => sum + gainFor(p, keys, tile.statType!), 0) >= tile.statGoal!;
        if (!meets) continue;

        // Freeze the per-member split at completion: the lone finisher for individual tiles, or every
        // contributing team member's current gain for team tiles. Locks "who got what %" against the
        // stat continuing to climb after the tile is done.
        const splitRows = milestone
          ? [{ playerId: individualFinisher!.id, gained: msFor(individualFinisher!).lifetime }]
          : individual
            ? [{ playerId: individualFinisher!.id, gained: gainFor(individualFinisher!, keys, tile.statType!) }]
            : teamPlayers.map((p) => ({ playerId: p.id, gained: gainFor(p, keys, tile.statType!) }));

        // Notify only on a genuine insert — the sweep + this push can both cross a threshold and
        // would otherwise double-ping Discord.
        const inserted = await db
          .insert(completions)
          .values({
            teamId: activePlayer.teamId!,
            tileId: tile.id,
            creditPlayerId: individualFinisher?.id ?? null,
            statContributions: JSON.stringify(buildContributionSnapshot(tile.statGoal!, splitRows)),
            awardedPoints: gate?.awardedPoints ?? null,
          })
          .onConflictDoNothing()
          .returning({ id: completions.id });
        if (inserted.length === 0) continue;
        if (gate?.bounty) handleBountyClaim(activePlayer.eventId, tile.id).catch(() => {});
        done.add(compKey);
        completed.push(tile.label);
        if (event && team) {
          notifyTileCompletion({
            clanId: clan.id,
            eventName: event.name,
            tileLabel: tile.label,
            teamName: team.name,
            teamId: team.id,
            teamColor: team.color,
            tileType: tile.tileType,
            trackedStat: tile.trackedStat,
            statType: tile.statType,
            eventId: event.id,
            tile,
          }).catch(() => {});
        }
      }
    }
  }

  // ── Weekly credit: move SOTW/BOTW live for any active comp whose metric was just pushed. Only when
  // the member is 'active' (unranked/banned rows are the sweep's job) and already baselined (a first
  // capture from a live push would zero the session — the sweep sets the baseline from max(hiscores,
  // live)). currentValue climbs monotonically; a stale-baseline flush is spike-flagged here too.
  if (memberRow?.status === 'active') {
    const activeComps = (await getActiveWeeklyMetrics(clan.id)).filter((c) => updatedKeys.has(c.metric));
    for (const comp of activeComps) {
      const participant = await db.query.weeklyParticipants.findFirst({
        where: and(
          eq(weeklyParticipants.competitionId, comp.id),
          eq(weeklyParticipants.clanMemberId, member.clanMemberId),
        ),
      });
      if (!participant) continue; // not enrolled yet — the lifecycle cron enrolls + the sweep baselines
      await applyWeeklyValue({
        participantId: participant.id,
        type: comp.type,
        metric: comp.metric,
        value: live[comp.metric] ?? 0,
        baselineValue: participant.baselineValue,
        currentValue: participant.currentValue,
        lastUpdated: participant.lastUpdated,
        allowFirstCapture: false,
        competitionStartIso: comp.startDate,
        now: nowIso,
      });
    }
  }

  return NextResponse.json({ ok: true, updated: Object.keys(pushed).length, completed });
}

/**
 * A push from somebody with no seat to credit — no clan at all, or a character that's theirs but on no
 * roster. Only the account half runs (overlay + history): there is no competition row or tile to
 * credit without a seat.
 *
 * Only a character the token OWNS (accountStanding 'yours'). Unclaimed or somebody else's character
 * gets nothing — claiming happens on the config path, which knows how; a stat push is not the place
 * to decide who an account belongs to. Null ⇒ not ours to take; the caller answers as before.
 */
async function accountOnlyPush(request: Request): Promise<NextResponse | null> {
  const viewer = await verifyPluginTokenUser(request);
  const character = playedCharacter(request);
  if (!viewer || !character) return null;
  if ((await accountStanding(viewer.userId, character)) !== 'yours') return null;
  const account = await accountForCharacter(character);
  if (!account) return null;

  const rl = await rateLimit(request, `plugin-stats:${viewer.userId}`, { limit: 120, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });
  }
  let body: PushBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const pushed = readPushed(body);
  if (Object.keys(pushed).length === 0) return NextResponse.json({ ok: true, updated: 0 });
  await applyAccountPush(account.id, pushed, new Date().toISOString());
  return NextResponse.json({ ok: true, updated: Object.keys(pushed).length, completed: [] });
}
