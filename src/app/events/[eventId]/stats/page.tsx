import { requireEventForParticipantPage } from '@/lib/eventScope';
import EventApiHost from '@/components/EventApiHost';
import ClanLink from '@/components/ClanLink';
import LiveRefresher from '@/components/LiveRefresher';
import { getEventStats, type StatsWindow } from '@/lib/eventStats';
import { stampMs } from '@/lib/eventDay';
import { eventHasStarted } from '@/lib/completionGate';
import StatsDashboard from './StatsDashboard';

export const dynamic = 'force-dynamic';

function Notice({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="max-w-xl mx-auto mt-10 border border-dashed border-card-border rounded-xl p-8 text-center">
      <p className="text-lg font-semibold mb-1">{title}</p>
      {children && <div className="text-sm text-text-muted">{children}</div>}
    </div>
  );
}

/**
 * Event stats — per member, per team and per hour, for the whole event or one day (lib/eventStats).
 * Open to everyone who can see the board, while it runs: the live numbers are the point.
 */
export default async function EventStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { eventId } = await params;
  const { day } = await searchParams;
  const id = parseInt(eventId, 10);
  const { event, apiPrefix } = await requireEventForParticipantPage(id);

  const header = (title: string) => (
    <div className="mb-5">
      <EventApiHost eventId={id} prefix={apiPrefix} />
      <ClanLink href={`/events/${id}`} className="text-sm text-text-muted hover:text-gold transition-colors">← {event.name}</ClanLink>
      <h1 className="text-2xl font-bold text-gold mt-1">{title}</h1>
    </div>
  );

  const startMs = stampMs(event.startDate);
  if (startMs == null || !eventHasStarted(event)) {
    return (
      <div>
        {header('Event stats')}
        <Notice title="Stats start when the event does">Every number here counts from the start — check back once it’s under way.</Notice>
      </div>
    );
  }

  const requested = day ? parseInt(day, 10) : NaN;
  const window: StatsWindow = Number.isInteger(requested) ? { kind: 'day', day: requested } : { kind: 'all' };
  const data = (await getEventStats(id, window)) ?? (await getEventStats(id, { kind: 'all' }));
  if (!data) {
    return (
      <div>
        {header('Event stats')}
        <Notice title="No stats for this event" />
      </div>
    );
  }

  const days = Array.from({ length: data.event.dayCount }, (_, i) => i + 1).filter((d) => startMs + (d - 1) * 86_400_000 <= data.event.nowMs);
  const chip = (href: string, label: string, active: boolean) => (
    <ClanLink
      key={label}
      href={href}
      className={`px-3 py-1 rounded-full text-sm border transition-colors ${
        active ? 'border-gold bg-gold/15 text-gold font-semibold' : 'border-card-border text-text-muted hover:text-gold hover:border-gold/60'
      }`}
    >
      {label}
    </ClanLink>
  );

  return (
    <div>
      {header('Event stats')}
      {data.window.live && <LiveRefresher url={`/api/events/${id}/pulse`} />}
      <nav className="flex flex-wrap gap-2 mb-6" aria-label="Pick a day">
        {chip(`/events/${id}/stats`, 'Whole event', data.window.kind === 'all')}
        {days.map((d) =>
          chip(`/events/${id}/stats?day=${d}`, data.event.currentDay === d ? `Day ${d} · live` : `Day ${d}`, data.window.day === d),
        )}
      </nav>
      <StatsDashboard data={data} />
    </div>
  );
}
