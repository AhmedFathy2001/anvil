import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  players,
  tiles,
  teams,
  completions,
  events,
  clanMembers,
  weeklyCompetitions,
  weeklyParticipants,
} from '@/db/schema';
import { eq, and, or, inArray, isNull, asc } from 'drizzle-orm';
import { fetchSnapshotWithRetry, type HiscoresSnapshot } from '@/lib/hiscores';
import { notifyTileCompletion, notifyTeamWin } from '@/lib/discord';
import { processEventLifecycleNotifications } from '@/lib/eventLifecycle';
import { log } from '@/lib/logger';
import { statKeys } from '@/lib/tileKinds';
import { parsePluginStats } from '@/lib/pluginStats';
import { computeGain, effectiveValue, reconcileLive } from '@/lib/statTracking';
import { applyWeeklyValue, readMetricFromSnapshot, writePlayerSnapshot } from '@/lib/weekly';
import { timingSafeStrEqual } from '@/lib/auth';
import { normalizeRsn } from '@/lib/auth';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// The unified hiscores sweep. Runs every 15 min (control-plane dispatcher). It builds ONE work list
// keyed by clan member — so a member who's in a bingo event AND SOTW+BOTW is fetched from OSRS
// Hiscores exactly ONCE — then fans the single snapshot out to that member's bingo stat tiles AND
// every weekly participant row. Hiscores is the source of truth: it reconciles (prunes) the member's
// live plugin overlay as it catches up. The competition LIFECYCLE (status flips, announcements,
// enrollment, re-probe, rename review) stays in /api/cron/weekly.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const CRON_SECRET = process.env.CRON_SECRET;

// maxDuration is a Vercel-only cap and a no-op on the self-hosted box, where the run is instead
// bounded by TIME_BUDGET_MS below (with the host cron's curl -m timeout as a hard backstop).
export const maxDuration = 300;

// Hiscores polling budget: CONCURRENCY workers behind a shared token bucket (~1 request /
// PER_REQUEST_GAP_MS ≈ 2.5 rps, safely under Jagex's limit), the whole run bounded by a wall-clock
// budget. Members are polled oldest-fetched-first, so when the union roster exceeds one tick's budget
// the remainder rolls to the next tick instead of the run being killed mid-loop.
const CONCURRENCY = 3;
const PER_REQUEST_GAP_MS = 400;
const TIME_BUDGET_MS = 240_000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type EventRow = typeof events.$inferSelect;
type PlayerRow = typeof players.$inferSelect;
type TileRow = typeof tiles.$inferSelect;
type TeamRow = typeof teams.$inferSelect;

// Per-event working context, assembled once up front. completionSet / teamGains mutate during eval.
interface EventCtx {
  event: EventRow;
  eventTiles: TileRow[];
  statTiles: TileRow[];
  teams: TeamRow[];
  teamMap: Map<number, TeamRow>;
  completionSet: Set<string>;
  teamGains: Map<string, number>;
  hasStatTiles: boolean;
  result: {
    eventId: number;
    eventName: string;
    playersChecked: number;
    playersSnapshotted: number;
    tilesCompleted: { tileLabel: string; teamName: string; playerName: string }[];
    errors: string[];
  };
}

interface BingoTask { ctx: EventCtx; player: PlayerRow; needsSnapshot: boolean; }
interface WeeklyTask {
  comp: { id: number; type: 'skill' | 'boss'; metric: string };
  participant: { id: number; baselineValue: number | null; currentValue: number | null; lastUpdated: string | null; clanMemberId: number | null };
}

// One clan member's whole workload for this sweep — a single hiscores fetch, fanned out.
interface MemberWork {
  key: string;
  clanMemberId: number | null;
  fetchRsn: string;
  liveMap: Record<string, number>;
  bingo: BingoTask[];
  weekly: WeeklyTask[];
  staleKey: string; // oldest task timestamp — drives oldest-first ordering
}

