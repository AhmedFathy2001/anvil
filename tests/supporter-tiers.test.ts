// Anvil Supporter, the pure half: which tier a person holds right now, and since when.
//
// Run: npx tsx --test tests/supporter-tiers.test.ts (no database).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  rowInForce,
  supporterState,
  supporterTierForGumroad,
  tenureStep,
  wholeMonths,
} from '../src/lib/supporterTiers.ts';

const NOW = Date.parse('2026-11-02T12:00:00Z');
const row = (o: Partial<{ tier: string; status: string; currentPeriodEnd: string | null; startedAt: string }>) => ({
  tier: 'supporter',
  status: 'active',
  currentPeriodEnd: null,
  startedAt: '2026-05-02T12:00:00Z',
  ...o,
});

test('Gumroad tier names map case-insensitively, and an unknown name is never a guess', () => {
  assert.equal(supporterTierForGumroad('Champion'), 'champion');
  assert.equal(supporterTierForGumroad(' patron '), 'patron');
  assert.equal(supporterTierForGumroad('Gold'), null, 'a clan plan name is not a supporter tier');
  assert.equal(supporterTierForGumroad(null), null);
});

test('cancelling keeps the tier until the paid term ends, then it stops', () => {
  assert.equal(rowInForce(row({ status: 'cancelling', currentPeriodEnd: '2026-11-20 00:00:00' }), NOW), true);
  assert.equal(rowInForce(row({ status: 'cancelling', currentPeriodEnd: '2026-10-20T00:00:00Z' }), NOW), false);
});

test('ended and refunded memberships grant nothing', () => {
  assert.equal(rowInForce(row({ status: 'ended' }), NOW), false);
  assert.equal(rowInForce(row({ status: 'refunded' }), NOW), false);
  assert.equal(rowInForce(row({ tier: 'gold' }), NOW), false, 'an unknown tier grants nothing');
});

test('the best tier in force wins', () => {
  const s = supporterState([row({ tier: 'supporter' }), row({ tier: 'patron' }), row({ tier: 'champion', status: 'ended' })], NOW);
  assert.equal(s?.tier.id, 'patron');
});

test('nobody is a supporter with nothing in force', () => {
  assert.equal(supporterState([row({ status: 'ended' })], NOW), null);
  assert.equal(supporterState([], NOW), null);
});

test('"since" counts from the first membership, but money taken back is not tenure', () => {
  const s = supporterState(
    [
      row({ status: 'refunded', startedAt: '2025-01-01T00:00:00Z' }),
      row({ status: 'ended', startedAt: '2026-02-02T12:00:00Z' }),
      row({ status: 'active', startedAt: '2026-08-02T12:00:00Z' }),
    ],
    NOW,
  );
  assert.equal(s?.since, '2026-02-02T12:00:00.000Z');
  assert.equal(s?.months, 9);
});

test('renewal and end dates come from the row in force', () => {
  const active = supporterState([row({ currentPeriodEnd: '2026-12-02 12:00:00' })], NOW);
  assert.equal(active?.renewsAt, '2026-12-02 12:00:00');
  assert.equal(active?.endsAt, null);
  const cancelling = supporterState([row({ status: 'cancelling', currentPeriodEnd: '2026-12-02 12:00:00' })], NOW);
  assert.equal(cancelling?.endsAt, '2026-12-02 12:00:00');
  assert.equal(cancelling?.renewsAt, null);
});

test('months are whole calendar months', () => {
  assert.equal(wholeMonths(Date.parse('2026-01-31T00:00:00Z'), Date.parse('2026-02-28T00:00:00Z')), 0);
  assert.equal(wholeMonths(Date.parse('2026-01-15T00:00:00Z'), Date.parse('2026-04-15T00:00:00Z')), 3);
  assert.equal(wholeMonths(NOW, NOW - 1), 0);
});

test('tenure flair steps at 3, 6 and 12 months', () => {
  assert.deepEqual(tenureStep(0), { reached: 0, next: 3 });
  assert.deepEqual(tenureStep(5), { reached: 3, next: 6 });
  assert.deepEqual(tenureStep(12), { reached: 12, next: null });
});

test('a supporter\'s Discord post gets their star on the author line, and nothing else changes', async () => {
  const { withSupporterAuthor } = await import('../src/lib/supporterTiers.ts');
  const e = { title: 'Rare drop!', author: { name: 'Zezima' } };
  assert.deepEqual(withSupporterAuthor(e, 'champion', 'https://anvilosrs.com').author, {
    name: 'Zezima',
    icon_url: 'https://anvilosrs.com/icons/supporter-champion.png',
  });
  assert.equal(withSupporterAuthor(e, null, 'https://anvilosrs.com'), e, 'not a supporter: untouched');
  const noAuthor = { title: 'Level 99!' };
  assert.equal(withSupporterAuthor(noAuthor, 'patron', 'https://anvilosrs.com'), noAuthor);
  const own = { author: { name: 'x', icon_url: 'https://cdn/x.png' } };
  assert.equal(withSupporterAuthor(own, 'patron', 'https://anvilosrs.com'), own, 'an icon already there stays');
});
