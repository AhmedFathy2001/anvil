// Which checkout a buy button opens, and what it says before it is pressed (the rule itself is
// lib/planTrialRules buyButtons; tests/buy-offer.test.ts).
//
// Every tier has two Gumroad products: the ORIGINAL, which starts with Gumroad's own free trial when
// the owner has one switched on there (TRIAL_DAYS / SUPPORTER_TRIAL_DAYS > 0), and a PAY-NOW copy
// with no trial (the `_NOW` envs, lib/billingInterval). Someone who has never had a trial gets
// "Start free trial" beside "Skip trial, pay now". Someone who has had one — Anvil's own plan trial,
// a Gumroad trial, or a membership — only ever gets the pay-now product, so subscribing never starts
// a second free period; until that product's link is configured they see "Subscribing opens soon".
//
// Pure: no database import.

import { usd, yearlyPriceUsd, type BillingInterval } from './billingInterval.ts';
import { TRIAL_DAYS, checkoutUrlWithRef, trialDaysFrom, type Plan } from './plans.ts';
import { creatorCheckoutUrlWithRef, type CreatorPlan } from './creatorCatalog.ts';
import { buyButtons, type BuyButtons } from './planTrialRules.ts';

/**
 * The length of Gumroad's own free trial on the SUPPORTER product, for display on its "Start free
 * trial" button (GUMROAD_SUPPORTER_TRIAL_DAYS). 0, the default, means that trial is off and nothing
 * mentions one.
 */
export const SUPPORTER_TRIAL_DAYS = trialDaysFrom(process.env.GUMROAD_SUPPORTER_TRIAL_DAYS);

/** A clan tier's buttons for the clan whose checkout `ref` this is. */
export function clanBuy(plan: Plan, ref: string | null | undefined, interval: BillingInterval, trialUsed: boolean): BuyButtons {
  return buyButtons({
    gumroadTrialDays: TRIAL_DAYS,
    trialUsed,
    trialUrl: checkoutUrlWithRef(plan, ref, interval, 'trial'),
    nowUrl: checkoutUrlWithRef(plan, ref, interval, 'now'),
  });
}

/** A creator tier's buttons for the space whose checkout `ref` this is. */
export function creatorBuy(plan: CreatorPlan, ref: string | null | undefined, interval: BillingInterval, trialUsed: boolean): BuyButtons {
  return buyButtons({
    gumroadTrialDays: TRIAL_DAYS,
    trialUsed,
    trialUrl: creatorCheckoutUrlWithRef(plan, ref, interval, 'trial'),
    nowUrl: creatorCheckoutUrlWithRef(plan, ref, interval, 'now'),
  });
}

/** The site route that sends a signed-in person to the Supporter checkout (it adds their ref and re-checks the rule). */
export const SUPPORTER_CHECKOUT = '/api/supporter/checkout';

/** Supporter's buttons. Both go through the site route, which decides the product again on the server. */
export function supporterBuy(trialUsed: boolean, env: Record<string, string | undefined> = process.env): BuyButtons {
  return buyButtons({
    gumroadTrialDays: SUPPORTER_TRIAL_DAYS,
    trialUsed,
    trialUrl: env.GUMROAD_URL_SUPPORTER ? SUPPORTER_CHECKOUT : null,
    nowUrl: env.GUMROAD_URL_SUPPORTER_NOW ? `${SUPPORTER_CHECKOUT}?pay=now` : null,
  });
}

/** "$6.99 a month" / "$69.90 a year". */
export function chargeText(monthlyUsd: number, interval: BillingInterval = 'monthly'): string {
  return interval === 'yearly' ? `${usd(yearlyPriceUsd(monthlyUsd) ?? 0)} a year` : `${usd(monthlyUsd)} a month`;
}

export interface BuyWording {
  /** The main button; null href = not clickable ("Subscribing opens soon"). */
  primary: { label: string; href: string | null };
  /** "Skip trial, pay now", beside "Start free trial". */
  secondary: { label: string; href: string } | null;
  /** What pressing it does to their card, said before they press. */
  note: string;
}

/**
 * The words on a tier's buttons. `verb` is the subscribe button's own label where the page has a
 * better one ("Keep Gold after 14 Mar", "Move to Gold"); the default is "Subscribe to <tier>".
 * `charge` is chargeText() for the tier at the interval, or the page's own price words.
 */
export function buyWording(
  b: BuyButtons,
  o: {
    tierName: string;
    charge: string;
    every?: 'month' | 'year';
    verb?: string;
    /** Replaces "You'll be charged X today, then every month." where the buyer picks the interval at checkout. */
    chargedToday?: string;
  },
): BuyWording | null {
  const every = o.every ?? (o.charge.includes('year') ? 'year' : 'month');
  const today = o.chargedToday ?? `You'll be charged ${o.charge.replace(/ a (month|year)$/, '')} today, then every ${every}.`;
  switch (b.kind) {
    case 'trial':
      return {
        primary: { label: 'Start free trial', href: b.trialUrl },
        secondary: b.nowUrl ? { label: 'Skip trial, pay now', href: b.nowUrl } : null,
        note: `${b.trialDays}-day free trial, then ${o.charge}. Gumroad takes your card details now and charges it when the trial ends; cancel before then and you pay nothing.${b.nowUrl ? ` Skip the trial: ${today}` : ''}`,
      };
    case 'subscribe':
      return {
        primary: { label: o.verb ?? `Subscribe to ${o.tierName}`, href: b.url },
        secondary: null,
        note: `${today} No free trial: cancel any time on Gumroad.`,
      };
    case 'soon':
      return {
        primary: { label: 'Subscribing opens soon', href: null },
        secondary: null,
        note: `You have had your free trial, so ${o.tierName} is charged from the first day, and that checkout is not open yet. Ask in the Anvil Discord and we will tell you when it is.`,
      };
    default:
      return null;
  }
}

/** For staff: why a tier shows "Subscribing opens soon", naming the env var to set. */
export function soonReason(urlEnv: string | undefined): string {
  return `No pay-now checkout is configured for this tier (${urlEnv ? `${urlEnv}_NOW` : 'its _NOW link'}). A clan that has had its trial is never sent to the product that starts another.`;
}
