// Writes the billing ledger (schema billingLedger) from a Gumroad notification. Best-effort: a
// failure here must never fail or delay the webhook, whose real job is entitlements.

import { db } from '@/db';
import { billingLedger } from '@/db/schema';
import { gumroadPurchase } from '@/lib/billingCatalog';
import type { GumroadEvent } from '@/lib/gumroad';
import { ledgerRow } from '@/lib/moneyLedgerRules';
import { log } from '@/lib/logger';
import { isSupporterEvent } from '@/lib/supporterBilling';
import { isSupporterGiftEvent } from '@/lib/supporterGiftCheckout';

export function ledgerProduct(ev: GumroadEvent): 'supporter' | 'hosted' | 'creator' | 'other' {
  // A one-time gift is Supporter money too.
  if (isSupporterEvent(ev) || isSupporterGiftEvent(ev)) return 'supporter';
  const bought = gumroadPurchase(ev);
  if (!bought) return 'other';
  return bought.catalog === 'creator' ? 'creator' : 'hosted';
}

export async function recordLedger(ev: GumroadEvent, raw: string): Promise<void> {
  try {
    const p = new URLSearchParams(raw);
    const feeStr = p.get('gumroad_fee');
    const partial = p.get('partially_refunded') === 'true' || p.get('partially_refunded') === '1';
    const row = ledgerRow(ev, ledgerProduct(ev), feeStr != null && feeStr !== '' ? Number(feeStr) : null, partial);
    if (!row) return;
    // A redelivered notification (same sale, same kind) is already here. Events with no sale id
    // (a cancellation) can repeat harmlessly: NULLs are distinct in the unique index.
    await db.insert(billingLedger).values(row).onConflictDoNothing();
  } catch (err) {
    log.warn('money.ledger-failed', { err: String(err) });
  }
}
