import { redirect } from 'next/navigation';

import StreamOverlayCard from '@/app/admin/dashboard/StreamOverlayCard';
import { clanHref } from '@/lib/clanPath';
import { staffTab, tabHref } from '@/lib/eventSettingsTabs';
import EventEditorsPanel from '../../EventEditorsPanel';
import { loadSettings } from '../load';

export const dynamic = 'force-dynamic';

/**
 * Settings › Stream (a creator space, or a clan with Streaming on): the OBS overlay, its look and the
 * channel panels — and, in a space, its mods (board staff).
 */
export default async function StreamSettingsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { id, kind, isAdmin } = await loadSettings((await params).eventId);
  if (!kind.streams) redirect(await clanHref(tabHref(id, 'event')));
  return (
    <>
      {isAdmin && (
        <div id="overlay" className="scroll-mt-28 rounded-xl">
          <StreamOverlayCard eventId={id} defaultOpen />
        </div>
      )}
      {isAdmin && staffTab(kind) === 'stream' && (
        <div id="staff" className="scroll-mt-28 rounded-xl">
          <EventEditorsPanel eventId={id} />
        </div>
      )}
      {!isAdmin && <p className="text-sm text-text-muted">The overlay and mods are set by the space&rsquo;s admins.</p>}
    </>
  );
}
