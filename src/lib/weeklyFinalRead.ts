// The last look at the hiscores before a competition's results are posted.
//
// The stats sweep reads each participant about every 15 minutes, and Jagex only publishes a
// player's numbers when they log out. Somebody who logged out five minutes before the end had
// their last kills on the hiscores but not on the board, and the results and prizes went out
// from the board: RS Universe's BOTW (2026-11-23) paid 1st to the player who finished 2nd.
//
// So finishing a competition reads every participant once more, right at the end, through the
// same applyWeeklyValue the sweep uses (monotonic, negative-gain guard, spike flag). Anyone still
// logged in at the end has nothing new on the hiscores yet, which is the same for everybody.

import { and, eq, isNull, or } from 'drizzle-orm';

import { db } from '@/db';
import { clanRoster, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { countsWorld } from '@/lib/competitionGame';
import { log } from '@/lib/logger';
import { applyWeeklyValue, fetchParticipantStat } from '@/lib/weekly';
import { competitionStat, effectiveMetricParts } from '@/lib/weeklyMetric';
import { liveAtEnd, takeLateRead } from '@/lib/finalReadGate';
import { parseStatKeyTimes } from '@/lib/liveStats';
import { parsePluginStats } from '@/lib/pluginStats';
import { metricKeys } from '@/lib/constants';

type Comp = typeof weeklyCompetitions.$inferSelect;

/** The sweep's own pacing (lib/statsSweep): the Jagex budget is shared by every clan on the box. */
const CONCURRENCY = 3;
const PER_REQUEST_GAP_MS = 400;

/** One shared clock per process, so several competitions finishing in one tick share a budget. */
let budgetEndsAt = 0;
/** Total time the final reads in one cron tick may take; whatever is left keeps its last value. */
export const FINAL_READ_BUDGET_MS = 240_000;

/** Start a fresh budget: the weekly cron calls this once per tick, before finishing anything. */
export function startFinalReadBudget(now = Date.now()): void {
  budgetEndsAt = now + FINAL_READ_BUDGET_MS;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface FinalReadResult {
  read: number;
  updated: number;
  skipped: number;
  /** Entrants still not read after the end (a transient failure, or the budget ran out). */
  remaining: number;
  /** Their names, for the "not read" note once the wait runs out. */
  unread: string[];
}

export { FINAL_READ_WAIT_MS } from '@/lib/finalReadGate';

/**
 * Read every participant's hiscores once and apply it. Never throws: a failed read leaves that
 * player's last value, and the finish goes ahead either way.
 */
export async function finalHiscoresRead(
  comp: Comp,
  /** Tests pass a fake; everything else reads Jagex. */
  fetchStat: typeof fetchParticipantStat = fetchParticipantStat,
): Promise<FinalReadResult> {
  const out: FinalReadResult = { read: 0, updated: 0, skipped: 0, remaining: 0, unread: [] };
  // An item hunt with no stat beside its drops reads nothing; a mode-only competition is scored
  // off its own table (lib/weeklyModeScores), not the main game's.
  // An item hunt places by its drops, so the stat beside them can't move a result.
  // An item hunt reads the stat it shows beside its drops (a Boss Rush scores its kills off it);
  // one with no stat reads nothing (competitionStat is null).
  const stat = competitionStat(comp);
  if (!stat || !countsWorld(comp.countsOn, null)) return out;
  // A process where the cron never started a budget: give this one its own. A budget the cron
  // started and this tick already spent is NOT renewed — that is the point of sharing it.
  if (budgetEndsAt === 0) startFinalReadBudget();

  try {
    // The sweep's filter: active seats (or none), not opted out, read from the main table, still going.
    // clan-scope: global -- one competition by id; its clan is settled by the caller.
    const participants = await db
      .select({
        id: weeklyParticipants.id,
        rsn: weeklyParticipants.rsn,
        baselineValue: weeklyParticipants.baselineValue,
        currentValue: weeklyParticipants.currentValue,
        lastUpdated: weeklyParticipants.lastUpdated,
        live: clanRoster.liveStats,
        liveKeyTimes: clanRoster.liveStatKeyTimes,
      })
      .from(weeklyParticipants)
      .leftJoin(clanRoster, eq(weeklyParticipants.clanMemberId, clanRoster.id))
      .where(
        and(
          eq(weeklyParticipants.competitionId, comp.id),
          or(isNull(weeklyParticipants.clanMemberId), eq(clanRoster.status, 'active')),
          eq(weeklyParticipants.optedOut, false),
          isNull(weeklyParticipants.hiscoresTable),
          isNull(weeklyParticipants.stoppedAt),
          // Read once after the end; a retry next tick picks up only who is left.
          isNull(weeklyParticipants.finalReadAt),
        ),
      );

    const pending = [...participants];
    const left = new Map(participants.map((p) => [p.id, p.rsn]));
    // Read AFTER the end only: a tick that lands before it (staff ending early sets the end to now)
    // still counts, a read from before the end never does.
    const markRead = (id: number) => {
      left.delete(id);
      return db.update(weeklyParticipants).set({ finalReadAt: new Date().toISOString() }).where(eq(weeklyParticipants.id, id));
    };
    let lastDispatch = 0;
    const takeToken = async () => {
      const wait = Math.max(0, PER_REQUEST_GAP_MS - (Date.now() - lastDispatch));
      lastDispatch = Date.now() + wait;
      if (wait > 0) await delay(wait);
    };

    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        while (pending.length > 0) {
          if (Date.now() > budgetEndsAt) {
            out.skipped += pending.length;
            pending.length = 0;
            break;
          }
          const p = pending.shift();
          if (!p) break;
          await takeToken();
          try {
            const res = await fetchStat(p.rsn, stat.type, stat.metric);
            out.read++;
            // Not on the hiscores at all is an answer too; a timeout is not, and is tried again.
            if (res.kind === 'unranked') await markRead(p.id);
            if (res.kind !== 'value') continue;
            // A read well after the end (the budget, a retry) may carry play after it: when the plugin
            // pushed this stat before the end, that standing (already in currentValue) is kept instead.
            const endMs = Date.parse(comp.endDate);
            const lagMs = Date.now() - endMs;
            const keys = metricKeys(stat.metric);
            // The plugin push stops moving a competition at its end date (getActiveWeeklyMetrics), so
            // currentValue already holds the pre-end standing; a key that rose after the end shows the
            // late read carries play after it.
            const at = liveAtEnd(parsePluginStats(p.live), parseStatKeyTimes(p.liveKeyTimes), endMs);
            if (!takeLateRead(lagMs, keys.some((k) => k in at.atEnd), keys.some((k) => at.rose.includes(k)))) {
              log.info('weekly.final-read-late', { competitionId: comp.id, rsn: p.rsn, lagMs });
              await markRead(p.id);
              continue;
            }
            const applied = await applyWeeklyValue({
              participantId: p.id,
              hunt: comp.type === 'hunt',
              // The split per boss too: a rush checks its plugin kills target by target (lib/bossRushRules).
              parts: 'snapshot' in res && res.snapshot ? effectiveMetricParts(res.snapshot, stat.type, stat.metric, {}) ?? undefined : undefined,
              hiscoresParts: 'snapshot' in res && res.snapshot ? effectiveMetricParts(res.snapshot, stat.type, stat.metric, {}) : null,
              type: stat.type,
              metric: stat.metric,
              value: res.value,
              baselineValue: p.baselineValue,
              currentValue: p.currentValue,
              lastUpdated: p.lastUpdated,
              // A player never read during the whole competition has no start to measure from;
              // the end is the wrong moment to invent one.
              allowFirstCapture: false,
              competitionStartIso: comp.startDate,
            });
            if (applied.outcome === 'updated') out.updated++;
            await markRead(p.id);
          } catch (err) {
            log.warn('weekly.final-read-row-fail', { competitionId: comp.id, rsn: p.rsn }, err);
          }
        }
      }),
    );
    out.remaining = left.size;
    out.unread = [...left.values()];
  } catch (err) {
    log.warn('weekly.final-read-fail', { competitionId: comp.id }, err);
    // Unknown how far it got: count it as not done, so the results keep waiting (up to the cap).
    out.remaining = Math.max(out.remaining, 1);
  }
  log.info('weekly.final-read', { competitionId: comp.id, read: out.read, updated: out.updated, skipped: out.skipped, remaining: out.remaining });
  return out;
}
