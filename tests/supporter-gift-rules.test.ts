// Staff Supporter gifts, the pure half (lib/supporterGiftRules): a gift is an overlay row that never
// touches the paid subscription, the best tier in force is what someone wears, and the staff view can
// say who gave a gift and who ended it.
//
// Run: node --import tsx --test tests/supporter-gift-rules.test.ts (no database).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { giftSources, supporterStanding, type StandingRow } from '../src/lib/supporterGiftRules.ts';
import { supporterState } from '../src/lib/supporterTiers.ts';

const NOW = Date.parse('2026-11-07T12:00:00Z');
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

const paid = (tier: string, status = 'active', end: number | null = NOW + 20 * DAY): StandingRow => ({
  id: 1,
  tier,
  status,
  recurrence: 'monthly',
  currentPeriodEnd: end == null ? null : iso(end),
  startedAt: iso(NOW - 100 * DAY),
});
const gift = (tier: string, end: number, status = 'granted', id = 9): StandingRow => ({
  id,
  tier,
  status,
  recurrence: 'gift',
  currentPeriodEnd: iso(end),
  startedAt: iso(NOW - DAY),
});

test('a gift above the paid tier is worn, and the paid tier is still reported as paid', () => {
  const s = supporterStanding([paid('supporter'), gift('patron', NOW + 30 * DAY)], NOW);
  assert.equal(s.paid, 'supporter');
  assert.equal(s.effective, 'patron');
  assert.equal(s.source, 'gift');
  assert.deepEqual(s.gift, { tier: 'patron', id: 9, endsAt: iso(NOW + 30 * DAY) });
});

test('a gift at or below the paid tier lifts nothing: the paid tier is the source', () => {
  assert.equal(supporterStanding([paid('champion'), gift('champion', NOW + DAY)], NOW).source, 'paid');
  const below = supporterStanding([paid('patron'), gift('supporter', NOW + DAY)], NOW);
  assert.deepEqual([below.effective, below.source, below.gift?.tier], ['patron', 'paid', 'supporter']);
});

test('expiry: once the gift runs out the person is back on exactly what they pay for', () => {
  const rows = [paid('supporter', 'active', null), gift('patron', NOW + 3 * DAY)];
  assert.equal(supporterStanding(rows, NOW + 3 * DAY - 1).effective, 'patron');
  const after = supporterStanding(rows, NOW + 3 * DAY);
  assert.deepEqual([after.paid, after.effective, after.source, after.gift], ['supporter', 'supporter', 'paid', null]);
  // With nothing paid, expiry leaves nothing at all.
  const giftOnly = supporterStanding([gift('champion', NOW + DAY)], NOW + DAY);
  assert.deepEqual([giftOnly.effective, giftOnly.source], [null, null]);
});

test('removal: a gift staff ended early (status ended) stops at once', () => {
  // endGift sets status 'ended' and pulls the period end to now.
  const s = supporterStanding([paid('supporter'), gift('patron', NOW, 'ended')], NOW + 1);
  assert.deepEqual([s.effective, s.source, s.gift], ['supporter', 'paid', null]);
  // Ending one of two gifts leaves the other in force.
  const two = supporterStanding([gift('patron', NOW, 'ended', 9), gift('champion', NOW + 10 * DAY, 'granted', 10)], NOW + 1);
  assert.deepEqual([two.effective, two.gift?.id], ['champion', 10]);
});

test('a paid upgrade during a gift: once they pay for more than the gift, the paid tier is worn', () => {
  // Paid Supporter with a Champion gift, then they upgrade to Patron on Gumroad.
  const before = supporterStanding([paid('supporter'), gift('champion', NOW + 30 * DAY)], NOW);
  assert.deepEqual([before.effective, before.source], ['champion', 'gift']);
  const upgraded = supporterStanding([{ ...paid('patron') }, gift('champion', NOW + 30 * DAY)], NOW);
  assert.deepEqual([upgraded.paid, upgraded.effective, upgraded.source], ['patron', 'patron', 'paid']);
  // ...and when the gift later ends, nothing changes for them.
  assert.equal(supporterStanding([paid('patron'), gift('champion', NOW + 30 * DAY)], NOW + 31 * DAY).effective, 'patron');
});

