import { db } from '@/db';
import { weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { jsonWithEtag } from '@/lib/httpEtag';

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

  const comp = await db.query.weeklyCompetitions.findFirst({
    where: eq(weeklyCompetitions.id, compId),
    columns: { status: true, endDate: true },
  });
  if (!comp) {
    return jsonWithEtag(request, { v: 'none' });
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

  const token = [
    comp.status,
    comp.endDate ?? '',
    Number(agg?.count ?? 0),
    Number(agg?.cur ?? 0),
    Number(agg?.base ?? 0),
  ].join('|');

  return jsonWithEtag(request, { v: token });
}
