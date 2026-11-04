import { redirect } from 'next/navigation';

import { verifyAdmin, verifyUser } from '@/lib/auth';
import { clanGrant } from '@/lib/clanGrants';
import { requireClan } from '@/lib/clanContext';
import { clanHref } from '@/lib/clanPath';
import { isCreatorSpace } from '@/lib/creatorSpaces';
import CreatorSettings from '../clan/CreatorSettings';
import DeleteClan from '../clan/DeleteClan';

export const dynamic = 'force-dynamic';

/**
 * A creator space's settings: its name, page, channels, highlights, `!join` and overlay. A space is
 * not a clan, so it does not live at /admin/clan (which sends a space here, keeping any #anchor —
 * clan/MovedToSpace). A clan asking for this address goes back to its own settings.
 */
export default async function SpaceSettingsPage() {
  const clan = await requireClan();
  if (!isCreatorSpace(clan)) redirect(await clanHref('/admin/clan'));
  if (!(await verifyAdmin())) redirect(await clanHref('/admin/people'));
  const session = await verifyUser();
  const grant = session ? await clanGrant(clan.id, session.userId) : null;
  return (
    <>
      <CreatorSettings />
      <div className="mt-6">
        <DeleteClan slug={clan.slug} isOwner={!!grant?.isOwner} space />
      </div>
    </>
  );
}
