import { redirect } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import { clanHref } from '@/lib/clanPath';
import { staffTab, tabHref } from '@/lib/eventSettingsTabs';
import EventEditorsPanel from '../../EventEditorsPanel';
import { loadSettings } from '../load';

export const dynamic = 'force-dynamic';

/** Settings › Staff (a clan): one job on this board for someone who shouldn't have it everywhere. */
export default async function StaffSettingsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { id, kind, isAdmin } = await loadSettings((await params).eventId);
  // A space keeps its board staff with the stream (its mods).
  if (staffTab(kind) !== 'staff') redirect(await clanHref(`${tabHref(id, staffTab(kind))}#staff`));
  return (
    <>
      {isAdmin ? (
        <div id="staff" className="scroll-mt-28 rounded-xl">
          <EventEditorsPanel eventId={id} />
        </div>
      ) : (
        <p className="text-sm text-text-muted">Only the clan&rsquo;s admins hand out board jobs.</p>
      )}
      <p className="text-sm text-text-muted">
        Entry fees, prizes and the payout split are on the{' '}
        <ClanLink href={`/admin/events/${id}/payouts`} className="text-gold hover:underline">
          Prizes tab
        </ClanLink>
        .
      </p>
    </>
  );
}
