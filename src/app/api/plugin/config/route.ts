import { NextResponse } from 'next/server';
import { personOf, seatsOwnedBy } from '@/lib/roster';
import { requireClan } from '@/lib/clanContext';
import { db } from '@/db';
import { events, tiles, teams, submissions, eventParticipants, completions, clanRoster, eventStartProofs } from '@/db/schema';
import { eq, and, sql, inArray, isNull } from 'drizzle-orm';
import { verifyPluginToken, verifyPluginTokenUser, normalizeRsn } from '@/lib/auth';
import { eventTimeState } from '@/lib/eventTime';
import { requireSecret } from '@/lib/env';
import {
  buildSchedule,
  getActiveWeekly,
  getActiveWeeklyMetrics,
  getNotificationWebhooks,
  getFunDeathMessages,
  getDeathTaunts,
  getSpoonTaunts,
  getAlwaysNotifyItems,
  getAlwaysNotifyItemIds,
  getShowKillCount,
  getDropRarityFloor,
  getClanDisplayName,
  getTierBands,
  personalBestActivities,
  type PluginWebhooks,
} from '@/lib/pluginConfig';
import { notableItemFor, bossItemForStatKey } from '@/lib/tileIcons';
import { statKeys } from '@/lib/tileKinds';
import { lapUnitNoun } from '@/lib/constants';
import { ROLL_TABLES, rollItemIds } from '@/lib/rollTables';
import { isIndividualMode } from '@/lib/statTracking';
import { kcNamesForKey } from '@/lib/pluginStats';
import { isActivityKey } from '@/lib/hiscoresActivities';
import { liveStatsForMembers, parseStatKeyTimes } from '@/lib/liveStats';
import { jsonWithEtag } from '@/lib/httpEtag';
import { serverInfo } from '@/lib/serverInfo';
import { parseEventRules, hasRevealPolicy, nextRevealAt, nextMissionAt, isMissionTile, parseTileMissionRules } from '@/lib/eventRules';
import { startProofState } from '@/lib/startProof';
import { isLadderFormat } from '@/lib/utils';
import { getLadderBoards, toPluginStandings, type PluginStandings } from '@/lib/ladderStandings';
import crypto from 'crypto';

const CODEWORD_SECRET = requireSecret('CODEWORD_SECRET', 'dev-codeword-secret');

// The roll tables as the plugin needs them: ids to match loot against, the vestige to watch for, and
// the cadence. Item NAMES stay server-side — they exist for the tile editor's fill button, and the
// plugin already knows how to name an item id.
const pluginRollTables = ROLL_TABLES.map((t) => ({
  boss: t.boss,
  rollItemIds: rollItemIds(t),
  vestigeItemId: t.vestigeItemId,
  vestigeName: t.vestigeName,
  rollsPerVestige: t.rollsPerVestige,
}));

// The plugin only needs to know WHICH notification channels are live, never the webhook URLs
// themselves — it posts to /api/plugin/notify and the server forwards to Discord. Sending the raw
// URLs would let a plugin call them directly, which the RuneLite plugin hub forbids. Clips are
// excluded: those post to a user-pasted webhook configured in the plugin, not via the site.
function notifyFlags(webhooks: PluginWebhooks) {
  return {
    rareDrops: !!webhooks.rareDrops,
    deaths: !!webhooks.deaths,
    combatAchievements: !!webhooks.combatAchievements,
    pvpKills: !!webhooks.pvpKills,
  };
}

function generateCodeword(playerId: number, eventId: number): string {
  const date = new Date().toISOString().slice(0, 10);
  const hmac = crypto.createHmac('sha256', CODEWORD_SECRET);
  hmac.update(`${playerId}:${eventId}:${date}`);
  return hmac.digest('hex').slice(0, 6).toUpperCase();
}


/**
 * Server-resolved home-board summary for the sidebar, keyed to the TOKEN's user alone (no in-game
 * login needed): linked members → a player row in a LIVE event → that team's completed/total scored
 * tiles (points-weighted for Leagues). This is what lets the plugin render the home clan's board at
 * the login screen — the same resolution the website's My Team page performs — while the live layers
 * (nearest tiles, active-now) still wait for a playing account. Null when the user isn't enrolled
 * anywhere live.
 */
async function homeBoardForUser(userId: number): Promise<{
  eventName: string;
  tilesComplete: number;
  tilesTotal: number;
  pointsScored: boolean;
} | null> {
  const myMembers = await db
    .select({ id: clanRoster.id, isPrimary: clanRoster.isPrimary })
    .from(clanRoster)
    .where(and(await seatsOwnedBy(userId), isNull(clanRoster.leftAt)));
  if (myMembers.length === 0) return null;
  const primaryIds = new Set(myMembers.filter((m) => m.isPrimary === 1).map((m) => m.id));

  const enrollments = await db
    .select({
      eventId: events.id,
      eventName: events.name,
      scoringMode: events.scoringMode,
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
      teamId: eventParticipants.teamId,
      clanMemberId: eventParticipants.clanMemberId,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .where(inArray(eventParticipants.clanMemberId, myMembers.map((m) => m.id)));

  const now = Date.now();
  const isLive = (e: (typeof enrollments)[number]) =>
    e.teamId != null &&
    !e.forceEndedAt &&
    e.startDate != null &&
    e.endDate != null &&
    Date.parse(e.startDate) <= now &&
    now <= Date.parse(e.endDate);
  // The token is USER-scoped, so pre-login we can't know which linked account is about to play
  // (Jagex launchers know client-side; legacy logins don't). Deterministic guess: the PRIMARY
  // account's live enrollment first, else any live one; latest start wins within each tier —
  // mirroring verifyPluginToken's pick so pre- and post-login agree. The real account-scoped board
  // takes over the moment an account resolves in-game.
  enrollments.sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));
  const live =
    enrollments.find((e) => isLive(e) && e.clanMemberId != null && primaryIds.has(e.clanMemberId)) ??
    enrollments.find(isLive);
  if (!live) return null;

  // Optional tiles are bonus: excluded from both tallies, matching the website's scoredTiles filter
  // and the plugin's own logged-in summary.
  const tileRows = await db
    .select({ id: tiles.id, points: tiles.points, optional: tiles.optional })
    .from(tiles)
    .where(eq(tiles.eventId, live.eventId));
  const scored = tileRows.filter((t) => !t.optional);
  const doneIds = new Set(
    (
      await db
        .select({ tileId: completions.tileId })
        .from(completions)
        .where(eq(completions.teamId, live.teamId as number))
    ).map((c) => c.tileId),
  );
  const totalPoints = scored.reduce((sum, t) => sum + (t.points ?? 1), 0);
  const pointsScored = live.scoringMode === 'points' && totalPoints > 0;
  const tilesTotal = pointsScored ? totalPoints : scored.length;
  const tilesComplete = pointsScored
    ? scored.filter((t) => doneIds.has(t.id)).reduce((sum, t) => sum + (t.points ?? 1), 0)
    : scored.filter((t) => doneIds.has(t.id)).length;

  return { eventName: live.eventName, tilesComplete, tilesTotal, pointsScored };
}

