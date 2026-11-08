import { verifyUser } from '@/lib/auth';
import ClanRosterClient from './ClanRosterClient';
import PendingCoHostInvites from './PendingCoHostInvites';
import CompetitionInvites from '@/components/weekly/CompetitionInvites';
import { competitionInvitesForClan } from '@/lib/competitionTeamsDb';
import JoinRequests from './JoinRequests';
import { atLeast, canGrantRole, holdsModeratorTier } from '@/lib/clanRoles';
import { requireClan } from '@/lib/clanContext';
import { pendingCoHostInvites } from '@/lib/coHost';
import { pendingRequests } from '@/lib/guestAdmission';
import { isCreatorSpace } from '@/lib/creatorSpaces';
import { creatorPlayers } from '@/lib/creatorHome';
import CreatorPlayers from './CreatorPlayers';

export const dynamic = 'force-dynamic';

export default async function AdminClanPage() {
  const session = await verifyUser();
  const isAdmin = atLeast(session?.role, 'admin');
  // Co-host invites addressed to this clan — only an admin can accept, so only they see them.
  const clan = await requireClan();
  // Join requests are MODERATOR work — the same tier that can already remove somebody — while a
  // co-host invite speaks for the whole clan and stays with an admin. Two different bars, so two
  // different reads rather than one `isStaff`.
  // Moderator TIER: a clan treasurer is in it, a board-only grant is not (lib/clanRoles).
  const isModerator = holdsModeratorTier(session);
  const [pending, requests, compInvites] = await Promise.all([
    isAdmin ? pendingCoHostInvites(clan.id) : Promise.resolve([]),
    isModerator ? pendingRequests(clan.id) : Promise.resolve([]),
    // Clan vs clan competition invites — an owner/admin answers, same bar as co-hosting.
    isAdmin ? competitionInvitesForClan(clan.id) : Promise.resolve([]),
  ]);
  if (isCreatorSpace(clan)) {
    return (
      <>
        {requests.length > 0 && <JoinRequests initial={requests} />}
        {pending.length > 0 && <PendingCoHostInvites initial={pending} />}
        <CreatorPlayers players={await creatorPlayers(clan.id)} />
      </>
    );
  }
  return (
    <>
      {requests.length > 0 && <JoinRequests initial={requests} />}
      {pending.length > 0 && <PendingCoHostInvites initial={pending} />}
      {compInvites.length > 0 && <CompetitionInvites initial={compInvites} />}
      {/* Only the owner can hand out Admin (Staff & roles' rule), so only they are offered it. */}
      <ClanRosterClient isAdmin={isAdmin} canGrantAdmin={canGrantRole(session?.role, 'admin')} />
    </>
  );
}
