// Paid Supporter gifts, the pure half (lib/supporterGiftPurchase).
//
// Run: npx tsx --test tests/supporter-gift-purchase.test.ts (no database).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GIFT_OPTIONS, giftOptionName, giftPriceUsd, giverRank, parseGiftOption } from '../src/lib/supporterGiftPurchase.ts';
import { supporterState } from '../src/lib/supporterTiers.ts';

test('every option name reads back to its tier and length, and nothing else does', () => {
  for (const o of GIFT_OPTIONS) assert.deepEqual(parseGiftOption(o.name), { tier: o.tier, months: o.months });
  assert.equal(giftOptionName('patron', 12), 'Patron · 1 year');
  assert.deepEqual(parseGiftOption('champion - 3 months'), { tier: 'champion', months: 3 });
  assert.equal(parseGiftOption('Gold · 1 month'), null, 'a clan plan is not a gift');
  assert.equal(parseGiftOption('Champion · 6 months'), null, 'only lengths on sale');
  assert.equal(parseGiftOption(null), null);
});

test('prices follow the plans: a year is the yearly price', () => {
  assert.equal(giftPriceUsd('supporter', 1), 1);
  assert.equal(giftPriceUsd('champion', 3), 6);
  assert.equal(giftPriceUsd('patron', 12), 50);
});

test('giver ranks at 1, 5 and 15 months given', () => {
  assert.equal(giverRank(0).rank, null);
  assert.equal(giverRank(1).rank?.name, 'Giver');
  assert.equal(giverRank(4).next?.name, 'Benefactor');
  assert.equal(giverRank(15).rank?.name, 'Pillar of the clan');
  assert.equal(giverRank(40).next, null);
});

test('a paid gift wears the tier, reads as a gift, and never climbs the recipient’s tenure', () => {
  const now = Date.parse('2026-11-10T12:00:00Z');
  const s = supporterState(
    [{ tier: 'champion', status: 'granted', recurrence: 'gift-paid', startedAt: '2025-01-01T00:00:00Z', currentPeriodEnd: '2026-12-10T00:00:00Z' }],
    now,
  )!;
  assert.equal(s.tier.id, 'champion');
  assert.equal(s.gift, true);
  assert.equal(s.earned, false);
  assert.equal(s.tenureMonths, 0);
});
