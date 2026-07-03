import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, tiles, teams, submissions, players, completions } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { verifyPluginToken, verifyPluginTokenUser } from '@/lib/auth';
import { requireSecret } from '@/lib/env';
import {
  buildSchedule,
  getActiveWeekly,
  getNotificationWebhooks,
  getFunDeathMessages,
  getDeathTaunts,
  getSpoonTaunts,
  getAlwaysNotifyItems,
  getShowKillCount,
  getTierBands,
  type PluginWebhooks,
} from '@/lib/pluginConfig';
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
      const [schedule, activeWeekly, webhooks, funDeathMessages, deathTaunts, spoonTaunts, alwaysNotifyItems, showKillCount] =
        await Promise.all([
          buildSchedule(),
          getActiveWeekly(),
          getNotificationWebhooks(),
          getFunDeathMessages(),
          getDeathTaunts(),
          getSpoonTaunts(),
          getAlwaysNotifyItems(),
          getShowKillCount(),
        ]);
      return NextResponse.json({
        event: null,
        team: null,
        player: null,
        codeword: null,
        trackedStats: [],
        trackedDrops: [],
        trackedKills: [],
        trackedTimed: [],
        trackedLms: [],
        trackedDiaries: [],
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
      statsSnapshot: players.statsSnapshot,
      cachedStats: players.cachedStats,
    })
    .from(players)
    .where(and(eq(players.eventId, auth.eventId), eq(players.teamId, auth.teamId)));

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

  const trackedStats = statTilesRaw.map((t) => {
    const statName = t.trackedStat ?? '';
    const statType = t.statType ?? 'skill';
    const goal = t.statGoal ?? 0;
    const trackingMode = t.trackingMode ?? 'team';

    let gainedTotal = 0;
    const sources = trackingMode === 'individual'
      ? teamPlayers.filter((p) => p.id === auth.playerId)
      : teamPlayers;

    for (const p of sources) {
      const baseline = readStatValue(p.statsSnapshot, statType, statName);
      const current = readStatValue(p.cachedStats, statType, statName);
      if (baseline == null || current == null) continue;
      const gained = current - baseline;
      if (gained > 0) gainedTotal += gained;
    }

    return {
      tileId: t.id,
      label: t.label,
      description: t.description ?? null,
      points: t.points ?? 0,
      category: t.category ?? null,
      statName,
      statType,
      trackingMode,
      currentAmount: gainedTotal,
      goalAmount: goal,
    };
  });

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
  const completedTiles = teamCompletions.map((c) => {
    const tile = tileById.get(c.tileId);
    return {
      tileId: c.tileId,
      label: tile?.label ?? `Tile #${c.tileId}`,
      points: tile?.points ?? 0,
    };
  });

  return NextResponse.json({
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
    trackedDrops: dropTiles
      .filter(t => t.trackedItemIds) // only tiles with item IDs configured
      .map(t => {
        const itemReqs = t.itemRequirements
          ? JSON.parse(t.itemRequirements) as { itemId: number; name: string; requiredAmount: number }[]
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
          label: t.label,
          description: t.description ?? null,
          points: t.points ?? 0,
          category: t.category ?? null,
          itemIds: JSON.parse(t.trackedItemIds || '[]'),
          requiredAmount: t.requiredAmount ?? 1,
          currentAmount: submissionMap[t.id] ?? 0,
          acceptedSources,
          sourceNpcs,
          ...(itemReqs ? {
            itemRequirements: itemReqs.map(req => ({
              itemId: req.itemId,
              name: req.name,
              requiredAmount: req.requiredAmount,
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

    // Timed-clear tiles — the plugin times the named activity and bakes the duration onto a
    // screenshot; the tile completes when a submitted time is at or under `thresholdSeconds`.
    trackedTimed: allEventTiles
      .filter((t) => t.tileType === 'timed')
      .map((t) => ({
        tileId: t.id,
        label: t.label,
        description: t.description ?? null,
        points: t.points ?? 0,
        category: t.category ?? null,
        activity: t.timedActivity ?? null,
        thresholdSeconds: t.timeThresholdSeconds ?? null,
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
        label: t.label,
        description: t.description ?? null,
        points: t.points ?? 0,
        category: t.category ?? null,
        placementCap: t.timeThresholdSeconds ?? 1,
        requiredAmount: t.requiredAmount ?? 1,
        currentAmount: submissionMap[t.id] ?? 0,
        completed: completedTileIdSet.has(t.id),
      })),
  });
}
