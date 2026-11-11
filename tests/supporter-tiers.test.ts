// Anvil Supporter, the pure half: which tier a person holds right now, and since when.
//
// Run: npx tsx --test tests/supporter-tiers.test.ts (no database).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  rowInForce,
  supporterState,
  paidRunStart,
  supporterTierForGumroad,
  tenureFor,
  tenureLabel,
  wholeMonths,
} from '../src/lib/supporterTiers.ts';

const NOW = Date.parse('2026-11-02T12:00:00Z');
const row = (o: Partial<{ tier: string; status: string; currentPeriodEnd: string | null; startedAt: string; tenureStartedAt: string | null; endedAt: string | null; recurrence: string | null; style: string | null; userId: number }>) => ({
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

test('the tenure ladder: Apprentice → Journeyman 3 → Artisan 6 → Master 12 → Grandmaster 24 → Legend 36', () => {
  const at = (m: number) => tenureFor(m).step.id;
  assert.equal(at(0), 'apprentice');
  assert.equal(at(2), 'apprentice');
  assert.equal(at(3), 'journeyman');
  assert.equal(at(6), 'artisan');
  assert.equal(at(11), 'artisan');
  assert.equal(at(12), 'master');
  assert.equal(at(24), 'grandmaster');
  assert.equal(at(36), 'legend');
  assert.equal(at(120), 'legend');
  assert.equal(tenureFor(36).next, null);
  assert.equal(tenureFor(13).next?.id, 'grandmaster');
  // Four chat shapes only: they must read apart at 11px.
  // The first in-game change is at 3 months: every step past Apprentice looks different in game.
  assert.deepEqual([0, 3, 6, 12, 24, 36].map((m) => tenureFor(m).step.chat), [1, 2, 3, 4, 5, 6]);
  assert.equal(tenureLabel(14), '1 year, 2 months');
  assert.equal(tenureLabel(1), '1 month');
  assert.equal(tenureLabel(0), 'under a month');
});

const DAY = 86_400_000;
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

test('tenure counts unbroken PAID time: a live membership counts from its run start', () => {
  assert.equal(paidRunStart([row({ startedAt: ago(400) })], NOW), NOW - 400 * DAY);
  // A resubscribe moved the run start forward; started_at alone would overstate it.
  assert.equal(paidRunStart([row({ startedAt: ago(400), tenureStartedAt: ago(30) })], NOW), NOW - 30 * DAY);
  const s = supporterState([row({ startedAt: ago(400) })], NOW)!;
  assert.equal(s.tenure.id, 'master');
  assert.equal(s.tenureMonths, 13);
  assert.equal(s.months, 13);
});

test('a lapse under 30 days keeps the run; a longer gap starts the climb again (since stays the first date)', () => {
  const short = [
    row({ status: 'ended', startedAt: ago(500), endedAt: ago(120) }),
    row({ startedAt: ago(100) }),
  ];
  assert.equal(paidRunStart(short, NOW), NOW - 500 * DAY, '20-day gap is joined');
  const long = [
    row({ status: 'ended', startedAt: ago(500), endedAt: ago(200) }),
    row({ startedAt: ago(100) }),
  ];
  assert.equal(paidRunStart(long, NOW), NOW - 100 * DAY, '100-day gap breaks it');
  const s = supporterState(long, NOW)!;
  assert.equal(s.tenure.id, 'journeyman');
  assert.equal(s.since, new Date(NOW - 500 * DAY).toISOString(), '"Supporter since" is still the first date');
});

test('changing tier never resets tenure: rows of any tier join one run', () => {
  const rows = [
    row({ tier: 'supporter', status: 'ended', startedAt: ago(800), endedAt: ago(300) }),
    row({ tier: 'patron', startedAt: ago(299) }),
  ];
  assert.equal(supporterState(rows, NOW)!.tenure.id, 'grandmaster');
});

test('invite-earned time, staff gifts and refunded money never climb the ladder', () => {
  const end = new Date(NOW + 20 * DAY).toISOString();
  const earned = [row({ status: 'granted', recurrence: 'referral', startedAt: ago(400), currentPeriodEnd: end })];
  assert.equal(paidRunStart(earned, NOW), null);
  const s = supporterState(earned, NOW)!;
  assert.equal(s.tenure.id, 'apprentice', 'they still wear the star');
  assert.equal(s.tenureMonths, 0);
  const gift = [row({ status: 'granted', recurrence: 'gift', startedAt: ago(400), currentPeriodEnd: end })];
  assert.equal(paidRunStart(gift, NOW), null);
  assert.equal(paidRunStart([row({ status: 'refunded', startedAt: ago(400), endedAt: ago(1) })], NOW), null);
});

test('a cancelled membership counts until its term ends, then fades out after the grace', () => {
  assert.equal(paidRunStart([row({ status: 'cancelling', startedAt: ago(400), currentPeriodEnd: new Date(NOW + 5 * DAY).toISOString() })], NOW), NOW - 400 * DAY);
  assert.equal(paidRunStart([row({ status: 'ended', startedAt: ago(400), endedAt: ago(10) })], NOW), NOW - 400 * DAY);
  assert.equal(paidRunStart([row({ status: 'ended', startedAt: ago(400), endedAt: ago(40) })], NOW), null);
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

test('one person on several logins: equal tiers pick the login with chosen colours, then the oldest — every read alike', () => {
  const blue = JSON.stringify({ stops: ['#7ae0ff', '#3a6bff'] });
  const plain = row({ tier: 'patron', userId: 3 });
  const styled = row({ tier: 'patron', userId: 9, style: blue });
  // Whichever order the rows come back in (a host's own login first, or their characters' login).
  assert.deepEqual(supporterState([plain, styled], NOW)?.style, supporterState([styled, plain], NOW)?.style);
  assert.ok(supporterState([plain, styled], NOW)?.style, 'the chosen colours win the tie');
  // A higher tier still wins over chosen colours.
  assert.equal(supporterState([row({ tier: 'champion', userId: 1, style: blue }), plain], NOW)?.tier.id, 'patron');
  // No colours on either: the oldest login, either order.
  const a = row({ tier: 'patron', userId: 2, startedAt: '2026-01-01T00:00:00Z' });
  const b = row({ tier: 'patron', userId: 5, startedAt: '2026-02-01T00:00:00Z' });
  assert.equal(supporterState([a, b], NOW)?.since, supporterState([b, a], NOW)?.since);
});

test('a membership coming back restarts its run only after the grace, or after a refund', async () => {
  const { runStartOnReturn } = await import('../src/lib/supporterTiers.ts');
  assert.deepEqual(runStartOnReturn({ status: 'ended', endedAt: ago(10), currentPeriodEnd: null }, NOW), {});
  assert.deepEqual(runStartOnReturn({ status: 'ended', endedAt: ago(45), currentPeriodEnd: null }, NOW), { tenureStartedAt: new Date(NOW).toISOString() });
  assert.deepEqual(runStartOnReturn({ status: 'refunded', endedAt: ago(1), currentPeriodEnd: null }, NOW), { tenureStartedAt: new Date(NOW).toISOString() });
  assert.deepEqual(runStartOnReturn({ status: 'active', endedAt: null, currentPeriodEnd: null }, NOW), {});
});

test('a framed tenure star on Discord: the tier colours drawn with the step, plain stars unchanged', async () => {
  const { supporterStarUrl } = await import('../src/lib/supporterTiers.ts');
  const o = 'https://anvilosrs.com';
  assert.equal(supporterStarUrl('supporter', null, o), `${o}/icons/supporter-supporter.png`);
  assert.equal(supporterStarUrl('supporter', null, o, 'apprentice'), `${o}/api/og/supporter-star/ffd35c?t=apprentice`, 'every step has its badge');
  assert.equal(supporterStarUrl('supporter', null, o, 'master'), `${o}/api/og/supporter-star/ffd35c?t=master`);
  assert.equal(supporterStarUrl('champion', null, o, 'legend'), `${o}/api/og/supporter-star/ff9a5a-e05ad0-7a8cff?t=legend`);
});

test('the tenure star SVG frames every step past Apprentice and renders only checked colours', async () => {
  const { tenureStarSvg } = await import('../src/lib/tenureStarSvg.ts');
  assert.ok(tenureStarSvg(['#ffd35c']).includes('<path'), 'no step: the bare star');
  assert.ok(tenureStarSvg(['#ffd35c'], 'master').includes('<rect'), 'a step: its pixel badge');
  assert.notEqual(tenureStarSvg(['#ffd35c'], 'master'), tenureStarSvg(['#ffd35c'], 'legend'));
  assert.equal(tenureStarSvg(['#ffd35c'], 'master'), tenureStarSvg(['#e05ad0'], 'master'), 'the gem has its own colours, not the name\'s');
  assert.ok(!tenureStarSvg(['#ffd35c'], 'legend').includes('script'));
});
