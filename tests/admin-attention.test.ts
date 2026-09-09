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
  feeEvents: [],
  pendingVerifications: 0,
  joinRequests: 0,
  coHostInvites: 0,
  gap: null,
  unscheduled: [],
};

const facts = (over: Partial<AttentionFacts> = {}): AttentionFacts => ({ ...QUIET, ...over });

test('somebody knocking reaches the queue', () => {
  // Both of these were written end to end on the server and shown on no page a human opens. The
  // dashboard is where "what needs you" is answered, so an unanswered request belongs in it.
  const asked = attentionQueue(facts({ joinRequests: 3 }));
  const join = asked.find((i) => i.key === 'join-requests');
  assert.ok(join, 'a pending join request is something waiting on a human');
  assert.match(join.title, /3 people asking to join/);
  assert.equal(join.severity, 'warn');

  const invited = attentionQueue(facts({ coHostInvites: 1 }));
  const cohost = invited.find((i) => i.key === 'cohost-invites');
  assert.ok(cohost, 'a co-host invite is a decision, not a notification');
  assert.match(cohost.title, /1 clan invited you to co-host/);
});

test('a clan nobody is knocking on is not nagged about either', () => {
  const q = attentionQueue(QUIET);
  assert.equal(q.find((i) => i.key === 'join-requests'), undefined);
  assert.equal(q.find((i) => i.key === 'cohost-invites'), undefined);
});

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

const liveFees = [{ name: 'Bingo #6', ended: false, count: 34, href: '/admin/events/1/fees' }];
const oldFees = [{ name: 'July Bingo', ended: true, count: 34, href: '/admin/events/9/fees' }];

test('held fees for a live event escalate once they have sat a fortnight', () => {
  const fresh = attentionQueue(facts({ feesToSign: 34, oldestFeeDays: 3, feeEvents: liveFees }));
  assert.equal(fresh.find((i) => i.key === 'fees-sign')?.severity, 'info');

  const stale = attentionQueue(facts({ feesToSign: 34, oldestFeeDays: 19, feeEvents: liveFees }));
  const item = stale.find((i) => i.key === 'fees-sign');
  assert.equal(item?.severity, 'warn');
  assert.match(item!.detail, /Oldest: 19 days/);
});

test('fees left over from a finished event are bookkeeping, not an alarm', () => {
  // The complaint this fixes: a 50-day-old fee from a board that ended in July was the loudest
  // card on the dashboard every morning, and never said which event it meant.
  const q = attentionQueue(facts({ feesToSign: 34, oldestFeeDays: 50, feeEvents: oldFees }));
  const item = q.find((i) => i.key === 'fees-sign')!;
  assert.equal(item.severity, 'info', 'a finished event must not escalate on age alone');
  assert.match(item.title, /left unsigned from July Bingo/);
  assert.match(item.detail, /The event is over/);
  assert.equal(item.action, 'Close them out');
  assert.equal(item.href, '/admin/events/9/fees');
});

test('stale bookkeeping sorts below anything live, however old it is', () => {
  const q = attentionQueue(
    facts({
      feesToSign: 34,
      oldestFeeDays: 50,
      feeEvents: oldFees,
      pendingVerifications: 2,
    }),
  );
  assert.deepEqual(q.map((i) => i.key), ['verifications', 'fees-sign']);
});

test('a live event among the waiting fees keeps the card urgent and names it', () => {
  const q = attentionQueue(
    facts({ feesToSign: 34, oldestFeeDays: 20, feeEvents: [...oldFees, ...liveFees] }),
  );
  const item = q.find((i) => i.key === 'fees-sign')!;
  assert.equal(item.severity, 'warn');
  assert.match(item.title, /waiting on a second signature/);
});