/**
 * When a token holder resolves to no active event, check whether the RSN they're logged into is
 * actually a drafted player in an event that's LIVE right now — i.e. they're in a bingo but their
 * account isn't linked to it (unverified RSN, or the player row belongs to another user). Returns
 * that event's name so the plugin can warn them; null when the RSN isn't in any live event.
 */
async function activeEventForUnlinkedRsn(request: Request): Promise<string | null> {
  const rsnHeader = request.headers.get('X-RSN')?.trim();
  if (!rsnHeader) return null;
  const norm = normalizeRsn(rsnHeader);
  if (!norm) return null;
  const rows = await db
    .select({
      name: eventParticipants.name,
      eventName: events.name,
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .where(sql`lower(${eventParticipants.name}) = ${norm}`);
  const now = Date.now();
  for (const r of rows) {
    if (normalizeRsn(r.name) !== norm) continue; // exact (nbsp-normalised) match
    if (eventTimeState({ startDate: r.startDate, endDate: r.endDate, forceEndedAt: r.forceEndedAt, now }).phase === 'active') {
      return r.eventName;
    }
  }
  return null;
}

// The active weekly comps' metrics as plugin-pushable names: boss metrics expand to their KC-line
// names, skill metrics are the lowercase skill name. Merged into trackedKcNames/trackedSkillNames so
// the plugin pushes SOTW/BOTW live (debounced 15 s, same machinery as bingo tiles) even for a member
// with no active bingo event.
async function weeklyTrackedNames(): Promise<{ kc: string[]; skills: string[] }> {
  const metrics = await getActiveWeeklyMetrics();
  return {
    kc: metrics.filter((m) => m.type === 'boss').flatMap((m) => kcNamesForKey(m.metric)),
    skills: metrics.filter((m) => m.type === 'skill').map((m) => m.metric),
  };
}

export async function GET(request: Request) {
  const clan = await requireClan();
  const auth = await verifyPluginToken(request);
  if (!auth) {
    // Distinguish "bad token" from "valid token but no active event" so the plugin
    // doesn't surface a misleading "failed to connect" when the user just isn't
    // enrolled anywhere right now.
    const userOnly = await verifyPluginTokenUser(request);
    if (userOnly) {
      // Valid token, no live event: still resolve the read-bootstrap (schedule, weekly,
      // notification webhooks, fun-death pool) so deaths/rare-drops post and the side
      // panel shows the schedule even when the player isn't enrolled anywhere.
      const [schedule, activeWeekly, weeklyNames, webhooks, funDeathMessages, deathTaunts, spoonTaunts, alwaysNotifyItems, alwaysNotifyItemIds, showKillCount, dropRarityFloor, unlinkedActiveEvent, homeBoard] =
        await Promise.all([
          buildSchedule(),
          getActiveWeekly(),
          weeklyTrackedNames(),
          getNotificationWebhooks(clan.id),
          getFunDeathMessages(clan.id),
          getDeathTaunts(clan.id),
          getSpoonTaunts(clan.id),
          getAlwaysNotifyItems(clan.id),
          getAlwaysNotifyItemIds(clan.id),
          getShowKillCount(clan.id),
          getDropRarityFloor(clan.id),
          activeEventForUnlinkedRsn(request),
          homeBoardForUser(userOnly.userId),
        ]);
      return jsonWithEtag(request, {
        // Version + capability handshake — present on every /config shape (enrolled or not) so the
        // plugin can gate features per-site. Old plugins ignore it (GSON drops unknown fields).
        server: serverInfo(),
        event: null,
        team: null,
        player: null,
        // The clan's display name — the sidebar's clan-filter label and the logged-out home card
        // need it even when no event/team is resolvable for this token.
        clanName: await getClanDisplayName(clan.id),
        // Server-resolved board summary off the token's USER (linked member → live enrollment), so
        // the sidebar shows the home board even at the login screen. Null when not enrolled anywhere.
        homeBoard,
        // Non-null when the logged-in RSN IS a player in a live bingo but this token/account isn't
        // linked to it — the plugin surfaces a "verify your RSN" warning so tracking isn't silently off.
        unlinkedActiveEvent,
        codeword: null,
        // No event resolved → nothing to prove (lib/startProof). Present for shape parity.
        startProof: null,
        // Profile sync runs with or without an event, so the PB import needs its names here too.
        pbActivities: personalBestActivities(),
        trackedStats: [],
        // With no bingo event the plugin still pushes the active SOTW/BOTW metric so weekly moves live.
        trackedKcNames: weeklyNames.kc,
        trackedSkillNames: weeklyNames.skills,
        // Weekly comps rank on a skill or a boss only — the picker offers nothing else — so there's
        // never an activity to push without a bingo event behind it.
        trackedActivityKeys: [],
        trackedDrops: [],
        trackedKills: [],
        trackedPvp: [],
        pvpRoster: [],
        trackedTimed: [],
        trackedLms: [],
        trackedValues: [],
        trackedGains: [],
        trackedDeathless: [],
        trackedDiaries: [],
        trackedCombatTasks: [],
        noActiveEvent: true,
        rollTables: pluginRollTables,
        schedule,
        activeWeekly,
        notify: notifyFlags(webhooks),
        funDeathMessages,
        deathTaunts,
        spoonTaunts,
        alwaysNotifyItems,
        alwaysNotifyItemIds,
        showKillCount,
        dropRarityFloor,
      });
    }
    return NextResponse.json({ error: 'Unauthorized. Provide Authorization: Bearer <accountToken>' }, { status: 401 });
  }

  const event = await db.query.events.findFirst({
    where: eq(events.id, auth.eventId),
  });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, auth.teamId),
  });
  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  // Tiles stay hidden in-game until the host reveals them: with `tilesRevealed` off we
  // feed the tracked-tile builders empty inputs, so trackedStats/Drops/Kills/Timed all
  // come back empty while the rest of the config (schedule, weekly, notify flags) still
  // flows. Mirrors the web board + plugin board gates.
  const tilesRevealed = !!event.tilesRevealed;

  // Reveal-policy events (lib/eventRules) narrow that further per-tile: the plugin only ever
  // learns about REVEALED tiles (hidden tile content must never reach a client), and only
  // still-open ones are worth detecting for — a claimed bounty tile is done rotating. The
  // full-board rows stay server-side; completed-tile labels resolve off the revealed subset
  // (a completed tile is revealed by definition).
  const fullEventTiles = tilesRevealed
    ? await db.query.tiles.findMany({ where: eq(tiles.eventId, auth.eventId) })
    : [];
  const rules = parseEventRules(event.rules);
  const revealMode = hasRevealPolicy(rules);

  // STARTING SHOT (lib/startProof): what this player still owes, plus the keyword only they get.
  // Null on every event that doesn't ask for one, so an older plugin sees nothing new and a newer
  // one hides its button. The keyword is stable for the whole event, so it never churns the ETag.
  const startProofRow = rules.startProof
    ? await db.query.eventStartProofs.findFirst({
        where: and(eq(eventStartProofs.eventId, event.id), eq(eventStartProofs.playerId, auth.playerId)),
      })
    : null;
  const startProof = rules.startProof
    ? startProofState({ cfg: rules.startProof, event, playerId: auth.playerId, proof: startProofRow })
    : null;
  // The tiles the plugin may track: board tiles are policy-gated (revealed + open on a reveal board,
  // all on classic); MISSION tiles are always hidden until announced, so a hidden mission never leaks
  // into the tracked lists even on a classic board.
  const allEventTiles = fullEventTiles.filter((t) => {
    if (isMissionTile(t)) return t.revealedAt != null && t.closedAt == null;
    return !revealMode || (t.revealedAt != null && t.closedAt == null);
  });

  // Get drop tiles with tracked item IDs
  const dropTiles = allEventTiles.filter((t) => t.tileType === 'drop');

  // Stat-tracked tiles (skill XP / boss KC). The DB sometimes stores tile_type='standard'
  // for these — match on the presence of a trackedStat field instead.
  const statTilesRaw = allEventTiles.filter((t) => t.trackedStat && t.trackedStat.length > 0);

  // Get current submission totals per tile for this team
  const teamSubmissions = await db
    .select({
      tileId: submissions.tileId,
      total: sql<number>`COALESCE(SUM(${submissions.amount}), 0)`,
    })
    .from(submissions)
    .where(eq(submissions.teamId, auth.teamId))
    .groupBy(submissions.tileId);

  const submissionMap = Object.fromEntries(teamSubmissions.map(s => [s.tileId, s.total]));

  // The CALLER's own totals per tile (credit follows creditPlayerId when a captain uploaded on their
  // behalf). Solo ("any one member") tiles complete on one member's count, so the progress the plugin
  // shows in-game — and counts up against locally — has to be theirs, not the team's. Mirrors what
  // trackedStats already does for individual-mode hiscores tiles by filtering `sources` to the caller.
  const soloSubmissionMap: Record<number, number> = {};
  if (auth.playerId != null) {
    const own = await db
      .select({
        tileId: submissions.tileId,
        total: sql<number>`COALESCE(SUM(${submissions.amount}), 0)`,
      })
      .from(submissions)
      .where(and(
        eq(submissions.teamId, auth.teamId),
        sql`COALESCE(${submissions.creditPlayerId}, ${submissions.playerId}) = ${auth.playerId}`,
      ))
      .groupBy(submissions.tileId);
    for (const r of own) soloSubmissionMap[r.tileId] = r.total;
  }
  // Progress to advertise for a count tile: the caller's own on a Solo tile, the team's otherwise.
  const currentFor = (t: { id: number; trackingMode: string | null }) =>
    (isIndividualMode(t.trackingMode) ? soloSubmissionMap[t.id] : submissionMap[t.id]) ?? 0;

  // Get per-item submission totals for tiles with itemRequirements
  const perItemSubmissions = await db
    .select({
      tileId: submissions.tileId,
      itemId: submissions.itemId,
      total: sql<number>`COALESCE(SUM(${submissions.amount}), 0)`,
    })
    .from(submissions)
    .where(eq(submissions.teamId, auth.teamId))
    .groupBy(submissions.tileId, submissions.itemId);

  // Build a map: tileId -> { itemId -> total }
  const perItemMap = new Map<number, Map<number, number>>();
  for (const row of perItemSubmissions) {
    if (row.itemId == null) continue;
    if (!perItemMap.has(row.tileId)) perItemMap.set(row.tileId, new Map());
    perItemMap.get(row.tileId)!.set(row.itemId, Number(row.total));
  }

  // Aggregate stat-tile progress so the side panel can show "Mining XP: 4500/5000"
  // for the team. We pull every team player's baseline + cached stats once, parse
  // them, and sum gained values per tile (or use just the calling player's value
  // when tracking_mode is 'individual').
  const teamPlayers = await db
    .select({
      id: eventParticipants.id,
      name: eventParticipants.name,
      clanMemberId: eventParticipants.clanMemberId,
      statsSnapshot: eventParticipants.statsSnapshot,
      cachedStats: eventParticipants.cachedStats,
      // Per-KEY last-rose timestamps — the "is this teammate grinding THIS stat tile right now" signal
      // for "Active now". Per-stat (not per-member), so a fishing push only marks their fishing tile.
      liveStatKeyTimes: clanRoster.liveStatKeyTimes,
    })
    .from(eventParticipants)
    .leftJoin(clanRoster, eq(eventParticipants.clanMemberId, clanRoster.id))
    .where(and(eq(eventParticipants.eventId, auth.eventId), eq(eventParticipants.teamId, auth.teamId)));
  // Member-scoped real-time overlay (shared with weekly), folded into current as a per-key max.
  const memberLive = await liveStatsForMembers(teamPlayers.map((p) => p.clanMemberId));

  function readStatValue(blob: string | null, statType: string | null, statName: string): number | null {
    if (!blob) return null;
    try {
      const parsed = JSON.parse(blob) as {
        skills?: Record<string, { xp?: number; level?: number }>;
        bosses?: Record<string, { score?: number; rank?: number }>;
      };
      if (statType === 'boss' || statType === 'kc') {
        return parsed.bosses?.[statName]?.score ?? null;
      }
      // default to skill XP
      return parsed.skills?.[statName]?.xp ?? null;
    } catch {
      return null;
    }
  }

  // "Active now" attribution for stat tiles: a teammate who's contributed to a stat tile AND pushed
  // live stats within this window is shown as actively grinding it (the plugin marks the caller "You"
  // via its own local signal, so the caller is excluded here). Capped to bound the payload.
  const ACTIVE_STAT_WINDOW_MS = 5 * 60_000;
  const ACTIVE_WORKERS_CAP = 5;
  const nowMs = Date.now();

  const trackedStats = statTilesRaw.map((t) => {
    const statName = t.trackedStat ?? '';
    const statType = t.statType ?? 'skill';
    const goal = t.statGoal ?? 0;
    const trackingMode = t.trackingMode ?? 'team';

    let gainedTotal = 0;
    const activeWorkers: string[] = [];
    const sources = isIndividualMode(trackingMode)
      ? teamPlayers.filter((p) => p.id === auth.playerId)
      : teamPlayers;

    for (const p of sources) {
      // Real-time plugin push (boss KC AND skill XP) folds into current as a per-key max, so the
      // in-game progress reflects a fresh kill / training burst before the hiscores sweep catches up.
      const plug = (p.clanMemberId != null && memberLive.get(p.clanMemberId)) || {};
      // Composite trackedStat ("chambersOfXeric,chambersOfXericChallengeMode") sums the
      // per-key gains — CoX and CM clears count toward the same tile.
      let playerGained = 0;
      for (const part of statKeys(statName)) {
        const baseline = readStatValue(p.statsSnapshot, statType, part);
        const hiscoresCurrent = readStatValue(p.cachedStats, statType, part);
        const pushed = plug[part];
        const current = hiscoresCurrent != null || pushed != null
          ? Math.max(hiscoresCurrent ?? 0, pushed ?? 0)
          : null;
        if (baseline == null || current == null) continue;
        const gained = current - baseline;
        if (gained > 0) { gainedTotal += gained; playerGained += gained; }
      }
      // A teammate is "active on THIS tile" only if one of ITS stat keys actually rose within the window
      // (not merely any live push + some cumulative gain) — so a fishing burst no longer lights up their
      // CM/ToA tiles. The caller is excluded (the plugin marks itself "You" from its own local signal).
      if (playerGained > 0 && p.id !== auth.playerId && activeWorkers.length < ACTIVE_WORKERS_CAP) {
        const keyTimes = parseStatKeyTimes(p.liveStatKeyTimes);
        const roseRecently = statKeys(statName).some((k) => {
          const at = Date.parse(keyTimes[k] ?? '');
          return Number.isFinite(at) && nowMs - at <= ACTIVE_STAT_WINDOW_MS;
        });
        if (roseRecently) activeWorkers.push(p.name);
      }
    }

    return {
      tileId: t.id,
      // Board position so the plugin can mirror the site's tile order (difficulty sort, shuffle).
      position: t.position ?? 0,
      label: t.label,
      description: t.description ?? null,
      points: t.points ?? 0,
      category: t.category ?? null,
      statName,
      statType,
      trackingMode,
      currentAmount: gainedTotal,
      goalAmount: goal,
      // Teammates actively grinding this stat tile right now (RSNs), for the sidebar's "Active now".
      // Empty on older plugins/servers; the caller is never in here (the plugin marks itself "You").
      activeWorkers,
      // Boss KC tiles get the boss's representative clog item as their icon; skill tiles
      // keep -1 (the plugin shows the skill sprite instead). Composite keys use the first
      // boss's icon (a CoX + CM tile shows the CoX item).
      itemId: (statType === 'boss' || statType === 'kc') ? bossItemForStatKey(statKeys(statName)[0] ?? statName) ?? -1 : -1,
    };
  });

  // Active weekly SOTW/BOTW metrics are pushed live too — merged in below so a member in a bingo AND a
  // weekly comp pushes both metrics through the same debounced path.
  const weeklyNames = await weeklyTrackedNames();

  // In-game KC-line boss names for the event's boss-KC tiles (+ any active BOTW boss). The plugin
  // watches for "Your <boss> ... count is: N" matching one of these and pushes the absolute KC to
  // /api/plugin/stats so the tile updates in real time (see lib/pluginStats + the endpoint).
  const trackedKcNames = Array.from(
    new Set([
      ...statTilesRaw
        .filter((t) => t.statType === 'boss' || t.statType === 'kc')
        .flatMap((t) => statKeys(t.trackedStat).flatMap((k) => kcNamesForKey(k))),
      ...weeklyNames.kc,
    ]),
  );

  // The event's tracked stats that are hiscores ACTIVITIES rather than bosses — clue tiers, clog
  // slots, Colosseum glory and the rest. They're saved as statType 'boss' (they share the KC-style
  // picker), so they'd otherwise be indistinguishable here; kcNamesForKey returns [] for them, which
  // is why they contribute nothing to trackedKcNames. Sent as raw keys: the plugin reads each from a
  // named varbit, so unlike a boss there is no in-game name to match on. It pushes only the subset
  // it can actually read — rank-based entries (LMS, PvP Arena, Bounty Hunter) have no in-game
  // counter — and that filtering is the plugin's call, so everything the board tracks is listed.
  const trackedActivityKeys = Array.from(
    new Set(
      statTilesRaw
        .filter((t) => t.statType === 'boss' || t.statType === 'kc')
        .flatMap((t) => statKeys(t.trackedStat))
        .filter((k) => isActivityKey(k)),
    ),
  );

  // Skill names for the event's skill-XP tiles (+ any active SOTW skill). The plugin pushes real-time
  // absolute XP for these off StatChanged so the tile / weekly moves without waiting on the sweep.
  const trackedSkillNames = Array.from(
    new Set([
      ...statTilesRaw
        .filter((t) => t.statType === 'skill')
        .flatMap((t) => statKeys(t.trackedStat)),
      ...weeklyNames.skills,
    ]),
  );

  // Read-bootstrap extras merged in so the plugin's login flow is a single GET:
  // schedule + active weekly (was two separate endpoints) plus the notification
  // webhooks and fun-death pool the plugin posts with directly.
  const [schedule, activeWeekly, webhooks, funDeathMessages, deathTaunts, spoonTaunts, alwaysNotifyItems, alwaysNotifyItemIds, showKillCount, dropRarityFloor, tiers] =
    await Promise.all([
      buildSchedule(),
      getActiveWeekly(),
      getNotificationWebhooks(clan.id),
      getFunDeathMessages(clan.id),
      getDeathTaunts(clan.id),
      getSpoonTaunts(clan.id),
      getAlwaysNotifyItems(clan.id),
      getAlwaysNotifyItemIds(clan.id),
      getShowKillCount(clan.id),
      getDropRarityFloor(clan.id),
      getTierBands(clan.id),
    ]);

  // Team-level tile completions (drops, stats, manual — all tile types). The plugin uses this to
  // fire a banner for the whole team when any tile is completed, regardless of who finished it.
  const teamCompletions = tilesRevealed
    ? await db
        .select({ tileId: completions.tileId })
        .from(completions)
        .where(eq(completions.teamId, auth.teamId))
    : [];
  // Label lookups include CLOSED reveal-mode tiles (a completed bounty tile is closed but its
  // completion row still needs its label) — just never the still-hidden ones.
  const visibleEventTiles = revealMode ? fullEventTiles.filter((t) => t.revealedAt != null) : fullEventTiles;
  const tileById = new Map(visibleEventTiles.map((t) => [t.id, t]));
  const completedTileIdSet = new Set(teamCompletions.map((c) => c.tileId));

  // "Completed by <who>" for the plugin's completion chat line: the crediting player of the LATEST
  // submission for each completed tile (usually the one that finished it). Stat/manual completions
  // have no submission, so they stay unattributed (null).
  const completedTileIds = teamCompletions.map((c) => c.tileId);
  const completedByMap = new Map<number, string>();
  if (completedTileIds.length > 0) {
    const creditRows = await db
      .select({ tileId: submissions.tileId, name: eventParticipants.name })
      .from(submissions)
      .leftJoin(eventParticipants, eq(submissions.creditPlayerId, eventParticipants.id))
      .where(and(eq(submissions.teamId, auth.teamId), inArray(submissions.tileId, completedTileIds)))
      .orderBy(submissions.createdAt); // ascending → the last write per tile is the latest
    for (const r of creditRows) {
      if (r.name) completedByMap.set(r.tileId, r.name);
    }
  }

  const completedTiles = teamCompletions.map((c) => {
    const tile = tileById.get(c.tileId);
    return {
      tileId: c.tileId,
      label: tile?.label ?? `Tile #${c.tileId}`,
      points: tile?.points ?? 0,
      completedBy: completedByMap.get(c.tileId) ?? null,
    };
  });

  // Lock-out claims (bounty / lockout modifier): the most recent missions someone locked in,
  // EVENT-WIDE (not just this team), so the plugin can announce "X claimed <mission>" to the other
  // eventParticipants. Only shipped on lockout events; the plugin diffs it across polls and skips its own.
  let recentClaims:
    | { tileId: number; label: string; points: number; rsn: string | null; at: string }[]
    | undefined;
  // Lockout can come from the event rules OR from an individual mission's own rules.
  const hasLockoutMissions = fullEventTiles.some((t) => isMissionTile(t) && parseTileMissionRules(t.rules).lockout);
  if ((rules.lockout || hasLockoutMissions) && tilesRevealed) {
    const claimRows = await db
      .select({
        tileId: completions.tileId,
        teamId: completions.teamId,
        creditPlayerId: completions.creditPlayerId,
        awardedPoints: completions.awardedPoints,
        at: completions.completedAt,
      })
      .from(completions)
      .innerJoin(tiles, eq(completions.tileId, tiles.id))
      .where(eq(tiles.eventId, auth.eventId))
      .orderBy(sql`${completions.completedAt} desc`)
      .limit(12);
    // Finisher name: the completion's crediting player, else the latest submission credit on the tile.
    const claimCreditIds = Array.from(
      new Set(claimRows.map((c) => c.creditPlayerId).filter((x): x is number => x != null)),
    );
    const claimNameById = new Map<number, string>();
    if (claimCreditIds.length > 0) {
      const rows = await db.select({ id: eventParticipants.id, name: eventParticipants.name }).from(eventParticipants).where(inArray(eventParticipants.id, claimCreditIds));
      for (const r of rows) claimNameById.set(r.id, r.name);
    }
    const subTileIds = Array.from(new Set(claimRows.filter((c) => c.creditPlayerId == null).map((c) => c.tileId)));
    const subNameByTileTeam = new Map<string, string>();
    if (subTileIds.length > 0) {
      const subRows = await db
        .select({ tileId: submissions.tileId, teamId: submissions.teamId, name: eventParticipants.name })
        .from(submissions)
        .leftJoin(eventParticipants, eq(submissions.creditPlayerId, eventParticipants.id))
        .where(inArray(submissions.tileId, subTileIds))
        .orderBy(submissions.createdAt); // ascending → last write per (tile,team) wins
      for (const r of subRows) {
        if (r.name) subNameByTileTeam.set(`${r.tileId}:${r.teamId}`, r.name);
      }
    }
    recentClaims = claimRows.map((c) => {
      const tile = tileById.get(c.tileId);
      const rsn =
        c.creditPlayerId != null
          ? claimNameById.get(c.creditPlayerId) ?? null
          : subNameByTileTeam.get(`${c.tileId}:${c.teamId}`) ?? null;
      return {
        tileId: c.tileId,
        label: tile?.label ?? `Tile #${c.tileId}`,
        points: c.awardedPoints ?? tile?.points ?? 0,
        rsn,
        at: c.at,
      };
    });
  }

  // PvP-kill tiles need the event roster so the plugin can tell whether a victim is on a
  // rival team ('team:other' selectors match RSN → teamId). Only shipped while a pvp tile
  // exists — otherwise it's payload (and roster) for nothing.
  const hasPvpTiles = allEventTiles.some((t) => t.tileType === 'pvp');
  // Shared-kill tiles need the same RSN→team map: naming the teammates in your instance is how a
  // kill gets correlated (and how a minimum-teammates tile counts people who aren't running the
  // plugin). Sent for those tiles too, not just PvP ones.
  const hasCoopTiles = allEventTiles.some(
    (t) => t.tileType === 'kill' && (t.coopCredit === 'per-kill' || (t.coopMinMembers ?? 0) > 0),
  );
  const pvpRoster = hasPvpTiles || hasCoopTiles
    ? (
        await db
          .select({ name: eventParticipants.name, teamId: eventParticipants.teamId })
          .from(eventParticipants)
          .where(eq(eventParticipants.eventId, auth.eventId))
      ).filter((p): p is { name: string; teamId: number } => p.teamId != null)
    : [];

  // Ladder events (in-game "missions board"): the individual leaderboard both all-time and for the
  // current UTC month, plus the caller's live rank — so the plugin renders a DMM-All-Stars-style board
  // straight from /config (no extra endpoint). Gated to format='ladder' so other events pay nothing.
  let ladderStandings: PluginStandings | null = null;
  let ladderMonthly: PluginStandings | null = null;
  if (isLadderFormat(event.format)) {
    const boards = await getLadderBoards(event);
    ladderStandings = toPluginStandings(boards.allTime, auth.playerId, boards.ownerByPlayerId, boards.perPerson);
    ladderMonthly = toPluginStandings(boards.monthly, auth.playerId, boards.ownerByPlayerId, boards.perPerson);
  }

  // The plugin's "missions board": the announced, still-open objectives with their face points, reveal
  // time, and per-mission decay/lockout, so it can show a live grow/decay value + a countdown. On a
  // reveal-policy board every open tile is a mission (ladder/rotating); on a classic board only the
  // announced MISSION-flagged tiles are. Each carries its own decay (mission tiles) or the event's.
  const missionSource = revealMode ? allEventTiles : allEventTiles.filter((t) => isMissionTile(t));
  const missions =
    missionSource.length > 0
      ? missionSource.map((t) => {
          const m = isMissionTile(t) ? parseTileMissionRules(t.rules) : null;
          return {
            tileId: t.id,
            label: t.label,
            points: t.points ?? 0,
            revealedAt: t.revealedAt ?? null,
            category: t.category ?? null,
            decay: m ? m.decay : rules.decay,
            lockout: m ? m.lockout : rules.lockout,
          };
        })
      : undefined;
  // Countdown target: the board's next reveal, else the next mission drop (classic-with-missions).
  const effectiveNextRevealAt = revealMode
    ? nextRevealAt(event, rules, fullEventTiles)
    : nextMissionAt(event, rules, fullEventTiles);

  return jsonWithEtag(request, {
    server: serverInfo(),
    clanName: await getClanDisplayName(clan.id),
    event: {
      id: event.id,
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
      forceEndedAt: event.forceEndedAt ?? null,
      // The plugin's Anvil tab opens the matching view (grid / points accordion / tile race / ladder)
      // for the player's own active event straight from these two fields.
      format: event.format,
      scoringMode: event.scoringMode,
      // Reveal-policy board extras (absent on classic events). Old plugins ignore unknown fields.
      ...(revealMode
        ? {
            revealPolicy: rules.revealPolicy,
            hiddenTileCount: fullEventTiles.length - visibleEventTiles.length,
          }
        : {}),
      // The missions board: the announced objectives + the countdown/decay they need. Present for a
      // reveal board (its open tiles) OR a classic board that has announced mission tiles.
      ...(revealMode || missions
        ? { nextRevealAt: effectiveNextRevealAt, decay: rules.decay }
        : {}),
      ...(missions ? { missions } : {}),
      // Ladder standings: all-time + this-month individual leaderboards with the caller's rank.
      ...(ladderStandings ? { standings: ladderStandings, monthlyStandings: ladderMonthly } : {}),
      // Lock-out claims (event-wide) so the plugin can announce another player's claim.
      ...(recentClaims ? { recentClaims } : {}),
    },
    team: {
      id: team.id,
      name: team.name,
      color: team.color,
    },
    player: {
      id: auth.playerId,
    },
    codeword: generateCodeword(auth.playerId, event.id),
    // Activity names for the personal-best import (lib/pluginConfig). RuneLite files its stored PBs
    // under a config scope the plugin can READ but can't LIST, so it has to ask by name — and the
    // names live here rather than in the plugin so a new boss is a dataset change, not a release.
    pbActivities: personalBestActivities(),
    // Null unless this event requires a starting shot (lib/startProof). Carries the drawn location,
    // this player's keyword and whether they've filed one — the plugin's button keys off it.
    startProof,
    // Bosses whose vestige is on a fixed rotation (lib/rollTables). Server-side data so a cadence
    // change or a corrected item list is an edit here, not a plugin release.
    rollTables: pluginRollTables,
    schedule,
    activeWeekly,
    // Admin-configurable difficulty bands (points → tier) for the in-clog Tier filter.
    tiers,
    notify: notifyFlags(webhooks),
    funDeathMessages,
    deathTaunts,
    spoonTaunts,
    alwaysNotifyItems,
    alwaysNotifyItemIds,
    showKillCount,
    dropRarityFloor,
    completedTiles,
    trackedStats,
    trackedKcNames,
    trackedSkillNames,
    trackedActivityKeys,
    trackedDrops: dropTiles
      .filter(t => t.trackedItemIds) // only tiles with item IDs configured
      .map(t => {
        const itemReqs = t.itemRequirements
          ? JSON.parse(t.itemRequirements) as { itemId: number; name: string; requiredAmount: number; group?: string | null; groupRequire?: number | null }[]
          : null;
        const tileItemTotals = perItemMap.get(t.id);

        let acceptedSources: string[] | null = null;
        if (t.acceptedSources) {
          try {
            const parsed = JSON.parse(t.acceptedSources);
            if (Array.isArray(parsed)) acceptedSources = parsed.filter((s) => typeof s === 'string');
          } catch { /* ignore malformed JSON, treat as accept-any */ }
        }
        let sourceNpcs: string[] | null = null;
        if (t.sourceNpcs) {
          try {
            const parsed = JSON.parse(t.sourceNpcs);
            if (Array.isArray(parsed)) sourceNpcs = parsed.filter((s) => typeof s === 'string');
          } catch { /* ignore malformed JSON, treat as any-source */ }
        }
        return {
          tileId: t.id,
          // Board position so the plugin can mirror the site's tile order (difficulty sort, shuffle).
          position: t.position ?? 0,
          label: t.label,
          description: t.description ?? null,
          points: t.points ?? 0,
          category: t.category ?? null,
          itemIds: JSON.parse(t.trackedItemIds || '[]'),
          requiredAmount: t.requiredAmount ?? 1,
          currentAmount: submissionMap[t.id] ?? 0,
          acceptedSources,
          sourceNpcs,
          // Exact raid party size required ("solo Cursed phalanx"); rides
          // timeThresholdSeconds on drop tiles. 0 = any size.
          partySize: t.timeThresholdSeconds ?? 0,
          // Most this tile can be credited from one kill (0 = uncapped). The plugin enforces it —
          // it's the only side that can see where one kill ends and the next begins.
          perKillCap: t.perKillCap ?? 0,
          ...(itemReqs ? {
            itemRequirements: itemReqs.map(req => ({
              itemId: req.itemId,
              name: req.name,
              requiredAmount: req.requiredAmount,
              group: req.group ?? null,
              // How many of the set satisfy it (absent = all), and how the sets combine. Older
              // plugins ignore both and keep reading the tile as OR-ed full sets; the SERVER owns
              // completion either way, so an 'all' tile still credits correctly in-game — its
              // progress bar just reads the old way until the plugin ships set support.
              groupRequire: req.groupRequire ?? 0,
              currentAmount: tileItemTotals?.get(req.itemId) ?? 0,
            })),
            groupMode: t.groupMode === 'all' ? 'all' : 'any',
          } : {}),
        };
      }),

    // Kill-count tiles — the plugin counts kills of the named NPC(s) (not hiscores-backed)
    // and submits a baked screenshot toward `requiredAmount`. `currentAmount` is the team's
    // submitted kill total so the side panel can show progress.
    //
    // Agility-lap tiles ride this same array on purpose. The plugin's kill counter is driven by
    // the Jagex "Your <X> ... count is: N" line, whose parser already strips the "lap" counter
    // word — so a lap tile is exactly a kill tile whose target names are course names, and it
    // credits on every client build, including ones released before laps existed. Only the SITE
    // needs to know the difference (it says "laps", not "kills").
    trackedKills: allEventTiles
      .filter((t) => t.tileType === 'kill' || t.tileType === 'lap')
      .map((t) => {
        let targetNpcs: string[] = [];
        if (t.targetNpcs) {
          try {
            const parsed = JSON.parse(t.targetNpcs);
            if (Array.isArray(parsed)) targetNpcs = parsed.filter((s) => typeof s === 'string');
          } catch { /* ignore malformed JSON */ }
        }
        return {
          tileId: t.id,
          // Board position so the plugin can mirror the site's tile order (difficulty sort, shuffle).
          position: t.position ?? 0,
          label: t.label,
          description: t.description ?? null,
          points: t.points ?? 0,
          category: t.category ?? null,
          targetNpcs,
          requiredAmount: t.requiredAmount ?? 1,
          currentAmount: currentFor(t),
          // What one credit is, for the plugin's in-game wording only ("Tracked lap: …"). Reads off
          // the targets, since a Sepulchre tile counts floors rather than laps. Clients that predate
          // agility tiles ignore the field and say "kill", which is the old behaviour.
          unit: t.tileType === 'lap' ? lapUnitNoun(targetNpcs) : 'kill',
          trackingMode: t.trackingMode ?? 'team',
          // Shared kills: 'per-kill' collapses one kill several members were in, and
          // coopMinMembers gates it on how many of the team were there. Either one makes the plugin
          // attach what it could see of its company to the submission (lib/coopRuns correlates
          // them server-side). Absent/'per-member' + 0 = nothing to report, as before.
          coopCredit: t.coopCredit === 'per-kill' ? 'per-kill' : 'per-member',
          coopMinMembers: t.coopMinMembers ?? 0,
        };
      }),

    // PvP-kill tiles — the plugin credits a kill off the "You have defeated <name>!" line
    // (sent only to the player the game awards the kill/loot key to — one credit per death),
    // gated to dangerous PvP (Wilderness / PvP worlds), when the victim matches a selector:
    // 'team:other' = any member of a rival team (resolved against pvpRoster), 'rsn:<name>'
    // = a named bounty.
    // Selectors live in the targetNpcs column (reused per-tileType, like diary/CA).
    trackedPvp: allEventTiles
      .filter((t) => t.tileType === 'pvp')
      .map((t) => {
        let targets: string[] = [];
        if (t.targetNpcs) {
          try {
            const parsed = JSON.parse(t.targetNpcs);
            if (Array.isArray(parsed)) targets = parsed.filter((s) => typeof s === 'string');
          } catch { /* ignore malformed JSON */ }
        }
        return {
          tileId: t.id,
          // Board position so the plugin can mirror the site's tile order (difficulty sort, shuffle).
          position: t.position ?? 0,
          label: t.label,
          description: t.description ?? null,
          points: t.points ?? 0,
          category: t.category ?? null,
          targets,
          requiredAmount: t.requiredAmount ?? 1,
          currentAmount: currentFor(t),
          trackingMode: t.trackingMode ?? 'team',
          // Minimum loot value (gp) a kill must yield to count. 0 = no minimum (every attributed
          // kill counts, incl. loot-key kills). > 0 makes the plugin price the kill's loot and
          // only credit kills worth at least this much.
          minLootValue: t.pvpMinLootValue ?? 0,
        };
      }),
    pvpRoster,

    // Achievement-diary tiles — the plugin credits a completion when the in-game diary
    // completion line matches one of the tile's selectors ("Ardougne Elite", "Any Elite",
    // "Wilderness Any"). Selectors live in the targetNpcs column (reused per-tileType).
    trackedDiaries: allEventTiles
      .filter((t) => t.tileType === 'diary')
      .map((t) => {
        let diaries: string[] = [];
        if (t.targetNpcs) {
          try {
            const parsed = JSON.parse(t.targetNpcs);
            if (Array.isArray(parsed)) diaries = parsed.filter((s) => typeof s === 'string');
          } catch { /* ignore malformed JSON */ }
        }
        return {
          tileId: t.id,
          // Board position so the plugin can mirror the site's tile order (difficulty sort, shuffle).
          position: t.position ?? 0,
          label: t.label,
          description: t.description ?? null,
          points: t.points ?? 0,
          category: t.category ?? null,
          diaries,
          requiredAmount: t.requiredAmount ?? 1,
          currentAmount: currentFor(t),
          trackingMode: t.trackingMode ?? 'team',
        };
      }),

    // Combat Achievement tiles — the plugin credits a completion when the in-game "you've
    // completed a <tier> combat task" line matches one of the tile's selectors (exact task
    // names like "Whack-a-Mole", or "Any <Tier>" wildcards). Selectors live in the targetNpcs
    // column (reused per-tileType, like diary). Players who already own a task re-fire the
    // line via the in-game "Repeat completion" setting. Consumed by a future plugin release —
    // current plugins simply ignore the field.
    trackedCombatTasks: allEventTiles
      .filter((t) => t.tileType === 'ca')
      .map((t) => {
        let tasks: string[] = [];
        if (t.targetNpcs) {
          try {
            const parsed = JSON.parse(t.targetNpcs);
            if (Array.isArray(parsed)) tasks = parsed.filter((s) => typeof s === 'string');
          } catch { /* ignore malformed JSON */ }
        }
        return {
          tileId: t.id,
          // Board position so the plugin can mirror the site's tile order (difficulty sort, shuffle).
          position: t.position ?? 0,
          label: t.label,
          description: t.description ?? null,
          points: t.points ?? 0,
          category: t.category ?? null,
          tasks,
          requiredAmount: t.requiredAmount ?? 1,
          currentAmount: currentFor(t),
          trackingMode: t.trackingMode ?? 'team',
        };
      }),

    // Timed-clear tiles — the plugin times the named activity and bakes the duration onto a
    // screenshot; the tile completes when a submitted time is at or under `thresholdSeconds`.
    trackedTimed: allEventTiles
      .filter((t) => t.tileType === 'timed')
      .map((t) => ({
        tileId: t.id,
        // Board position so the plugin can mirror the site's tile order (difficulty sort, shuffle).
        position: t.position ?? 0,
        label: t.label,
        description: t.description ?? null,
        points: t.points ?? 0,
        category: t.category ?? null,
        activity: t.timedActivity ?? null,
        thresholdSeconds: t.timeThresholdSeconds ?? null,
        // Exact party size required inside the raid (0 = any) — mirrors deathless partySize.
        partySize: t.partySize ?? 0,
        // Signature reward of the timed activity (Colosseum → Dizana's quiver) — the clog
        // accordion's icon; -1 falls back to the book sprite.
        itemId: notableItemFor(t.timedActivity) ?? -1,
        completed: completedTileIdSet.has(t.id),
      })),

    // LMS placement tiles — the plugin watches Last Man Standing games and submits a baked
    // screenshot each time the player places at or under `placementCap` (1 = win). The cap
    // rides in the timeThresholdSeconds column; `requiredAmount` qualifying games complete
    // the tile (summed like kill tiles).
    trackedLms: allEventTiles
      .filter((t) => t.tileType === 'lms')
      .map((t) => ({
        tileId: t.id,
        // Board position so the plugin can mirror the site's tile order (difficulty sort, shuffle).
        position: t.position ?? 0,
        label: t.label,
        description: t.description ?? null,
        points: t.points ?? 0,
        category: t.category ?? null,
        placementCap: t.timeThresholdSeconds ?? 1,
        requiredAmount: t.requiredAmount ?? 1,
        currentAmount: submissionMap[t.id] ?? 0,
        completed: completedTileIdSet.has(t.id),
      })),

    // Loot-value tiles — the plugin prices every loot haul (drop, loot key, PvP kill) and
    // submits a baked screenshot when one meets `thresholdGp` (stored in requiredAmount).
    // `sources` optionally restricts where the haul may come from: NPC/chest names, or the
    // special "PvP" for player kills. Empty = any source.
    trackedValues: allEventTiles
      .filter((t) => t.tileType === 'value' || t.tileType === 'valuetotal')
      .map((t) => {
        let sources: string[] = [];
        if (t.sourceNpcs) {
          try {
            const parsed = JSON.parse(t.sourceNpcs);
            if (Array.isArray(parsed)) sources = parsed.filter((s) => typeof s === 'string');
          } catch { /* ignore malformed JSON */ }
        }
        return {
          tileId: t.id,
          // Board position so the plugin can mirror the site's tile order (difficulty sort, shuffle).
          position: t.position ?? 0,
          label: t.label,
          description: t.description ?? null,
          points: t.points ?? 0,
          category: t.category ?? null,
          thresholdGp: t.requiredAmount ?? 1,
          // 'single' = one haul must meet the threshold; 'total' = hauls sum toward it.
          mode: t.tileType === 'valuetotal' ? 'total' : 'single',
          currentGp: submissionMap[t.id] ?? 0,
          sources,
          completed: completedTileIdSet.has(t.id),
        };
      }),

    // Item-gain tiles — the plugin counts tracked items appearing in the inventory
    // (fishing catches, cooked food, jarred implings) and submits a baked running total,
    // exactly like kill tiles. Bank/GE/trade gains are ignored plugin-side.
    trackedGains: allEventTiles
      .filter((t) => t.tileType === 'gain')
      .map((t) => ({
        tileId: t.id,
        // Board position so the plugin can mirror the site's tile order (difficulty sort, shuffle).
        position: t.position ?? 0,
        label: t.label,
        description: t.description ?? null,
        points: t.points ?? 0,
        category: t.category ?? null,
        itemIds: (() => {
          try {
            const ids = JSON.parse(t.trackedItemIds || '[]');
            return Array.isArray(ids) ? ids.filter((n) => typeof n === 'number') : [];
          } catch { return []; }
        })(),
        requiredAmount: t.requiredAmount ?? 1,
        currentAmount: currentFor(t),
        trackingMode: t.trackingMode ?? 'team',
        completed: completedTileIdSet.has(t.id),
      })),

    // Deathless-raid tiles — the plugin counts player deaths inside the raid instance and
    // credits a run off the completion message only when that count is zero. The raid name
    // rides timedActivity; requiredAmount = deathless runs needed.
    trackedDeathless: allEventTiles
      .filter((t) => t.tileType === 'deathless')
      .map((t) => ({
        tileId: t.id,
        // Board position so the plugin can mirror the site's tile order (difficulty sort, shuffle).
        position: t.position ?? 0,
        label: t.label,
        description: t.description ?? null,
        points: t.points ?? 0,
        category: t.category ?? null,
        activity: t.timedActivity ?? null,
        requiredAmount: t.requiredAmount ?? 1,
        currentAmount: submissionMap[t.id] ?? 0,
        // Exact party size required (rides timeThresholdSeconds); 0 = any size.
        partySize: t.timeThresholdSeconds ?? 0,
        itemId: notableItemFor(t.timedActivity) ?? -1,
        completed: completedTileIdSet.has(t.id),
      })),
  });
}
