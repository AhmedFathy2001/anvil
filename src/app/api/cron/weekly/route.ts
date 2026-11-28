import { weeklyBoard } from '@/lib/rankMoves';
import { NextResponse } from 'next/server';
import { settleWeeklyPrizes } from '@/lib/weeklyPrizeSettle';
import { finishCompetition, settleFinished } from '@/lib/weeklyFinish';
import { startFinalReadBudget } from '@/lib/weeklyFinalRead';
import { updateAccountOfSeat } from '@/lib/roster';
import { db } from '@/db';
import { clanRoster, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { eq, asc, and, or, isNull, lt } from 'drizzle-orm';
import {
  enrollAllPlayers,
  probeRsnForAccount,
} from '@/lib/weekly';
import { announceCompetitionStart, announceHalfwayIfDue } from '@/lib/competitionTeamsPosts';
import { log } from '@/lib/logger';
import { timingSafeStrEqual } from '@/lib/auth';
import { rollWeeklySeries } from '@/lib/weeklyRepeat';

const CRON_SECRET = process.env.CRON_SECRET;

// Default Vercel function timeout (15 s on Pro, 10 s on Hobby) is well under what this
// loop needs. Bumped to the Pro cap; Hobby clips to 60 s automatically.
export const maxDuration = 300;

// Weekly Discord posts are best-effort: a webhook failure must never break the cron sweep.
// Team / clan-vs-clan competitions carry their group standings, and clan vs clan posts to every
// racing clan (lib/competitionTeamsPosts).
async function announceWeeklyStart(comp: typeof weeklyCompetitions.$inferSelect) {
  try {
    await announceCompetitionStart(comp);
  } catch (err) {
    log.warn('weekly-cron.notify-start-fail', {}, err);
  }
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production' && !CRON_SECRET) {
    log.error('weekly-cron.misconfigured', { reason: 'CRON_SECRET env var is unset in production' });
    return NextResponse.json(
      { error: 'Server misconfigured: CRON_SECRET is required in production' },
      { status: 500 },
    );
  }
  const authHeader = request.headers.get('authorization');
  const hasValidSecret = !!CRON_SECRET && timingSafeStrEqual(authHeader ?? '', `Bearer ${CRON_SECRET}`);
  // Local dev only. In production a missing secret is a 500 above, never an open door.
  const devBypass = process.env.NODE_ENV !== 'production' && !CRON_SECRET && request.headers.get('x-vercel-cron') === '1';
  if (!hasValidSecret && !devBypass) {
    log.warn('weekly-cron.unauthorized', {
      hasSecret: !!CRON_SECRET,
      hasAuthHeader: !!authHeader,
      hasVercelCronHeader: request.headers.get('x-vercel-cron') === '1',
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();
  // Every competition finishing this tick reads its players once more first; they share one budget.
  startFinalReadBudget();

  // Update competition statuses based on dates
  // clan-scope: global -- the lifecycle tick flips statuses for every clan's competitions.
  const allComps = await db.select().from(weeklyCompetitions);

  for (const comp of allComps) {
    if (comp.status === 'upcoming' && comp.startDate <= now) {
      if (comp.endDate <= now) {
        // Finished before it was ever marked active: results and prizes through the one finish
        // (lib/weeklyFinish), which claims it so nothing else can post it too.
        await finishCompetition(comp.id);
        comp.status = 'completed';
        continue;
      }
      await db.update(weeklyCompetitions)
        .set({ status: 'active' })
        .where(eq(weeklyCompetitions.id, comp.id));
      comp.status = 'active';
      // The status flip happens exactly once, so the announcement fires exactly once.
      await announceWeeklyStart(comp);
    } else if (comp.status === 'active' && comp.endDate <= now) {
      // Results, then prizes, exactly once: the same finish an item hunt's N-drop ending and the
      // "End now and post results" button go through (lib/weeklyFinish).
      await finishCompetition(comp.id);
      comp.status = 'completed';
    }
  }

  // Halfway post, once each: the groups for team / clan-vs-clan competitions, the players for solo ones.
  for (const comp of allComps) {
    if (comp.status !== 'active') continue;
    try {
      await announceHalfwayIfDue(comp, Date.now(), () => weeklyBoard(comp.id));
    } catch (err) {
      log.warn('weekly-cron.notify-halfway-fail', { competitionId: comp.id }, err);
    }
  }

  // Anything that finished while nobody was settling — a competition completed before prizes
  // existed, or a tick that died between the status flip and the payout. Cheap: the stamp means
  // each one is looked at once, ever.
  // Finished but still waiting on after-the-end reads (lib/weeklyFinish settleFinished): read who is
  // left and post once everyone is in, or the 2-hour wait is over. Claimed this tick above or earlier.
  for (const comp of allComps) {
    if (comp.status === 'completed' && !comp.resultsPostedAt) {
      // Re-read: finishing above may have just posted it.
      // clan-scope: global -- one competition by id, from the list this tick walks.
      const fresh = await db.query.weeklyCompetitions.findFirst({ where: eq(weeklyCompetitions.id, comp.id) });
      if (fresh && !fresh.resultsPostedAt) await settleFinished(fresh);
    }
  }
  for (const comp of allComps) {
    // Never before the results are posted: a prize follows a standing everybody has been shown.
    if (comp.status === 'completed' && !comp.prizesSettledAt && comp.resultsPostedAt) {
      await settleWeeklyPrizes(comp.id);
    }
  }

  // Repeating competitions: each finished one that repeats starts its successor now (lib/weeklyRepeat).
  // After the settle pass, so the results and prizes of the old week land before the new week opens.
  const rolled = await rollWeeklySeries();
  if (rolled > 0) log.info('weekly-cron.repeat', { started: rolled });

  // Process active competitions
  const activeComps = allComps.filter((c) => c.status === 'active');

  // Re-probe pass: lift previously-unranked clan members back to 'active' if their RSN
  // is reachable on hiscores again. We bound the batch tightly (10/tick) and only pick
  // rows whose status_last_checked is older than 6 h — that's enough to recover from
  // most rename-then-reappear flows within a day without burning hiscores quota.
  const REPROBE_BATCH = 10;
  const REPROBE_AGE_THRESHOLD = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  // clan-scope: global -- the sweep runs across every clan by design; that is what a platform-wide cron is.
  const unrankedCandidates = await db
    .select({ id: clanRoster.id, rsn: clanRoster.rsn, lastXp: clanRoster.statsOverallXp })
    .from(clanRoster)
    .where(
      and(
        eq(clanRoster.status, 'unranked'),
        or(isNull(clanRoster.statusLastChecked), lt(clanRoster.statusLastChecked, REPROBE_AGE_THRESHOLD)),
      ),
    )
    .orderBy(asc(clanRoster.statusLastChecked))
    .limit(REPROBE_BATCH);

  let revived = 0;
  for (const m of unrankedCandidates) {
    // 'different' = the name answers, but for a smaller account: a stranger took it. Stay parked.
    const probe = await probeRsnForAccount(m.rsn, m.lastXp ?? null);
    const nowIso = new Date().toISOString();
    if (probe === 'reachable') {
      await updateAccountOfSeat(m.id, { status: 'active', statusLastChecked: nowIso });
      revived++;
    } else if (probe === 'unranked' || probe === 'different') {
      // Still gone — just bump statusLastChecked so we don't keep retrying this same
      // batch every tick.
      await updateAccountOfSeat(m.id, { statusLastChecked: nowIso });
    }
    // transient → leave statusLastChecked alone so this row stays at the head of the
    // next tick's eligible queue, but the rate-limit budget has already moved on.
  }

  // Catch-up enrollment: members added to the clan roster after a comp was created
  // (or new members synced while a comp is running) are not in weekly_participants
  // unless we re-run enrollment. enrollAllPlayers is idempotent (onConflictDoNothing)
  // so this is safe to run every tick. New rows land with baselineValue=null and are
  // picked up first by the queue sort below.
  let enrolledThisTick = 0;
  for (const comp of activeComps) {
    try {
      enrolledThisTick += await enrollAllPlayers(comp.id);
    } catch (err) {
      log.warn('weekly-cron.enroll-fail', { competitionId: comp.id }, err);
    }
  }

  // Renames the in-game roster split into "X left, Y joined": confident pairs (same rank, matching
  // XP, one partner each) are healed onto the real character within one tick — the event entry and
  // baseline stay, the roster seat follows the new name (lib/renameDetection). Anything it cannot
  // apply goes to Anvil staff. Capped hiscores lookups keep it inside the tick's budget.
  let renameReview = { clans: 0, applied: 0, raised: 0 };
  try {
    const { applyConfidentRenames } = await import('@/lib/renameDetection');
    renameReview = await applyConfidentRenames({ lookbackDays: 2, maxClans: 25, liveFetchCap: 4 });
  } catch (err) {
    log.warn('weekly-cron.rename-heal-fail', undefined, err);
  }

  log.info('weekly-cron.tick', {
    totalComps: allComps.length,
    activeComps: activeComps.length,
    newlyEnrolled: enrolledThisTick,
    reprobedUnranked: unrankedCandidates.length,
    revivedToActive: revived,
    renameReview,
  });

  // NOTE: participant stat fetching lives in the unified /api/cron/stats sweep now — it fetches each
  // clan member's hiscores ONCE and fans the snapshot out to bingo tiles AND weekly participants.
  // This route owns only the competition LIFECYCLE above (status flips + announcements, re-probe,
  // catch-up enrollment, rename review).

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    activeCompetitions: activeComps.length,
    newlyEnrolled: enrolledThisTick,
    reprobedUnranked: unrankedCandidates.length,
    revivedToActive: revived,
    renameReview,
  });
}
