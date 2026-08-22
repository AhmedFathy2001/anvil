import Link from 'next/link';
import { notFound } from 'next/navigation';
import EventLifecycleBar from '../../[eventId]/EventLifecycleBar';
import { getWeeklyCounts, getWeeklyRow } from '@/lib/weeklyWorkspace';
import { weeklyLifecycleSteps, weeklyStage, WEEKLY_BADGE } from '@/lib/weeklyStage';
import { weeklyRailGroups } from '@/lib/eventRail';
import AdminSidebar from '@/app/admin/_components/AdminSidebar';
import { weeklyMetricLabel } from '@/lib/weeklyLabels';

export const dynamic = 'force-dynamic';

/**
 * A weekly competition's workspace — the same shell a board event gets.
 *
 * Weeklies used to live as rows in one long page: to see whether a competition needed anything you
 * expanded an accordion. They have a window, a roster, a leaderboard and a winner like everything
 * else here, so they get the same header, the same lifecycle strip and the same rail.
 */
export default async function WeeklyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ weeklyId: string }>;
}) {
  const { weeklyId } = await params;
  const id = parseInt(weeklyId, 10);

  const comp = await getWeeklyRow(id);
  if (!comp) notFound();

  const counts = await getWeeklyCounts(id);
  const stage = weeklyStage(comp);
  const steps = weeklyLifecycleSteps(comp, counts);

  const status =
    stage === 'wrap'
      ? { label: 'Ended', cls: 'bg-text-muted/15 text-text-muted border-text-muted/25' }
      : stage === 'run'
        ? { label: 'Active', cls: 'bg-accent-green/15 text-accent-green-light border-accent-green/25' }
        : { label: 'Upcoming', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' };

  const rail = weeklyRailGroups({ weeklyId: id, stage, counts });

  return (
    <div className="lg:flex lg:gap-6">
      <AdminSidebar
        scope="event"
        groups={rail}
        header={{ title: comp.title, subtitle: `${WEEKLY_BADGE[comp.type] ?? 'Weekly'} · ${weeklyMetricLabel(comp.type, comp.metric)}` }}
      />
      <div className="flex-1 min-w-0">
      <Link
        href="/admin/events"
        className="inline-flex items-center gap-1 text-text-muted text-sm hover:text-gold transition-colors mb-4"
      >
        &larr; All events
      </Link>

      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-gold">{comp.title}</h1>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${status.cls}`}>{status.label}</span>
      </div>

      <div className="flex items-center gap-2.5 text-sm text-text-muted mb-6 flex-wrap">
        <span className="bg-purple-400/15 text-purple-300 px-2 py-0.5 rounded-full text-xs font-medium">
          {WEEKLY_BADGE[comp.type] ?? 'Weekly'}
        </span>
        <span className="bg-gold/15 text-gold px-2 py-0.5 rounded-full text-xs font-medium">
          {weeklyMetricLabel(comp.type, comp.metric)}
        </span>
        <span>{counts.participants} entered</span>
        <span>·</span>
        <span>{counts.moving} scoring</span>
      </div>

      <EventLifecycleBar
        steps={steps}
        hrefFor={{
          enrolled: `/admin/events/weekly/${id}/participants`,
          baselines: `/admin/events/weekly/${id}/baselines`,
          running: `/admin/events/weekly/${id}`,
          results: `/admin/events/weekly/${id}`,
        }}
      />

      {children}
      </div>
    </div>
  );
}