test('a paid downgrade during a gift: the gift still holds them up until it ends, then the new paid tier', () => {
  const rows = [paid('supporter'), gift('champion', NOW + 30 * DAY)]; // was Patron, now pays Supporter
  const during = supporterStanding(rows, NOW);
  assert.deepEqual([during.paid, during.effective, during.source], ['supporter', 'champion', 'gift']);
  const after = supporterStanding([paid('supporter', 'active', null), gift('champion', NOW + 30 * DAY)], NOW + 30 * DAY);
  assert.deepEqual([after.paid, after.effective], ['supporter', 'supporter']);
});

test('losing the subscription during a gift: the gift is all that is left, then nothing', () => {
  for (const lost of [paid('champion', 'ended'), paid('champion', 'refunded'), paid('champion', 'cancelling', NOW - 1)]) {
    const s = supporterStanding([lost, gift('supporter', NOW + 5 * DAY)], NOW);
    assert.deepEqual([s.paid, s.effective, s.source], [null, 'supporter', 'gift'], lost.status);
    const later = supporterStanding([lost, gift('supporter', NOW + 5 * DAY)], NOW + 5 * DAY);
    assert.deepEqual([later.paid, later.effective, later.source], [null, null, null], lost.status);
  }
  // Cancelling but still inside the paid term counts as paid until that term ends.
  const cancelling = supporterStanding([paid('champion', 'cancelling', NOW + DAY), gift('supporter', NOW + 5 * DAY)], NOW);
  assert.deepEqual([cancelling.paid, cancelling.source], ['champion', 'paid']);
});

test('invite time is neither paid nor a gift, and a gift only lifts above it', () => {
  const invite: StandingRow = { tier: 'champion', status: 'granted', recurrence: 'referral', currentPeriodEnd: iso(NOW + DAY), startedAt: iso(NOW - DAY) };
  const s = supporterStanding([invite, gift('champion', NOW + DAY)], NOW);
  assert.deepEqual([s.paid, s.earned, s.effective, s.source], [null, 'champion', 'champion', 'earned']);
  assert.equal(supporterStanding([invite, gift('patron', NOW + DAY)], NOW).source, 'gift');
});

test('grant sources: who gave each gift and who ended it, from the audit entries', () => {
  const gifts = [
    { id: 10, tier: 'patron', startedAt: '2026-11-07T10:00:00.000Z' },
    { id: 11, tier: 'champion', startedAt: '2026-11-01T09:00:00.000Z' },
    { id: 12, tier: 'supporter', startedAt: '2026-10-01T09:00:00.000Z' },
  ];
  const audit = [
    { eventType: 'supporter_gift_granted', actorName: 'Root', newValue: JSON.stringify({ userId: 5, giftId: 10, tier: 'patron', note: 'event prize' }), occurredAt: '2026-11-07 10:00:00' },
    { eventType: 'supporter_gift_ended', actorName: 'Mod', newValue: JSON.stringify({ userId: 5, giftId: 10, tier: 'patron' }), occurredAt: '2026-11-07 11:00:00' },
    // An entry from before grants carried the gift id: matched by tier and time.
    { eventType: 'supporter_gift_granted', actorName: null, newValue: JSON.stringify({ userId: 5, tier: 'champion' }), occurredAt: '2026-11-01 09:00:02' },
    // A legacy entry too far from any same-tier gift matches nothing.
    { eventType: 'supporter_gift_granted', actorName: 'Ghost', newValue: JSON.stringify({ userId: 5, tier: 'supporter' }), occurredAt: '2026-09-01 09:00:00' },
    { eventType: 'supporter_gift_granted', actorName: 'Junk', newValue: 'not json', occurredAt: '2026-10-01 09:00:00' },
  ];
  const out = giftSources(gifts, audit);
  assert.deepEqual(out.get(10), { grantedBy: 'Root', endedBy: 'Mod', note: 'event prize' });
  assert.deepEqual(out.get(11), { grantedBy: 'a deleted login', endedBy: null, note: null });
  assert.deepEqual(out.get(12), { grantedBy: null, endedBy: null, note: null });
});

test('the tier staff see as worn is the same tier flair, roles and the profile use (supporterState)', () => {
  const cases: StandingRow[][] = [
    [paid('supporter'), gift('patron', NOW + DAY)],
    [paid('patron'), gift('champion', NOW + DAY)],
    [paid('champion', 'ended'), gift('supporter', NOW + DAY)],
    [paid('champion', 'cancelling', NOW - 1)],
    [gift('patron', NOW, 'ended')],
    [],
  ];
  for (const rows of cases) assert.equal(supporterStanding(rows, NOW).effective, supporterState(rows, NOW)?.tier.id ?? null);
});
