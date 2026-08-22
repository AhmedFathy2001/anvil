import { loadHubView } from '@/lib/eventsHub';
import { loadCalendar } from '@/lib/eventsCalendar';
import { hubKind } from '@/lib/hubKinds';
import CompetitionCard, { boardGlyphFor } from '@/components/events/CompetitionCard';
import WeekFrame from '@/components/events/WeekFrame';
import HubRecord from './HubRecord';
import SeasonCalendar from './SeasonCalendar';
import EventTimer from '@/components/EventTimer';

export const dynamic = 'force-dynamic';

/**
 * The Events hub — every competition the clan runs, in one place.
 *
 * Weekly competitions used to have their own page, because they have their own table. They are
 * events by every definition this site uses — a start, an end, entrants, a leaderboard, a winner —
 * so this is the page for both, and `/weekly` redirects here.
 *
 * Three questions, in order: what's on now, what's next, and what has the clan ever run. Boards and
 * weeks are peers throughout: several of each can be live at once, and the weeks that share a
 * window share a frame and a countdown rather than being demoted to a list.
 */

const PAGE = 24;

export default async function EventsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show } = await searchParams;
  const requested = Number.parseInt(show ?? '', 10);
  const pastLimit = Number.isFinite(requested) ? Math.min(Math.max(requested, PAGE), 500) : PAGE;

  const [view, calendar] = await Promise.all([loadHubView({ pastLimit }), loadCalendar()]);
  const liveCount = view.live.boards.length + view.live.weeks.length;
  const nextUp = [
    ...view.upcoming.boards.map((b) => ({
      key: `e${b.id}`,
      kind: b.mode,
      name: b.name,
      href: `/events/${b.id}`,
      startDate: b.startDate,
      endDate: b.endDate,
      foot: b.foot,
    })),
    ...view.upcoming.weeks.map((w) => ({
      key: `w${w.id}`,
      kind: w.kind,
      name: w.name,
      href: `/weekly/${w.id}`,
      startDate: w.startDate,
      endDate: w.endDate,
      foot: `${w.metricLabel} · everyone on the roster`,
    })),
  ].sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));

  const more = view.record.pastTotal - view.record.items.length;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gold sm:text-3xl">Events</h1>
        <p className="mt-1 text-sm text-text-muted">
          Bingos, ladders, tile races and every Skill and Boss of the Week — running now, coming up,
          and everything already finished.
        </p>
      </header>

      {/* ---- on now ------------------------------------------------------------------ */}
      <SectionHead
        title="On now"
        note={
          liveCount === 0
            ? 'nothing running'
            : `${view.live.boards.length} board${view.live.boards.length === 1 ? '' : 's'} · ${view.live.weeks.length} week${
                view.live.weeks.length === 1 ? '' : 's'
              }`
        }
      />

      {liveCount === 0 ? (
        <div className="rounded-xl border border-dashed border-card-border p-6 text-sm text-text-muted">
          {nextUp.length > 0 ? (
            <>
              Nothing is running. Next up is <b className="text-foreground">{nextUp[0].name}</b>
              {nextUp[0].startDate ? ` on ${new Date(nextUp[0].startDate).toLocaleDateString()}` : ''}.
            </>
          ) : (
            'Nothing is running, and nothing is scheduled — an admin can start something from the Admin tab.'
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {view.live.boards.length > 0 && (
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(272px,1fr))]">
              {view.live.boards.map((b) => (
                <CompetitionCard
                  key={b.id}
                  kind={b.mode}
                  href={`/events/${b.id}`}
                  name={b.name}
                  shape={b.shape}
                  state="live"
                  startDate={b.startDate}
                  endDate={b.endDate}
                  entrants={b.chips[0] ?? 'no teams yet'}
                  top={
                    b.top
                      ? {
                          name: b.top.name,
                          text: `${b.top.score.toLocaleString()} ${b.top.unit}`,
                          color: b.top.color,
                          pct: b.top.total > 0 ? (b.top.score / b.top.total) * 100 : 0,
                        }
                      : null
                  }
                  chips={b.chips.slice(1)}
                  glyph={boardGlyphFor(b, hubKind(b.mode).accent)}
                />
              ))}
            </div>
          )}
          <WeekFrame weeks={view.live.weeks} />
        </div>
      )}

      {/* ---- up next ----------------------------------------------------------------- */}
      {nextUp.length > 0 && (
        <>
          <SectionHead title="Up next" note={`${nextUp.length} scheduled`} />
          <ul className="divide-y divide-card-border overflow-hidden rounded-xl border border-card-border bg-card-bg">
            {nextUp.slice(0, 8).map((n) => {
              const meta = hubKind(n.kind);
              return (
                <li key={n.key}>
                  <a href={n.href} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-brown-light/40">
                    <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: meta.accent }} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{n.name}</span>
                      <span className="block truncate text-[11.5px] text-text-muted">
                        {meta.short} · {n.foot}
                      </span>
                    </span>
                    <span className="ml-auto shrink-0 text-[11.5px]">
                      <EventTimer startDate={n.startDate} endDate={n.endDate} className="text-[11.5px] text-text-muted" />
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* ---- the season ---------------------------------------------------------------
          Boards and weeks on one axis. This is the merge made visible: a three-week bingo running
          through three Skill weeks is the actual shape of a clan's summer, and nothing showed it
          while the two lived on separate pages. */}
      {calendar.items.length > 1 && (
        <>
          <SectionHead title="The season" note="everything on one axis" />
          <SeasonCalendar items={calendar.items} />
        </>
      )}

      {/* ---- the record -------------------------------------------------------------- */}
      <SectionHead
        title="The record"
        note={`${view.record.boardsTotal} boards · ${view.record.weeksTotal} weeks`}
      />
      <HubRecord
        items={view.record.items}
        pastTotal={view.record.pastTotal}
        boardsTotal={view.record.boardsTotal}
        weeksTotal={view.record.weeksTotal}
        showMoreHref={more > 0 ? `/events?show=${pastLimit + PAGE}` : null}
      />
    </div>
  );
}

function SectionHead({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-3 mt-8 flex flex-wrap items-center gap-3 first:mt-0">
      <h2 className="flex items-center gap-2 text-[17px] font-bold">
        <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
        {title}
      </h2>
      {note && <span className="text-xs text-text-muted">{note}</span>}
    </div>
  );
}