// A bingo player fetched this tick, held for the single-threaded completion pass.
interface FetchedBingo {
  ctx: EventCtx;
  player: PlayerRow;
  baseline: HiscoresSnapshot;
  current: HiscoresSnapshot;
  liveMap: Record<string, number>;
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production' && !CRON_SECRET) {
    return NextResponse.json({ error: 'Server misconfigured: CRON_SECRET is required in production' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  const hasValidSecret = !!CRON_SECRET && timingSafeStrEqual(authHeader ?? '', `Bearer ${CRON_SECRET}`);
  const devBypass = !CRON_SECRET && request.headers.get('x-vercel-cron') === '1';
  if (!hasValidSecret && !devBypass) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  const now = new Date().toISOString();

  // Fire scheduled event start/end Discord posts (idempotent via atomic flags). The per-minute
  // flush-notifications cron runs the same check; this is a backstop so posts don't lag.
  await processEventLifecycleNotifications();

  // ── Phase 1: assemble the member-keyed work list ──────────────────────────────────────────────
  const work = new Map<string, MemberWork>();
  const clanMemberIds = new Set<number>();
  const keyFor = (clanMemberId: number | null, rsn: string) =>
    clanMemberId != null ? `cm:${clanMemberId}` : `rsn:${normalizeRsn(rsn)}`;
  const olderOf = (a: string, b: string | null) => {
    const bn = b ?? '';
    return a === '' ? a : bn === '' ? bn : a < bn ? a : bn;
  };
  function ensureEntry(clanMemberId: number | null, provisionalRsn: string): MemberWork {
    const key = keyFor(clanMemberId, provisionalRsn);
    let entry = work.get(key);
    if (!entry) {
      entry = { key, clanMemberId, fetchRsn: provisionalRsn, liveMap: {}, bingo: [], weekly: [], staleKey: 'zzzz' };
      work.set(key, entry);
    }
    if (clanMemberId != null) clanMemberIds.add(clanMemberId);
    return entry;
  }

  // Bingo events → per-event ctx + per-player bingo tasks.
  const allEvents = await db.select().from(events);
  const activeEvents = allEvents.filter((e) => {
    if (e.forceEndedAt) return false;
    if (e.startDate && e.startDate > now) return false;
    if (e.endDate && e.endDate < now) return false;
    return true;
  });

  const ctxList: EventCtx[] = [];
  for (const event of activeEvents) {
    const eventPlayers = await db.query.players.findMany({ where: eq(players.eventId, event.id) });
    const eventTiles = await db.query.tiles.findMany({ where: eq(tiles.eventId, event.id) });
    // Skip tiles an admin flipped to manual (autoTrackDisabled) — never auto-credit those.
    const statTiles = eventTiles.filter((t) => t.trackedStat && t.statType && t.statGoal && !t.autoTrackDisabled);
    const hasStatTiles = statTiles.length > 0;
    const eventTeams = await db.query.teams.findMany({ where: eq(teams.eventId, event.id) });
    const eventTileIds = eventTiles.map((t) => t.id);
    const existingCompletions = eventTileIds.length
      ? await db.select().from(completions).where(inArray(completions.tileId, eventTileIds))
      : [];

    const ctx: EventCtx = {
      event,
      eventTiles,
      statTiles,
      teams: eventTeams,
      teamMap: new Map(eventTeams.map((t) => [t.id, t])),
      completionSet: new Set(existingCompletions.map((c) => `${c.teamId}-${c.tileId}`)),
      teamGains: new Map(),
      hasStatTiles,
      result: { eventId: event.id, eventName: event.name, playersChecked: 0, playersSnapshotted: 0, tilesCompleted: [], errors: [] },
    };
    ctxList.push(ctx);

    for (const player of eventPlayers) {
      if (!player.teamId) continue;
      const needsSnapshot = !player.statsSnapshot;
      // Fetch when the event has stat tiles (need current stats for gains) or the player still needs
      // a baseline. Events without stat tiles only snapshot missing baselines.
      if (!hasStatTiles && !needsSnapshot) continue;
      const entry = ensureEntry(player.clanMemberId, player.name);
      entry.bingo.push({ ctx, player, needsSnapshot });
      entry.staleKey = olderOf(entry.staleKey, player.lastStatsFetch);
    }
  }

  // Weekly comps → per-participant weekly tasks. Mirror the weekly cron's participant filter: skip
  // any whose clan_members.status isn't 'active' (renamed / banned), but keep null-clanMemberId rows.
  const activeComps = await db.query.weeklyCompetitions.findMany({ where: eq(weeklyCompetitions.status, 'active') });
  for (const comp of activeComps) {
    const participants = await db
      .select({
        id: weeklyParticipants.id,
        rsn: weeklyParticipants.rsn,
        baselineValue: weeklyParticipants.baselineValue,
        currentValue: weeklyParticipants.currentValue,
        lastUpdated: weeklyParticipants.lastUpdated,
        clanMemberId: weeklyParticipants.clanMemberId,
      })
      .from(weeklyParticipants)
      .leftJoin(clanMembers, eq(weeklyParticipants.clanMemberId, clanMembers.id))
      .where(
        and(
          eq(weeklyParticipants.competitionId, comp.id),
          or(isNull(weeklyParticipants.clanMemberId), eq(clanMembers.status, 'active')),
        ),
      )
      .orderBy(asc(weeklyParticipants.lastUpdated));

    for (const p of participants) {
      const entry = ensureEntry(p.clanMemberId, p.rsn);
      entry.weekly.push({ comp: { id: comp.id, type: comp.type as 'skill' | 'boss', metric: comp.metric }, participant: p });
      entry.staleKey = olderOf(entry.staleKey, p.lastUpdated);
    }
  }

  // Resolve the canonical fetch RSN + live overlay per linked member. Fetching by clan_members.rsn
  // (rename-synced) instead of players.name (a per-event display override) is what stops a mid-event
  // rename from 404-parking tracking.
  if (clanMemberIds.size > 0) {
    const members = await db
      .select({ id: clanMembers.id, rsn: clanMembers.rsn, liveStats: clanMembers.liveStats })
      .from(clanMembers)
      .where(inArray(clanMembers.id, Array.from(clanMemberIds)));
    const memberById = new Map(members.map((m) => [m.id, m]));
    for (const entry of work.values()) {
      if (entry.clanMemberId == null) continue;
      const m = memberById.get(entry.clanMemberId);
      if (m) {
        entry.fetchRsn = m.rsn;
        entry.liveMap = parsePluginStats(m.liveStats);
      }
    }
  }

  // ── Phase 2: fetch each member once, under a shared token bucket + wall-clock budget ────────────
  const queue = Array.from(work.values()).sort((a, b) => a.staleKey.localeCompare(b.staleKey));
  const fetchedBingo: FetchedBingo[] = [];
  const unrankedMemberIds = new Set<number>();
  let membersFetched = 0;
  let weeklyUpdated = 0;
  let fetchErrors = 0;

  let lastDispatch = 0;
  async function takeToken() {
    const wait = Math.max(0, PER_REQUEST_GAP_MS - (Date.now() - lastDispatch));
    if (wait > 0) await delay(wait);
    lastDispatch = Date.now();
  }

  const pending = [...queue];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (pending.length > 0) {
      if (Date.now() - start > TIME_BUDGET_MS) break; // budget hit — leave the rest for next tick
      const entry = pending.shift();
      if (!entry) break;
      await takeToken();
      const ts = new Date().toISOString();
      const result = await fetchSnapshotWithRetry(entry.fetchRsn);

      if (result.kind !== 'value') {
        fetchErrors++;
        // Terminal 404 → quarantine the member so the weekly cron's re-probe lifts them back later.
        if (result.kind === 'unranked' && entry.clanMemberId != null) unrankedMemberIds.add(entry.clanMemberId);
        // Advance weekly rows out of the queue head; leave their values untouched.
        for (const w of entry.weekly) {
          await db.update(weeklyParticipants).set({ lastUpdated: ts }).where(eq(weeklyParticipants.id, w.participant.id));
        }
        for (const b of entry.bingo) b.ctx.result.errors.push(`Failed to fetch stats for ${entry.fetchRsn}`);
        continue;
      }

      membersFetched++;
      const snapshot = result.snapshot;
      const snapshotJson = JSON.stringify(snapshot);

      // Reconcile the live overlay against fresh hiscores: drop keys hiscores caught up to. The kept
      // (still-ahead) map is BOTH what we persist and the live overlay for this tick's gains.
      let liveMap = entry.liveMap;
      if (entry.clanMemberId != null) {
        const { pruned, changed } = reconcileLive(entry.liveMap, snapshot);
        liveMap = pruned;
        if (changed) {
          await db
            .update(clanMembers)
            .set({ liveStats: Object.keys(pruned).length ? JSON.stringify(pruned) : null })
            .where(eq(clanMembers.id, entry.clanMemberId));
        }
      }

      // Bingo: write each player's cached (and, on first fetch, baseline) snapshot; hold for eval.
      for (const b of entry.bingo) {
        if (b.needsSnapshot) {
          await db
            .update(players)
            .set({ statsSnapshot: snapshotJson, snapshotAt: ts, cachedStats: snapshotJson, lastStatsFetch: ts })
            .where(eq(players.id, b.player.id));
          b.ctx.result.playersSnapshotted++;
          fetchedBingo.push({ ctx: b.ctx, player: b.player, baseline: snapshot, current: snapshot, liveMap });
        } else {
          await db.update(players).set({ cachedStats: snapshotJson, lastStatsFetch: ts }).where(eq(players.id, b.player.id));
          b.ctx.result.playersChecked++;
          let baseline: HiscoresSnapshot;
          try {
            baseline = JSON.parse(b.player.statsSnapshot!);
          } catch {
            b.ctx.result.errors.push(`Invalid snapshot for ${b.player.name}`);
            continue;
          }
          fetchedBingo.push({ ctx: b.ctx, player: b.player, baseline, current: snapshot, liveMap });
        }
      }

      // Weekly: extract each comp's metric from the one snapshot, fold in the live overlay, apply.
      for (const w of entry.weekly) {
        const m = readMetricFromSnapshot(snapshot, w.comp.type, w.comp.metric);
        if (m.kind !== 'value') {
          // Unknown boss key / bad read — leave the value, just advance the queue position.
          await db.update(weeklyParticipants).set({ lastUpdated: ts }).where(eq(weeklyParticipants.id, w.participant.id));
          continue;
        }
        // Effective = max(hiscores, live). On first capture this becomes the baseline, absorbing a
        // mid-session logout flush so the gain starts at 0.
        const value = effectiveValue(m.value, liveMap, w.comp.metric);
        const outcome = await applyWeeklyValue({
          participantId: w.participant.id,
          type: w.comp.type,
          metric: w.comp.metric,
          value,
          baselineValue: w.participant.baselineValue,
          currentValue: w.participant.currentValue,
          lastUpdated: w.participant.lastUpdated,
          allowFirstCapture: true,
          now: ts,
        });
        if (outcome.outcome === 'updated' || outcome.outcome === 'first-captured') weeklyUpdated++;
        // Competition-scoped snapshot (frozen baseline + per-tick current), bounded at 2 rows/member/comp.
        if (w.participant.clanMemberId != null) {
          await writePlayerSnapshot(w.participant.clanMemberId, w.comp.id, snapshot);
        }
      }
    }
  });
  await Promise.all(workers);
  const skipped = pending.length;

