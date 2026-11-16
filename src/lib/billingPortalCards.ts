// What /portal shows for each clan or creator space someone owns — the pure half (no database), so
// the wording and, above all, WHICH CHECKOUT a button points at can be tested without a page.
//
// A clan's card reads the clan ladder (lib/plans) and links clan checkouts; a creator space's reads
// its own catalogue (lib/creatorCatalog) and links creator checkouts. Neither ever offers the other's
// tiers. A tier whose checkout URL is not configured has no button, the same rule for both.

import { PLANS, PLAN_IDS, checkoutUrl, overMemberCap, planOf, type Plan } from '@/lib/plans';
import { CREATOR_BUYABLE, creatorCheckoutUrl, creatorPlanOf, type CreatorPlan } from '@/lib/creatorCatalog';
import { buyWording, chargeText, clanBuy, creatorBuy } from '@/lib/buyOffer';
import { tierNameOf } from '@/lib/planTrialRules';
import { SECOND_MEMBERSHIP_WARNING } from '@/lib/supporterDuplicates';
import { creatorPlanCard, type SeatMeter } from '@/lib/creatorPlans';
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
  /**
   * It has had its one trial (Anvil's own, Gumroad's, or a membership): its buttons open the pay-now
   * product only (lib/planTrials clansWithTrialUsed). Absent reads as not used.
   */
  trialUsed?: boolean;
  /** Its running trial from Anvil (lib/planTrials), if any. */
  siteTrial?: { tier: string; endsAt: number } | null;
  /** Its other open Gumroad memberships (lib/extraMemberships): the older one to cancel, or one waiting for its first charge. */
  extras?: { state: string; subscriptionId: string; plan: string; trialEndsAt: number | null }[];
}

/** A checkout button as the portal draws it. */
export interface CardButton {
  label: string;
  /** Null with `soon`: this row has had its trial and the pay-now checkout is not configured yet. */
  href: string | null;
  detail: string;
  soon?: boolean;
  /** "Skip trial, pay now", beside a "Start free trial" button. */
  skipHref?: string | null;
  /** What pressing it does to their card, said before they press. */
  note?: string;
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
  upgrade: CardButton | null;
  /** Every other tier above the current one, each its own checkout: the button is a suggestion, not the only way up. */
  others: { label: string; href: string; detail: string }[];
  /** The Gumroad membership behind it, ended or not — its manage page updates the card, cancels or restarts. */
  subscriptionId: string | null;
  /** On free with nothing to offer yet. */
  freeNote: string | null;
  /** A trial from Anvil running on it: the tier lent, and when it ends (the admin plan page has the detail). */
  siteTrial: { tierName: string; endsAt: number } | null;
  /** Older memberships still charging after an upgrade purchase: each needs cancelling on Gumroad. */
  toCancel: { subscriptionId: string; tierName: string }[];
  /** A second membership in Gumroad's free period that takes over at its first payment. */
  waiting: { subscriptionId: string; tierName: string; startsAt: number | null } | null;
  /** When a held membership's first payment is due (`held`). */
  heldStartsAt: number | null;
}

/** The extra-membership and trial fields of a card, the same for both catalogues. */
function extrasOf(row: OwnedBillingRow, now: number): Pick<BillingCardModel, 'siteTrial' | 'toCancel' | 'waiting' | 'heldStartsAt'> {
  const extras = row.extras ?? [];
  const wait = extras.find((e) => e.state === 'waiting');
  const trialEnd = row.trialEndsAt ? Date.parse(row.trialEndsAt) : NaN;
  return {
    siteTrial: row.siteTrial && row.siteTrial.endsAt > now ? { tierName: tierNameOf(row.kind, row.siteTrial.tier), endsAt: row.siteTrial.endsAt } : null,
    toCancel: extras.filter((e) => e.state === 'to_cancel').map((e) => ({ subscriptionId: e.subscriptionId, tierName: tierNameOf(row.kind, e.plan) })),
    waiting: wait ? { subscriptionId: wait.subscriptionId, tierName: tierNameOf(row.kind, wait.plan), startsAt: wait.trialEndsAt } : null,
    heldStartsAt: Number.isFinite(trialEnd) ? trialEnd : null,
  };
}

/**
 * One tier's button for this row, by the one-trial rule (lib/buyOffer): a row that has had its trial
 * gets the pay-now checkout or "Subscribing opens soon"; one that has not gets the original product
 * (Gumroad's trial when that is on) with "Skip trial, pay now" beside it.
 */
