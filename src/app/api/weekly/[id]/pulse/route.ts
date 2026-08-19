import { db } from '@/db';
import { competitionForRequest } from '@/lib/eventScope';
import { moments, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { jsonWithEtag } from '@/lib/httpEtag';
import { cachedPulseToken } from '@/lib/pulseCache';

/**
 * Cheap change-pulse for a weekly (SOTW/BOTW) leaderboard — same contract as the event pulse: a tiny
 * fingerprint of the board's mutable state wrapped in {@link jsonWithEtag}, so an unchanged board is a
 * 304 with no body. Weekly values only move on the 15-min stats sweep, so this rarely changes.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const compId = parseInt(id, 10);
  if (!Number.isFinite(compId)) {
    return jsonWithEtag(request, { v: 'none' });
  }

  // Collapse concurrent viewers' polls of the same board to one DB computation per ~5s.
  const token = await cachedPulseToken(`weekly:${compId}`, () => computeWeeklyToken(request, compId));
  return jsonWithEtag(request, { v: token });
}

async function computeWeeklyToken(request: Request, compId: number): Promise<string> {
  const comp = await competitionForRequest(request, compId);
  if (!comp) {
    return 'none';
  }

  // sum(currentValue) moves whenever any participant's tracked value changes; count catches
  // joins/leaves. Both are cheap indexed aggregates over one competition.
  const [agg] = await db
    .select({
      count: sql<number>`count(*)`,
      cur: sql<number>`coalesce(sum(${weeklyParticipants.currentValue}), 0)`,
      base: sql<number>`coalesce(sum(${weeklyParticipants.baselineValue}), 0)`,
    })
    .from(weeklyParticipants)
    .where(eq(weeklyParticipants.competitionId, compId));

  // Moments arrive between sweeps and are the one thing on this page that can change while every
  // number on it stays still — a pet doesn't move anybody's XP. Counting them is an indexed lookup
  // on the same competition, and without it a tab sitting open never learns one landed.
  const [feed] = await db
    .select({ count: sql<number>`count(*)` })
    .from(moments)
    .where(eq(moments.weeklyCompetitionId, compId));

  return [
    comp.status,
    comp.endDate ?? '',
    Number(agg?.count ?? 0),
    Number(agg?.cur ?? 0),
    Number(agg?.base ?? 0),
    Number(feed?.count ?? 0),
  ].join('|');
}
