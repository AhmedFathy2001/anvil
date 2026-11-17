// Staff gift: "Lift to a tier" or "Add time" (lib/supporterGiftRules), and two memberships at once
// (lib/supporterDuplicates). The pure halves: what each option will do, and the exact words shown.
//
// Run: npx tsx --test tests/supporter-gift-options.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  addTimePreview,
  giftLineForPerson,
  giftModes,
  lengthWords,
  liftChangesNothing,
  liftPreview,
  paidAtTier,
  planAddTime,
  supporterStanding,
  type GiftPlanRow,
} from '../src/lib/supporterGiftRules.ts';
import { membershipsToCancel } from '../src/lib/supporterDuplicates.ts';
import { paidRunStart, rowInForce, supporterState } from '../src/lib/supporterTiers.ts';

const DAY = 86_400_000;
const NOW = Date.parse('2027-01-10T12:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();

const row = (over: Partial<GiftPlanRow> & { id: number }): GiftPlanRow => ({
  tier: 'champion',
  status: 'active',
  currentPeriodEnd: iso(NOW + 20 * DAY),
  startedAt: iso(NOW - 10 * DAY),
  recurrence: 'monthly',
  gumroadSubscriptionId: null,
  queuedDays: null,
  ...over,
});
const paid = (id: number, over: Partial<GiftPlanRow> = {}) => row({ id, gumroadSubscriptionId: `sub-${id}`, ...over });
const gift = (id: number, over: Partial<GiftPlanRow> = {}) => row({ id, status: 'granted', recurrence: 'gift', currentPeriodEnd: iso(NOW + 14 * DAY), ...over });

// ── Add time ────────────────────────────────────────────────────────────────────────────────────

test('add time, holding nothing: a fresh entitlement for N days from today', () => {
  const plan = planAddTime([], 'champion', 30, NOW);
  assert.deepEqual(plan, { kind: 'new', from: iso(NOW), to: iso(NOW + 30 * DAY), after: null });
  assert.equal(addTimePreview(plan, 'champion', 30), 'They hold nothing at Champion. This gives Champion for 1 month, from today until 9 Feb 2027.');
});

test('add time on a running gift or trial at that tier: its end moves out by N, never overlapping', () => {
  const plan = planAddTime([gift(7)], 'champion', 30, NOW);
  assert.deepEqual(plan, { kind: 'extend', giftId: 7, from: iso(NOW + 14 * DAY), to: iso(NOW + 44 * DAY) });
  assert.equal(addTimePreview(plan, 'champion', 30), 'They hold Champion from Anvil until 24 Jan 2027. This moves that end out by 1 month, to 23 Feb 2027.');
});

test('add time twice stacks: 30 then 60 days is 90 days on one entitlement', () => {
  const first = planAddTime([], 'champion', 30, NOW);
  assert.equal(first.kind, 'new');
  const after = gift(1, { currentPeriodEnd: (first as { to: string }).to });
  const second = planAddTime([after], 'champion', 60, NOW);
  assert.deepEqual(second, { kind: 'extend', giftId: 1, from: iso(NOW + 30 * DAY), to: iso(NOW + 90 * DAY) });
});

test('add time for someone who PAYS for that tier: stored, to begin when the paid period ends', () => {
  const rows = [paid(3)];
  assert.equal(paidAtTier(rows, 'champion', NOW)?.id, 3);
  const plan = planAddTime(rows, 'champion', 90, NOW);
  assert.deepEqual(plan, { kind: 'queue', queuedId: null, queuedDays: 90, paidUntil: iso(NOW + 20 * DAY), cancelling: false });
  assert.equal(
    addTimePreview(plan, 'champion', 90),
    "They pay for Champion through Gumroad (next charge 30 Jan 2027). Anvil cannot delay Gumroad's charges, so nothing changes today and they keep being charged as before. The 3 months is stored and starts the day their paid Champion stops, so it carries them on for free if they stop paying.",
  );
});

test('add time for a payer, twice: the stored days add up on the one stored row', () => {
  const rows = [paid(3), row({ id: 9, status: 'queued', recurrence: 'gift', currentPeriodEnd: null, queuedDays: 30 })];
  const plan = planAddTime(rows, 'champion', 60, NOW);
  assert.deepEqual(plan, { kind: 'queue', queuedId: 9, queuedDays: 90, paidUntil: iso(NOW + 20 * DAY), cancelling: false });
  assert.match(addTimePreview(plan, 'champion', 60), /With what is already stored, that is 3 months in all\.$/);
});

test('stored time is in force for nobody and is not paid tenure', () => {
  const stored = row({ id: 9, status: 'queued', recurrence: 'gift', currentPeriodEnd: null, queuedDays: 30 });
  assert.equal(rowInForce(stored, NOW), false);
  assert.equal(supporterState([stored], NOW), null);
  assert.equal(paidRunStart([stored], NOW), null);
});

test('paying for ANOTHER tier does not store it: they hold nothing at this one', () => {
  const plan = planAddTime([paid(3, { tier: 'supporter' })], 'champion', 30, NOW);
  assert.equal(plan.kind, 'new');
});

test('a cancelled membership still inside its term is still paid for: stored, and the words say paid until', () => {
  const plan = planAddTime([paid(3, { status: 'cancelling' })], 'champion', 30, NOW);
  assert.equal(plan.kind, 'queue');
  assert.match(addTimePreview(plan, 'champion', 30), /\(cancelled, paid until 30 Jan 2027\)/);
});

test('other free time at the tier (a bought gift, invite time): the new days run on after it', () => {
  const plan = planAddTime([row({ id: 4, status: 'granted', recurrence: 'gift-paid', currentPeriodEnd: iso(NOW + 10 * DAY) })], 'champion', 30, NOW);
  assert.deepEqual(plan, { kind: 'new', from: iso(NOW), to: iso(NOW + 40 * DAY), after: iso(NOW + 10 * DAY) });
});

test('a gift with no end date has nothing to add to', () => {
  const plan = planAddTime([gift(5, { currentPeriodEnd: null })], 'champion', 30, NOW);
  assert.deepEqual(plan, { kind: 'endless', giftId: 5 });
});

// ── Lift ────────────────────────────────────────────────────────────────────────────────────────

test('lift: says what changes, and that their own membership is untouched', () => {
  const standing = supporterStanding([paid(1, { tier: 'supporter' })], NOW);
  const p = liftPreview(standing, 'champion', iso(Date.parse('2027-03-14T12:00:00Z')));
  assert.equal(p.nothing, false);
  assert.equal(p.text, 'Has Supporter (paid). This lifts them to Champion until 14 Mar 2027. Their own membership and its charges are unchanged.');
});

test('lift for someone with nothing', () => {
  const p = liftPreview(supporterStanding([], NOW), 'patron', iso(Date.parse('2027-03-14T12:00:00Z')));
  assert.equal(p.text, 'Has no Supporter tier. This lifts them to Patron until 14 Mar 2027.');
});

test('a lift that is not higher than what they have changes nothing visible, and says so', () => {
  const standing = supporterStanding([paid(1, { tier: 'patron' })], NOW);
  assert.equal(liftChangesNothing(standing, 'champion'), true);
  assert.equal(liftChangesNothing(standing, 'patron'), true);
  const p = liftPreview(standing, 'champion', iso(Date.parse('2027-03-14T12:00:00Z')));
  assert.equal(p.nothing, true);
  assert.equal(p.text, 'Has Patron (paid). A lift to Champion until 14 Mar 2027 changes nothing they can see, because they already have Patron. It would only matter if that stopped before 14 Mar 2027.');
});

// ── What the person reads ───────────────────────────────────────────────────────────────────────

test('the person sees a gift from Anvil with its date, or the stored time and when it starts', () => {
  assert.equal(giftLineForPerson({ tier: 'champion', endsAt: '2027-03-14T12:00:00Z', queuedDays: null, queued: false }), 'A gift from Anvil: Champion until 14 Mar 2027.');
  assert.equal(giftLineForPerson({ tier: 'champion', endsAt: null, queuedDays: 90, queued: true }), '3 months of Champion added by Anvil, starting when your membership ends.');
  assert.equal(lengthWords(45), '45 days');
  assert.equal(lengthWords(30), '1 month');
});

// ── History names the option ────────────────────────────────────────────────────────────────────

test('gift history names the option, and the time added since', () => {
  const gifts = [{ id: 1, tier: 'champion', startedAt: iso(NOW) }, { id: 2, tier: 'patron', startedAt: iso(NOW) }, { id: 3, tier: 'patron', startedAt: iso(NOW) }];
  const at = '2027-01-10 12:00:00';
  const modes = giftModes(gifts, [
    { eventType: 'supporter_gift_granted', actorName: 'Root', occurredAt: at, newValue: JSON.stringify({ userId: 5, giftId: 1, tier: 'champion', mode: 'add', days: 30 }) },
    { eventType: 'supporter_gift_extended', actorName: 'Root', occurredAt: at, newValue: JSON.stringify({ userId: 5, giftId: 1, tier: 'champion', mode: 'add', days: 60 }) },
    { eventType: 'supporter_gift_granted', actorName: 'Root', occurredAt: at, newValue: JSON.stringify({ userId: 5, giftId: 2, tier: 'patron', mode: 'lift', days: 30 }) },
    // A grant from before the option existed carries no mode: it was a lift.
    { eventType: 'supporter_gift_granted', actorName: 'Root', occurredAt: at, newValue: JSON.stringify({ userId: 5, giftId: 3, tier: 'patron', days: 30 }) },
  ]);
  assert.deepEqual(modes.get(1), { mode: 'add', addedDays: 60 });
  assert.deepEqual(modes.get(2), { mode: 'lift', addedDays: 0 });
  assert.deepEqual(modes.get(3), { mode: 'lift', addedDays: 0 });
});

// ── Two memberships at once ─────────────────────────────────────────────────────────────────────

const m = (id: number, tier: string, status: string, startedAt: number, sub: string | null = `sub-${id}`) => ({ id, tier, status, startedAt: iso(startedAt), gumroadSubscriptionId: sub });

test('two memberships renewing: the older one is the one to cancel', () => {
  const out = membershipsToCancel([m(1, 'supporter', 'active', NOW - 40 * DAY), m(2, 'champion', 'active', NOW)]);
  assert.deepEqual(out, [{ rowId: 1, subscriptionId: 'sub-1', tierName: 'Supporter' }]);
});

test('it clears itself once the older one is cancelled or ended', () => {
  assert.deepEqual(membershipsToCancel([m(1, 'supporter', 'cancelling', NOW - 40 * DAY), m(2, 'champion', 'active', NOW)]), []);
  assert.deepEqual(membershipsToCancel([m(1, 'supporter', 'ended', NOW - 40 * DAY), m(2, 'champion', 'active', NOW)]), []);
});

test('one membership, a gift, or a membership waiting for its first charge is not two', () => {
  assert.deepEqual(membershipsToCancel([m(1, 'supporter', 'active', NOW)]), []);
  assert.deepEqual(membershipsToCancel([m(1, 'supporter', 'active', NOW - DAY), m(2, 'patron', 'granted', NOW, null)]), []);
  assert.deepEqual(membershipsToCancel([m(1, 'supporter', 'active', NOW - DAY), m(2, 'patron', 'held', NOW)]), []);
});
