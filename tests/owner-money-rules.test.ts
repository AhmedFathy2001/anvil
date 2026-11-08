// Owner money maths (lib/moneyRules, lib/moneyLedger.ledgerRow): periods, refunds, currencies,
// estimates, masking, trial status. Pure: no database.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DAY, activeSubs, aggregate, boostLevelValueCents, estimateHistory, maskEmail, monthlyCents, mrr, periodsAt, pipelineCents,
  supporterConverted, trialStatus, trialValueCents, upcomingRenewals, validTrialDays, type MoneyEvent,
} from '../src/lib/moneyRules.ts';
import { ledgerRow } from '../src/lib/moneyLedgerRules.ts';

const NOW = Date.UTC(2026, 10, 15, 12, 0, 0); // 2026-11-15 12:00 UTC
const ev = (o: Partial<MoneyEvent> & { at: number; cents: number }): MoneyEvent => ({
  key: String(Math.random()), kind: 'charge', feeCents: null, currency: 'usd', product: 'supporter', label: 'x', estimated: false, ledgerId: 1, ...o,
});

test('periods: today, rolling 7 and 30 days, this and last month, all time', () => {
  const events = [
    ev({ at: NOW - 1000, cents: 500 }),                                // today
    ev({ at: NOW - 3 * DAY, cents: 200 }),                              // last 7
    ev({ at: NOW - 20 * DAY, cents: 1000 }),                            // last 30, last month (Oct 26)
    ev({ at: Date.UTC(2026, 9, 5), cents: 700 }),                       // last month, outside 30d
    ev({ at: Date.UTC(2026, 7, 1), cents: 900 }),                       // all time only
  ];
  const p = periodsAt(events, NOW);
  assert.equal(p.today.usd.gross, 500);
  assert.equal(p.last7.usd.gross, 700);
  assert.equal(p.last30.usd.gross, 1700);
  assert.equal(p.thisMonth.usd.gross, 700);        // Nov 1..15: today + 3d ago
  assert.equal(p.lastMonth.usd.gross, 1700);       // Oct: 20d ago (Oct 26) + Oct 5
  assert.equal(p.allTime.usd.gross, 3300);
});

test('net is gross minus refunds minus known fees; unknown fees are flagged, not zero-assumed silently', () => {
  const events = [
    ev({ at: NOW - 10, cents: 1000, feeCents: 100 }),
    ev({ at: NOW - 20, cents: 500, feeCents: null }),
    ev({ at: NOW - 30, cents: 500, kind: 'refund', feeCents: 0 }),
  ];
  const b = aggregate(events, NOW - DAY, NOW + 1).usd;
  assert.equal(b.gross, 1500);
  assert.equal(b.refunds, 500);
  assert.equal(b.fees, 100);
  assert.equal(b.net, 900);
  assert.equal(b.feesUnknown, true);
});

test('a refund lands in the period it happened, and currencies are never summed', () => {
  const events = [
    ev({ at: NOW - 40 * DAY, cents: 1000 }),
    ev({ at: NOW - 1000, cents: 1000, kind: 'refund' }),
    ev({ at: NOW - 500, cents: 800, currency: 'eur' }),
  ];
  const p = periodsAt(events, NOW);
  assert.equal(p.last30.usd.gross, 0);
  assert.equal(p.last30.usd.net, -1000, 'refund today of an older sale');
  assert.equal(p.last30.eur.net, 800);
  assert.equal(p.allTime.usd.net, 0);
  assert.deepEqual(Object.keys(p.allTime).sort(), ['eur', 'usd']);
});

test('estimated portions are tracked so the page can mark them', () => {
  const b = aggregate([ev({ at: NOW - 5, cents: 300, estimated: true }), ev({ at: NOW - 4, cents: 100 })], 0, NOW + 1).usd;
  assert.equal(b.gross, 400);
  assert.equal(b.estimatedGross, 300);
});

const sup = (o: object = {}) => ({ id: 1, userId: 1, tier: 'champion', status: 'active', recurrence: 'monthly', startedAt: '2026-08-15T12:00:00.000Z', endedAt: null, currentPeriodEnd: '2026-11-20T00:00:00.000Z', gumroadSubscriptionId: 'sub1', ...o });

test('estimated history: one charge per period until it ended, only before the ledger began', () => {
  const ev1 = estimateHistory([sup()], [], NOW + 1, NOW);
  assert.equal(ev1.length, 4, 'Aug, Sep, Oct, Nov 15');
  assert.ok(ev1.every((e) => e.estimated && e.cents === 200));
  const before = estimateHistory([sup()], [], Date.UTC(2026, 9, 1), NOW);
  assert.equal(before.length, 2, 'Aug 15 and Sep 15 only');
  const ended = estimateHistory([sup({ status: 'ended', endedAt: '2026-09-20T00:00:00.000Z' })], [], NOW, NOW);
  assert.equal(ended.length, 2);
  const refunded = estimateHistory([sup({ status: 'refunded', endedAt: '2026-08-16T00:00:00.000Z' })], [], NOW, NOW);
  assert.deepEqual(refunded.map((e) => e.kind), ['charge', 'refund']);
  const yearly = estimateHistory([sup({ recurrence: 'yearly', startedAt: '2025-12-01T00:00:00.000Z' })], [], NOW, NOW);
  assert.equal(yearly.length, 1);
  assert.equal(yearly[0].cents, 2000);
  assert.equal(estimateHistory([sup({ status: 'granted', recurrence: 'gift' })], [], NOW, NOW).length, 0, 'gifts earn nothing');
});

