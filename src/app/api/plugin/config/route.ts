import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, tiles, teams, submissions, players, completions, clanMembers } from '@/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
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
  getShowKillCount,
  getTierBands,
  type PluginWebhooks,
} from '@/lib/pluginConfig';
import { notableItemFor, bossItemForStatKey } from '@/lib/tileIcons';
import { statKeys } from '@/lib/tileKinds';
import { kcNamesForKey } from '@/lib/pluginStats';
import { liveStatsForMembers } from '@/lib/liveStats';
import { jsonWithEtag } from '@/lib/httpEtag';
import crypto from 'crypto';

const CODEWORD_SECRET = requireSecret('CODEWORD_SECRET', 'dev-codeword-secret');

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
      name: players.name,
      eventName: events.name,
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
    })
    .from(players)
    .innerJoin(events, eq(players.eventId, events.id))
    .where(sql`lower(${players.name}) = ${norm}`);
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
      const [schedule, activeWeekly, weeklyNames, webhooks, funDeathMessages, deathTaunts, spoonTaunts, alwaysNotifyItems, showKillCount, unlinkedActiveEvent] =
        await Promise.all([
          buildSchedule(),
          getActiveWeekly(),
          weeklyTrackedNames(),
          getNotificationWebhooks(),
          getFunDeathMessages(),
          getDeathTaunts(),
          getSpoonTaunts(),
          getAlwaysNotifyItems(),
          getShowKillCount(),
          activeEventForUnlinkedRsn(request),
        ]);
      return jsonWithEtag(request, {
        event: null,
        team: null,
        player: null,
        // Non-null when the logged-in RSN IS a player in a live bingo but this token/account isn't
        // linked to it — the plugin surfaces a "verify your RSN" warning so tracking isn't silently off.
        unlinkedActiveEvent,
        codeword: null,
        trackedStats: [],
        // With no bingo event the plugin still pushes the active SOTW/BOTW metric so weekly moves live.
        trackedKcNames: weeklyNames.kc,
        trackedSkillNames: weeklyNames.skills,
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
        schedule,
        activeWeekly,
        notify: notifyFlags(webhooks),
        funDeathMessages,
        deathTaunts,
        spoonTaunts,
        alwaysNotifyItems,
        showKillCount,
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

  // Get drop tiles with tracked item IDs
  const dropTiles = tilesRevealed
    ? await db.query.tiles.findMany({
        where: and(eq(tiles.eventId, auth.eventId), eq(tiles.tileType, 'drop')),
      })
    : [];

  // Stat-tracked tiles (skill XP / boss KC). The DB sometimes stores tile_type='standard'
  // for these — match on the presence of a trackedStat field instead.
  const allEventTiles = tilesRevealed
    ? await db.query.tiles.findMany({ where: eq(tiles.eventId, auth.eventId) })
    : [];
  const statTilesRaw = allEventTiles.filter((t) => t.trackedStat && t.trackedStat.length > 0);

  // Get current submission totals per tile for this team
  const teamSubmissions = await db
    .select({
      tileId: submissions.tileId,
      total: sql<number>`COALESCE(SUM(${submissions.amount}), 0)`,
    })
    .from(submissions)
    .where(eq(submissions.teamId, auth.teamId))
    .groupBy(submissions.tileId)
    .all();

  const submissionMap = Object.fromEntries(teamSubmissions.map(s => [s.tileId, s.total]));

  // Get per-item submission totals for tiles with itemRequirements
  const perItemSubmissions = await db
    .select({
      tileId: submissions.tileId,
      itemId: submissions.itemId,
      total: sql<number>`COALESCE(SUM(${submissions.amount}), 0)`,
    })
    .from(submissions)
    .where(eq(submissions.teamId, auth.teamId))
    .groupBy(submissions.tileId, submissions.itemId)
    .all();

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
      id: players.id,
      name: players.name,
      clanMemberId: players.clanMemberId,
      statsSnapshot: players.statsSnapshot,
      cachedStats: players.cachedStats,
      // When this member last pushed live stats — the "is this teammate actively grinding right now"
      // signal for stat-tile attribution in the sidebar's "Active now". Per-member (not per-stat).
      liveStatsAt: clanMembers.liveStatsAt,
    })
    .from(players)
    .leftJoin(clanMembers, eq(players.clanMemberId, clanMembers.id))
    .where(and(eq(players.eventId, auth.eventId), eq(players.teamId, auth.teamId)));
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
    const sources = trackingMode === 'individual'
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
      if (playerGained > 0 && p.id !== auth.playerId && p.liveStatsAt
          && activeWorkers.length < ACTIVE_WORKERS_CAP) {
        const at = Date.parse(p.liveStatsAt);
        if (Number.isFinite(at) && nowMs - at <= ACTIVE_STAT_WINDOW_MS) {
          activeWorkers.push(p.name);
        }
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
  const [schedule, activeWeekly, webhooks, funDeathMessages, deathTaunts, spoonTaunts, alwaysNotifyItems, showKillCount, tiers] =
    await Promise.all([
      buildSchedule(),
      getActiveWeekly(),
      getNotificationWebhooks(),
      getFunDeathMessages(),
      getDeathTaunts(),
      getSpoonTaunts(),
      getAlwaysNotifyItems(),
      getShowKillCount(),
      getTierBands(),
    ]);

  // Team-level tile completions (drops, stats, manual — all tile types). The plugin uses this to
  // fire a banner for the whole team when any tile is completed, regardless of who finished it.
  const teamCompletions = tilesRevealed
    ? await db
        .select({ tileId: completions.tileId })
        .from(completions)
        .where(eq(completions.teamId, auth.teamId))
        .all()
    : [];
  const tileById = new Map(allEventTiles.map((t) => [t.id, t]));
  const completedTileIdSet = new Set(teamCompletions.map((c) => c.tileId));

  // "Completed by <who>" for the plugin's completion chat line: the crediting player of the LATEST
  // submission for each completed tile (usually the one that finished it). Stat/manual completions
  // have no submission, so they stay unattributed (null).
  const completedTileIds = teamCompletions.map((c) => c.tileId);
  const completedByMap = new Map<number, string>();
  if (completedTileIds.length > 0) {
    const creditRows = await db
      .select({ tileId: submissions.tileId, name: players.name })
      .from(submissions)
      .leftJoin(players, eq(submissions.creditPlayerId, players.id))
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

  // PvP-kill tiles need the event roster so the plugin can tell whether a victim is on a
  // rival team ('team:other' selectors match RSN → teamId). Only shipped while a pvp tile
  // exists — otherwise it's payload (and roster) for nothing.
  const hasPvpTiles = allEventTiles.some((t) => t.tileType === 'pvp');
  const pvpRoster = hasPvpTiles
    ? (
        await db
          .select({ name: players.name, teamId: players.teamId })
          .from(players)
          .where(eq(players.eventId, auth.eventId))
      ).filter((p): p is { name: string; teamId: number } => p.teamId != null)
    : [];

  return jsonWithEtag(request, {
    event: {
      id: event.id,
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
      forceEndedAt: event.forceEndedAt ?? null,
      // The plugin's Anvil tab opens the matching view (grid / points accordion / tile race)
      // for the player's own active event straight from these two fields.
      format: event.format,
      scoringMode: event.scoringMode,
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
    schedule,
    activeWeekly,
    // Admin-configurable difficulty bands (points → tier) for the in-clog Tier filter.
    tiers,
    notify: notifyFlags(webhooks),
    funDeathMessages,
    deathTaunts,
    spoonTaunts,
    alwaysNotifyItems,
    showKillCount,
    completedTiles,
    trackedStats,
    trackedKcNames,
    trackedSkillNames,
    trackedDrops: dropTiles
      .filter(t => t.trackedItemIds) // only tiles with item IDs configured
      .map(t => {
        const itemReqs = t.itemRequirements
          ? JSON.parse(t.itemRequirements) as { itemId: number; name: string; requiredAmount: number; group?: string | null }[]
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
          ...(itemReqs ? {
            itemRequirements: itemReqs.map(req => ({
              itemId: req.itemId,
              name: req.name,
              requiredAmount: req.requiredAmount,
              group: req.group ?? null,
              currentAmount: tileItemTotals?.get(req.itemId) ?? 0,
            })),
          } : {}),
        };
      }),

    // Kill-count tiles — the plugin counts kills of the named NPC(s) (not hiscores-backed)
    // and submits a baked screenshot toward `requiredAmount`. `currentAmount` is the team's
    // submitted kill total so the side panel can show progress.
    trackedKills: allEventTiles
      .filter((t) => t.tileType === 'kill')
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
          currentAmount: submissionMap[t.id] ?? 0,
          trackingMode: t.trackingMode ?? 'team',
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
          currentAmount: submissionMap[t.id] ?? 0,
          trackingMode: t.trackingMode ?? 'team',
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
          currentAmount: submissionMap[t.id] ?? 0,
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
          currentAmount: submissionMap[t.id] ?? 0,
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
        currentAmount: submissionMap[t.id] ?? 0,
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
