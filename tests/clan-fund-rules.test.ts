// The clan fund's pure rules (lib/clanFundRules): the goal is one plan's yearly price, which chip-ins
// count, when the clan gets the plan, and the grace before it drops.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { counts, fundCheckoutUrl, fundStep, fundTotals, goalCents, totalIn, usd, yearlyCents } from '../src/lib/clanFundRules.ts';

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-23T12:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();

test('the goal is the picked plan\'s yearly price, never another tier', () => {
  // A year costs ten months: Silver at $6.99 a month is $69.90 a year.
  assert.equal(goalCents('silver'), 6990);
  assert.ok(goalCents('bronze') < goalCents('silver') && goalCents('silver') < goalCents('gold'));
});

test('active counts; cancelling counts until its year runs out; the rest never', () => {
  assert.equal(counts({ status: 'active', cents: 600 }, NOW), true);
  assert.equal(counts({ status: 'cancelling', cents: 600, currentPeriodEnd: iso(NOW + DAY) }, NOW), true);
  assert.equal(counts({ status: 'cancelling', cents: 600, currentPeriodEnd: iso(NOW - DAY) }, NOW), false);
  assert.equal(counts({ status: 'cancelling', cents: 600, currentPeriodEnd: '2026-11-24 00:00:00' }, NOW), true);
  for (const status of ['failed', 'ended', 'refunded']) assert.equal(counts({ status, cents: 600 }, NOW), false, status);
  assert.equal(yearlyCents({ status: 'active', cents: 600, recurrence: 'monthly' }), 7200);
});

test('totals: the payer is not a member, nobody is named, funded at the goal', () => {
  const pledges = [
    { status: 'active', cents: 4000, userId: 1 },
    { status: 'active', cents: 1400, userId: 2 },
    { status: 'refunded', cents: 5000, userId: 3 },
    { status: 'active', cents: 1590, userId: 9, isPayer: true },
  ];
  const t = fundTotals('silver', pledges, NOW);
  assert.deepEqual({ total: t.total, left: t.left, members: t.members, funded: t.funded, pct: t.pct }, { total: 6990, left: 0, members: 2, funded: true, pct: 100 });
  const short = fundTotals('silver', pledges.slice(0, 2), NOW);
  assert.equal(short.funded, false);
  assert.equal(short.left, 1590);
});

test('a week ahead: cancelled chip-ins that run out are left out', () => {
  const pledges = [
    { status: 'active', cents: 6000 },
    { status: 'cancelling', cents: 4000, currentPeriodEnd: iso(NOW + 3 * DAY) },
  ];
  assert.equal(totalIn(pledges, NOW, 7), 6000);
  assert.equal(totalIn(pledges, NOW, 1), 10000);
});

test('the step: grant at the goal, grace when short, drop after it, never over another membership', () => {
  assert.deepEqual(fundStep({ funded: true, granted: false, shortSince: null, blocked: false, now: NOW }), { kind: 'grant' });
  assert.deepEqual(fundStep({ funded: true, granted: true, shortSince: null, blocked: false, now: NOW }), { kind: 'keep' });
  assert.deepEqual(fundStep({ funded: true, granted: true, shortSince: NOW - DAY, blocked: false, now: NOW }), { kind: 'grant' });
  assert.deepEqual(fundStep({ funded: false, granted: false, shortSince: null, blocked: false, now: NOW }), { kind: 'none' });
  assert.deepEqual(fundStep({ funded: false, granted: true, shortSince: null, blocked: false, now: NOW }), { kind: 'short', graceEndsAt: NOW + 7 * DAY });
  assert.deepEqual(fundStep({ funded: false, granted: true, shortSince: NOW - 7 * DAY, blocked: false, now: NOW }), { kind: 'drop' });
  assert.deepEqual(fundStep({ funded: true, granted: false, shortSince: null, blocked: true, now: NOW }), { kind: 'none' });
});

test('checkout carries the clan ref, the person, and cover for the payer', () => {
  assert.equal(fundCheckoutUrl('https://a.gumroad.com/l/clan-fund', 'cref', 'pref', true), 'https://a.gumroad.com/l/clan-fund?ref=cref&payer=pref&cover=1');
  assert.equal(fundCheckoutUrl('https://a.gumroad.com/l/clan-fund', 'cref', null), 'https://a.gumroad.com/l/clan-fund?ref=cref');
  assert.equal(fundCheckoutUrl(null, 'cref', 'p'), null);
  assert.equal(usd(6990), '$69.90');
  assert.equal(usd(600), '$6');
});