test('a single live event is named in the detail', () => {
  const q = attentionQueue(facts({ feesToSign: 3, oldestFeeDays: 2, feeEvents: liveFees }));
  assert.match(q.find((i) => i.key === 'fees-sign')!.detail, /the money for Bingo #6/);
});

test('owed and held fees are different jobs and stay separate', () => {
  const q = attentionQueue(facts({ feesOwed: 5, feesToSign: 2, oldestFeeDays: 1 }));
  assert.ok(q.find((i) => i.key === 'fees-owed'));
  assert.ok(q.find((i) => i.key === 'fees-sign'));
});

test('a short seam in the schedule is not reported as a gap', () => {
  const q = attentionQueue(facts({ gap: { days: 3, startsInDays: 4, openEnded: false, startsOn: '19 August' } }));
  assert.equal(q.find((i) => i.key === 'gap'), undefined);
  assert.equal(openCount(q), 0);
});

test('a real gap points at the undated board that would fill it', () => {
  const q = attentionQueue(
    facts({
      gap: { days: 7, startsInDays: 9, openEnded: false, startsOn: '24 August' },
      unscheduled: [{ id: 9, name: 'September Bingo', href: '/admin/events/9' }],
    }),
  );
  const gap = q.find((i) => i.key === 'gap');
  assert.match(gap!.title, /Nothing runs for 7 days, starting in 9 days/);
  assert.match(gap!.detail, /September Bingo is written but has no dates/);
  assert.equal(gap?.href, '/admin/events/9');
  assert.equal(gap?.action, 'Give it dates');
});

test('an open-ended gap is dated, never given a made-up length', () => {
  // "Nothing runs for 33 days" was the distance to the edge of a six-week window, not a fact about
  // the calendar — widen the window and the same empty schedule claims 47.
  const q = attentionQueue(
    facts({ gap: { days: 33, startsInDays: 10, openEnded: true, startsOn: '24 August' } }),
  );
  const gap = q.find((i) => i.key === 'gap')!;
  assert.equal(gap.title, 'Nothing is scheduled after 24 August');
  assert.doesNotMatch(gap.title, /33/);
});

test('a gap with nothing waiting sends you to the schedule instead', () => {
  const q = attentionQueue(facts({ gap: { days: 10, startsInDays: 2, openEnded: false, startsOn: '17 August' } }));
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
      feeEvents: liveFees,
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

/* ---------------------------------------------------------------------------
   Whose queue is it.

   The dashboard is the landing tile for EVERY staff tier, and this queue was built for an admin
   and handed to all of them unchanged. lib/adminAccess bounces a moderator without the authoring
   capability off /admin/events entirely — so "Bingo #7 starts in 3 days with no teams · Build
   teams" was a button that returned them to the page they pressed it on, every morning, for work
   that was never theirs to do.

   `canReach` is the real routing table, passed in by the page. These assert the filter, not the
   table: tests/admin-access.test.ts owns what the table itself says.
   --------------------------------------------------------------------------- */

/** Stands in for redirectFor(href, moderatorGrant) === null. */
const moderatorReach = (href: string) => !href.startsWith('/admin/events');

test('a moderator is not asked to do an admin’s job', () => {
  const asAdmin = attentionQueue(
    facts({ events: [board({ teamCount: 0, startDate: inDays(3) })], pendingVerifications: 4 }),
  );
  assert.deepEqual(asAdmin.map((i) => i.key), ['teams-1', 'verifications']);

  const asModerator = attentionQueue(
    facts({
      events: [board({ teamCount: 0, startDate: inDays(3) })],
      pendingVerifications: 4,
      canReach: moderatorReach,
    }),
  );
  assert.deepEqual(
    asModerator.map((i) => i.key),
    ['verifications'],
    'the teams card links into /admin/events, which they cannot open',
  );
});

test('what a moderator CAN act on still reaches them', () => {
  // Verifications, join requests and co-host invites all land on /admin/people; fees on /admin/fees.
  // Every one of those is moderator-tier, so none of them may be filtered out.
  const q = attentionQueue(
    facts({
      pendingVerifications: 2,
      joinRequests: 1,
      coHostInvites: 1,
      feesOwed: 3,
      canReach: moderatorReach,
    }),
  );
  assert.deepEqual(
    new Set(q.map((i) => i.key)),
    new Set(['verifications', 'join-requests', 'cohost-invites', 'fees-owed']),
  );
});

test('a filtered-empty queue is an honest all-clear, not a silent page', () => {
  // Nothing here is the moderator's, so their dashboard says so rather than showing four cards
  // that bounce. An empty list would have rendered a heading over nothing at all.
  const q = attentionQueue(
    facts({ events: [board({ teamCount: 0, tileCount: 0, startDate: inDays(2) })], canReach: moderatorReach }),
  );
  assert.equal(q.length, 1);
  assert.equal(q[0].key, 'clear');
  assert.equal(openCount(q), 0);
});

test('the all-clear card never offers a page the reader cannot open', () => {
  // It is the one card that is always rendered, so its own link has to survive the filter too.
  const noSchedule = (href: string) => href === '/admin/people';
  const q = attentionQueue(facts({ canReach: noSchedule }));
  assert.equal(q[0].key, 'clear');
  assert.equal(noSchedule(q[0].href), true, 'the fallback link must itself be reachable');
  assert.equal(q[0].action, 'Open roster');
});

test('no predicate means no filtering — the admin case, and every existing caller', () => {
  const q = attentionQueue(facts({ events: [board({ teamCount: 0, startDate: inDays(3) })] }));
  assert.equal(q.find((i) => i.key === 'teams-1') != null, true);
});

test('the gap card is filtered on the board it would send you to, not on the gap', () => {
  // "Nothing runs for 12 days · Bingo #8 is written but has no dates — Give it dates" points INTO
  // an event. A moderator gets the schedule-shaped version of the same news or nothing at all.
  const withBoard = attentionQueue(
    facts({
      gap: { days: 12, startsInDays: 1, openEnded: false, startsOn: '1 September' },
      unscheduled: [{ id: 9, name: 'Bingo #8', href: '/admin/events/9' }],
      canReach: moderatorReach,
    }),
  );
  assert.equal(withBoard.find((i) => i.key === 'gap'), undefined);

  const noBoard = attentionQueue(
    facts({
      gap: { days: 12, startsInDays: 1, openEnded: false, startsOn: '1 September' },
      canReach: moderatorReach,
    }),
  );
  assert.equal(noBoard.find((i) => i.key === 'gap')?.href, '/admin/schedule');
});

/* ---------------------------------------------------------------------------
   Snoozing.

   The `key` field has carried a comment promising this since the queue was written — "used as a
   React key and to snooze one item without touching the rest" — and nothing implemented it. So the
   card about fees held against a board that finished in July stood on the dashboard every morning,
   correct and unactionable, beside the cards that were urgent.

   The rule that makes it safe is that the QUEUE decides what may be put down, not the caller: a
   stored key for an item marked `snoozable: false` is ignored.
   --------------------------------------------------------------------------- */

const laterToday = NOW + 3 * DAY;
const yesterday = NOW - DAY;

test('a snoozed item goes quiet until its moment comes back', () => {
  const stale = { feesToSign: 4, oldestFeeDays: 40, feeEvents: [{ name: 'July bingo', ended: true, count: 4, href: '/admin/events/3/signups' }] };

  const before = attentionQueue(facts(stale));
  assert.ok(before.some((i) => i.key === 'fees-sign'));

  const after = attentionQueue(facts({ ...stale, snoozed: { 'fees-sign': laterToday } }));
  assert.equal(after.some((i) => i.key === 'fees-sign'), false);

  // And it comes back on its own once the snooze runs out. Nothing has to clean the map up.
  const expired = attentionQueue(facts({ ...stale, snoozed: { 'fees-sign': yesterday } }));
  assert.ok(expired.some((i) => i.key === 'fees-sign'));
});

test('an unprepared board CANNOT be snoozed, however the map is written', () => {
  // This is the whole safety of the feature. A board that opens with no teams opens broken, and
  // nothing about a stored key should be able to take that off the page.
  const q = attentionQueue(
    facts({
      events: [board({ teamCount: 0, startDate: inDays(2) })],
      snoozed: { 'teams-1': laterToday },
    }),
  );
  const teams = q.find((i) => i.key === 'teams-1');
  assert.ok(teams, 'still there');
  assert.equal(teams.snoozable, false, 'and it says so, so no button is offered either');
});

test('somebody waiting on an answer is never snoozable', () => {
  // A person applied, or self-reported and cannot be scored until a mod looks. Silencing that
  // silences them, not the task.
  const q = attentionQueue(facts({ pendingVerifications: 2, joinRequests: 1, coHostInvites: 1 }));
  for (const key of ['verifications', 'join-requests', 'cohost-invites']) {
    assert.equal(q.find((i) => i.key === key)!.snoozable, false, key);
  }
});

test('snoozing every open item leaves the honest all-clear, not a blank section', () => {
  const q = attentionQueue(
    facts({
      feesOwed: 2,
      gap: { days: 12, startsInDays: 1, openEnded: false, startsOn: '1 September' },
      snoozed: { 'fees-owed': laterToday, gap: laterToday },
    }),
  );
  assert.equal(q.length, 1);
  assert.equal(q[0].key, 'clear');
});

test('a snooze for a key that is not in the queue is simply ignored', () => {
  const q = attentionQueue(facts({ feesOwed: 1, snoozed: { 'teams-4321': laterToday, nonsense: laterToday } }));
  assert.ok(q.some((i) => i.key === 'fees-owed'));
});

test('every item states whether it can be put down', () => {
  // A missing flag would render a snooze button on something that must never carry one.
  const q = attentionQueue(
    facts({
      events: [board({ teamCount: 0, tileCount: 0, startDate: inDays(2) })],
      feesOwed: 1,
      feesToSign: 1,
      oldestFeeDays: 3,
      feeEvents: [{ name: 'Live one', ended: false, count: 1, href: '/admin/events/1/signups' }],
      pendingVerifications: 1,
      joinRequests: 1,
      coHostInvites: 1,
      gap: { days: 9, startsInDays: 2, openEnded: false, startsOn: '1 September' },
    }),
  );
  for (const item of q) {
    assert.equal(typeof item.snoozable, 'boolean', item.key);
  }
});
