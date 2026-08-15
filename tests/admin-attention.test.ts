// The admin dashboard's "needs you" queue (lib/adminAttention) — which decisions surface, how
// loudly, and in what order.
//
// Run: node --experimental-strip-types --test tests/admin-attention.test.ts
// (lib/adminAttention imports nothing from `@/`, so Node's native TS type-stripping runs it directly.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  attentionQueue,
  openCount,
  type AttentionEvent,
  type AttentionFacts,
} from '../src/lib/adminAttention.ts';

const NOW = Date.parse('2026-08-15T12:00:00Z');
const DAY = 86_400_000;
const inDays = (n: number) => new Date(NOW + n * DAY).toISOString();

const board = (over: Partial<AttentionEvent> = {}): AttentionEvent => ({
  id: 1,
  kind: 'board',
  name: 'Bingo #6',
  href: '/admin/events/1',
  startDate: inDays(30),
  status: 'upcoming',
  teamCount: 4,
  tileCount: 25,
  expectedTiles: 25,
  needsTeams: true,
  ...over,
});

const QUIET: AttentionFacts = {
  now: NOW,
  events: [],
  feesOwed: 0,
  feesToSign: 0,
  oldestFeeDays: null,
  pendingVerifications: 0,
  gap: null,
  unscheduled: [],
};

const facts = (over: Partial<AttentionFacts> = {}): AttentionFacts => ({ ...QUIET, ...over });

test('a quiet clan gets one all-clear, not an empty page', () => {
  const q = attentionQueue(QUIET);
  assert.equal(q.length, 1);
  assert.equal(q[0].severity, 'clear');
  assert.equal(openCount(q), 0);
});

test('a board opening this week with no teams is critical', () => {
  const q = attentionQueue(facts({ events: [board({ teamCount: 0, startDate: inDays(3) })] }));
  const teams = q.find((i) => i.key === 'teams-1');
  assert.equal(teams?.severity, 'critical');
  assert.match(teams!.title, /starts in 3 days with no teams/);
  assert.equal(teams?.href, '/admin/events/1/teams');
});

test('the same board six weeks out is only information', () => {
  const q = attentionQueue(facts({ events: [board({ teamCount: 0, startDate: inDays(42) })] }));
  assert.equal(q.find((i) => i.key === 'teams-1')?.severity, 'info');
});

test('a format that never drafts is not nagged about teams', () => {
  const q = attentionQueue(
    facts({ events: [board({ teamCount: 0, needsTeams: false, startDate: inDays(2) })] }),
  );
  assert.equal(q.find((i) => i.key === 'teams-1'), undefined);
});

test('a half-drawn board is quiet until it is nearly open', () => {
  const far = attentionQueue(facts({ events: [board({ tileCount: 10, startDate: inDays(30) })] }));
  assert.equal(far.find((i) => i.key === 'tiles-1'), undefined);

  const near = attentionQueue(facts({ events: [board({ tileCount: 10, startDate: inDays(2) })] }));
  const tiles = near.find((i) => i.key === 'tiles-1');
  assert.equal(tiles?.severity, 'warn');
  assert.match(tiles!.title, /short 15 tiles/);
  assert.match(tiles!.detail, /10 of 25 drawn/);
});

test('an imminent board with no tiles at all is critical, not a warning', () => {
  const q = attentionQueue(facts({ events: [board({ tileCount: 0, startDate: inDays(1) })] }));
  assert.equal(q.find((i) => i.key === 'tiles-1')?.severity, 'critical');
});

test('a finished event never asks for anything', () => {
  const q = attentionQueue(
    facts({ events: [board({ status: 'ended', teamCount: 0, tileCount: 0, startDate: inDays(-9) })] }),
  );
  assert.equal(openCount(q), 0);
});

test('a running board is not asked to build teams it can no longer draft', () => {
  const q = attentionQueue(
    facts({ events: [board({ status: 'running', teamCount: 0, startDate: inDays(-1) })] }),
  );
  assert.equal(q.find((i) => i.key === 'teams-1'), undefined);
});

