import Link from 'next/link';
import { db } from '@/db';
import { weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { desc, count, eq, inArray } from 'drizzle-orm';
import { SKILL_LABELS, BOSSES, EFFICIENCY_LABELS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

function getMetricLabel(type: string, metric: string): string {
  if (type === 'skill') return SKILL_LABELS[metric] || metric;
  if (type === 'efficiency') return EFFICIENCY_LABELS[metric] || metric.toUpperCase();
  const boss = BOSSES.find((b) => b.key === metric);
  return boss?.label || metric;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-accent-green/15 text-accent-green-light">
          Active
        </span>
      );
    case 'upcoming':
      return (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
          Upcoming
        </span>
      );
    case 'completed':
      return (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-text-muted/15 text-text-muted">
          Completed
        </span>
      );
    default:
      return null;
  }
}

/**
 * Finished weeks come a page at a time. A clan running one a week has fifty-two a year — three a
 * week is over a hundred and fifty — and every one of them is a card with a participant count
 * behind it. Active and upcoming are never capped: several can run at once and those are the ones
 * the page exists for.
 */
const PAGE = 24;

export default async function WeeklyPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show } = await searchParams;
  const requested = Number.parseInt(show ?? '', 10);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, PAGE), 500) : PAGE;

  // Four bounded queries rather than one that reads every week the clan has ever run: the archive
  // only needs a page of itself and a total.
  const byStatus = (status: string, take?: number) => {
    const q = db
      .select()
      .from(weeklyCompetitions)
      .where(eq(weeklyCompetitions.status, status))
      .orderBy(desc(weeklyCompetitions.createdAt));
    return take != null ? q.limit(take) : q;
  };
  const [active, upcoming, completed, finishedTotal] = await Promise.all([
    byStatus('active'),
    byStatus('upcoming'),
    byStatus('completed', limit),
    db
      .select({ c: count() })
      .from(weeklyCompetitions)
      .where(eq(weeklyCompetitions.status, 'completed'))
      .then((r) => r[0]?.c ?? 0),
  ]);
  const moreFinished = finishedTotal - completed.length;

  // Only the competitions actually on the page need their entrant count — the group-by used to
  // sweep every participant row the clan has ever recorded.
  const shownIds = [...active, ...upcoming, ...completed].map((c) => c.id);
  const participantCounts = shownIds.length
    ? await db
        .select({ competitionId: weeklyParticipants.competitionId, count: count() })
        .from(weeklyParticipants)
        .where(inArray(weeklyParticipants.competitionId, shownIds))
        .groupBy(weeklyParticipants.competitionId)
    : [];

  const countMap = new Map(participantCounts.map((p) => [p.competitionId, p.count]));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gold">Weekly Competitions</h1>
        <p className="text-text-muted text-sm mt-1">Skill of the Week & Boss of the Week</p>
      </div>

      {active.length + upcoming.length + completed.length === 0 && (
        <div className="text-center py-12 border border-dashed border-card-border rounded-xl">
          <p className="text-text-muted">No weekly competitions yet. Check back soon!</p>
        </div>
      )}

      {[
        { label: 'Active', items: active, color: 'bg-accent-green' },
        { label: 'Upcoming', items: upcoming, color: 'bg-blue-500' },
        { label: 'Completed', items: completed, color: 'bg-text-muted' },
      ].map(({ label, items, color }) =>
        items.length > 0 ? (
          <div key={label} className="mb-8">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <span className={`w-1 h-5 ${color} rounded-full`} />
              {label}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((comp) => (
                <Link
                  key={comp.id}
                  href={`/weekly/${comp.id}`}
                  className="group border border-card-border rounded-xl p-4 bg-card-bg hover:border-gold/40 hover:bg-card-bg-hover transition-all"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold group-hover:text-gold transition-colors">
                      {comp.title}
                    </span>
                    {getStatusBadge(comp.status)}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gold/15 text-gold">
                      {comp.type === 'skill' ? 'Skill' : comp.type === 'boss' ? 'Boss' : 'Efficiency'}:{' '}
                      {getMetricLabel(comp.type, comp.metric)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <span>{countMap.get(comp.id) || 0} participants</span>
                    <span>
                      {new Date(comp.startDate).toLocaleDateString()} -{' '}
                      {new Date(comp.endDate).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null,
      )}

      {moreFinished > 0 && (
        <div className="text-center">
          <Link
            href={`/weekly?show=${limit + PAGE}`}
            scroll={false}
            className="inline-block rounded-lg border border-card-border px-4 py-2 text-sm font-semibold text-text-muted transition-colors hover:border-gold/40 hover:text-foreground"
          >
            Show {Math.min(PAGE, moreFinished)} more
            <span className="ml-2 text-text-muted/70">
              {completed.length} of {finishedTotal} finished
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
