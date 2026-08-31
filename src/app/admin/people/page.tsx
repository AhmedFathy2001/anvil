import { verifyUser } from '@/lib/auth';
import ClanRosterClient from './ClanRosterClient';
import PendingCoHostInvites from './PendingCoHostInvites';
import JoinRequests from './JoinRequests';
import { atLeast } from '@/lib/clanRoles';
import { requireClan } from '@/lib/clanContext';
import { pendingCoHostInvites } from '@/lib/coHost';
import { pendingRequests } from '@/lib/guestAdmission';

export const dynamic = 'force-dynamic';

export default async function AdminClanPage() {
  const session = await verifyUser();
  const isAdmin = atLeast(session?.role, 'admin');
  // Co-host invites addressed to this clan — only an admin can accept, so only they see them.
  const clan = await requireClan();
  // Join requests are MODERATOR work — the same tier that can already remove somebody — while a
  // co-host invite speaks for the whole clan and stays with an admin. Two different bars, so two
  // different reads rather than one `isStaff`.
  const isModerator = atLeast(session?.role, 'moderator');
  const [pending, requests] = await Promise.all([
    isAdmin ? pendingCoHostInvites(clan.id) : Promise.resolve([]),
    isModerator ? pendingRequests(clan.id) : Promise.resolve([]),
  ]);
  return (
    <>
      {requests.length > 0 && <JoinRequests initial={requests} />}
      {pending.length > 0 && <PendingCoHostInvites initial={pending} />}
      <ClanRosterClient isAdmin={isAdmin} />
    </>
  );
}
