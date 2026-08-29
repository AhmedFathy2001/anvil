import { verifyUser } from '@/lib/auth';
import ClanRosterClient from './ClanRosterClient';
import PendingCoHostInvites from './PendingCoHostInvites';
import { atLeast } from '@/lib/clanRoles';
import { requireClan } from '@/lib/clanContext';
import { pendingCoHostInvites } from '@/lib/coHost';

export const dynamic = 'force-dynamic';

export default async function AdminClanPage() {
  const session = await verifyUser();
  const isAdmin = atLeast(session?.role, 'admin');
  // Co-host invites addressed to this clan — only an admin can accept, so only they see them.
  const clan = await requireClan();
  const pending = isAdmin ? await pendingCoHostInvites(clan.id) : [];
  return (
    <>
      {pending.length > 0 && <PendingCoHostInvites initial={pending} />}
      <ClanRosterClient isAdmin={isAdmin} />
    </>
  );
}
