import { resolvePluginClan } from '@/lib/auth';
import { noClanForPlugin } from '@/lib/pluginNoClan';
import { NextResponse } from 'next/server';
import { foreignOr } from '@/lib/pluginForeign';
import { db } from '@/db';
import { eventParticipants, tiles, events, clanRoster, weeklyParticipants } from '@/db/schema';
import { findRosterSeat } from '@/lib/roster';
import { eq, and } from 'drizzle-orm';
import { pluginParticipantScope, resolvePluginMember, verifyPluginTokenUser } from '@/lib/auth';
import { applyAccountPush, isEmptyPush, readPushed, type PushBody } from '@/lib/accountPush';
import { accountForCharacter, accountStanding, playedCharacter } from '@/lib/pluginAccount';
import { statKeys } from '@/lib/tileKinds';
import { getActiveWeeklyMetrics } from '@/lib/pluginConfig';
import { applyWeeklyValue } from '@/lib/weekly';
import { liveMetricValue, type CompetitionType } from '@/lib/weeklyMetric';
import { metricKeys } from '@/lib/constants';
import { eventHasStarted } from '@/lib/completionGate';
import { creditStatTilesForTeam } from '@/lib/statTileCredit';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { log } from '@/lib/logger';
import { ttlMemo } from '@/lib/ttlMemo';
import { labDivert } from '@/lib/lab';
import { applyLabStatsPush } from '@/lib/labStats';
import { notifyTeamTiles } from '@/lib/pushNotify';
import { worldModeIgnored, worldModeOf } from '@/lib/worldModeRequest';
import { parseEventRules } from '@/lib/eventRules';
import { mergeModePush } from '@/lib/modeStats';
import type { WorldMode } from '@/lib/worldModes';

// Real-time boss-KC / skill-XP / activity ingest. The plugin posts {stats:[{name,kc}],
// skills:[{name,xp}], activities:[{key,value}]} with
// ABSOLUTE counts (no image), debounced to one push per key per 15 s. We resolve the caller's clan
// member from the account token (NO active bingo event required), store the max per key on
// clan_members.live_stats — the ONE member-scoped overlay read by both bingo tiles AND weekly
// SOTW/BOTW as max(hiscores, live) — then credit both immediately so a live kill/training burst
// lands before the 15-min hiscores sweep. The sweep is source of truth: it prunes a live entry once
// hiscores catches up. See lib/liveStats + lib/statTracking + the cron/stats sweep.

export async function POST(request: Request) {
  // Kills and XP from a game-mode world (Leagues, Deadman, hardcore, …) are another save's progress:
  // they never reach the account's overlay, history or weekly competitions. Only a board that counts
  // that mode (rules.worldModes) takes them — see modePush below.
  const mode = worldModeOf(request);
  const clan = await resolvePluginClan(request);
  if (mode) {
    const member = clan ? await resolvePluginMember(request) : null;
    if (!clan || !member) return worldModeIgnored(request)!;
    return modePush(request, mode, member, clan.id);
  }
  // No clan is not "nowhere to put it": the stats are the PERSON's, and their profile keeps them
  // with or without a clan. The account-only path takes the push when the token owns the character.
  if (!clan) return (await accountOnlyPush(request)) ?? (await foreignOr(request, noClanForPlugin));
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
    // Somebody else's character (or one this login let go of) says so (lib/pluginForeign).
    return foreignOr(request, NextResponse.json({ error: 'Unauthorized. Provide Authorization: Bearer <accountToken> + X-RSN' }, { status: 401 }));
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
  // A character in a tile-lab session (lib/lab): the push is logged and credits that session's board
  // (lib/labStats). A replayed scenario stops there — never the overlay, history or weekly comps. Real
  // play goes on below exactly as without a session; the board pick leaves lab boards out, so the lab
  // board is credited once (just now) and the real board is the one the pick finds.
  const lab = await labDivert(request, member.accountId, 'stats', body, labStatsOnSession(body));
  if (lab.response) return lab.response;
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
    .where(await pluginParticipantScope(member, { lab: false }));
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
      notifyTeamTiles(activePlayer.eventId, activePlayer.teamId!, statTiles.map((t) => t.id));
      completed.push(
        ...(await creditStatTilesForTeam({
          eventId: activePlayer.eventId,
          teamId: activePlayer.teamId!,
          statTiles,
          notifyClanId: clan.id,
        })),
      );
    }
  }

  // ── Weekly credit: move SOTW/BOTW live for any active comp whose metric was just pushed. Only when
  // the member is 'active' (unranked/banned rows are the sweep's job) and already baselined (a first
  // capture from a live push would zero the session — the sweep sets the baseline from max(hiscores,
  // live)). currentValue climbs monotonically; a stale-baseline flush is spike-flagged here too.
  if (memberRow?.status === 'active') {
    // Shared per clan for 15s: every member's push asks the same question, and pushes are already
    // debounced 15s client-side, so a competition that just started is picked up within one cycle.
    const activeComps = (
      await ttlMemo(`active-weekly-metrics:${clan.id}`, () => getActiveWeeklyMetrics(clan.id), 15_000)
    ).filter((c) => metricKeys(c.metric).some((k) => updatedKeys.has(k)));
    for (const comp of activeComps) {
      const participant = await db.query.weeklyParticipants.findFirst({
        where: and(
          eq(weeklyParticipants.competitionId, comp.id),
          eq(weeklyParticipants.clanMemberId, member.clanMemberId),
        ),
      });
      if (!participant) continue; // not enrolled yet — the lifecycle cron enrolls + the sweep baselines
      // A raid across its modes needs every mode in the overlay to be whole; otherwise the sweep has it.
      const value = liveMetricValue(comp.type as CompetitionType, comp.metric, live);
      if (value == null) continue;
      await applyWeeklyValue({
        participantId: participant.id,
        type: comp.type,
        metric: comp.metric,
        value,
        baselineValue: participant.baselineValue,
        currentValue: participant.currentValue,
        lastUpdated: participant.lastUpdated,
        allowFirstCapture: false,
        competitionStartIso: comp.startDate,
        now: nowIso,
      });
    }
  }

  return NextResponse.json({ ok: true, updated: Object.keys(pushed).length, completed: [...completed, ...labCompleted(lab.applied)] });
}

