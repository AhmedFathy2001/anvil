import { requireClan } from '@/lib/clanContext';
import { isCreatorSpace, streamsEvents } from '@/lib/creatorSpaces';
import { requireEventForPage } from '@/lib/eventScope';
import { tabsFor } from '@/lib/eventSettingsTabs';
import SettingsNav from './SettingsNav';
import { SaveBarProvider } from './SaveBar';
import { idParam } from '@/lib/routeIds';

export const dynamic = 'force-dynamic';

/**
 * Settings, as tabs (lib/eventSettingsTabs): a creator space and a clan get their own set, and a
 * search box finds any setting on any tab — or the event page it actually lives on. One column, one
 * width, for every tab: the old single page stacked panels of three different widths.
 */
export default async function EventSettingsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ eventId: string }> }) {
  const id = idParam((await params).eventId);
  await requireEventForPage(id);
  const clan = await requireClan();
  const kind = { creator: isCreatorSpace(clan), streams: streamsEvents(clan) };
  return (
    <div className="max-w-4xl">
      <SettingsNav eventId={id} kind={kind} tabs={tabsFor(kind)} />
      {/* One save bar for the whole tab (SaveBar): panels register their unsaved edits with it. */}
      <SaveBarProvider>
        <div className="space-y-6">{children}</div>
      </SaveBarProvider>
    </div>
  );
}
