import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import CompetitionInvites from '@/components/weekly/CompetitionInvites';
import OptOutToggle from '@/components/weekly/OptOutToggle';
import { competitionInvitesForClan, entryStatus } from '@/lib/competitionTeamsDb';
import { atLeast } from '@/lib/clanRoles';
import ClanLink from '@/components/ClanLink';
import { listClanEvents } from '@/lib/clanEvents';
import { takesNames } from '@/lib/clanEventModules';
import { getClanDisplayName } from '@/lib/pluginConfig';
import { clanSectionMetadata } from '@/lib/seoPages';
import { loadHubView } from '@/lib/eventsHub';
import { loadCalendar } from '@/lib/eventsCalendar';
import { currentClan, isApexHost } from '@/lib/clanContext';
import { isCreatorSpace } from '@/lib/creatorSpaces';
import { creatorEventsView, isSpaceStaff } from '@/lib/creatorHome';
import CreatorEventList from '@/components/CreatorEventList';
import { parseFilters } from '@/lib/eventsDirectory';
import { socialMetadata } from '@/lib/seo';
import EventsDirectory from './EventsDirectory';
import { verifyUser } from '@/lib/auth';
import { isStaffRole } from '@/lib/clanRoles';
import CompetitionRow, { CompetitionRowList } from '@/components/events/CompetitionRow';
import { boardRow, countRows, rowWhen, sectionRows, weeklyRow } from '@/lib/competitionRows';
import { runningParts } from '@/lib/runningCount';
import { parseStamp } from '@/lib/dbTime';
import { viewerEventEntries, type ViewerEventEntry } from '@/lib/viewerEvents';
import { viewerWeeklyStandings } from '@/lib/viewerWeeklyStandings';
import HubRecord from './HubRecord';
import SeasonCalendar from './SeasonCalendar';
import EventTimer from '@/components/EventTimer';
import LocalTime from '@/components/LocalTime';
import { displayImageUrl } from '@/lib/displayImage';

export const dynamic = 'force-dynamic';

/**
 * ONE ADDRESS, TWO PAGES — the same split /guides and /profile make. Inside a clan (`/c/<slug>/events`)
 * this is the clan's events hub. On the apex, where no clan is named, it is the public events
 * directory: every event a host chose to advertise on Anvil (lib/eventsDirectory). Any other host
 * that names no clan has neither, and 404s.
 */
async function apexOrNotFound(): Promise<void> {
  if (!isApexHost((await headers()).get('host'))) notFound();
}

export async function generateMetadata(): Promise<Metadata> {
  const clan = await currentClan();
  if (!clan) {
    await apexOrNotFound();
    return socialMetadata({
      title: 'OSRS events you can join — bingos, races and ladders',
      description:
        'Old School RuneScape bingos, tile races and ladders from clans and streamers on Anvil, live now or starting soon. Find one and join.',
      canonical: '/events',
    });
  }
  const name = (await getClanDisplayName(clan.id, clan.name)) || clan.name;
  if (isCreatorSpace(clan)) {
    return clanSectionMetadata({
      section: 'Events',
      description: `Events by ${name} on Anvil — what is live, what is open to join, what is coming up and how the last ones finished.`,
    });
  }
  return clanSectionMetadata({
    section: 'Events',
    description: `Every bingo board, Skill of the Week and Boss of the Week ${name} has run — what is live now, what is coming, and how the last ones finished.`,
  });
}

/**
 * The Events hub — every competition the clan runs, in one place.
 *
 * Weekly competitions used to have their own page, because they have their own table. They are
 * events by every definition this site uses — a start, an end, entrants, a leaderboard, a winner —
 * so this is the page for both, and `/weekly` redirects here.
 *
 * In order: what the viewer is in, what else is running, what's next, and what has finished. Boards
 * and weeks are peers throughout and drawn as the same row (components/events/CompetitionRow), so
 * several of each can be live at once without the page reading as two lists.
 */

const PAGE = 24;