test('weeklies are never in the queue — nothing about them is manual', () => {
  const q = attentionQueue(
    facts({ events: [board({ kind: 'weekly', teamCount: 0, tileCount: 0, startDate: inDays(1) })] }),
  );
  assert.equal(openCount(q), 0);
});

test('held fees escalate once they have sat a fortnight', () => {
  const fresh = attentionQueue(facts({ feesToSign: 34, oldestFeeDays: 3 }));
  assert.equal(fresh.find((i) => i.key === 'fees-sign')?.severity, 'info');

  const stale = attentionQueue(facts({ feesToSign: 34, oldestFeeDays: 19 }));
  const item = stale.find((i) => i.key === 'fees-sign');
  assert.equal(item?.severity, 'warn');
  assert.match(item!.detail, /Oldest: 19 days/);
});

test('owed and held fees are different jobs and stay separate', () => {
  const q = attentionQueue(facts({ feesOwed: 5, feesToSign: 2, oldestFeeDays: 1 }));
  assert.ok(q.find((i) => i.key === 'fees-owed'));
  assert.ok(q.find((i) => i.key === 'fees-sign'));
});

test('a short seam in the schedule is not reported as a gap', () => {
  const q = attentionQueue(facts({ gap: { days: 3, startsInDays: 4 } }));
  assert.equal(q.find((i) => i.key === 'gap'), undefined);
  assert.equal(openCount(q), 0);
});

test('a real gap points at the undated board that would fill it', () => {
  const q = attentionQueue(
    facts({
      gap: { days: 7, startsInDays: 9 },
      unscheduled: [{ id: 9, name: 'September Bingo', href: '/admin/events/9' }],
    }),
  );
  const gap = q.find((i) => i.key === 'gap');
  assert.match(gap!.title, /Nothing runs for 7 days, starting in 9 days/);
  assert.match(gap!.detail, /September Bingo is written but has no dates/);
  assert.equal(gap?.href, '/admin/events/9');
  assert.equal(gap?.action, 'Give it dates');
});

test('a gap with nothing waiting sends you to the schedule instead', () => {
  const q = attentionQueue(facts({ gap: { days: 10, startsInDays: 2 } }));
  assert.equal(q.find((i) => i.key === 'gap')?.action, 'Open schedule');
});

test('critical work outranks everything, and ties break on what bites first', () => {
  const q = attentionQueue(
    facts({
      events: [
        board({ id: 1, name: 'Later', teamCount: 0, startDate: inDays(6) }),
        board({ id: 2, name: 'Sooner', teamCount: 0, startDate: inDays(1) }),
      ],
      feesToSign: 3,
      oldestFeeDays: 20,
      pendingVerifications: 12,
    }),
  );
  assert.deepEqual(
    q.map((i) => i.key),
    ['teams-2', 'teams-1', 'fees-sign', 'verifications'],
  );
  assert.equal(q[0].severity, 'critical');
});

test('an undated board is not nagged about a start date it does not have', () => {
  const q = attentionQueue(
    facts({ events: [board({ startDate: null, status: 'draft', teamCount: 0, tileCount: 0 })] }),
  );
  assert.equal(openCount(q), 0);
});

test('singular wording is used for a single item', () => {
  const q = attentionQueue(facts({ pendingVerifications: 1, feesOwed: 1 }));
  assert.match(q.find((i) => i.key === 'verifications')!.title, /^1 person waiting/);
  assert.match(q.find((i) => i.key === 'fees-owed')!.title, /^1 fee still/);
});

test('an event opening in hours reads in hours, not "in 0 days"', () => {
  const q = attentionQueue(
    facts({ events: [board({ teamCount: 0, startDate: new Date(NOW + 5 * 3_600_000).toISOString() })] }),
  );
  assert.match(q.find((i) => i.key === 'teams-1')!.title, /in 5 hours/);
});