function buttonFor(row: OwnedBillingRow, tier: Plan | CreatorPlan, label: string, detail: string, moving: boolean): CardButton | null {
  const buttons = row.kind === 'creator' ? creatorBuy(tier as CreatorPlan, row.gumroadRef, 'monthly', !!row.trialUsed) : clanBuy(tier as Plan, row.gumroadRef, 'monthly', !!row.trialUsed);
  const wording = buyWording(buttons, { tierName: tier.name, charge: chargeText(tier.priceUsd ?? 0), verb: label });
  if (!wording) return null;
  // Moving between paid tiers is a NEW membership: said in one line before they buy.
  const note = moving && wording.primary.href ? `${wording.note} ${SECOND_MEMBERSHIP_WARNING}` : wording.note;
  return {
    label: buttons.kind === 'trial' ? `${wording.primary.label}: ${tier.name}` : wording.primary.label,
    href: wording.primary.href,
    detail,
    soon: buttons.kind === 'soon',
    skipHref: wording.secondary?.href ?? null,
    note,
  };
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
  const upgrade =
    higher && !held
      ? buttonFor(row, higher, buttonLabel(higher.name, { renewing, lapsed, onTrial, hasSubscription }), `up to ${higher.memberCap?.toLocaleString('en-US')} members`, hasSubscription && !renewing)
      : null;
  // The other tiers above this one that still hold the roster (never while a trial is held or a renewal is due).
  const others =
    held || renewing || !upgrade?.href
      ? []
      : paid
          .filter((p) => p !== higher && plan.memberCap != null && p.memberCap! > plan.memberCap && p.memberCap! >= members)
          .flatMap((p) => {
            const to = buttonFor(row, p, p.name, '', false)?.href;
            return to ? [{ label: p.name, href: to, detail: `up to ${p.memberCap?.toLocaleString('en-US')} members · $${p.priceUsd}/mo` }] : [];
          });
  return {
    ...extrasOf(row, now),
    id: row.id,
    slug: row.slug,
    name: row.name,
    creator: false,
    others,
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
    upgrade,
    subscriptionId: row.subscriptionId,
    freeNote: !higher && plan.priceUsd === 0 && !onTrial ? 'On the free tier. Paid tiers add room for a bigger roster whenever you need it.' : null,
  };
}

/** "Summer Bingo has" / "Summer Bingo and Autumn Bingo, running at the same time, have". */
function overWhat(meter: SeatMeter | null): string {
  const names = meter?.peakEvents.map((e) => e.name) ?? [];
  if (names.length === 0) return 'Your events have';
  if (names.length === 1) return `${names[0]} has`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}, running at the same time, have`;
}

/** A creator space's card: the creator catalogue, metered by players at once across its events, creator checkouts. */
export function creatorCardModel(
  row: OwnedBillingRow,
  meter: SeatMeter | null,
  now = Date.now(),
): BillingCardModel {
  const plan = creatorPlanOf(row.plan);
  const card = creatorPlanCard({ clanPlan: row.plan, meter });
  const { onTrial, trialDaysLeft } = trialOf(row, now);
  const lapsed = lapsedOf(row, now);
  const free = plan.priceUsd === 0;
  const hasSubscription = !!row.subscriptionId && !free;
  // Only creator tiers with a configured checkout (GUMROAD_URL_CREATOR_*): a missing one has no button.
  const paid = CREATOR_BUYABLE.filter((p) => creatorCheckoutUrl(p));
  const held = onTrial && free && !!row.subscriptionId;
  const renewing = lapsed && !free && paid.includes(plan);
  // A creator space moves up by players at once across its events (creatorPlanCard.next), never by roster size.
  const higher = renewing ? plan : card.next ? (paid.find((p) => p.id === card.next!.id) ?? null) : null;
  const capText = card.playersCap == null ? '∞' : card.playersCap.toLocaleString('en-US');
  const upgrade =
    higher && !held
      ? buttonFor(
          row,
          higher,
          buttonLabel(higher.name, { renewing, lapsed, onTrial, hasSubscription }),
          [higher.playersPerEvent != null ? `up to ${higher.playersPerEvent.toLocaleString('en-US')} players at once` : null, ...(renewing ? [] : higher.perks)].filter(Boolean).join(' · '),
          hasSubscription && !renewing,
        )
      : null;
  // The other creator tiers above this one (never while a trial is held or a renewal is due).
  const others =
    held || renewing || !upgrade?.href
      ? []
      : paid
          .filter((p) => p !== higher && (p.priceUsd ?? 0) > (plan.priceUsd ?? 0))
          .flatMap((p) => {
            const to = buttonFor(row, p, p.name, '', false)?.href;
            return to
              ? [{ label: p.name, href: to, detail: [p.playersPerEvent != null ? `up to ${p.playersPerEvent.toLocaleString('en-US')} players at once` : null, `$${p.priceUsd}/mo`].filter(Boolean).join(' · ') }]
              : [];
          });
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    creator: true,
    ...extrasOf(row, now),
    others,
    tierName: card.planName,
    priceUsd: plan.priceUsd,
    meter: meter
      ? meter.current
        ? `At once across your events: ${meter.peak.toLocaleString('en-US')} / ${capText} players, counted per event they’re in`
        : `Biggest past event: ${meter.peak.toLocaleString('en-US')} / ${capText} players`
      : `Up to ${card.playersCap == null ? 'any number of' : card.playersCap.toLocaleString('en-US')} players at once across your events`,
    onTrial,
    trialDaysLeft,
    held,
    lapsed,
    overdue: lapsed && !free,
    overLine: card.over
      ? `${overWhat(meter)} more players at once than ${card.planName} allows. Everyone still gets in for now — the next tier gives you room.`
      : null,
    upgrade,
    subscriptionId: row.subscriptionId,
    freeNote: !higher && free && !onTrial ? 'On the free tier. Paid tiers add room for more players whenever your events need it.' : null,
  };
}
