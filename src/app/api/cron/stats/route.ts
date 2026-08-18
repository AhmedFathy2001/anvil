import { NextResponse } from 'next/server';
import { db } from '@/db';
import { eventParticipants, tiles, teams, completions, events, clanMembers, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { eq, and, or, inArray, isNull, asc } from 'drizzle-orm';
import { fetchSnapshotWithRetry, type HiscoresSnapshot } from '@/lib/hiscores';
import { notifyTileCompletion, notifyTeamWin } from '@/lib/discord';
import { processEventLifecycleNotifications } from '@/lib/eventLifecycle';
import { evaluateCompletionGate } from '@/lib/completionGate';
import { handleBountyClaim } from '@/lib/revealEngine';
import { log } from '@/lib/logger';
import { statKeys } from '@/lib/tileKinds';
import { parsePluginStats } from '@/lib/pluginStats';
import { computeGain, computeGainFromJson, effectiveValue, reconcileLive, pruneStaleOverlay, isIndividualMode, buildContributionSnapshot } from '@/lib/statTracking';
import { parseStatKeyTimes } from '@/lib/liveStats';
import { readAllActivities } from '@/lib/hiscoresActivities';

// A live-overlay entry not refreshed within this window is stale: OSRS force-logs-out at ~6h, so
// hiscores must reflect real XP/KC by then. Anything the overlay still holds above hiscores past this
// is a bogus/doubled push — drop it and trust hiscores. Slightly over 6h so a full-length session's
// last push isn't clipped early.
const STALE_OVERLAY_MS = 6.5 * 60 * 60 * 1000;
import { applyWeeklyValue, readMetricFromSnapshot, writePlayerSnapshot, type CompetitionType } from '@/lib/weekly';
import { detectMilestones, computeDeltas, isDue, nextDueAt, recordDailyStats, recordMilestones } from '@/lib/statHistory';
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
type PlayerRow = typeof eventParticipants.$inferSelect;
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
  // Per-member team-mode gains, keyed `${teamId}-${tileId}` → the raw contributors. Kept alongside
  // teamGains (the running sum) so that when a team-mode stat tile crosses its goal we can freeze the
  // exact per-member split onto completions.statContributions instead of only the total.
  teamMemberGains: Map<string, { playerId: number; gained: number }[]>;
  // Benched (sub-out) players on a team: their gain is pinned to frozenStats and never re-fetched, but
  // it still counts toward team-mode tiles, so we seed it into teamGains/teamMemberGains each run.
  frozenPlayers: { id: number; teamId: number; baselineJson: string | null; frozenStats: string | null }[];
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
  comp: { id: number; type: CompetitionType; metric: string; startDate: string };
  participant: { id: number; baselineValue: number | null; currentValue: number | null; lastUpdated: string | null; clanMemberId: number | null };
}

