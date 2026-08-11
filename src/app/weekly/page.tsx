import Link from 'next/link';
import { db } from '@/db';
import { weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { desc, count } from 'drizzle-orm';
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

export default async function WeeklyPage() {
  const comps = await db.select().from(weeklyCompetitions).orderBy(desc(weeklyCompetitions.createdAt));

  const participantCounts = await db
    .select({ competitionId: weeklyParticipants.competitionId, count: count() })
    .from(weeklyParticipants)
    .groupBy(weeklyParticipants.competitionId);

  const countMap = new Map(participantCounts.map((p) => [p.competitionId, p.count]));

  const active = comps.filter((c) => c.status === 'active');
  const upcoming = comps.filter((c) => c.status === 'upcoming');
  const completed = comps.filter((c) => c.status === 'completed');

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gold">Weekly Competitions</h1>
        <p className="text-text-muted text-sm mt-1">Skill of the Week & Boss of the Week</p>
      </div>

      {comps.length === 0 && (
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
    </div>
  );
}
