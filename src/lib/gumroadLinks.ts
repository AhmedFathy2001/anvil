// Links to Gumroad's own pages. Pure (client components import it); nothing here calls Gumroad.

/** Gumroad's own page for one membership: card, cancel, restart. The only place a membership is cancelled. */
export function manageUrl(subscriptionId: string): string {
  return `https://gumroad.com/subscriptions/${encodeURIComponent(subscriptionId)}/manage`;
}
