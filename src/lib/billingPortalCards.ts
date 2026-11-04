// What /portal shows for each clan or creator space someone owns — the pure half (no database), so
// the wording and, above all, WHICH CHECKOUT a button points at can be tested without a page.
//
// A clan's card reads the clan ladder (lib/plans) and links clan checkouts; a creator space's reads
// its own catalogue (lib/creatorCatalog) and links creator checkouts. Neither ever offers the other's
// tiers. A tier whose checkout URL is not configured has no button, the same rule for both.

import { PLANS, PLAN_IDS, TRIAL_DAYS, checkoutUrl, checkoutUrlWithRef, overMemberCap, planOf } from '@/lib/plans';
import { CREATOR_BUYABLE, creatorCheckoutUrl, creatorCheckoutUrlWithRef, creatorPlanOf } from '@/lib/creatorCatalog';
import { creatorPlanCard } from '@/lib/creatorPlans';
import { billingStatus, subscriptionFacts } from '@/lib/clanBilling';

/** The billing columns of one owned row. */
export interface OwnedBillingRow {
  id: number;
  slug: string;
  name: string;
  kind: string;
  plan: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  subscriptionId: string | null;
  gumroadRef: string | null;
}

export interface BillingCardModel {
  id: number;
  slug: string;
  name: string;
  creator: boolean;
  /** "Free", "Silver", "Partner"… in the row's own catalogue. */
  tierName: string;
  /** Monthly list price, when the tier is paid. */
  priceUsd: number | null;
  /** "12 / 50 members" for a clan; "Biggest event: 42 / 50 players" for a creator space. */
  meter: string;
  onTrial: boolean;
  trialDaysLeft: number;
  /** A new membership whose trial is running while the row stays on free (the trial is once per row). */
  held: boolean;
  /** Its membership stopped being paid — a failed card or an end — or the renewal is overdue. */
  lapsed: boolean;
  /** Lapsed while still on the paid tier (overdue), as opposed to already dropped to free (ended). */
  overdue: boolean;
  /** Orange warning: the roster / biggest event has outgrown the tier. */
  overLine: string | null;
  /** The one button: a checkout from the row's own catalogue. Null when none fits or none is configured. */
  upgrade: { label: string; href: string; detail: string } | null;
  /** The Gumroad membership behind it, ended or not — its manage page updates the card, cancels or restarts. */
  subscriptionId: string | null;
  /** On free with nothing to offer yet. */
  freeNote: string | null;
}

function trialOf(row: OwnedBillingRow, now: number): { onTrial: boolean; trialDaysLeft: number } {
  const ms = row.trialEndsAt ? Date.parse(row.trialEndsAt) : NaN;
  const onTrial = Number.isFinite(ms) && ms > now;
  return { onTrial, trialDaysLeft: onTrial ? Math.ceil((ms - now) / 86_400_000) : 0 };
}

function lapsedOf(row: OwnedBillingRow, now: number): boolean {
  const { state } = billingStatus(
    { plan: row.plan, trialEndsAt: row.trialEndsAt, currentPeriodEnd: row.currentPeriodEnd, cancelAtPeriodEnd: row.cancelAtPeriodEnd, ...subscriptionFacts(row.subscriptionId, row.plan) },
    now,
  );
  return state === 'ended' || state === 'lapsed';
}

function buttonLabel(name: string, o: { renewing: boolean; lapsed: boolean; onTrial: boolean; hasSubscription: boolean }): string {
  if (o.renewing) return `Renew ${name}`;
  if (o.lapsed) return `Subscribe to ${name}`;
  return o.onTrial || !o.hasSubscription ? `Upgrade to ${name}` : `Move to ${name}`;
}

