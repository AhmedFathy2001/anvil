// Clan tenure: how long a clan has paid for Anvil without a break (lib/clanTenure). Pure.
//
// Run: npx tsx --test tests/clan-tenure.test.ts (no database).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { clanTenure, clanTenureLine, runOnEnded, runOnPaid, runOnRefund } from '../src/lib/clanTenure.ts';

const NOW = Date.parse('2026-11-10T12:00:00Z');
const DAY = 86_400_000;
const ago = (d: number) => new Date(NOW - d * DAY).toISOString();
const clan = (o: Partial<{ plan: string; paidSince: string | null; paidEndedAt: string | null; gumroadSubscriptionId: string | null }>) => ({
  plan: 'gold',
  paidSince: null,
  paidEndedAt: null,
  gumroadSubscriptionId: 'sub-1',
  ...o,
});

test('a first paid plan starts the run; renewals keep it', () => {
  assert.deepEqual(runOnPaid(clan({ plan: 'free' }), NOW), { paidSince: new Date(NOW).toISOString(), paidEndedAt: null });
  assert.deepEqual(runOnPaid(clan({ paidSince: ago(400) }), NOW), { paidSince: ago(400), paidEndedAt: null });
});

test('coming back within 30 days keeps the run; later starts a new one', () => {
  assert.equal(runOnPaid(clan({ plan: 'free', paidSince: ago(400), paidEndedAt: ago(10) }), NOW).paidSince, ago(400));
  assert.equal(runOnPaid(clan({ plan: 'free', paidSince: ago(400), paidEndedAt: ago(60) }), NOW).paidSince, new Date(NOW).toISOString());
});

test('ending marks when; a refund wipes the run', () => {
  assert.deepEqual(runOnEnded(clan({ paidSince: ago(30) }), NOW), { paidEndedAt: new Date(NOW).toISOString() });
  assert.deepEqual(runOnEnded(clan({ plan: 'free', paidSince: ago(30) }), NOW), {});
  assert.deepEqual(runOnRefund(), { paidSince: null, paidEndedAt: null });
});

test('only a paying clan with a subscription shows tenure, on the Supporter ladder', () => {
  assert.equal(clanTenure(clan({ plan: 'free', paidSince: ago(400) }), NOW), null);
  assert.equal(clanTenure(clan({ paidSince: ago(400), gumroadSubscriptionId: null }), NOW), null, 'comped by hand');
  assert.equal(clanTenure(clan({}), NOW), null);
  const t = clanTenure(clan({ paidSince: ago(800) }), NOW)!;
  assert.equal(t.step.id, 'grandmaster');
  assert.equal(clanTenureLine(t), 'Backing Anvil for 2 years');
  assert.equal(clanTenureLine(clanTenure(clan({ paidSince: ago(100) }), NOW)!), 'Backing Anvil for 3 months');
  assert.equal(clanTenure(clan({ paidSince: ago(1200) }), NOW)!.step.id, 'legend');
});