// One clan member's whole workload for this sweep — a single hiscores fetch, fanned out.
interface MemberWork {
  key: string;
  clanMemberId: number | null;
  fetchRsn: string;
  liveMap: Record<string, number>;
  liveKeyTimes: Record<string, string>; // key -> last-rose ISO, for the stale-overlay prune
  bingo: BingoTask[];
  weekly: WeeklyTask[];
  staleKey: string; // oldest task timestamp — drives oldest-first ordering
  // Adaptive polling state (lib/statHistory.ts). A member who keeps coming back unchanged is fetched
  // less and less often, up to a two-hour floor; anything that proves they're playing resets it.
  missStreak: number;
  nextDueAt: string | null;
  lastSnapshot: string | null;
  /** Whether the member already has a derived activity blob — false means backfill it this tick. */
  hasActivities: boolean;
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
      entry = {
        key,
        clanMemberId,
        fetchRsn: provisionalRsn,
        liveMap: {},
        liveKeyTimes: {},
        bingo: [],
        weekly: [],
        staleKey: 'zzzz',
        missStreak: 0,
        nextDueAt: null,
        lastSnapshot: null,
        hasActivities: false,
      };
      work.set(key, entry);
    }
    if (clanMemberId != null) clanMemberIds.add(clanMemberId);
    return entry;
  }

  // Bingo events → per-event ctx + per-player bingo tasks.
  // clan-scope: global -- the stats sweep runs across every clan; that is what a cron tick IS.
  // Each event carries its own clanId, which is what the per-event work below scopes on.
  const allEvents = await db.select().from(events);
  const activeEvents = allEvents.filter((e) => {
    if (e.forceEndedAt) return false;
    if (e.startDate && e.startDate > now) return false;
    if (e.endDate && e.endDate < now) return false;
    return true;
  });

  const ctxList: EventCtx[] = [];
  for (const event of activeEvents) {
    const eventPlayers = await db.query.eventParticipants.findMany({ where: eq(eventParticipants.eventId, event.id) });
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
      teamMemberGains: new Map(),
      frozenPlayers: eventPlayers
        .filter((p) => p.teamId != null && p.frozenAt)
        .map((p) => ({ id: p.id, teamId: p.teamId!, baselineJson: p.statsSnapshot, frozenStats: p.frozenStats })),
      hasStatTiles,
      result: { eventId: event.id, eventName: event.name, playersChecked: 0, playersSnapshotted: 0, tilesCompleted: [], errors: [] },
    };
    ctxList.push(ctx);

    for (const player of eventPlayers) {
      if (!player.teamId) continue;
      // Benched players are pinned to frozenStats — don't re-fetch them (that would unfreeze the gain).
      // Their contribution is seeded into team-mode sums from ctx.frozenPlayers in the finalize loop.
      if (player.frozenAt) continue;
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
      entry.weekly.push({ comp: { id: comp.id, type: comp.type as CompetitionType, metric: comp.metric, startDate: comp.startDate }, participant: p });
      entry.staleKey = olderOf(entry.staleKey, p.lastUpdated);
    }
  }

  // Resolve the canonical fetch RSN + live overlay per linked member. Fetching by clan_members.rsn
  // (rename-synced) instead of eventParticipants.name (a per-event display override) is what stops a mid-event
  // rename from 404-parking tracking.
  if (clanMemberIds.size > 0) {
    const members = await db
      .select({
        id: clanMembers.id,
        rsn: clanMembers.rsn,
        liveStats: clanMembers.liveStats,
        liveStatKeyTimes: clanMembers.liveStatKeyTimes,
        statsMissStreak: clanMembers.statsMissStreak,
        statsNextDueAt: clanMembers.statsNextDueAt,
        statsLastSnapshot: clanMembers.statsLastSnapshot,
        statsActivities: clanMembers.statsActivities,
      })
      .from(clanMembers)
      .where(inArray(clanMembers.id, Array.from(clanMemberIds)));
    const memberById = new Map(members.map((m) => [m.id, m]));
    for (const entry of work.values()) {
      if (entry.clanMemberId == null) continue;
      const m = memberById.get(entry.clanMemberId);
      if (m) {
        entry.fetchRsn = m.rsn;
        entry.liveMap = parsePluginStats(m.liveStats);
        entry.liveKeyTimes = parseStatKeyTimes(m.liveStatKeyTimes);
        entry.missStreak = m.statsMissStreak ?? 0;
        entry.nextDueAt = m.statsNextDueAt;
        entry.lastSnapshot = m.statsLastSnapshot;
        entry.hasActivities = m.statsActivities != null;
        // A plugin push means they're logged in RIGHT NOW, which is the strongest "worth fetching"
        // signal we get — it overrides any backoff the ladder had built up while they were away.
        if (Object.keys(entry.liveMap).length > 0) entry.nextDueAt = null;
      }
    }
  }

  // ── Phase 2: fetch each member once, under a shared token bucket + wall-clock budget ────────────
  // Only fetch members who could plausibly have changed. A member still missing a baseline is always
  // due — their tile or comp row can't score without one — but an idle member who has come back
  // unchanged several ticks running is deferred (lib/statHistory.ts). This is the difference between
  // polling a 200-member clan ~19k times a day and ~4k, and it compounds with every clan on the box,
  // since all of them share one IP as far as Jagex is concerned.
  const nowDate = new Date();
  const allWork = Array.from(work.values());
  const queue = allWork
    .filter((entry) => {
      const needsBaseline =
        entry.bingo.some((b) => b.needsSnapshot) || entry.weekly.some((w) => w.participant.baselineValue === null);
      return needsBaseline || isDue(entry.nextDueAt, nowDate);
    })
    .sort((a, b) => a.staleKey.localeCompare(b.staleKey));
  const deferred = allWork.length - queue.length;
  const fetchedBingo: FetchedBingo[] = [];
  const unrankedMemberIds = new Set<number>();
  let membersFetched = 0;
  let weeklyUpdated = 0;
  let fetchErrors = 0;
  let historyWrites = 0;
  let milestonesRecorded = 0;

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
        // 1) Drop keys hiscores has caught up to (h >= v). 2) Drop keys not refreshed within ~6h —
        // the OSRS-logout backstop that heals a bogus push stuck ABOVE hiscores (which step 1 can't).
        const rec = reconcileLive(entry.liveMap, snapshot);
        const stale = pruneStaleOverlay(rec.pruned, entry.liveKeyTimes, Date.parse(ts), STALE_OVERLAY_MS);
        liveMap = stale.pruned;
        if (rec.changed || stale.changed) {
          await db
            .update(clanMembers)
            .set({ liveStats: Object.keys(liveMap).length ? JSON.stringify(liveMap) : null })
            .where(eq(clanMembers.id, entry.clanMemberId));
        }
      }

      // ── History + adaptive polling ────────────────────────────────────────────────────────────
      // Everything below is derived from the snapshot we already have — no extra hiscores traffic.
      if (entry.clanMemberId != null) {
        let previous: HiscoresSnapshot | null = null;
        if (entry.lastSnapshot) {
          try {
            previous = JSON.parse(entry.lastSnapshot) as HiscoresSnapshot;
          } catch {
            previous = null; // corrupt blob — treat as a first sighting rather than failing the tick
          }
        }
        const overallXp = Math.max(0, snapshot.skills?.overall?.xp ?? 0);
        const changed = previous === null || overallXp !== Math.max(0, previous.skills?.overall?.xp ?? 0);
        const missStreak = changed ? 0 : entry.missStreak + 1;

        // The compact activity map the member directory reads instead of parsing full snapshots.
        // Written whenever the snapshot is, plus once for a member who predates the column — without
        // that backfill an idle account would sit missing from the clan leaderboards until the day
        // it happened to gain XP, which for some members is never.
        const writeActivities = changed || !entry.hasActivities;

        await db
          .update(clanMembers)
          .set({
            statsOverallXp: overallXp,
            statsMissStreak: missStreak,
            statsNextDueAt: nextDueAt(missStreak, new Date()),
            // Only rewrite the blob when it would differ — an idle member's row stays untouched.
            ...(changed ? { statsLastSnapshot: snapshotJson } : {}),
            ...(writeActivities ? { statsActivities: JSON.stringify(readAllActivities(snapshot)) } : {}),
          })
          .where(eq(clanMembers.id, entry.clanMemberId));
        if (writeActivities) entry.hasActivities = true;

        if (changed) {
          historyWrites++;
          try {
            await recordDailyStats({ clanMemberId: entry.clanMemberId, snapshot, previous });
            const found = detectMilestones(previous, snapshot, computeDeltas(previous, snapshot));
            if (found.length > 0) milestonesRecorded += await recordMilestones(entry.clanMemberId, found);
          } catch (e) {
            // History is a reporting nicety; a failure here must never cost the tick its scoring work.
            log.warn('stats-cron.history-failed', { clanMemberId: entry.clanMemberId, error: (e as Error).message });
          }
        }
      }

      // Bingo: write each player's cached (and, on first fetch, baseline) snapshot; hold for eval.
      for (const b of entry.bingo) {
        if (b.needsSnapshot) {
          await db
            .update(eventParticipants)
            .set({ statsSnapshot: snapshotJson, snapshotAt: ts, cachedStats: snapshotJson, lastStatsFetch: ts })
            .where(eq(eventParticipants.id, b.player.id));
          b.ctx.result.playersSnapshotted++;
          fetchedBingo.push({ ctx: b.ctx, player: b.player, baseline: snapshot, current: snapshot, liveMap });
        } else {
          await db.update(eventParticipants).set({ cachedStats: snapshotJson, lastStatsFetch: ts }).where(eq(eventParticipants.id, b.player.id));
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
          competitionStartIso: w.comp.startDate,
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

      if (isIndividualMode(tile.trackingMode)) {
        if (gained >= tile.statGoal!) {
          // Event-rules gate: unrevealed/claimed tiles and lockout losses never auto-credit from
          // the sweep; the gain keeps accruing and credits if/when the tile opens up.
          const gate = await evaluateCompletionGate({ event: ctx.event, tile, teamId: f.player.teamId });
          if (!gate.allowed) continue;
          // Notify only on a genuine insert (a live push may have completed it already).
          const inserted = await db
            .insert(completions)
            // Individual stat tile → attribute to the player who reached the goal (no submission exists
            // for a hiscores-driven completion, so this is how the activity feed says who finished it).
            // The finisher hit the goal alone, so the frozen split is 100% theirs.
            .values({
              teamId: f.player.teamId,
              tileId: tile.id,
              creditPlayerId: f.player.id,
              statContributions: JSON.stringify(
                buildContributionSnapshot(tile.statGoal!, [{ playerId: f.player.id, gained }]),
              ),
              awardedPoints: gate.awardedPoints,
            })
            .onConflictDoNothing()
            .returning({ id: completions.id });
          ctx.completionSet.add(key);
          if (inserted.length > 0) {
            if (gate.bounty) handleBountyClaim(ctx.event.id, tile.id).catch(() => {});
            const team = ctx.teamMap.get(f.player.teamId);
            ctx.result.tilesCompleted.push({ tileLabel: tile.label, teamName: team?.name || 'Unknown', playerName: f.player.name });
            if (team) {
              notifyTileCompletion({
                clanId: ctx.event.clanId,
                eventName: ctx.event.name,
                tileLabel: tile.label,
                teamName: team.name,
                teamColor: team.color,
                tileType: tile.tileType,
                trackedStat: tile.trackedStat,
                statType: tile.statType,
                eventId: ctx.event.id,
                tile,
              }).catch(() => {});
            }
          }
        }
      } else {
        ctx.teamGains.set(key, (ctx.teamGains.get(key) || 0) + gained);
        if (gained > 0) {
          const members = ctx.teamMemberGains.get(key) ?? [];
          members.push({ playerId: f.player.id, gained });
          ctx.teamMemberGains.set(key, members);
        }
      }
    }
  }

  // Team-mode completions + blackout win, from the accumulated gains.
  for (const ctx of ctxList) {
    if (ctx.hasStatTiles) {
      for (const tile of ctx.statTiles) {
        if (isIndividualMode(tile.trackingMode)) continue;
        const keys = statKeys(tile.trackedStat);
        // Seed benched players' frozen gains into this run's team sums (they aren't fetched, so phase 3
        // never counted them). Their locked contribution keeps counting toward the goal + the split.
        for (const fp of ctx.frozenPlayers) {
          const gained = computeGainFromJson(fp.baselineJson, fp.frozenStats, {}, keys, tile.statType!);
          if (gained <= 0) continue;
          const key = `${fp.teamId}-${tile.id}`;
          ctx.teamGains.set(key, (ctx.teamGains.get(key) || 0) + gained);
          const members = ctx.teamMemberGains.get(key) ?? [];
          members.push({ playerId: fp.id, gained });
          ctx.teamMemberGains.set(key, members);
        }
        for (const team of ctx.teams) {
          const key = `${team.id}-${tile.id}`;
          if (ctx.completionSet.has(key)) continue;
          if ((ctx.teamGains.get(key) || 0) >= tile.statGoal!) {
            // Event-rules gate: same as the individual path above.
            const gate = await evaluateCompletionGate({ event: ctx.event, tile, teamId: team.id });
            if (!gate.allowed) continue;
            const inserted = await db
              .insert(completions)
              // Freeze the per-member split as of this tick so the "who got what %" can't drift as the
              // team's underlying KC/XP keeps climbing after the tile is done.
              .values({
                teamId: team.id,
                tileId: tile.id,
                statContributions: JSON.stringify(
                  buildContributionSnapshot(tile.statGoal!, ctx.teamMemberGains.get(key) ?? []),
                ),
                awardedPoints: gate.awardedPoints,
              })
              .onConflictDoNothing()
              .returning({ id: completions.id });
            ctx.completionSet.add(key);
            if (inserted.length > 0) {
              if (gate.bounty) handleBountyClaim(ctx.event.id, tile.id).catch(() => {});
              ctx.result.tilesCompleted.push({ tileLabel: tile.label, teamName: team.name, playerName: '(team total)' });
              notifyTileCompletion({
                clanId: ctx.event.clanId,
                eventName: ctx.event.name,
                tileLabel: tile.label,
                teamName: team.name,
                teamColor: team.color,
                tileType: tile.tileType,
                trackedStat: tile.trackedStat,
                statType: tile.statType,
                eventId: ctx.event.id,
                tile,
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
            notifyTeamWin({ clanId: ctx.event.clanId, eventName: ctx.event.name, teamName: team.name, teamColor: team.color, totalTiles: totalRequiredTiles, eventId: ctx.event.id }).catch(() => {});
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
    // How many the backoff ladder held back this tick — the number to watch when tuning it.
    membersDeferred: deferred,
    membersFetched,
    historyWrites,
    milestonesRecorded,
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
