import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { apexDomain, isApexHost } from '@/lib/clanContext';
import { verifyUser } from '@/lib/auth';
import { PLANS, TRIAL_DAYS, checkoutUrl } from '@/lib/plans';
import { freemiumEnforced } from '@/lib/entitlements';
import { db } from '@/db';
import { clanStaff, clans } from '@/db/schema';
import { operatorDiscordId } from '@/lib/welcomeDm';
import { and, eq } from 'drizzle-orm';
import NewClanClient from './NewClanClient';

export const dynamic = 'force-dynamic';

/**
 * Create a clan — on the apex only.
 *
 * Not reachable from inside a clan's site: making a clan is a platform act, and offering it on
 * someone else's subdomain would read as that clan's doing.
 */
export default async function NewClanPage({ searchParams }: { searchParams: Promise<{ plan?: string; created?: string }> }) {
  if (!isApexHost((await headers()).get('host'))) notFound();

  const session = await verifyUser();

  // A paid tier picked on /pricing. Only honoured once caps are enforced and its checkout is configured —
  // before that every size is free and asking for a card would be for nothing.
  const { plan: planParam, created: createdParam } = await searchParams;
  const picked = planParam ? PLANS[planParam as keyof typeof PLANS] : undefined;
  const trialPlan = freemiumEnforced() && picked?.priceUsd && checkoutUrl(picked) ? { id: picked.id, name: picked.name, trialDays: TRIAL_DAYS } : null;

  // Back from "Join the Anvil Discord": show the finished screen, but only for a clan they own.
  let created: string | null = null;
  if (session && createdParam) {
    // clan-scope: global -- the apex create flow; the caller's own owner seat on the clan they just made.
    const [own] = await db
      .select({ slug: clans.slug })
      .from(clans)
      .innerJoin(clanStaff, and(eq(clanStaff.clanId, clans.id), eq(clanStaff.userId, session.userId), eq(clanStaff.role, 'owner')))
      .where(eq(clans.slug, createdParam))
      .limit(1);
    created = own?.slug ?? null;
  }
  const contactId = await operatorDiscordId().catch(() => null);

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
        <NewClanClient apex={apexDomain()} signedIn={session != null} trialPlan={trialPlan} created={created} contactId={contactId} />
      </div>
    </div>
  );
}
