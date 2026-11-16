import { headers } from 'next/headers';
import { slugIn } from '@/lib/clanSlugLookup';
import { notFound, redirect } from 'next/navigation';

import { apexDomain, isApexHost } from '@/lib/clanContext';
import { verifyUser } from '@/lib/auth';
import { PLANS, TRIAL_DAYS, checkoutUrl } from '@/lib/plans';
import { freemiumEnforced } from '@/lib/entitlements';
import { parseBillingInterval, type BillingInterval } from '@/lib/billingInterval';
import { db } from '@/db';
import { clanStaff, clans } from '@/db/schema';
import { operatorDiscordId } from '@/lib/welcomeDm';
import { and, eq } from 'drizzle-orm';
import NewClanClient from './NewClanClient';
import { autoTrialDays } from '@/lib/planTrialRules';

export const dynamic = 'force-dynamic';

/**
 * Create a clan — on the apex only.
 *
 * Not reachable from inside a clan's site: making a clan is a platform act, and offering it on
 * someone else's subdomain would read as that clan's doing.
 */
export default async function NewClanPage({ searchParams }: { searchParams: Promise<{ plan?: string; billing?: string; created?: string }> }) {
  if (!isApexHost((await headers()).get('host'))) notFound();

  const session = await verifyUser();

  // Signed out: straight to the sign-in, which says why ("Sign in to create your clan") and lands
  // back here. This used to render the form's place as a "Sign in with Discord first" card whose
  // only button led to /login, which had its own button.
  if (!session) {
    const { plan } = await searchParams;
    const back = plan ? `/clans/new?plan=${encodeURIComponent(plan)}` : '/clans/new';
    redirect(`/login?return=${encodeURIComponent(back)}`); // clan-prefix: platform -- apex-only page
  }

  // A paid tier picked on /pricing. Only honoured once caps are enforced and its checkout is configured —
  // before that every size is free and asking for a card would be for nothing.
  // ?billing=yearly (the /pricing switch) picks the yearly checkout when that tier has one configured.
  const { plan: planParam, billing: billingParam, created: createdParam } = await searchParams;
  const picked = planParam ? PLANS[planParam as keyof typeof PLANS] : undefined;
  const wanted = parseBillingInterval(billingParam);
  const billing: BillingInterval = picked && wanted === 'yearly' && checkoutUrl(picked, 'yearly') ? 'yearly' : 'monthly';
  // Every new clan starts Anvil's own trial with no card (lib/planTrials), so while those are on the
  // form never ends on a checkout: the clan subscribes later from its plan page, with the pay-now
  // product. Only with automatic trials off does a picked tier go on to its checkout.
  const autoDays = autoTrialDays();
  const trialPlan =
    autoDays <= 0 && freemiumEnforced() && picked?.priceUsd && checkoutUrl(picked, billing)
      ? { id: picked.id, name: picked.name, trialDays: TRIAL_DAYS, billing }
      : null;

  // Back from "Join the Anvil Discord": show the finished screen, but only for a clan they own.
  let created: string | null = null;
  if (session && createdParam) {
    // clan-scope: global -- the apex create flow; the caller's own owner seat on the clan they just made.
    const [own] = await db
      .select({ slug: clans.slug })
      .from(clans)
      .innerJoin(clanStaff, and(eq(clanStaff.clanId, clans.id), eq(clanStaff.userId, session.userId), eq(clanStaff.role, 'owner')))
      .where(slugIn(createdParam, 'clan')) // this page only makes clans
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
            Make the clan first — it&rsquo;s live the moment you press the button. Then you&rsquo;ll{' '}
            {TRIAL_DAYS > 0 ? `start your ${TRIAL_DAYS}-day ${trialPlan.name} free trial on Gumroad.` : `subscribe to ${trialPlan.name} on Gumroad.`}
          </>
        ) : autoDays > 0 ? (
          <>
            Live the moment you press the button, with no card. Your clan starts with {autoDays} days of {PLANS.gold.name} from
            Anvil; after that it is on {PLANS.free.name} ({PLANS.free.capLabel.toLowerCase()}) unless you subscribe. Add members
            with the RuneLite plugin&rsquo;s roster sync, or by hand.
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
