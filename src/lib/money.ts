// Owner money: the database half. Everything here reads stored rows only (no Gumroad calls) and is
// reachable solely through the owner guard (lib/ownerAccess). Amounts never leave through any other path.

import { eq, isNotNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { billingLedger, clans, supporterSubscriptions } from '@/db/schema';
import { billingTierOf } from '@/lib/billingCatalog';
import {
  DAY, PRODUCT_LABEL, activeSubs, estimateHistory, maskEmail, mrr, periodsAt, splitByProduct, upcomingRenewals,
  type ClanRow, type LedgerPrice, type MoneyEvent, type ProductKey, type SupporterRow,
} from '@/lib/moneyRules';

const REAL_KINDS = ['sale', 'recurring_charge', 'refund', 'dispute'];

function ledgerEvent(r: typeof billingLedger.$inferSelect): MoneyEvent | null {
  if (!REAL_KINDS.includes(r.kind) || r.amountCents == null) return null;
  const refund = r.kind === 'refund' || r.kind === 'dispute';
  return {
    key: `l${r.id}`,
    at: r.occurredAt.getTime(),
    kind: refund ? 'refund' : 'charge',
    cents: r.amountCents,
    feeCents: refund ? 0 : r.feeCents,
    currency: r.currency ?? 'usd',
    product: (r.product as ProductKey) ?? 'other',
    label: r.tier ?? PRODUCT_LABEL[(r.product as ProductKey) ?? 'other'] ?? r.product,
    estimated: r.partial,
    ledgerId: r.id,
  };
}

export async function loadClanRows(): Promise<ClanRow[]> {
  const rows = await db
    .select({
      id: clans.id, name: clans.name, kind: clans.kind, plan: clans.plan, status: clans.status,
      gumroadSubscriptionId: clans.gumroadSubscriptionId, currentPeriodEnd: clans.currentPeriodEnd,
      cancelAtPeriodEnd: clans.cancelAtPeriodEnd, trialEndsAt: clans.trialEndsAt,
    })
    .from(clans)
    .where(isNotNull(clans.gumroadSubscriptionId));
  return rows.map((c) => {
    const t = billingTierOf(c.kind, c.plan);
    return { ...c, priceUsd: t.priceUsd, free: t.free };
  });
}

export async function loadSupporterRows(): Promise<SupporterRow[]> {
  return db
    .select({
      id: supporterSubscriptions.id, userId: supporterSubscriptions.userId, tier: supporterSubscriptions.tier,
      status: supporterSubscriptions.status, recurrence: supporterSubscriptions.recurrence,
      startedAt: supporterSubscriptions.startedAt, endedAt: supporterSubscriptions.endedAt,
      currentPeriodEnd: supporterSubscriptions.currentPeriodEnd, gumroadSubscriptionId: supporterSubscriptions.gumroadSubscriptionId,
    })
    .from(supporterSubscriptions)
    .where(sql`${supporterSubscriptions.recurrence} is not null and ${supporterSubscriptions.recurrence} not in ('gift','invite')`);
}

export interface FeedItem {
  key: string; at: number; type: 'sale' | 'renewal' | 'refund' | 'cancellation' | 'ended'; product: ProductKey;
  label: string; cents: number | null; currency: string; estimated: boolean; maskedEmail: string; ledgerId: number | null;
}

export async function loadMoney(now = Date.now()) {
  const [ledger, supporters, clanRows] = await Promise.all([
    db.select().from(billingLedger).orderBy(billingLedger.occurredAt),
    loadSupporterRows(),
    loadClanRows(),
  ]);
  const real = ledger.map(ledgerEvent).filter((e): e is MoneyEvent => e !== null);
  const firstLedger = ledger.length ? ledger[0].occurredAt.getTime() : Infinity;
  const events = [...estimateHistory(supporters, clanRows, firstLedger, now), ...real];

  const lastPrice = new Map<string, LedgerPrice>();
  for (const r of ledger) {
    if ((r.kind === 'sale' || r.kind === 'recurring_charge') && r.subscriptionId && r.amountCents && r.amountCents > 0) {
      lastPrice.set(r.subscriptionId, { cents: r.amountCents, currency: r.currency ?? 'usd', recurrence: r.recurrence });
    }
  }
  const subs = activeSubs(supporters, clanRows, lastPrice, now);
  const rec = mrr(subs);
  const renewals = upcomingRenewals(subs, now);

  const types: Record<string, FeedItem['type']> = { sale: 'sale', recurring_charge: 'renewal', refund: 'refund', dispute: 'refund', cancellation: 'cancellation', subscription_ended: 'ended' };
  const feed: FeedItem[] = ledger
    .filter((r) => types[r.kind])
    .map((r) => ({
      key: `l${r.id}`, at: r.occurredAt.getTime(), type: types[r.kind], product: r.product as ProductKey,
      label: r.tier ?? PRODUCT_LABEL[r.product as ProductKey] ?? r.product, cents: r.amountCents, currency: r.currency ?? 'usd',
      estimated: r.partial, maskedEmail: maskEmail(r.buyerEmail), ledgerId: r.id,
    }));
  for (const e of events.filter((x) => x.estimated && x.ledgerId == null)) {
    feed.push({ key: e.key, at: e.at, type: e.kind === 'refund' ? 'refund' : 'sale', product: e.product, label: e.label, cents: e.cents, currency: e.currency, estimated: true, maskedEmail: '—', ledgerId: null });
  }
  feed.sort((a, b) => b.at - a.at);
  const recent = (types2: FeedItem['type'][]) => feed.filter((f) => types2.includes(f.type)).slice(0, 20);

  return {
    generatedAt: now,
    ledgerSince: ledger.length ? firstLedger : null,
    periods: periodsAt(events, now),
    byProduct: {
      allTime: splitByProduct(events, -Infinity, now + 1),
      last30: splitByProduct(events, now - 30 * DAY, now + 1),
    },
    activeCount: subs.length,
    activeBy: (['supporter', 'hosted', 'creator'] as ProductKey[]).map((p) => ({ product: p, label: PRODUCT_LABEL[p], count: subs.filter((s) => s.product === p).length })),
    mrr: rec.total,
    mrrAtRisk: rec.atRisk,
    renewals: renewals.map((s) => ({ key: s.key, product: s.product, label: s.label, cents: s.cents, currency: s.currency, recurrence: s.recurrence, at: s.renewsAt as number, estimated: s.estimated })),
    recentSales: recent(['sale', 'renewal']),
    recentRefunds: recent(['refund']),
    recentCancellations: recent(['cancellation', 'ended']),
    cancellingNow: subs.filter((s) => s.cancelling).map((s) => ({ key: s.key, label: s.label, product: s.product, endsAt: s.renewsAt })),
  };
}

/** Full detail of one ledger row, for the owner's click-through (the only place a full email is returned). */
export async function ledgerDetail(id: number) {
  const [r] = await db.select().from(billingLedger).where(eq(billingLedger.id, id)).limit(1);
  if (!r) return null;
  return {
    id: r.id, at: r.occurredAt.toISOString(), kind: r.kind, product: r.product, tier: r.tier, saleId: r.saleId,
    subscriptionId: r.subscriptionId, amountCents: r.amountCents, feeCents: r.feeCents, currency: r.currency,
    recurrence: r.recurrence, partial: r.partial, buyerEmail: r.buyerEmail,
  };
}

