import { db } from '@/db';
import { requireEventForPage } from '@/lib/eventScope';
import { events, teams, tiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { verifyUser } from '@/lib/auth';
import SettingsClient from './SettingsClient';
import EventLookPanel from './EventLookPanel';
import { requireClan } from '@/lib/clanContext';
import SaveAsPresetButton from '@/components/SaveAsPresetButton';
import { atLeast } from '@/lib/clanRoles';
import AccessPanel from '../teams/AccessPanel';
import CoHostPanel from '../teams/CoHostPanel';
import EventWebhooksPanel from '../teams/EventWebhooksPanel';
import EventDiscordServerPanel from '@/components/EventDiscordServerPanel';
import { cohostsForEvent } from '@/lib/coHost';
import { settlementForEvent } from '@/lib/coHostSettlement';

export const dynamic = 'force-dynamic';

/**
 * Everything about an event you set once and then stop thinking about: its shape, its dates, when
 * tiles open, who may edit the board — plus the destructive corner (clone, delete).
 *
 * These used to sit at the top of the Overview, above the live board, which meant the surface you
 * check ten times a day opened on a configuration form.
 */
export default async function EventSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ uninvited?: string }>;
}) {
  const { eventId } = await params;
  // Clans the create form could not invite — a typo, or the multi-clan plan gate. Carried here
  // rather than shown on the form, because the board exists either way and this is where an admin
  // fixes it. Silence was the old behaviour and it left an invite-only event with nobody invited.
  const uninvited = ((await searchParams).uninvited ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const id = parseInt(eventId, 10);

  // Whose event is this? Ids are global and this one came from the URL.
  await requireEventForPage(id);
  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) notFound();

  const [eventTiles, eventTeams, session, clan, cohosts, settlement] = await Promise.all([
    db.select().from(tiles).where(eq(tiles.eventId, id)),
    db.select({ id: teams.id, name: teams.name, color: teams.color }).from(teams).where(eq(teams.eventId, id)),
    verifyUser(),
    requireClan(),
    cohostsForEvent(id),
    settlementForEvent(id),
  ]);
  const isAdmin = atLeast(session?.role, 'admin');

  return (
    <>
      <EventLookPanel
        eventId={event.id}
        eventName={event.name}
        clanLogoUrl={clan.logoUrl}
        initialIcon={event.iconUrl}
        initialBanner={event.bannerUrl}
        initialBannerPosition={event.bannerPosition ?? null}
      />
      {/* Who may see and enter it, other clans, the money, and extra Discord channels. These sat on
          the Teams tab, above the team setup it is named for. */}
      <h2 id="who-can-play" className="scroll-mt-24 mt-2 mb-1 text-lg font-semibold flex items-center gap-2">
        <span className="w-1 h-5 bg-gold rounded-full" />
        Who can play
      </h2>
      <p className="mb-4 text-sm text-text-muted">Who sees and enters this event, other clans running a team, and where it posts.</p>
      {uninvited.length > 0 && (
        <div className="mb-4 rounded-xl border border-accent-red/40 bg-accent-red/10 p-4">
          <div className="text-[14px] font-semibold text-accent-red">
            {uninvited.length === 1 ? 'One clan was not invited' : `${uninvited.length} clans were not invited`}
          </div>
          <div className="mt-0.5 text-[12.5px] text-text-muted">
            The board was created, but {uninvited.map((u) => `/c/${u}`).join(', ')} could not be
            reached — check the address and invite them below. This event is invite-only, so until
            somebody is invited, nobody outside your clan can see it.
          </div>
        </div>
      )}
      <AccessPanel eventId={id} />
      <CoHostPanel eventId={id} initial={cohosts} cashPolicy={event.cashPolicy} settlement={settlement} />
      <EventDiscordServerPanel eventId={id} />
      <EventWebhooksPanel eventId={id} teams={eventTeams} />

      <SettingsClient event={event} tiles={eventTiles} canManageEditors={isAdmin} />
      {isAdmin && <SaveAsPresetButton eventId={event.id} defaultName={event.name} />}
    </>
  );
}
