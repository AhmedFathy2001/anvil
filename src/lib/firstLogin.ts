// Where a brand-new account lands after its first Discord sign-in. Pure, so it can be tested
// without the database (lib/discord-login imports @/db).
//
// It used to send a new user to onboarding only when they signed in from the home page. Anybody who
// arrived from a deep link — an event, a clan page, a leaderboard someone shared — skipped it and
// never saw the setup steps again. Now every first sign-in goes through onboarding, and the page
// they were heading for rides along as `next` so onboarding can offer "Continue to …".
//
// A few destinations are the reason the person signed in at all and are time-sensitive, so they go
// straight through: approving the plugin's sign-in code (it expires), accepting an event invite,
// founding a clan, the billing portal. Detouring those through a four-step setup page would break
// the thing they came to do.

import { safeReturnPath } from './safe-redirect.ts';

const STRAIGHT_THROUGH: RegExp[] = [
  /^\/link-device(?:[/?#]|$)/,
  /^\/welcome(?:[/?#]|$)/,
  /^\/profile\?(?:.*&)?welcome=1/,
  /^\/portal(?:[/?#]|$)/,
  /^\/clans\/new(?:[/?#]|$)/,
  // An event invite, with or without a clan prefix.
  /^(?:\/c\/[^/]+)?\/events\/[^/]+\/join\/[^/?#]+/,
];

export function firstLoginDestination(returnTo: string, returningToClan: boolean): string {
  const target = safeReturnPath(returnTo);
  if (STRAIGHT_THROUGH.some((re) => re.test(target))) return target;
  const base = returningToClan ? '/profile?welcome=1' : '/welcome';
  if (target === '/') return base;
  return `${base}${base.includes('?') ? '&' : '?'}next=${encodeURIComponent(target)}`;
}

/** Reads `next` back off the onboarding page's query. Same rules as any other return path. */
export function onboardingNext(raw: string | string[] | undefined | null): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const safe = safeReturnPath(value, '');
  if (!safe || safe === '/') return null;
  return safe;
}
