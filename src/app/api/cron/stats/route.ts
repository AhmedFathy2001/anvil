import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players, tiles, teams, completions, events } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { getHiscoresStats } from '@/lib/hiscores';
import { notifyTileCompletion, notifyTeamWin } from '@/lib/discord';
import { processEventLifecycleNotifications } from '@/lib/eventLifecycle';
import { log } from '@/lib/logger';
import { statKeys } from '@/lib/tileKinds';
import { parsePluginStats } from '@/lib/pluginStats';
import { timingSafeStrEqual } from '@/lib/auth';

// Cron protection — requests must carry the shared secret (Vercel injected it automatically; the
// self-hosted host cron sends `Authorization: Bearer $CRON_SECRET`).
const CRON_SECRET = process.env.CRON_SECRET;

// maxDuration is a Vercel-only cap and a no-op on the self-hosted box, where the run is instead
// bounded by TIME_BUDGET_MS below (with the host cron.sh's curl -m timeout as a hard backstop).
export const maxDuration = 300;

// Hiscores polling budget. Mirrors the weekly cron: CONCURRENCY workers behind a shared token
// bucket (~1 request / PER_REQUEST_GAP_MS ≈ 2.5 rps, safely under Jagex's limit), the whole run
// bounded by a wall-clock budget. Players are polled oldest-fetched-first, so when a roster
// exceeds one tick's budget the remainder rolls to the next tick instead of the run being killed
// mid-loop and the same head-of-list players being re-polled forever (the old failure mode).
const CONCURRENCY = 3;
const PER_REQUEST_GAP_MS = 400;
const TIME_BUDGET_MS = 240_000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface Snapshot {
  skills: Record<string, { rank: number; level: number; xp: number }>;
  bosses: Record<string, { rank: number; score: number }>;
}

type EventRow = typeof events.$inferSelect;
type PlayerRow = typeof players.$inferSelect;
type TileRow = typeof tiles.$inferSelect;
type TeamRow = typeof teams.$inferSelect;

interface EventResult {
  eventId: number;
  eventName: string;
  playersChecked: number;
  playersSnapshotted: number;
  tilesCompleted: { tileLabel: string; teamName: string; playerName: string }[];
  errors: string[];
}

// Per-event working context, assembled once up front so the fetch and evaluate phases don't
// re-query. completionSet / teamGains are mutated during evaluation.
interface EventCtx {
  event: EventRow;
  eventTiles: TileRow[];
  statTiles: TileRow[];
  teams: TeamRow[];
  teamMap: Map<number, TeamRow>;
  completionSet: Set<string>;
  teamGains: Map<string, number>;
  hasStatTiles: boolean;
  result: EventResult;
}

interface FetchTask {
  ctx: EventCtx;
  player: PlayerRow;
  needsSnapshot: boolean;
}

interface Fetched {
  ctx: EventCtx;
  player: PlayerRow;
  snapshot: Snapshot; // baseline
  current: Snapshot;  // this tick
  // Real-time boss KC pushed by the plugin, AFTER reconciling against this tick's hiscores (entries
  // hiscores has caught up to are pruned). Completion uses max(hiscores, plugin) per key. Empty for
  // players with no pushed KC.
  pluginMap: Record<string, number>;
}

