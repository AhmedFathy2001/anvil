import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { eq, asc, and, or, isNull, lt } from 'drizzle-orm';
import {
  enrollAllPlayers,
  probeRsnReachable,
  reviewPendingRenames,
  computeLeaderboard,
} from '@/lib/weekly';
import { notifyWeeklyStart, notifyWeeklyResults } from '@/lib/discord';
import { log } from '@/lib/logger';
import { timingSafeStrEqual } from '@/lib/auth';
import { reconcileBrokerRegistration } from '@/lib/federation';
import { publicOrigin } from '@/lib/request-origin';

const CRON_SECRET = process.env.CRON_SECRET;

// Default Vercel function timeout (15 s on Pro, 10 s on Hobby) is well under what this
// loop needs. Bumped to the Pro cap; Hobby clips to 60 s automatically.
export const maxDuration = 300;

// Final, deduped standings for a competition (gains floored at 0), for the results announcement.
async function buildWeeklyStandings(competitionId: number): Promise<{ rsn: string; gained: number }[]> {
  const participants = await db
    .select({
      rsn: weeklyParticipants.rsn,
      baselineValue: weeklyParticipants.baselineValue,
      currentValue: weeklyParticipants.currentValue,
    })
    .from(weeklyParticipants)
    .where(eq(weeklyParticipants.competitionId, competitionId));
  // Dedupe by normalized RSN (rename/re-enroll can leave two rows), keeping the most progress.
  const byRsn = new Map<string, (typeof participants)[number]>();
  for (const p of participants) {
    const key = (p.rsn ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    const existing = byRsn.get(key);
    if (!existing || (p.currentValue ?? 0) > (existing.currentValue ?? 0)) byRsn.set(key, p);
  }
  return computeLeaderboard([...byRsn.values()]).map((e) => ({ rsn: e.rsn, gained: Math.max(0, e.gained) }));
}

// Weekly Discord posts are best-effort: a webhook failure must never break the cron sweep.
async function announceWeeklyStart(comp: { type: string; title: string; metric: string; endDate: string }) {
  try {
    await notifyWeeklyStart({ type: comp.type, title: comp.title, metric: comp.metric, endDate: comp.endDate });
  } catch (err) {
    log.warn('weekly-cron.notify-start-fail', {}, err);
  }
}

async function announceWeeklyResults(comp: { id: number; type: string; title: string; metric: string }) {
  try {
    const standings = await buildWeeklyStandings(comp.id);
    await notifyWeeklyResults({ type: comp.type, title: comp.title, metric: comp.metric, standings });
  } catch (err) {
    log.warn('weekly-cron.notify-results-fail', {}, err);
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
  const devBypass = !CRON_SECRET && request.headers.get('x-vercel-cron') === '1';
  if (!hasValidSecret && !devBypass) {
    log.warn('weekly-cron.unauthorized', {
      hasSecret: !!CRON_SECRET,
      hasAuthHeader: !!authHeader,
      hasVercelCronHeader: request.headers.get('x-vercel-cron') === '1',
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Piggy-backed on the lifecycle tick: make sure an instance that is federation-ON is actually
  // registered with the broker. Hosted clans are seeded federation-on at provision and so never save
  // the Federation tab — the only other thing that registers them. Near-free (two settings reads and
  // an early return) once connected; fire-and-forget so the broker can never stall the sweep.
  void reconcileBrokerRegistration(publicOrigin(request)).catch(() => {});

  const now = new Date().toISOString();

  // Update competition statuses based on dates
  const allComps = await db.select().from(weeklyCompetitions);

  for (const comp of allComps) {
    if (comp.status === 'upcoming' && comp.startDate <= now) {
      const newStatus = comp.endDate <= now ? 'completed' : 'active';
      await db.update(weeklyCompetitions)
        .set({ status: newStatus })
        .where(eq(weeklyCompetitions.id, comp.id));
      comp.status = newStatus;
      // The status flip happens exactly once, so these announcements fire exactly once.
      if (newStatus === 'active') {
        await announceWeeklyStart(comp);
      } else {
        await announceWeeklyResults(comp);
      }
    } else if (comp.status === 'active' && comp.endDate <= now) {
      await db.update(weeklyCompetitions)
        .set({ status: 'completed' })
        .where(eq(weeklyCompetitions.id, comp.id));
      comp.status = 'completed';
      await announceWeeklyResults(comp);
    }
  }

  // Process active competitions
  const activeComps = allComps.filter((c) => c.status === 'active');

  // Re-probe pass: lift previously-unranked clan members back to 'active' if their RSN
  // is reachable on hiscores again. We bound the batch tightly (10/tick) and only pick
  // rows whose status_last_checked is older than 6 h — that's enough to recover from
  // most rename-then-reappear flows within a day without burning hiscores quota.
  const REPROBE_BATCH = 10;
  const REPROBE_AGE_THRESHOLD = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const unrankedCandidates = await db
    .select({ id: clanMembers.id, rsn: clanMembers.rsn })
    .from(clanMembers)
    .where(
      and(
        eq(clanMembers.status, 'unranked'),
        or(isNull(clanMembers.statusLastChecked), lt(clanMembers.statusLastChecked, REPROBE_AGE_THRESHOLD)),
      ),
    )
    .orderBy(asc(clanMembers.statusLastChecked))
    .limit(REPROBE_BATCH);

  let revived = 0;
  for (const m of unrankedCandidates) {
    const probe = await probeRsnReachable(m.rsn);
    const nowIso = new Date().toISOString();
    if (probe === 'reachable') {
      await db.update(clanMembers)
        .set({ status: 'active', statusLastChecked: nowIso })
        .where(eq(clanMembers.id, m.id));
      revived++;
    } else if (probe === 'unranked') {
      // Still gone — just bump statusLastChecked so we don't keep retrying this same
      // batch every tick.
      await db.update(clanMembers)
        .set({ statusLastChecked: nowIso })
        .where(eq(clanMembers.id, m.id));
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

  // Pending-rename auto-reviewer. Cap at 5/tick — each row costs up to 2 hiscores
  // calls, so a batch of 5 ≈ 10 calls × 0.5 s = 5 s of work. Sits inside the same
  // function budget as the rest of the tick.
  let renameReview = { reviewed: 0, approved: 0, denied: 0, deferred: 0 };
  try {
    renameReview = await reviewPendingRenames(5);
  } catch (err) {
    log.warn('weekly-cron.rename-review-fail', undefined, err);
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
