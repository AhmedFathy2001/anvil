import EarlyBirdBadge from '@/components/EarlyBirdBadge';
import TrialCard from '@/components/TrialCard';
import { ensureClanCheckoutRef } from '@/lib/billing';
import { usd, yearlyPriceUsd, type BillingInterval } from '@/lib/billingInterval';
import { clanBuy, creatorBuy, soonReason } from '@/lib/buyOffer';
import { CAP_GRACE_DAYS } from '@/lib/memberCapRules';
import { CREATOR_PLANS, creatorPlanOf, isCreatorPlanId } from '@/lib/creatorCatalog';
import { freemiumEnforced } from '@/lib/entitlements';
import { PLANS, planOf } from '@/lib/plans';
import { latestPlanTrial, membershipHeld } from '@/lib/planTrials';
import { daysLeft, tierRankOf, trialPhase } from '@/lib/planTrialRules';

/**
 * The clan's or creator space's trial from Anvil, for its owner (components/TrialCard): on the admin
 * plan page and the dashboard. Renders nothing when there is no trial to talk about (none, taken
 * back, paid for at the trial's tier or above, or ended longer ago than the grace window).
 *
 * "Keep <tier>" opens that tier's PAY-NOW checkout: this row has had its trial, so it is never sent
 * to the product that starts Gumroad's (lib/buyOffer).
 */
export default async function PlanTrialPanel({
  clan,
  billing = 'monthly',
  canBuy,
  planHref = null,
  viewerIsStaff = false,
  earlyBird = true,
}: {
  clan: { id: number; kind: string; paidPlan: string };
  billing?: BillingInterval;
  /** Owners buy; other admins see the trial without the button. */
  canBuy: boolean;
  planHref?: string | null;
  viewerIsStaff?: boolean;
  /** False where the page already shows the early-bird line elsewhere (once per page). */
  earlyBird?: boolean;
}) {
  const trial = await latestPlanTrial(clan.id);
  if (!trial) return null;
  const creator = clan.kind === 'creator';
  const paidCovers = tierRankOf(clan.kind, clan.paidPlan) >= tierRankOf(clan.kind, trial.tier);
  const phase = trialPhase({ endsAt: trial.endsAt, revoked: trial.revoked }, paidCovers);
  if (phase === 'none') return null;
  // A membership already bought and waiting for its first charge (on the free tier meanwhile): the
  // page's own notice says so. An ended trial's "Subscribe to get it back" would contradict it, and a
  // running one keeps its dates but loses the button.
  const held = tierRankOf(clan.kind, clan.paidPlan) <= 0 && (await membershipHeld(clan.id));
  if (held && phase === 'just-ended') return null;
  if (held) canBuy = false;

  const enforced = freemiumEnforced();
  const ref = canBuy ? await ensureClanCheckoutRef(clan.id) : null;
  let tierName: string;
  let monthly: number;
  let keeps: string;
  let loses: string;
  let buy;
  let urlEnv: string | undefined;
  if (creator) {
    const tier = isCreatorPlanId(trial.tier) ? CREATOR_PLANS[trial.tier] : CREATOR_PLANS.creator_gold;
    const paid = creatorPlanOf(clan.paidPlan);
    tierName = tier.name;
    monthly = tier.priceUsd ?? 0;
    urlEnv = billing === 'yearly' ? tier.gumroadUrlYearlyEnv : tier.gumroadUrlEnv;
    keeps = 'your space, its events, players and history. Nothing is deleted.';
    loses = enforced
      ? `the space is on ${paid.name}: ${paid.playersPerEvent ?? 'no limit on'} players at once across your events, and the extras above ${paid.name} switch off (follower and sub checks, several events at once, !join in chat, hiding the Anvil mark).`
      : `the space is on ${paid.name}. Limits are not being applied to any space right now, so nothing switches off that day.`;
    buy = creatorBuy(tier, ref, billing, true);
  } else {
    const tier = planOf(trial.tier);
    const paid = planOf(clan.paidPlan);
    tierName = tier.name;
    monthly = tier.priceUsd ?? 0;
    urlEnv = billing === 'yearly' ? tier.gumroadUrlYearlyEnv : tier.gumroadUrlEnv;
    keeps = 'your clan, its events, roster and history. Nobody is removed and nothing is deleted.';
    const cap = paid.memberCap ?? PLANS.free.memberCap;
    loses = `the clan is on ${paid.name} (up to ${cap} members). A roster over ${cap} has ${CAP_GRACE_DAYS} days to subscribe or trim before new members stop being added.${
      enforced ? ` ${tier.name}'s extras switch off (hosting events together with other clans, a custom domain).` : ''
    }`;
    buy = clanBuy(tier, ref, billing, true);
  }
  const yearly = billing === 'yearly';
  const href = canBuy && buy.kind === 'subscribe' ? buy.url : null;
  const soon = canBuy && buy.kind === 'soon';

  return (
    <TrialCard
      tierName={tierName}
      who={creator ? 'space' : 'clan'}
      endsAt={trial.endsAt}
      phase={phase}
      daysLeft={daysLeft(trial.endsAt)}
      keeps={keeps}
      loses={loses}
      href={href}
      soon={soon}
      chargeToday={usd(yearly ? (yearlyPriceUsd(monthly) ?? 0) : monthly)}
      every={yearly ? 'year' : 'month'}
      remindUrl={canBuy ? '/api/admin/plan-trial/remind' : null}
      remindRequested={trial.remindRequested}
      planHref={planHref}
      staffNote={viewerIsStaff && soon ? soonReason(urlEnv) : null}
    >
      {earlyBird && <EarlyBirdBadge />}
    </TrialCard>
  );
}
