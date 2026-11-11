import { redirect } from 'next/navigation';
import { getClanFeatures } from '@/lib/clanFeatures';
import { isTileRaceFormat, isPointsMode, eventShapeBadge } from '@/lib/utils';
import { verifyUser } from '@/lib/auth';
import { isEventEditor, isEventTreasurer } from '@/lib/eventEditors';
import EventTabNav from './EventTabNav';
import EventTitle from './EventTitle';
import EventLockBanner from './EventLockBanner';
import EventLifecycleBar from './EventLifecycleBar';
import { isEventOver, eventEditLocked } from '@/lib/eventLock';
import { lifecycleSteps, eventStage } from '@/lib/eventStage';
import { getStageCounts } from '@/lib/eventStageCounts';
import { eventRailGroups } from '@/lib/eventRail';
import { authoringModel } from '@/lib/tileAuthoring';
import AdminSidebar from '@/app/admin/_components/AdminSidebar';
import { atLeast } from '@/lib/clanRoles';
import ClanLink from '@/components/ClanLink';
import { clanHref } from '@/lib/clanPath';
import { clanPrefix } from '@/lib/clanContext';
import { requireEventForPage } from '@/lib/eventScope';
import { resolveClanById } from '@/lib/clanContext';
import { eventIconUrl } from '@/lib/eventImage';
import { isCreatorSpace } from '@/lib/creatorSpaces';
import { isFriendsHost } from '@/lib/friendEventRules';
import { ensureInviteToken } from '@/lib/friendEvents';
import FriendsInviteLink from '@/components/FriendsInviteLink';
import { db } from '@/db';
import { clans } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { idParam } from '@/lib/routeIds';