export default async function EventsIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const clan = await currentClan();
  if (!clan) {
    await apexOrNotFound();
    return <EventsDirectory filters={parseFilters(await searchParams)} />;
  }
  // A creator space has no hub of weeklies and clan events: its own events, by the same rules and
  // the same rows as its home page (lib/creatorHome creatorEventsView).
  if (isCreatorSpace(clan)) {
    const viewer = await verifyUser();
    const list = await creatorEventsView(clan.id, { viewerIsStaff: await isSpaceStaff(clan.id, viewer?.userId) });
    return (
      <div className="mx-auto max-w-4xl">
        <header className="mb-2">
          <h1 className="text-2xl font-bold text-gold sm:text-3xl">Events</h1>
          <p className="mt-1 text-sm text-text-muted">
            {list.count === 1 ? '1 event' : `${list.count} events`} by {clan.name}: live now, open to join, coming up and finished.
          </p>
        </header>
        <CreatorEventList events={list} />
      </div>
    );
  }

  const { show: rawShow } = await searchParams;
  const show = Array.isArray(rawShow) ? rawShow[0] : rawShow;
  const requested = Number.parseInt(show ?? '', 10);
  const pastLimit = Number.isFinite(requested) ? Math.min(Math.max(requested, PAGE), 500) : PAGE;
  // Players have no Admin tab, so the empty state only points staff at one.
  const session = await verifyUser();
  const isStaff = isStaffRole(session?.role);

  const [view, calendar, clanEvents] = await Promise.all([
    loadHubView(clan.id, { pastLimit, viewer: session ? { playerId: session.playerId, userId: session.userId } : null }),
    loadCalendar(clan.id),
    listClanEvents(clan.id, { withinDays: 30 }),
  ]);
  const liveCount = view.live.boards.length + view.live.weeks.length;
  // Clan vs clan invites waiting on this clan — an owner/admin answers them right here.
  const compInvites = atLeast(session?.role, 'admin')
    ? (await competitionInvitesForClan(clan.id)).filter((i) => i.status === 'pending')
    : [];
  // "You're in · Opt out" for each running or upcoming week the viewer is entered in.
  const myEntries = session?.playerId
    ? (
        await Promise.all(
          [...view.live.weeks, ...view.upcoming.weeks].map(async (w) => ({ w, e: await entryStatus(w.id, { playerId: session.playerId }) })),
        )
      ).filter((x) => x.e.entered)
    : [];
  // One row shape for all of it, in the page's order: the viewer's own first, then the rest that is
  // running, then what is next (lib/competitionRows). Nothing here is paged.
  const optedOutByKey = new Map(myEntries.map(({ w, e }) => [`w${w.id}`, e.optedOut]));
  // The board events the viewer is on a team for (or signed up to, before it starts).
  const listedBoards = [...view.live.boards, ...view.upcoming.boards];
  const myBoards = session
    ? await viewerEventEntries(
        { userId: session.userId, playerId: session.playerId ?? null },
        // The finished boards on the page too, so a board they played in names their team. Same
        // three queries whatever the count.
        [...listedBoards.map((b) => b.id), ...view.record.items.filter((i) => i.group === 'boards').map((i) => i.id)],
        view.upcoming.boards.map((b) => b.id),
      )
    : new Map<number, ViewerEventEntry>();
  // Where they stand in each week they are in: two queries for all of them, none when they are in
  // none (lib/viewerWeeklyStandings). A clan-vs-clan week this page already found unreadable stays dark.
  const weekStandings = await viewerWeeklyStandings(
    { playerId: session?.playerId ?? null },
    myEntries.map(({ w }) => w.id),
    { readable: new Set([...view.live.weeks, ...view.upcoming.weeks].filter((w) => w.readable !== false).map((w) => w.id)) },
  );
  const now = new Date().getTime();
  const sections = sectionRows(
    [
      ...listedBoards.map((b) => boardRow(b, myBoards.get(b.id))),
      ...[...view.live.weeks, ...view.upcoming.weeks].map((w) => weeklyRow(w, weekStandings.get(w.id))),
    ],
    new Set([...optedOutByKey.keys(), ...[...myBoards.keys()].map((id) => `e${id}`)]),
  );
  const nextUp = sections.upNext;

  const more = view.record.pastTotal - view.record.items.length;

  // Clan events (a mass, a hangout) aren't competitions, but "nothing is on" is wrong while one is —
  // and so is a timeline that leaves them off.
  const liveClanEvent = clanEvents.find((ce) => ce.phase === 'live') ?? null;
  const nextClanEvent = clanEvents.find((ce) => ce.phase !== 'live' && ce.phase !== 'ended') ?? null;
  // The soonest scheduled thing, the viewer's own included.
  const firstNext = [...sections.mine.filter((r) => r.state === 'upcoming'), ...nextUp].sort(
    (x, y) => (parseStamp(x.startDate) ?? Infinity) - (parseStamp(y.startDate) ?? Infinity),
  )[0];
  const firstNextAt = parseStamp(firstNext?.startDate);
  const nextAny =
    nextClanEvent && (firstNextAt === null || (parseStamp(nextClanEvent.occurrence.start) ?? Infinity) < firstNextAt)
      ? { name: nextClanEvent.title, startDate: nextClanEvent.occurrence.start as string | null }
      : firstNext
        ? { name: firstNext.title, startDate: firstNext.startDate }
        : null;
  const calendarItems = [
    ...calendar.items,
    ...clanEvents.map((ce) => ({
      key: `c${ce.id}`,
      kind: 'classic' as const,
      name: ce.title,
      shortName: ce.title,
      href: `/clan-events/${ce.id}`,
      start: ce.occurrence.start,
      end: ce.occurrence.end,
      openEnded: false,
      state: ce.phase === 'live' ? ('live' as const) : ('upcoming' as const),
      clanEvent: true,
    })),
  ];

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gold sm:text-3xl">Events</h1>
        <p className="mt-1 text-sm text-text-muted">
          Bingos, ladders, tile races and every Skill and Boss of the Week — running now, coming up,
          and everything already finished.
        </p>
      </header>

      {compInvites.length > 0 && <CompetitionInvites initial={compInvites} />}

      {/* ---- yours first -------------------------------------------------------------
          What the viewer is in, running or scheduled: the board events they have a team in (or
          are signed up to) and the weekly competitions they are entered in, each of those with
          its "You're in · Opt out". */}
      {sections.mine.length > 0 && (
        <>
          <SectionHead title="You’re in" note={runningParts(countRows(sections.mine))} />
          <CompetitionRowList count={sections.mine.length}>
            {sections.mine.map((r) => (
              <li key={r.key}>
                <CompetitionRow
                  row={r}
                  when={rowWhen(r, now)}
                  mine
                  aside={
                    optedOutByKey.has(r.key) ? (
                      <OptOutToggle competitionId={Number(r.key.slice(1))} initialOptedOut={optedOutByKey.get(r.key) ?? false} compact />
                    ) : undefined
                  }
                />
              </li>
            ))}
          </CompetitionRowList>
        </>
      )}

      {/* ---- running now -------------------------------------------------------------- */}
      {(liveCount === 0 || sections.running.length > 0) && (
        <SectionHead
          title="Running now"
          note={liveCount === 0 ? 'nothing running' : runningParts(countRows(sections.running))}
        />
      )}

      {liveCount === 0 ? (
        <div className="rounded-xl border border-dashed border-card-border p-6 text-sm text-text-muted">
          {liveClanEvent ? (
            <>
              No competition is running, but <b className="text-foreground">{liveClanEvent.title}</b> is on now — see Clan events below.
            </>
          ) : nextAny ? (
            <>
              Nothing is running. Next up is <b className="text-foreground">{nextAny.name}</b>
              {nextAny.startDate && (
                <>
                  {' '}
                  on <LocalTime date={nextAny.startDate} format="date" />
                </>
              )}
              .
            </>
          ) : isStaff ? (
            <>
              Nothing is running, and nothing is scheduled.{' '}
              <ClanLink href="/admin/events/new" className="text-gold hover:underline">
                Start a new event
              </ClanLink>
              .
            </>
          ) : (
            'Nothing is running yet. Your clan’s staff will post here when the next event is on.'
          )}
        </div>
      ) : (
        sections.running.length > 0 && (
          <CompetitionRowList count={sections.running.length}>
            {sections.running.map((r) => (
              <li key={r.key}>
                <CompetitionRow row={r} when={rowWhen(r, now)} />
              </li>
            ))}
          </CompetitionRowList>
        )
      )}

      {/* ---- up next ----------------------------------------------------------------- */}
      {nextUp.length > 0 && (
        <>
          <SectionHead title="Up next" note={`${nextUp.length} scheduled`} />
          <CompetitionRowList count={nextUp.length}>
            {nextUp.map((r) => (
              <li key={r.key}>
                <CompetitionRow row={r} when={rowWhen(r, now)} />
              </li>
            ))}
          </CompetitionRowList>
        </>
      )}

      {/* ---- clan events: masses, hangouts — scheduled, not tracked (lib/clanEvents) ---- */}
      {clanEvents.length > 0 && (
        <>
          <SectionHead title="Clan events" note={`${clanEvents.length} in the next month`} />
          <ul className="mb-2 divide-y divide-card-border overflow-hidden rounded-xl border border-card-border bg-card-bg">
            {clanEvents.slice(0, 8).map((ce) => (
              <li key={ce.id}>
                <ClanLink href={`/clan-events/${ce.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-brown-light/40">
                  {ce.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={displayImageUrl(ce.imageUrl)} alt="" className="h-7 w-7 shrink-0 rounded border border-card-border object-cover" />
                  ) : (
                    <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-accent-green" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{ce.title}</span>
                    <span className="block truncate text-xs text-text-muted">
                      {[ce.repeat === 'weekly' ? 'Weekly' : 'Clan event', ce.location, ce.world ? `W${ce.world}` : null, takesNames(ce.modules) ? `${ce.going} going` : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="ml-auto shrink-0 text-xs">
                    <EventTimer startDate={ce.occurrence.start} endDate={ce.occurrence.end} className="text-xs text-text-muted" />
                  </span>
                </ClanLink>
              </li>
            ))}
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
          <SeasonCalendar items={calendarItems} />
        </>
      )}

      {/* ---- the record -------------------------------------------------------------- */}
      <SectionHead
        title="Finished"
        note={runningParts({ events: view.record.boardsTotal, competitions: view.record.weeksTotal }) || 'nothing yet'}
      />
      <HubRecord
        items={view.record.items}
        myTeams={Object.fromEntries(
          view.record.items
            .filter((i) => i.group === 'boards' && (myBoards.get(i.id)?.teamNames.length ?? 0) > 0)
            .map((i) => [i.key, myBoards.get(i.id)!.teamNames]),
        )}
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