export async function GET(request: Request) {
  // In production we require CRON_SECRET. The `x-vercel-cron` header alone isn't enough —
  // it's spoofable outside Vercel's edge, and forgetting the secret turns cron into a public endpoint.
  if (process.env.NODE_ENV === 'production' && !CRON_SECRET) {
    return NextResponse.json(
      { error: 'Server misconfigured: CRON_SECRET is required in production' },
      { status: 500 },
    );
  }
  const authHeader = request.headers.get('authorization');
  const hasValidSecret = !!CRON_SECRET && timingSafeStrEqual(authHeader ?? '', `Bearer ${CRON_SECRET}`);
  // Dev only: allow the Vercel-cron header when no secret is configured, so local simulation works.
  const devBypass = !CRON_SECRET && request.headers.get('x-vercel-cron') === '1';
  if (!hasValidSecret && !devBypass) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  const results: EventResult[] = [];

  // Get all events
  const allEvents = await db.select().from(events);
  const now = new Date().toISOString();

  // Fire scheduled event start/end Discord posts (idempotent via atomic flags). This is only
  // the hourly backstop — the per-minute flush-notifications cron runs the same check, so these
  // posts land on time rather than up to an hour late.
  await processEventLifecycleNotifications();

  // Filter to only active events for stat tracking
  const activeEvents = allEvents.filter((e) => {
    // Skip force-ended events
    if (e.forceEndedAt) return false;
    // Event has started
    if (e.startDate && e.startDate > now) return false;
    // Event hasn't ended
    if (e.endDate && e.endDate < now) return false;
    return true;
  });

  // ── Phase 1: assemble per-event context + the global fetch queue ──────────────────────────
  const ctxList: EventCtx[] = [];
  const tasks: FetchTask[] = [];

  for (const event of activeEvents) {
    const eventPlayers = await db.query.players.findMany({ where: eq(players.eventId, event.id) });
    const eventTiles = await db.query.tiles.findMany({ where: eq(tiles.eventId, event.id) });
    // Skip tiles an admin has flipped to manual (autoTrackDisabled) — the site must not
    // auto-credit them even though they carry stat config.
    const statTiles = eventTiles.filter((t) => t.trackedStat && t.statType && t.statGoal && !t.autoTrackDisabled);
    const hasStatTiles = statTiles.length > 0;
    const eventTeams = await db.query.teams.findMany({ where: eq(teams.eventId, event.id) });
    const teamMap = new Map(eventTeams.map((t) => [t.id, t]));

    const eventTileIds = eventTiles.map((t) => t.id);
    const existingCompletions = eventTileIds.length > 0
      ? await db.select().from(completions).where(inArray(completions.tileId, eventTileIds))
      : [];
    const completionSet = new Set(existingCompletions.map((c) => `${c.teamId}-${c.tileId}`));

    const ctx: EventCtx = {
      event,
      eventTiles,
      statTiles,
      teams: eventTeams,
      teamMap,
      completionSet,
      teamGains: new Map(),
      hasStatTiles,
      result: {
        eventId: event.id,
        eventName: event.name,
        playersChecked: 0,
        playersSnapshotted: 0,
        tilesCompleted: [],
        errors: [],
      },
    };
    ctxList.push(ctx);

    for (const player of eventPlayers) {
      if (!player.teamId) continue;
      const needsSnapshot = !player.statsSnapshot;
      // Fetch when the event has stat tiles (need current stats for gains) or when the player
      // still needs a baseline snapshot. Events without stat tiles only snapshot missing baselines.
      if (hasStatTiles || needsSnapshot) {
        tasks.push({ ctx, player, needsSnapshot });
      }
    }
  }

  // Oldest-first: never-fetched (null) sorts to the front, then ascending lastStatsFetch. Guarantees
  // every tick advances the queue so no player is perpetually starved when the roster exceeds one
  // tick's budget.
  tasks.sort((a, b) =>
    (a.player.lastStatsFetch ?? '').localeCompare(b.player.lastStatsFetch ?? ''),
  );

  // ── Phase 2: fetch hiscores concurrently under a shared token bucket + wall-clock budget ──────
  let lastDispatch = 0;
  async function takeToken() {
    const wait = Math.max(0, PER_REQUEST_GAP_MS - (Date.now() - lastDispatch));
    if (wait > 0) await delay(wait);
    lastDispatch = Date.now();
  }

  const fetched: Fetched[] = [];
  const queue = [...tasks];

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      if (Date.now() - start > TIME_BUDGET_MS) break; // budget hit — leave the rest for next tick
      const task = queue.shift();
      if (!task) break;
      await takeToken();
      const ts = new Date().toISOString();
      try {
        const current = await getHiscoresStats(task.player.name) as Snapshot;
        const currentJson = JSON.stringify(current);
        // Reconcile the plugin's real-time boss KC against this fresh hiscores read: drop any entry
        // hiscores has caught up to (its value now IS the truth), keep only entries still ahead.
        // This is what "readjusts an hour later" — a stale/over-reported push self-heals, and the
        // stored plugin blob shrinks back to nothing once hiscores confirms every kill.
        const rawPlugin = parsePluginStats(task.player.pluginStats);
        const pluginMap: Record<string, number> = {};
        for (const [k, v] of Object.entries(rawPlugin)) {
          const h = current.bosses?.[k]?.score ?? 0;
          if ((h < 0 ? 0 : h) < v) pluginMap[k] = v;
        }
        // Persist the pruned blob only when it actually changed, to avoid needless writes.
        const prunedJson = Object.keys(pluginMap).length > 0 ? JSON.stringify(pluginMap) : null;
        const pluginChanged = Object.keys(rawPlugin).length !== Object.keys(pluginMap).length
          || Object.entries(pluginMap).some(([k, v]) => rawPlugin[k] !== v);
        const pluginPatch = pluginChanged ? { pluginStats: prunedJson } : {};

        if (task.needsSnapshot) {
          // First fetch doubles as the baseline; the gain this tick is 0.
          await db.update(players)
            .set({ statsSnapshot: currentJson, snapshotAt: ts, cachedStats: currentJson, lastStatsFetch: ts, ...pluginPatch })
            .where(eq(players.id, task.player.id));
          task.ctx.result.playersSnapshotted++;
          fetched.push({ ctx: task.ctx, player: task.player, snapshot: current, current, pluginMap });
        } else {
          await db.update(players)
            .set({ cachedStats: currentJson, lastStatsFetch: ts, ...pluginPatch })
            .where(eq(players.id, task.player.id));
          task.ctx.result.playersChecked++;
          let snapshot: Snapshot;
          try {
            snapshot = JSON.parse(task.player.statsSnapshot!);
          } catch {
            task.ctx.result.errors.push(`Invalid snapshot for ${task.player.name}`);
            continue;
          }
          fetched.push({ ctx: task.ctx, player: task.player, snapshot, current, pluginMap });
        }
      } catch {
        task.ctx.result.errors.push(`Failed to fetch stats for ${task.player.name}`);
      }
    }
  });
  await Promise.all(workers);
  const skipped = queue.length; // players left unfetched this tick (budget) — picked up next tick

  // ── Phase 3: evaluate completions in-memory (single-threaded, so shared-state mutation is safe) ──
  for (const f of fetched) {
    const ctx = f.ctx;
    if (!ctx.hasStatTiles || !f.player.teamId) continue;

    for (const tile of ctx.statTiles) {
      const key = `${f.player.teamId}-${tile.id}`;
      if (ctx.completionSet.has(key)) continue;

      // A composite trackedStat ("chambersOfXeric,chambersOfXericChallengeMode") sums the
      // gains across its hiscores keys — CoX and CM clears count toward the same tile.
      let gained = 0;
      for (const part of statKeys(tile.trackedStat)) {
        if (tile.statType === 'skill') {
          const snapshotXp = f.snapshot.skills?.[part]?.xp ?? 0;
          const currentXp = f.current.skills?.[part]?.xp ?? 0;
          gained += Math.max(0, currentXp - snapshotXp);
        } else if (tile.statType === 'boss') {
          const snapshotKc = f.snapshot.bosses?.[part]?.score ?? 0;
          const currentKc = f.current.bosses?.[part]?.score ?? 0;
          const sKc = snapshotKc < 0 ? 0 : snapshotKc;
          // Effective current = max(hiscores, plugin-pushed) so a real-time kill counts before the
          // hiscores read catches up.
          const cKc = Math.max(currentKc < 0 ? 0 : currentKc, f.pluginMap[part] ?? 0);
          gained += Math.max(0, cKc - sKc);
        }
      }

      if (tile.trackingMode === 'individual') {
        // Individual mode: any player meeting the goal completes the tile for their team.
        if (gained >= tile.statGoal!) {
          await db.insert(completions).values({ teamId: f.player.teamId, tileId: tile.id }).onConflictDoNothing();
          ctx.completionSet.add(key);
          const team = ctx.teamMap.get(f.player.teamId);
          ctx.result.tilesCompleted.push({
            tileLabel: tile.label,
            teamName: team?.name || 'Unknown',
            playerName: f.player.name,
          });
          if (team) {
            notifyTileCompletion({
              eventName: ctx.event.name,
              tileLabel: tile.label,
              teamName: team.name,
              teamColor: team.color,
              tileType: tile.tileType,
              trackedStat: tile.trackedStat,
              statType: tile.statType,
            }).catch(() => {});
          }
        }
      } else {
        // Team mode: accumulate gains across the team's fetched players.
        const existing = ctx.teamGains.get(key) || 0;
        ctx.teamGains.set(key, existing + gained);
      }
    }
  }

  // Per-event: team-mode completions + blackout win, using the accumulated gains.
  for (const ctx of ctxList) {
    if (ctx.hasStatTiles) {
      // Team-mode tile completions
      for (const tile of ctx.statTiles) {
        if (tile.trackingMode !== 'team') continue;

        for (const team of ctx.teams) {
          const key = `${team.id}-${tile.id}`;
          if (ctx.completionSet.has(key)) continue;

          const totalGained = ctx.teamGains.get(key) || 0;
          if (totalGained >= tile.statGoal!) {
            await db.insert(completions).values({ teamId: team.id, tileId: tile.id }).onConflictDoNothing();
            ctx.completionSet.add(key);
            ctx.result.tilesCompleted.push({
              tileLabel: tile.label,
              teamName: team.name,
              playerName: '(team total)',
            });
            notifyTileCompletion({
              eventName: ctx.event.name,
              tileLabel: tile.label,
              teamName: team.name,
              teamColor: team.color,
              tileType: tile.tileType,
              trackedStat: tile.trackedStat,
              statType: tile.statType,
            }).catch(() => {});
          }
        }
      }

      // Check if any team completed ALL required (non-optional) tiles (blackout/win)
      const requiredTiles = ctx.eventTiles.filter((t) => !t.optional);
      const requiredTileIds = new Set(requiredTiles.map((t) => t.id));
      const totalRequiredTiles = requiredTiles.length;

      for (const team of ctx.teams) {
        // Only count completions of required tiles
        const teamCompletionCount = Array.from(ctx.completionSet).filter((key) => {
          if (!key.startsWith(`${team.id}-`)) return false;
          const tileId = parseInt(key.split('-')[1], 10);
          return requiredTileIds.has(tileId);
        }).length;

        if (teamCompletionCount >= totalRequiredTiles && totalRequiredTiles > 0) {
          // Only fire the win notice if a tile was completed for this team in this run.
          const justCompletedTile = ctx.result.tilesCompleted.some((tc) => tc.teamName === team.name);
          if (justCompletedTile) {
            notifyTeamWin({
              eventName: ctx.event.name,
              teamName: team.name,
              teamColor: team.color,
              totalTiles: totalRequiredTiles,
            }).catch(() => {});
          }
        }
      }
    }

    results.push(ctx.result);
  }

  const durationMs = Date.now() - start;
  log.info('stats-cron.tick', {
    activeEvents: activeEvents.length,
    queued: tasks.length,
    fetched: fetched.length,
    skipped,
    snapshotted: results.reduce((s, r) => s + r.playersSnapshotted, 0),
    checked: results.reduce((s, r) => s + r.playersChecked, 0),
    tilesCompleted: results.reduce((s, r) => s + r.tilesCompleted.length, 0),
    errors: results.reduce((s, r) => s + r.errors.length, 0),
    durationMs,
  });

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    skipped,
    durationMs,
    results,
  });
}
