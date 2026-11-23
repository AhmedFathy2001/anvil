import { notFound, redirect } from 'next/navigation';
import { and, desc, eq, isNull, ne } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import { requireClan } from '@/lib/clanContext';
import { clanHref } from '@/lib/clanPath';
import { activePracticeBoard } from '@/lib/practice';
import { PRACTICE_MAX_PLAYERS, PRACTICE_MAX_TILES, practiceAllowedForPlan } from '@/lib/practiceRules';
import PracticeSetup from './PracticeSetup';

export const dynamic = 'force-dynamic';

/** Start a practice board (lib/practice): one screen, for this clan's admins. */
export default async function PracticeSetupPage() {
  const clan = await requireClan();
  const session = await verifyUser();
  if (!session || !atLeast(session.role, 'admin') || !practiceAllowedForPlan(clan.plan)) notFound();
  // One at a time: a running one is where this button leads.
  const active = await activePracticeBoard(clan.id);
  if (active) redirect(await clanHref(`/events/practice/${active.id}`));

  // The admin's own characters in this clan, main first: they start on the board.
  const own = await db
    .select({ id: clanMemberships.id, rsn: accounts.rsn })
    .from(clanMemberships)
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .where(
      and(
        eq(clanMemberships.clanId, clan.id),
        eq(accounts.playerId, session.playerId),
        isNull(clanMemberships.leftAt),
        ne(clanMemberships.kind, 'event'),
      ),
    )
    .orderBy(desc(accounts.isPrimary), clanMemberships.id);

  return (
    <div className="max-w-3xl">
      <PracticeSetup clanName={clan.name} ownSeats={own.slice(0, 1)} maxPlayers={PRACTICE_MAX_PLAYERS} maxTiles={PRACTICE_MAX_TILES} />
    </div>
  );
}
