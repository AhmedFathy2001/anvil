import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, users } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { onboardingState } from '@/lib/onboarding';
import { clansOfPerson } from '@/lib/myClans';
import WelcomeClient from './WelcomeClient';

export const dynamic = 'force-dynamic';

/**
 * /welcome — first run, for a person.
 *
 * A PLATFORM page, on the apex, and it has to be: the flow's whole subject is somebody who has no
 * clan yet, so there is no Host that could name one. It is in PLATFORM_ROOTS for that reason, and
 * 'welcome' is a reserved slug so no clan can take the address.
 *
 * The route is reachable on purpose, not only by redirect — somebody who skipped it, or who came
 * back a month later to finish setting up, should be able to type it. Its state is derived from
 * facts (lib/onboarding), so arriving mid-way shows exactly what is left rather than starting over.
 */
export default async function WelcomePage() {
  const session = await verifyUser();
  if (!session?.userId) redirect('/login?return=%2Fwelcome');

  const [state, user, myClans, characters] = await Promise.all([
    onboardingState(session.userId, session.playerId),
    db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: { displayName: true, discordUsername: true },
    }),
    session.playerId == null ? Promise.resolve([]) : clansOfPerson(session.playerId, session.userId),
    session.playerId == null
      ? Promise.resolve([])
      : db.select({ rsn: accounts.rsn }).from(accounts).where(eq(accounts.playerId, session.playerId)),
  ]);

  // Finished it already. Not a 404 — the page exists and is theirs — and not a silent re-run either:
  // send them where the flow would have ended. The bare path is the person page, which spans their
  // clans rather than being any one clan's locker — the right destination for somebody who has just
  // finished setting up across all of them.
  if (state.completedAt) redirect('/profile'); // clan-prefix: platform -- apex-only page

  return (
    <WelcomeClient
      state={state}
      displayName={user?.displayName ?? 'there'}
      discordUsername={user?.discordUsername ?? null}
      clans={myClans.map((c) => ({ slug: c.slug, name: c.name }))}
      characters={characters.map((a) => a.rsn)}
    />
  );
}