  // ── Phase 3: evaluate bingo completions in-memory (single-threaded — safe shared-state mutation) ─
  for (const f of fetchedBingo) {
    const ctx = f.ctx;
    if (!ctx.hasStatTiles || !f.player.teamId) continue;
    for (const tile of ctx.statTiles) {
      const key = `${f.player.teamId}-${tile.id}`;
      if (ctx.completionSet.has(key)) continue;
      const gained = computeGain(f.baseline, f.current, f.liveMap, statKeys(tile.trackedStat), tile.statType!);

      if (tile.trackingMode === 'individual') {
        if (gained >= tile.statGoal!) {
          // Notify only on a genuine insert (a live push may have completed it already).
          const inserted = await db
            .insert(completions)
            .values({ teamId: f.player.teamId, tileId: tile.id })
            .onConflictDoNothing()
            .returning({ id: completions.id });
          ctx.completionSet.add(key);
          if (inserted.length > 0) {
            const team = ctx.teamMap.get(f.player.teamId);
            ctx.result.tilesCompleted.push({ tileLabel: tile.label, teamName: team?.name || 'Unknown', playerName: f.player.name });
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
        }
      } else {
        ctx.teamGains.set(key, (ctx.teamGains.get(key) || 0) + gained);
      }
    }
  }

  // Team-mode completions + blackout win, from the accumulated gains.
  for (const ctx of ctxList) {
    if (ctx.hasStatTiles) {
      for (const tile of ctx.statTiles) {
        if (tile.trackingMode !== 'team') continue;
        for (const team of ctx.teams) {
          const key = `${team.id}-${tile.id}`;
          if (ctx.completionSet.has(key)) continue;
          if ((ctx.teamGains.get(key) || 0) >= tile.statGoal!) {
            const inserted = await db
              .insert(completions)
              .values({ teamId: team.id, tileId: tile.id })
              .onConflictDoNothing()
              .returning({ id: completions.id });
            ctx.completionSet.add(key);
            if (inserted.length > 0) {
              ctx.result.tilesCompleted.push({ tileLabel: tile.label, teamName: team.name, playerName: '(team total)' });
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
      }

      // Blackout: a team completing ALL required (non-optional) tiles.
      const requiredTileIds = new Set(ctx.eventTiles.filter((t) => !t.optional).map((t) => t.id));
      const totalRequiredTiles = requiredTileIds.size;
      for (const team of ctx.teams) {
        const teamCompletionCount = Array.from(ctx.completionSet).filter((key) => {
          if (!key.startsWith(`${team.id}-`)) return false;
          return requiredTileIds.has(parseInt(key.split('-')[1], 10));
        }).length;
        if (teamCompletionCount >= totalRequiredTiles && totalRequiredTiles > 0) {
          if (ctx.result.tilesCompleted.some((tc) => tc.teamName === team.name)) {
            notifyTeamWin({ eventName: ctx.event.name, teamName: team.name, teamColor: team.color, totalTiles: totalRequiredTiles }).catch(() => {});
          }
        }
      }
    }
  }

  // Apply unranked flips in one statement (don't churn status_last_checked mid-loop).
  if (unrankedMemberIds.size > 0) {
    await db
      .update(clanMembers)
      .set({ status: 'unranked', statusLastChecked: new Date().toISOString() })
      .where(inArray(clanMembers.id, Array.from(unrankedMemberIds)));
  }

  const durationMs = Date.now() - start;
  const results = ctxList.map((c) => c.result);
  log.info('stats-cron.tick', {
    activeEvents: activeEvents.length,
    activeComps: activeComps.length,
    membersQueued: queue.length,
    membersFetched,
    skipped,
    snapshotted: results.reduce((s, r) => s + r.playersSnapshotted, 0),
    checked: results.reduce((s, r) => s + r.playersChecked, 0),
    tilesCompleted: results.reduce((s, r) => s + r.tilesCompleted.length, 0),
    weeklyUpdated,
    markedUnranked: unrankedMemberIds.size,
    fetchErrors,
    durationMs,
  });

  return NextResponse.json({ success: true, timestamp: new Date().toISOString(), skipped, durationMs, results });
}
