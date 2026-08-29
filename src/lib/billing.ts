// App-side billing helpers — the checkout half of the Gumroad loop.
//
// The webhook (api/webhooks/gumroad) receives payments and moves clans.plan; this is the send side. A
// clan's `gumroadRef` is a stable random token appended to its checkout URL, so when Gumroad pings us
// back the payment names the clan that STARTED it — the strong key, ahead of matching by email. New
// clans get one at creation (lib/clanCreate); this backfills any that predate that, on first checkout.

import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clans } from '@/db/schema';

/** A URL-safe token for `clans.gumroadRef`. */
export function newCheckoutRef(): string {
  return randomBytes(12).toString('base64url');
}

/**
 * The clan's checkout ref, creating and storing one if it has none. Idempotent — a clan keeps the same
 * token for the life of the clan, so the webhook can always resolve it.
 */
export async function ensureClanCheckoutRef(clanId: number): Promise<string> {
  const row = await db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { gumroadRef: true } });
  if (row?.gumroadRef) return row.gumroadRef;
  const ref = newCheckoutRef();
  await db.update(clans).set({ gumroadRef: ref }).where(eq(clans.id, clanId));
  return ref;
}
