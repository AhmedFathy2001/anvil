import { redirect } from 'next/navigation';

import { verifyAdmin, verifyUser } from '@/lib/auth';
import { clanGrant } from '@/lib/clanGrants';
import { requireClan } from '@/lib/clanContext';
import { clanHref } from '@/lib/clanPath';
import ProfileClient from './ProfileClient';
import ClanNameSettings from './ClanNameSettings';
import DeleteClan from './DeleteClan';
import BlockedClans from './BlockedClans';
import { listBlockedClans } from '@/lib/clanBlocks';
import LookSettings from './LookSettings';
import MovedToSpace from './MovedToSpace';
import StreamingSettings from './StreamSettings';
import { isCreatorSpace } from '@/lib/creatorSpaces';

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

  // Deleting is the owner's alone, so it is resolved here rather than trusted from the client — an
  // admin sees this page without ever seeing the button.
  const [clan, session] = await Promise.all([requireClan(), verifyUser()]);
  const grant = session ? await clanGrant(clan.id, session.userId) : null;

  // A creator space's settings are at /admin/space (a space is not a clan).
  if (isCreatorSpace(clan)) return <MovedToSpace />;

  return (
    <>
      <ClanNameSettings />
      {/* The name is passed so the image field's fallback crest is this clan's real one, rather than
          a generic letter that changes the moment the page saves. */}
      <ProfileClient clanName={clan.name} />
      {/* Colours from its own logo and banner (lib/artPalette). */}
      <LookSettings name={clan.name} />
      {/* "Streaming": viewers from the clan's stream can join its events as event players. */}
      <StreamingSettings />
      {/* Anti-spam: clans whose invites are refused (lib/clanBlocks). */}
      <BlockedClans initial={await listBlockedClans(clan.id)} />
      <DeleteClan slug={clan.slug} isOwner={!!grant?.isOwner} />
    </>
  );
}
