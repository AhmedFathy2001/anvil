import { redirect } from 'next/navigation';

import { verifyAdmin } from '@/lib/auth';
import { clanHref } from '@/lib/clanPath';
import ProfileClient from './ProfileClient';
import ClanNameSettings from './ClanNameSettings';

export const dynamic = 'force-dynamic';

/**
 * "Profile" tab of the Clan hub — what the clan is called, and the public face a stranger sees at
 * /c/<slug> (PublicClanHome). The name arrives here from the roster, where it used to sit behind an
 * "Edit clan settings" toggle above the member table: clan-entity configuration filed under the
 * people in it.
 *
 * ADMIN only, like Access: what the clan advertises about itself is a clan-level decision.
 */
export default async function ClanProfilePage() {
  // Not /admin/clan — that IS this page now that Profile is the hub's front door, so sending a
  // non-admin there would bounce them off it forever. People is the surface they can actually use.
  if (!(await verifyAdmin())) redirect(await clanHref('/admin/people'));
  return (
    <>
      <ClanNameSettings />
      <ProfileClient />
    </>
  );
}