/** A clan's card: the clan ladder, roster-metered, clan checkouts. */
export function clanCardModel(row: OwnedBillingRow, members: number, now = Date.now()): BillingCardModel {
  const plan = planOf(row.plan);
  const { onTrial, trialDaysLeft } = trialOf(row, now);
  const lapsed = lapsedOf(row, now);
  const overCap = overMemberCap(plan, members);
  const hasSubscription = !!row.subscriptionId && plan.id !== 'free';
  const paid = PLAN_IDS.map((id) => PLANS[id]).filter((p) => p.memberCap != null && checkoutUrl(p));
  // What "upgrade" points at: the smallest tier that holds the roster when it has outgrown this one
  // (a lapsed Silver clan of 296 dropped to free needs Silver, not the next step, Bronze), else the
  // next tier up.
  const fits = paid.find((p) => p.memberCap! >= members);
  const held = onTrial && plan.priceUsd === 0 && !!row.subscriptionId;
  // An overdue clan still on its paid plan renews that plan.
  const renewing = lapsed && plan.priceUsd !== 0 && paid.includes(plan);
  const higher = renewing ? plan : overCap && fits ? fits : paid.find((p) => plan.memberCap != null && p.memberCap! > plan.memberCap);
  const cap = plan.memberCap == null ? '∞' : plan.memberCap.toLocaleString('en-US');
  const href = higher && !held ? checkoutUrlWithRef(higher, row.gumroadRef) : null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    creator: false,
    tierName: plan.name,
    priceUsd: plan.priceUsd,
    meter: `${members.toLocaleString('en-US')} / ${cap} members`,
    onTrial,
    trialDaysLeft,
    held,
    lapsed,
    overdue: lapsed && plan.priceUsd !== 0,
    overLine: overCap
      ? `This roster is over the ${plan.name} cap of ${cap}. Nothing breaks and nobody is removed — but the next tier gives you room.`
      : null,
    upgrade:
      higher && href
        ? { label: buttonLabel(higher.name, { renewing, lapsed, onTrial, hasSubscription }), href, detail: `up to ${higher.memberCap?.toLocaleString('en-US')} members` }
        : null,
    subscriptionId: row.subscriptionId,
    freeNote:
      !higher && plan.priceUsd === 0 && !onTrial
        ? `On the free tier. Your ${TRIAL_DAYS}-day trial of the paid tiers is available whenever your roster needs it.`
        : null,
  };
}

/** A creator space's card: the creator catalogue, metered by players per event, creator checkouts. */
export function creatorCardModel(
  row: OwnedBillingRow,
  biggest: { name: string; players: number } | null,
  now = Date.now(),
): BillingCardModel {
  const plan = creatorPlanOf(row.plan);
  const card = creatorPlanCard({ clanPlan: row.plan, biggest });
  const { onTrial, trialDaysLeft } = trialOf(row, now);
  const lapsed = lapsedOf(row, now);
  const free = plan.priceUsd === 0;
  const hasSubscription = !!row.subscriptionId && !free;
  // Only creator tiers with a configured checkout (GUMROAD_URL_CREATOR_*): a missing one has no button.
  const paid = CREATOR_BUYABLE.filter((p) => creatorCheckoutUrl(p));
  const held = onTrial && free && !!row.subscriptionId;
  const renewing = lapsed && !free && paid.includes(plan);
  // A creator space moves up by players per event (creatorPlanCard.next), never by roster size.
  const higher = renewing ? plan : card.next ? (paid.find((p) => p.id === card.next!.id) ?? null) : null;
  const capText = card.playersCap == null ? '∞' : card.playersCap.toLocaleString('en-US');
  const href = higher && !held ? creatorCheckoutUrlWithRef(higher, row.gumroadRef) : null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    creator: true,
    tierName: card.planName,
    priceUsd: plan.priceUsd,
    meter: card.biggest
      ? `Biggest event: ${card.biggest.players.toLocaleString('en-US')} / ${capText} players`
      : `Up to ${card.playersCap == null ? 'any number of' : card.playersCap.toLocaleString('en-US')} players per event`,
    onTrial,
    trialDaysLeft,
    held,
    lapsed,
    overdue: lapsed && !free,
    overLine: card.over
      ? `${card.biggest?.name ?? 'Your biggest event'} has more players than ${card.planName} allows per event. Everyone still gets in for now — the next tier gives you room.`
      : null,
    upgrade:
      higher && href
        ? {
            label: buttonLabel(higher.name, { renewing, lapsed, onTrial, hasSubscription }),
            href,
            detail: [
              higher.playersPerEvent != null ? `up to ${higher.playersPerEvent.toLocaleString('en-US')} players per event` : null,
              ...(renewing ? [] : higher.perks),
            ]
              .filter(Boolean)
              .join(' · '),
          }
        : null,
    subscriptionId: row.subscriptionId,
    freeNote:
      !higher && free && !onTrial
        ? `On the free tier. Your ${TRIAL_DAYS}-day trial of the paid tiers is available whenever your events need it.`
        : null,
  };
}