/** The lab board's half of a stats push (lib/labStats), for labDivert. */
function labStatsOnSession(body: PushBody) {
  return (eventId: number, accountId: number) => applyLabStatsPush(eventId, accountId, readPushed(body));
}

/** The lab board tiles a real push just completed, from labDivert's `applied`. */
function labCompleted(applied: Record<string, unknown>): string[] {
  return Array.isArray(applied.completed) ? applied.completed.filter((c): c is string => typeof c === 'string') : [];
}

/**
 * A push from a game-mode world, for the boards that count that mode (rules.worldModes) and nothing
 * else. The readings go on the character's row on each such board that has started
 * (event_participants.mode_stats, lib/modeStats) — never the account's overlay, its stat history or a
 * weekly competition, so the main save's numbers are untouched — and those boards' stat tiles are
 * re-checked. A character on no such board gets the same 202 every mode push used to.
 */
async function modePush(
  request: Request,
  mode: WorldMode,
  member: NonNullable<Awaited<ReturnType<typeof resolvePluginMember>>>,
  clanId: number,
): Promise<NextResponse> {
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
  // A tile-lab character's replay writes nothing real, whatever world it's on; real play is logged to
  // the session and goes on as usual, lab boards left out of the pick below (lib/lab).
  const lab = await labDivert(request, member.accountId, 'stats', body, labStatsOnSession(body));
  if (lab.response) return lab.response;
  const pushed = readPushed(body);

  const nowIso = new Date().toISOString();
  // clan-scope: this clan -- boards the connected clan hosts or co-hosts (lib/auth pluginParticipantScope).
  const rows = await db
    .select({
      id: eventParticipants.id,
      teamId: eventParticipants.teamId,
      eventId: eventParticipants.eventId,
      modeStats: eventParticipants.modeStats,
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
      rules: events.rules,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .where(await pluginParticipantScope(member, { lab: false }));
  // Started, running, on a team — and the board counts THIS mode. A main-game-only board never does.
  const boards = rows.filter(
    (r) =>
      r.teamId &&
      !r.forceEndedAt &&
      (!r.endDate || r.endDate > nowIso) &&
      eventHasStarted(r) &&
      parseEventRules(r.rules).worldModes.includes(mode.key),
  );
  if (boards.length === 0) return lab.sessionEventId != null ? NextResponse.json({ ok: true, lab: true, completed: labCompleted(lab.applied) }) : worldModeIgnored(request)!;
  if (Object.keys(pushed).length === 0) return NextResponse.json({ ok: true, updated: 0, mode: mode.label, completed: [] });

  const updatedKeys = new Set(Object.keys(pushed));
  const completed: string[] = [];
  for (const row of boards) {
    const next = mergeModePush(row.modeStats, mode.key, pushed);
    if (next == null) continue;
    await db.update(eventParticipants).set({ modeStats: next }).where(eq(eventParticipants.id, row.id));
    const statTiles = (await db.select().from(tiles).where(eq(tiles.eventId, row.eventId))).filter(
      (t) =>
        t.trackedStat &&
        (t.statType === 'boss' || t.statType === 'kc' || t.statType === 'skill') &&
        t.statGoal &&
        !t.autoTrackDisabled &&
        statKeys(t.trackedStat).some((k) => updatedKeys.has(k)),
    );
    if (statTiles.length === 0) continue;
    notifyTeamTiles(row.eventId, row.teamId!, statTiles.map((t) => t.id));
    completed.push(
      ...(await creditStatTilesForTeam({ eventId: row.eventId, teamId: row.teamId!, statTiles, notifyClanId: clanId })),
    );
  }
  return NextResponse.json({ ok: true, updated: Object.keys(pushed).length, mode: mode.label, completed: [...completed, ...labCompleted(lab.applied)] });
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
  // Same lab rule as the seated path: a replay credits only the lab board; real play also goes on.
  const lab = await labDivert(request, account.id, 'stats', body, labStatsOnSession(body));
  if (lab.response) return lab.response;
  const pushed = readPushed(body);
  if (Object.keys(pushed).length === 0) return NextResponse.json({ ok: true, updated: 0 });
  await applyAccountPush(account.id, pushed, new Date().toISOString());
  return NextResponse.json({ ok: true, updated: Object.keys(pushed).length, completed: labCompleted(lab.applied) });
}
