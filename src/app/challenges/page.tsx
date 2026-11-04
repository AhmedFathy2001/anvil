import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import ClanLink from '@/components/ClanLink';
import { isApexHost } from '@/lib/clanContext';
import { verifyUser } from '@/lib/auth';
import { capForPlayer, challengesForPlayer, getH2hPrefs, myH2hCharacters, openCount, recordForPlayer } from '@/lib/h2h';
import ChallengesClient from './ChallengesClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Head-to-head challenges',
  description: 'Challenge a friend one on one: first to a drop, or most kills or XP in a set time. Anvil tracks you both and calls the winner.',
};

// Head-to-head challenges (lib/h2h): a person's, across every clan, so apex only like /supporter.
export default async function ChallengesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!isApexHost((await headers()).get('host'))) notFound();
  const session = await verifyUser();
  const sp = await searchParams;
  const vs = typeof sp.rsn === 'string' ? sp.rsn.slice(0, 20) : '';

  if (!session?.playerId) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <h1 className="display display-lg text-[clamp(1.7rem,4vw,2.2rem)] font-semibold">Head-to-head</h1>
        <p className="mx-auto mt-3 max-w-[52ch] text-text-muted">
          Challenge a friend one on one: first to a drop, or most kills or XP in a set time. Anvil tracks you both and
          calls the winner. Just for bragging rights, never for stakes.
        </p>
        <ClanLink
          href={`/login?return=${encodeURIComponent(vs ? `/challenges?rsn=${encodeURIComponent(vs)}` : '/challenges')}`}
          className="mt-6 inline-block rounded-lg bg-gold px-4 py-2 font-semibold text-brown-dark transition-colors hover:bg-gold-light"
        >
          Sign in to challenge someone
        </ClanLink>
      </div>
    );
  }

  const [challenges, record, cap, open, prefs, characters] = await Promise.all([
    challengesForPlayer(session.playerId),
    recordForPlayer(session.playerId, false),
    capForPlayer(session.playerId),
    openCount(session.playerId),
    getH2hPrefs(session.playerId),
    myH2hCharacters(session.playerId),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <ChallengesClient
        initial={{ challenges, record, cap, open, prefs, characters }}
        presetOpponent={vs}
      />
    </div>
  );
}
