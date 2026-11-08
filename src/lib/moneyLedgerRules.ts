// The ledger row a Gumroad notification becomes. Pure (no database), so it is tested directly.

import type { GumroadEvent } from './gumroad.ts';

/** The row for an event, or null when it carries nothing worth keeping. Money fields only on money events. */
export function ledgerRow(ev: GumroadEvent, product: 'supporter' | 'hosted' | 'creator' | 'other', fee: number | null, partial: boolean) {
  if (ev.kind === 'other') return null;
  const money = ev.kind === 'sale' || ev.kind === 'recurring_charge' || ev.kind === 'refund' || ev.kind === 'dispute';
  const cents = ev.priceCents != null && Number.isFinite(ev.priceCents) ? Math.round(ev.priceCents) : null;
  return {
    kind: ev.kind,
    product,
    tier: ev.tier,
    saleId: ev.saleId,
    subscriptionId: ev.subscriptionId,
    amountCents: money ? cents : null,
    feeCents: money && fee != null && Number.isFinite(fee) ? Math.round(fee) : null,
    currency: (ev.currency ?? 'usd').toLowerCase(),
    recurrence: ev.recurrence,
    partial,
    buyerEmail: ev.email,
  };
}
