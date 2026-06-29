import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { eq, asc, and, or, isNull, inArray, lt } from 'drizzle-orm';
import {
  enrollAllPlayers,
  fetchParticipantStat,
  probeRsnReachable,
  reviewPendingRenames,
  writePlayerSnapshot,
  computeLeaderboard,
} from '@/lib/weekly';
import { checkRateSpike, describeRateSpike } from '@/lib/gainsValidation';
import { notifyWeeklyStart, notifyWeeklyResults } from '@/lib/discord';
import { log } from '@/lib/logger';

const CRON_SECRET = process.env.CRON_SECRET;

// Default Vercel function timeout (15 s on Pro, 10 s on Hobby) is well under what this
// loop needs. Bumped to the Pro cap; Hobby clips to 60 s automatically.
export const maxDuration = 300;

// WOM-style token bucket. WOM runs 8-wide at 4 rps; we use a smaller window because
// our cron is short-lived and we don't want to hammer Jagex into rate-limit territory
// when we can only retry next tick. 3 workers × 400 ms global gate ≈ 7.5 rps headroom
// against ~1.5 s fetch latency, so an N-row sweep takes roughly (N × 0.5) seconds.
const CONCURRENCY = 3;
const PER_REQUEST_GAP_MS = 400;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  const hasValidSecret = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  const devBypass = !CRON_SECRET && request.headers.get('x-vercel-cron') === '1';
  if (!hasValidSecret && !devBypass) {
    log.warn('weekly-cron.unauthorized', {
      hasSecret: !!CRON_SECRET,
      hasAuthHeader: !!authHeader,
      hasVercelCronHeader: request.headers.get('x-vercel-cron') === '1',
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();
  const results: {
    competitionId: number;
    title: string;
    participantsUpdated: number;
    markedUnranked: number;
    errors: string[];
  }[] = [];

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

  for (const comp of activeComps) {
    const compResult = {
      competitionId: comp.id,
      title: comp.title,
      participantsUpdated: 0,
      markedUnranked: 0,
      errors: [] as string[],
    };

    // Pull participants joined to clan_members, skipping anyone whose clan_members.status
    // isn't 'active'. Without this filter, every tick wastes slots on accounts we already
    // know are renamed / banned. Participants with a null clan_member_id (rare legacy /
    // guest-only rows) are kept in the pool — they predate the status column.
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

    // With 3-way concurrency, a 150-row roster finishes in ~75 s, leaving headroom inside
    // the 300 s budget. The cap is a safety belt for runaway rosters.
    const batch = participants.slice(0, 250);

    // Token-bucket dispatch shared across all workers — keeps us under Jagex's rate
    // limits without serializing every fetch like the old `await delay(1200)` did.
    let lastDispatch = 0;
    const dispatchQueue = [...batch];
    const unrankedMemberIds = new Set<number>();

    async function takeToken() {
      const wait = Math.max(0, PER_REQUEST_GAP_MS - (Date.now() - lastDispatch));
      if (wait > 0) await delay(wait);
      lastDispatch = Date.now();
    }

    const compType = comp.type as 'skill' | 'boss';
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (dispatchQueue.length > 0) {
        const p = dispatchQueue.shift();
        if (!p) break;
        await takeToken();
        const result = await fetchParticipantStat(p.rsn, compType, comp.metric);
        const nowIso = new Date().toISOString();
        try {
          if (result.kind === 'value') {
            // Negative-gains guard: if the fetched value is *lower* than what we already
            // have, the most likely cause is that a different account now holds this RSN
            // (post-rename takeover). Bump lastUpdated so the row leaves the head of the
            // queue, log it, but don't overwrite the legit prior progress.
            if (p.currentValue !== null && result.value < p.currentValue) {
              log.warn('weekly-cron.negative-gain', {
                rsn: p.rsn,
                competitionId: comp.id,
                previous: p.currentValue,
                fetched: result.value,
              });
              await db.update(weeklyParticipants)
                .set({ lastUpdated: nowIso })
                .where(eq(weeklyParticipants.id, p.id));
              compResult.errors.push(`Negative gain ignored for ${p.rsn}`);
              continue;
            }
            const updates: Record<string, unknown> = {
              currentValue: result.value,
              lastUpdated: nowIso,
            };
            if (p.baselineValue === null) updates.baselineValue = result.value;

            // Flag an implausible single-tick jump (e.g. a logout flush of a pre-event
            // grind sweeping into the gain). We flag — never clamp — so an admin can
            // correct the baseline by hand. Only set the flag; never clear it here.
            if (p.currentValue !== null) {
              const spike = checkRateSpike({
                type: compType,
                metric: comp.metric,
                delta: result.value - p.currentValue,
                fromIso: p.lastUpdated,
                toIso: nowIso,
              });
              if (spike.flagged) {
                updates.flagged = 1;
                updates.flagReason = describeRateSpike(compType, spike);
                log.warn('weekly-cron.implausible-gain', {
                  rsn: p.rsn,
                  competitionId: comp.id,
                  delta: result.value - p.currentValue,
                  ratePerHour: Math.round(spike.ratePerHour),
                });
              }
            }
            await db.update(weeklyParticipants).set(updates).where(eq(weeklyParticipants.id, p.id));
            compResult.participantsUpdated++;

            // Persist this member's stats scoped to the competition: a frozen baseline on
            // their first tick, and a 'current' row overwritten each tick. Bounded at two
            // rows per (member, competition) — see writePlayerSnapshot.
            if (p.clanMemberId != null) {
              await writePlayerSnapshot(p.clanMemberId, comp.id, result.snapshot);
            }
          } else if (result.kind === 'unranked') {
            // Quarantine the clan_member row so future ticks skip it entirely. The display
            // RSN was almost certainly renamed; a separate re-probe job will lift it back
            // to 'active' if the account reappears on hiscores under this name.
            if (p.clanMemberId != null) unrankedMemberIds.add(p.clanMemberId);
            await db.update(weeklyParticipants)
              .set({ lastUpdated: nowIso })
              .where(eq(weeklyParticipants.id, p.id));
            compResult.errors.push(`Unranked: ${p.rsn}`);
          } else {
            // Transient — leave value alone, just shuffle position so we revisit next tick.
            await db.update(weeklyParticipants)
              .set({ lastUpdated: nowIso })
              .where(eq(weeklyParticipants.id, p.id));
            compResult.errors.push(`Transient fail: ${p.rsn}`);
          }
        } catch (err) {
          log.warn('weekly-cron.row-error', { rsn: p.rsn, compId: comp.id }, err);
          compResult.errors.push(`Failed: ${p.rsn}`);
        }
      }
    });
    await Promise.all(workers);

    // Apply the unranked flips in one statement at the end of the comp so we don't churn
    // status_last_checked on every row mid-loop. Doing it in batch also lets the SELECT
    // above for this comp continue to behave deterministically while workers run.
    if (unrankedMemberIds.size > 0) {
      const ids = Array.from(unrankedMemberIds);
      await db.update(clanMembers)
        .set({ status: 'unranked', statusLastChecked: new Date().toISOString() })
        .where(inArray(clanMembers.id, ids));
      compResult.markedUnranked = ids.length;
    }

    results.push(compResult);
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    activeCompetitions: activeComps.length,
    results,
  });
}