test('active subscriptions and MRR: yearly is a twelfth, ledger prices beat the catalogue, cancelling is at risk', () => {
  const rows = [sup(), sup({ id: 2, tier: 'patron', recurrence: 'yearly', gumroadSubscriptionId: 'sub2' }), sup({ id: 3, status: 'cancelling', tier: 'supporter', gumroadSubscriptionId: 'sub3' }), sup({ id: 4, status: 'ended' })];
  const prices = new Map([['sub1', { cents: 250, currency: 'usd', recurrence: 'monthly' }]]);
  const subs = activeSubs(rows, [], prices, NOW);
  assert.equal(subs.length, 3);
  const m = mrr(subs);
  // 250 (ledger) + 5000/12=417 + 100
  assert.equal(m.total.usd.cents, 250 + 417 + 100);
  assert.equal(m.total.usd.estimated, 417 + 100);
  assert.equal(m.atRisk.usd, 100);
  assert.equal(monthlyCents(5000, 'yearly'), 417);
});

test('clans: a free trial is pipeline not revenue; paid, not cancelling clans renew within 30 days', () => {
  const clan = (o: object) => ({ id: 1, name: 'Alpha', kind: 'clan', plan: 'silver', status: 'active', priceUsd: 6.99, free: false, gumroadSubscriptionId: 's', currentPeriodEnd: new Date(NOW + 5 * DAY).toISOString(), cancelAtPeriodEnd: false, trialEndsAt: null, ...o });
  const subs = activeSubs([], [clan({}), clan({ id: 2, trialEndsAt: new Date(NOW + DAY).toISOString() }), clan({ id: 3, status: 'suspended' }), clan({ id: 4, free: true })], new Map(), NOW);
  assert.equal(subs.length, 1);
  assert.equal(subs[0].cents, 699);
  assert.equal(upcomingRenewals(subs, NOW).length, 1);
  assert.equal(upcomingRenewals([{ ...subs[0], cancelling: true }], NOW).length, 0);
  assert.equal(upcomingRenewals([{ ...subs[0], renewsAt: NOW + 40 * DAY }], NOW).length, 0);
});

test('buyer emails are masked', () => {
  assert.equal(maskEmail('jane.doe@mail.example.com'), 'j•••@m•••.com');
  assert.equal(maskEmail(null), '—');
  assert.equal(maskEmail('nonsense'), '—');
  assert.ok(!maskEmail('jane.doe@mail.example.com').includes('jane'));
});

test('ledger rows: money only on money events, fee is null unless sent, currency lowercased', () => {
  const base = { kind: 'sale', sellerId: null, saleId: 'a', subscriptionId: 's', productId: null, productPermalink: null, tier: 'Champion', email: 'x@y.com', priceCents: 200, currency: 'USD', recurrence: 'monthly', freeTrialEndsAt: null, saleTimestamp: null, isRecurringCharge: false, urlParams: {} } as never;
  const r = ledgerRow(base, 'supporter', null, false)!;
  assert.equal(r.amountCents, 200);
  assert.equal(r.feeCents, null);
  assert.equal(r.currency, 'usd');
  assert.equal(ledgerRow({ ...(base as object), kind: 'cancellation' } as never, 'supporter', 12, false)!.amountCents, null);
  assert.equal(ledgerRow(base, 'supporter', 30, false)!.feeCents, 30);
  assert.equal(ledgerRow({ ...(base as object), kind: 'other' } as never, 'other', null, false), null);
});

test('trial status, value and pipeline', () => {
  const t = (endsAt: number, o: object = {}) => ({ endsAt, revokedAt: null, convertedAt: null, ...o });
  assert.equal(trialStatus(t(NOW + 20 * DAY), NOW), 'active');
  assert.equal(trialStatus(t(NOW + 3 * DAY), NOW), 'ending');
  assert.equal(trialStatus(t(NOW - 1), NOW), 'expired');
  assert.equal(trialStatus(t(NOW - 1, { convertedAt: NOW - 5 }), NOW), 'converted');
  assert.equal(trialStatus(t(NOW + 3 * DAY, { revokedAt: NOW - 5 }), NOW), 'revoked');
  assert.deepEqual(trialValueCents('supporter', 'patron'), { cents: 500, estimated: false });
  assert.equal(trialValueCents('boost', '2').cents, 8 * 200);
  assert.equal(boostLevelValueCents(1), 600);
  assert.equal(pipelineCents([{ status: 'active', valueCents: 500 }, { status: 'ending', valueCents: 200 }, { status: 'expired', valueCents: 900 }, { status: 'converted', valueCents: 900 }, { status: 'revoked', valueCents: 900 }]), 700);
  assert.equal(validTrialDays(14), true);
  assert.equal(validTrialDays(0), false);
  assert.equal(validTrialDays(1.5), false);
  assert.equal(validTrialDays(366), false);
});

test('a later paid Supporter row converts a trial; gifts and earlier rows do not', () => {
  const start = Date.UTC(2026, 10, 1);
  const row = (o: object) => ({ startedAt: '2026-11-05T00:00:00.000Z', status: 'active', recurrence: 'monthly', gumroadSubscriptionId: 'x', ...o });
  assert.equal(supporterConverted([row({})], start), true);
  assert.equal(supporterConverted([row({ startedAt: '2026-10-05T00:00:00.000Z' })], start), false);
  assert.equal(supporterConverted([row({ status: 'granted', recurrence: 'gift' })], start), false);
});