export const dynamic = 'force-dynamic';

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const id = idParam(eventId);

  // WHOSE EVENT IS THIS? Ids are global and this one came from the URL. The scope checks below ask
  // whether a board-scoped editor or treasurer may open this event, and `verifyUser` resolves their
  // role against the clan they are VISITING — so an admin of one clan could walk into another clan's
  // event admin by id and be handed the whole shell: name, dates, lifecycle, stage counts, and every
  // tab beneath this layout. The write routes underneath all call eventForRequest; the pages never
  // asked. This is the one check that settles it, for the layout and everything it wraps.
  const event = await requireEventForPage(id);

  const session = await verifyUser();
  const isEditor = session?.role === 'editor';
  // Board-scoped editors may only open events they hold a grant for. A non-granted event bounces
  // back to their (already-filtered) events list — the coarse middleware gate lets any editor reach
  // the tiles route, so this server-side check is what actually enforces per-board scoping.
  if (session?.role === 'editor' && session.editorScope === 'assigned') {
    if (!(await isEventEditor(session.userId, id))) redirect(await clanHref('/admin/events'));
  }
  // Same rule for a board treasurer: middleware only knows they're scoped, not to WHICH boards.
  const isBoardTreasurer = session?.role === 'treasurer' && session.treasurerScope === 'assigned';
  if (isBoardTreasurer) {
    if (!(await isEventTreasurer(session!.userId, id))) redirect(await clanHref('/admin/events'));
  }

  // A friends event's invite link, minted on first look for a board made before links existed.
  const friendsToken = (await friendsHostOfEventKind(event.clanId)) ? await ensureInviteToken(id) : null;
  const friendsApiBase = friendsToken ? await clanPrefix() : '';

  // Same per-request cache the rail reads, so the two strips never disagree and never double-query.
  const stageCounts = await getStageCounts(id);
  // What this board calls its entries, so the lifecycle step and the tab agree with the page.
  const { NounPlural, noun, nounPlural } = authoringModel(event);
  const steps = lifecycleSteps({ ...event, taskNounPlural: NounPlural }, stageCounts);
  const tileCount = { c: stageCounts.tileCount };
  const teamCount = { c: stageCounts.teamCount };

  const now = new Date();
  const isForceEnded = !!event.forceEndedAt;
  const eventStarted = event.startDate ? new Date(event.startDate) <= now : false;
  const eventEnded = event.endDate ? new Date(event.endDate) <= now : false;
  const isDraft = !isForceEnded && !event.startDate;
  const isActive = eventStarted && !eventEnded;
  const raceFormat = isTileRaceFormat(event.format);
  const pointsMode = isPointsMode(event.scoringMode);

  const status = isForceEnded
    ? { label: 'Force-Ended', cls: 'bg-red-500/15 text-red-400 border-red-500/25' }
    : eventEnded
      ? { label: 'Ended', cls: 'bg-text-muted/15 text-text-muted border-text-muted/25' }
      : isDraft
        ? { label: 'Draft', cls: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25' }
        : isActive
          ? { label: 'Active', cls: 'bg-accent-green/15 text-accent-green-light border-accent-green/25' }
          : { label: 'Upcoming', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' };

  // The rail lives HERE, not in the admin shell: this layout re-renders when the event id changes,
  // a parent layout doesn't. Rendering it from the shell meant walking from one event to another
  // left you looking at the first one's rail.
  const rail = eventRailGroups({
    eventId: id,
    stage: eventStage(event),
    counts: stageCounts,
    tilesOnly: isEditor,
    moneyOnly: isBoardTreasurer,
    taskNounPlural: nounPlural,
    surveyOn: (await getClanFeatures(event.clanId)).on('survey'),
    homeSettings: await homeSettingsFor(session?.role, event.clanId),
  });

  const heroIcon = eventIconUrl(event, await resolveClanById(event.clanId));

  return (
    <div className="lg:flex lg:gap-6">
      <AdminSidebar
        scope="event"
        groups={rail}
        header={{ title: event.name, subtitle: eventShapeBadge(event.format, event.scoringMode, event.boardSize, event.rules) }}
      />
      <div className="flex-1 min-w-0">
      <ClanLink
        href="/admin/events"
        className="inline-flex items-center gap-1 text-text-muted text-sm hover:text-gold transition-colors mb-4"
      >
        &larr; All events
      </ClanLink>

      {/* The event's hero (from the settings mockups): its banner, its icon over it, the name and
          what kind of board it is, and a way to see it as players do. */}
      <header className="mb-6 overflow-hidden rounded-2xl border border-card-border bg-card-bg">
        {/* A banner gets its own 3:1 frame, the shape the upload asks for (and the settings preview
            shows), so it is seen whole; without one, a short strip of grid. */}
        <div className={`relative bg-brown-dark ${event.bannerUrl ? 'aspect-[3/1]' : 'h-24 sm:h-28'}`} aria-hidden>
          {event.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- the event's own upload
            <img src={event.bannerUrl} alt="" className="h-full w-full object-cover" style={{ objectPosition: `50% ${event.bannerPosition ?? 50}%` }} />
          ) : (
            <div
              className="h-full w-full"
              style={{
                backgroundImage: 'linear-gradient(#ffffff0a 1px, transparent 1px), linear-gradient(90deg, #ffffff0a 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />
          )}
        </div>
        <div className="-mt-9 flex flex-wrap items-start gap-x-5 gap-y-3 px-5 pb-5">
          <div className="relative z-10 flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-card-bg bg-brown-light">
            {heroIcon ? (
              // eslint-disable-next-line @next/next/no-img-element -- the event's or the clan's own upload
              <img src={heroIcon} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="display text-2xl font-semibold text-gold" aria-hidden>
                {event.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-[1_1_18rem] sm:pt-11">
            <div className="flex flex-wrap items-center gap-2.5">
              <EventTitle eventId={id} initialName={event.name} canEdit={atLeast(session?.role, 'admin')} />
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${status.cls}`}>{status.label}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-sm text-text-muted">
              <span className="bg-gold/15 text-gold px-2 py-0.5 rounded-full text-xs font-medium">
                {eventShapeBadge(event.format, event.scoringMode, event.boardSize, event.rules)}
              </span>
              {raceFormat && <span className="bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full text-xs font-medium">Tile race</span>}
              {pointsMode && <span className="bg-purple-500/15 text-purple-300 px-2 py-0.5 rounded-full text-xs font-medium">Points</span>}
              <span>
                {tileCount.c} {tileCount.c === 1 ? noun : nounPlural}
              </span>
              <span>·</span>
              <span>
                {teamCount.c} team{teamCount.c !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <ClanLink
            href={`/events/${id}`}
            className="inline-flex min-h-10 items-center rounded-lg border border-card-border px-4 text-sm font-medium transition-colors hover:border-gold/40 hover:text-gold sm:mt-11"
          >
            Player view ↗
          </ClanLink>
        </div>
      </header>

      {/* The event's own rail (rendered by the admin shell) carries navigation now; this strip
          answers the other question — where the event is in its life, and what moves it forward. */}
      {!isEditor && !isBoardTreasurer && (
        <EventLifecycleBar
          steps={steps}
          homeOnly
          hrefFor={{
            built: `/admin/events/${id}/settings`,
            tiles: `/admin/events/${id}/tiles`,
            teams: `/admin/events/${id}/teams`,
            running: `/admin/events/${id}`,
            results: `/admin/events/${id}/stats`,
            payouts: `/admin/events/${id}/payouts`,
          }}
        />
      )}
      {isEditor && <EventTabNav eventId={id} tilesOnly taskNounPlural={NounPlural} />}
      {isBoardTreasurer && <EventTabNav eventId={id} moneyOnly taskNounPlural={NounPlural} />}

      {/* Finished events are read-only (lib/eventLock guards the APIs) — say so on every tab, and
          give admins the explicit unlock/re-lock control. */}
      {isEventOver(event) && (
        <EventLockBanner eventId={id} locked={eventEditLocked(event)} canToggle={atLeast(session?.role, 'admin')} />
      )}

      {/* A friends event's one way in (lib/friendEvents): the host copies the link from here. */}
      {friendsToken && atLeast(session?.role, 'admin') && <FriendsInviteLink eventId={id} token={friendsToken} apiBase={friendsApiBase} />}

      {children}
      </div>
    </div>
  );
}

/** "Space settings" / "Clan settings" in the event rail, for an admin only (the page rejects anyone else). */
async function homeSettingsFor(role: string | null | undefined, clanId: number): Promise<{ href: string; label: string } | null> {
  if (!atLeast(role, 'admin')) return null;
  // clan-scope: this clan -- the event's own clan, for its kind.
  const clan = await db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { kind: true } });
  // A friends host has no settings page of its own (lib/friendEventRules FRIENDS_ADMIN_PATHS).
  if (isFriendsHost(clan)) return null;
  return isCreatorSpace(clan) ? { href: '/admin/space', label: 'Space settings' } : { href: '/admin/clan', label: 'Clan settings' };
}

/** Is this event's host a friends host? */
async function friendsHostOfEventKind(clanId: number): Promise<boolean> {
  // clan-scope: this clan -- the event's own clan, for its kind.
  const clan = await db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { kind: true } });
  return isFriendsHost(clan);
}
