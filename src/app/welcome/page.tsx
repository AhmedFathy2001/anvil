import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, detectedAccounts, users } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { onboardingState } from '@/lib/onboarding';
import { clansOfPerson } from '@/lib/myClans';
import { isCreatorSpace } from '@/lib/creatorSpaces';
import { onboardingNext } from '@/lib/firstLogin';
import { runningXpCheck } from '@/lib/xpCheckRead';
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
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  // Where they were heading when they signed in for the first time (lib/firstLogin). Offered as a
  // way out of the flow at every step, and where finishing lands.
  const next = onboardingNext((await searchParams).next);
  const session = await verifyUser();
  if (!session?.userId) redirect(`/login?return=${encodeURIComponent(next ? `/welcome?next=${encodeURIComponent(next)}` : '/welcome')}`);

  const [state, user, myClans, characters, pending, xpCheck] = await Promise.all([
    onboardingState(session.userId, session.playerId),
    db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: { displayName: true, discordUsername: true },
    }),
    session.playerId == null ? Promise.resolve([]) : clansOfPerson(session.playerId, session.userId),
    session.playerId == null
      ? Promise.resolve([])
      : db
          .select({ rsn: accounts.rsn, rsnNormalized: accounts.rsnNormalized, accountHash: accounts.accountHash })
          .from(accounts)
          .where(eq(accounts.playerId, session.playerId)),
    // Characters the plugin saw but could not link by itself (a clan already lists them).
    db.query.detectedAccounts.findMany({
      where: and(eq(detectedAccounts.userId, session.userId), eq(detectedAccounts.status, 'pending')),
      columns: { rsnNormalized: true, accountHash: true },
    }),
    // An XP check left running: the fold it lives in has to open on it, or it looks lost.
    runningXpCheck(session.userId),
  ]);
  // Counted the way /api/profile/connection counts `suggestions`, because the plugin card compares
  // the two: a different count here would read as "something changed" on the first poll.
  const detectedCount = pending.filter(
    (d) =>
      !characters.some((a) => a.rsnNormalized === d.rsnNormalized) &&
      !(d.accountHash && characters.some((a) => a.accountHash === d.accountHash)),
  ).length;

  // Finished it already. Not a 404 — the page exists and is theirs — and not a silent re-run either:
  // send them where the flow would have ended. The bare path is the person page, which spans their
  // clans rather than being any one clan's locker — the right destination for somebody who has just
  // finished setting up across all of them.
  if (state.completedAt) redirect(next ?? '/profile'); // clan-prefix: platform -- apex-only page

  return (
    <WelcomeClient
      state={state}
      displayName={user?.displayName ?? 'there'}
      discordUsername={user?.discordUsername ?? null}
      // Clans only: a creator space is not a clan ("You're in 2 clans" must not count one).
      clans={myClans.filter((c) => !isCreatorSpace({ kind: c.clanKind })).map((c) => ({ slug: c.slug, name: c.name }))}
      characters={characters.map((a) => a.rsn)}
      detectedCount={detectedCount}
      xpCheckRunning={xpCheck != null}
      next={next}
    />
  );
}
