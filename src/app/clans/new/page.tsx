import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { apexDomain, isApexHost } from '@/lib/clanContext';
import { verifyUser } from '@/lib/auth';
import { PLANS, TRIAL_DAYS, checkoutUrl } from '@/lib/plans';
import { freemiumEnforced } from '@/lib/entitlements';
import NewClanClient from './NewClanClient';

export const dynamic = 'force-dynamic';

/**
 * Create a clan — on the apex only.
 *
 * Not reachable from inside a clan's site: making a clan is a platform act, and offering it on
 * someone else's subdomain would read as that clan's doing.
 */
export default async function NewClanPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  if (!isApexHost((await headers()).get('host'))) notFound();

  const session = await verifyUser();

  // A paid tier picked on /pricing. Only honoured once caps are enforced and its checkout is configured —
  // before that every size is free and asking for a card would be for nothing.
  const { plan: planParam } = await searchParams;
  const picked = planParam ? PLANS[planParam as keyof typeof PLANS] : undefined;
  const trialPlan = freemiumEnforced() && picked?.priceUsd && checkoutUrl(picked) ? { id: picked.id, name: picked.name, trialDays: TRIAL_DAYS } : null;

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold">Start a clan</h1>
      <p className="mt-1 text-sm text-gray-400">
        {trialPlan ? (
          <>
            Make the clan first — it&rsquo;s live the moment you press the button. Then you&rsquo;ll start your{' '}
            {TRIAL_DAYS}-day {trialPlan.name} trial on Gumroad.
          </>
        ) : (
          <>
            Free, and live the moment you press the button. Add members with the RuneLite plugin&rsquo;s
            roster sync, or by hand.
          </>
        )}
      </p>
      <div className="mt-6">
        <NewClanClient apex={apexDomain()} signedIn={session != null} trialPlan={trialPlan} />
      </div>
    </div>
  );
}
