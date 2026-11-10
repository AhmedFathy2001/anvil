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

test('the sale check holds a gift to the variant Gumroad itself sold', async () => {
  const { checkSaleWithGumroad } = await import('../src/lib/gumroad.ts');
  const real = globalThis.fetch;
  process.env.GUMROAD_ACCESS_TOKEN = 'test-token';
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ success: true, sale: { id: 's1', product_id: 'p', variants_and_quantity: '(Gift: Supporter · 1 month)' } }), { status: 200 })) as typeof fetch;
  try {
    assert.equal(await checkSaleWithGumroad('s1', 'p', 'Supporter · 1 month'), 'ok');
    assert.equal(await checkSaleWithGumroad('s1', 'p', 'Patron · 1 year'), 'rejected', 'a body claiming more than was sold');
    assert.equal(await checkSaleWithGumroad('s1', 'p'), 'ok', 'no variant asked: the old check');
  } finally {
    globalThis.fetch = real;
    delete process.env.GUMROAD_ACCESS_TOKEN;
  }
});

test('a gift can upgrade someone, but not repeat what they already pay for', async () => {
  const { giftBlocked } = await import('../src/lib/supporterGiftPurchase.ts');
  const now = Date.parse('2026-11-11T00:00:00Z');
  const patron = [{ tier: 'patron', status: 'active', recurrence: 'monthly', currentPeriodEnd: '2026-12-01T00:00:00Z' }];
  assert.match(giftBlocked(patron, 'patron', now)!, /already have this tier or higher/);
  assert.doesNotMatch(giftBlocked(patron, 'patron', now)!, /Patron/, 'never names their tier');
  assert.ok(giftBlocked(patron, 'supporter', now));
  const supporter = [{ tier: 'supporter', status: 'active', recurrence: 'yearly', currentPeriodEnd: null }];
  assert.equal(giftBlocked(supporter, 'champion', now), null, 'an upgrade');
  assert.ok(giftBlocked(supporter, 'supporter', now));
  // A cancelled one that has run out, or only granted time: nothing they pay for.
  assert.equal(giftBlocked([{ tier: 'patron', status: 'cancelling', currentPeriodEnd: '2026-11-01T00:00:00Z' }], 'patron', now), null);
  assert.equal(giftBlocked([{ tier: 'patron', status: 'granted', recurrence: 'gift-paid', currentPeriodEnd: '2026-12-01T00:00:00Z' }], 'patron', now), null);
});

test('a gift on top of granted time starts when it runs out', async () => {
  const { giftStartsAt } = await import('../src/lib/supporterGiftPurchase.ts');
  const now = Date.parse('2026-11-11T00:00:00Z');
  const end = Date.parse('2026-12-11T00:00:00Z');
  const gifted = [{ tier: 'patron', status: 'granted', recurrence: 'gift-paid', currentPeriodEnd: new Date(end).toISOString() }];
  assert.equal(giftStartsAt(gifted, 'patron', now), end, 'back to back');
  assert.equal(giftStartsAt(gifted, 'champion', now), end, 'a lower gift waits for the higher one too');
  assert.equal(giftStartsAt([{ tier: 'supporter', status: 'granted', currentPeriodEnd: new Date(end).toISOString() }], 'patron', now), now, 'an upgrade starts now');
  assert.equal(giftStartsAt([], 'patron', now), now);
});
