import { requireEventForParticipantPage } from '@/lib/eventScope';
import EventApiHost from '@/components/EventApiHost';
import ClanLink from '@/components/ClanLink';
import EventPageHeader from '@/components/events/EventPageHeader';
import LiveRefresher from '@/components/LiveRefresher';
import { getEventStats, type StatsWindow } from '@/lib/eventStats';
import { stampMs } from '@/lib/eventDay';
import { eventHasStarted } from '@/lib/completionGate';
import StatsDashboard from './StatsDashboard';
import StandingsHiddenNotice from '@/components/StandingsHiddenNotice';
import { standingsScopeForSession } from '@/lib/standingsAccess';
import { curtainInfo } from '@/lib/standingsVisibility';
import { verifyUser } from '@/lib/auth';
import { db } from '@/db';
import { clanRoster, eventParticipants } from '@/db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';

/** The signed-in viewer's own rows on this board (any of their characters), so the chart can mark them. */
async function viewerRows(eventId: number): Promise<number[]> {
  const user = await verifyUser();
  if (!user?.playerId) return [];
  // clan-scope: global -- the subject is the viewer, whose seats span clans; scoped to their own.
  const seats = await db
    .select({ id: clanRoster.id })
    .from(clanRoster)
    .where(and(eq(clanRoster.playerId, user.playerId), isNull(clanRoster.leftAt)));
  if (seats.length === 0) return [];
  const rows = await db
    .select({ id: eventParticipants.id })
    .from(eventParticipants)
    .where(and(eq(eventParticipants.eventId, eventId), inArray(eventParticipants.clanMemberId, seats.map((r) => r.id))));
  return rows.map((r) => r.id);
}

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

  const startMs = stampMs(event.startDate);
  const started = startMs != null && eventHasStarted(event);
  // HIDDEN STANDINGS: this page is every player's numbers side by side — the race itself. While the
  // host keeps the standings back it waits for the reveal (staff see it as ever).
  const curtain = started ? curtainInfo(await standingsScopeForSession(event)) : null;
  const header = () => (
    <>
      <EventApiHost eventId={id} prefix={apiPrefix} />
      <EventPageHeader event={event} apiPrefix={apiPrefix} active="stats" title="Event stats" curtained={!!curtain} />
    </>
  );
  if (startMs == null || !started) {
    return (
      <div>
        {header()}
        <Notice title="Stats start when the event does">Every number here counts from the start — check back once it’s under way.</Notice>
      </div>
    );
  }

  if (curtain) {
    return (
      <div>
        {header()}
        <StandingsHiddenNotice curtain={curtain} className="mx-auto mt-10 max-w-xl" />
      </div>
    );
  }

  const requested = day ? parseInt(day, 10) : NaN;
  const window: StatsWindow = Number.isInteger(requested) ? { kind: 'day', day: requested } : { kind: 'all' };
  const mine = await viewerRows(id).catch(() => []);
  const data = (await getEventStats(id, window, undefined, mine)) ?? (await getEventStats(id, { kind: 'all' }, undefined, mine));
  if (!data) {
    return (
      <div>
        {header()}
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
      {header()}
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
