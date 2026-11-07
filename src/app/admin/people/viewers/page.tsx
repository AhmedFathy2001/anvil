import { redirect } from 'next/navigation';

import { verifyUser } from '@/lib/auth';
import { holdsModeratorTier } from '@/lib/clanRoles';
import { requireClan } from '@/lib/clanContext';
import { clanHref } from '@/lib/clanPath';
import { streamsEvents } from '@/lib/creatorSpaces';
import PastViewersClient from './PastViewersClient';

export const dynamic = 'force-dynamic';

// "Past viewers" tab of People (lib/eventPlayers): the event players of a streaming space's events.
// Moderator tier, like the roster. A clan without Streaming has none to show, so it goes back to People.
export default async function PastViewersPage() {
  const [session, clan] = await Promise.all([verifyUser(), requireClan()]);
  if (!streamsEvents(clan) || !holdsModeratorTier(session)) {
    redirect(await clanHref('/admin/people'));
  }
  return <PastViewersClient />;
}
