import ClanLink from '@/components/ClanLink';
import { tabHref } from '@/lib/eventSettingsTabs';
import SettingsClient from './SettingsClient';
import EventLookPanel from './EventLookPanel';
import { boardTiles, loadSettings } from './load';

export const dynamic = 'force-dynamic';

/**
 * Settings › Event: what the event is and when it runs — its name and look, its format and its dates.
 * Everything else moved to its own tab (lib/eventSettingsTabs); the search box finds any of it.
 */
export default async function EventSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ uninvited?: string }>;
}) {
  const { id, event, clan } = await loadSettings((await params).eventId);
  // Clans the create form could not invite — a typo, or the multi-clan plan gate. The fix is on the
  // entry tab; this only says so, because the create form lands here.
  const uninvited = ((await searchParams).uninvited ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const tiles = await boardTiles(id);

  return (
    <>
      {uninvited.length > 0 && (
        <div className="rounded-xl border border-accent-red/40 bg-accent-red/10 p-4">
          <div className="text-[14px] font-semibold text-accent-red">
            {uninvited.length === 1 ? 'One clan was not invited' : `${uninvited.length} clans were not invited`}
          </div>
          <div className="mt-0.5 text-[12.5px] text-text-muted">
            The board was created, but {uninvited.join(', ')} could not be reached. This event is
            invite-only, so until somebody is invited, nobody outside your clan can see it.{' '}
            <ClanLink href={`${tabHref(id, 'access')}#access`} className="text-gold hover:underline">
              Invite them
            </ClanLink>
          </div>
        </div>
      )}
      <div id="look" className="scroll-mt-28 rounded-xl">
        <EventLookPanel
          eventId={event.id}
          eventName={event.name}
          clanLogoUrl={clan.logoUrl}
          initialIcon={event.iconUrl}
          initialBanner={event.bannerUrl}
          initialBannerPosition={event.bannerPosition ?? null}
        />
      </div>
      <SettingsClient event={event} tiles={tiles} section="event" />
    </>
  );
}
