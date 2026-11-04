// Friends events — the pure rules (lib/friendEventRules): caps by Supporter tier, the live limit,
// and the AGGREGATE player cap (seats held at once across overlapping events, a sweep over windows).
//
// Run: npx tsx --test tests/friend-event-rules.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  FRIENDS_CAPS,
  eventWindow,
  friendsAllowsAdminPath,
  friendsAllowsPublicPath,
  friendsCapsFor,
  friendsJoinVerdict,
  friendsLiveVerdict,
  friendsRedateVerdict,
  friendsScheduleVerdict,
  isInviteToken,
  mayHostFriends,
  peakSeats,
  type FriendsEventRow,
  type SeatLoad,
} from '../src/lib/friendEventRules.ts';

const H = 3_600_000;
const T0 = Date.parse('2026-12-01T00:00:00.000Z');
const at = (h: number) => new Date(T0 + h * H).toISOString();
const load = (id: number, from: number | null, to: number | null, seats: number): SeatLoad => ({
  id,
  window: from == null ? null : { start: T0 + from * H, end: to == null ? Infinity : T0 + to * H },
  seats,
});
const ALL = { start: -Infinity, end: Infinity };

test('the caps by tier: 10 / 25 / 50 players, 1 / 1 / 2 live events; no tier, no hosting', () => {
  assert.deepEqual(FRIENDS_CAPS.supporter, { playersPerEvent: 10, liveEvents: 1 });
  assert.deepEqual(FRIENDS_CAPS.champion, { playersPerEvent: 25, liveEvents: 1 });
  assert.deepEqual(FRIENDS_CAPS.patron, { playersPerEvent: 50, liveEvents: 2 });
  assert.equal(friendsCapsFor(null), null);
  assert.equal(mayHostFriends(null).ok, false);
  assert.equal(mayHostFriends('supporter').ok, true);
});

test('live limit: one at a time below Patron, two for a Patron, none without a tier', () => {
  assert.equal(friendsLiveVerdict({ tier: 'supporter', liveEvents: 0 }).ok, true);
  assert.equal(friendsLiveVerdict({ tier: 'champion', liveEvents: 1 }).ok, false);
  assert.equal(friendsLiveVerdict({ tier: 'patron', liveEvents: 1 }).ok, true);
  const third = friendsLiveVerdict({ tier: 'patron', liveEvents: 2 });
  assert.equal(third.ok, false);
  assert.equal(!third.ok && third.reason, 'live-limit');
  const none = friendsLiveVerdict({ tier: null, liveEvents: 0 });
  assert.equal(!none.ok && none.reason, 'not-supporter');
});

test('a window: start to the earlier of end and force-end; undated or inverted is no window', () => {
  assert.deepEqual(eventWindow({ startDate: at(0), endDate: at(10), forceEndedAt: null }), { start: T0, end: T0 + 10 * H });
  assert.deepEqual(eventWindow({ startDate: at(0), endDate: at(10), forceEndedAt: at(4) }), { start: T0, end: T0 + 4 * H });
  assert.deepEqual(eventWindow({ startDate: at(0), endDate: null, forceEndedAt: null }), { start: T0, end: Infinity }, 'open-ended counts until ended');
  assert.equal(eventWindow({ startDate: null, endDate: at(10), forceEndedAt: null }), null, 'an undated draft is not on the clock');
  assert.equal(eventWindow({ startDate: at(5), endDate: at(5), forceEndedAt: null }), null);
});

test('peak: overlapping windows add up, separate ones do not', () => {
  assert.equal(peakSeats([load(1, 0, 10, 30), load(2, 5, 15, 30)], ALL), 60, 'overlap adds');
  assert.equal(peakSeats([load(1, 0, 10, 30), load(2, 20, 30, 30)], ALL), 30, 'apart: each alone');
});

test('peak: touching windows (one ends as the next starts) never overlap', () => {
  assert.equal(peakSeats([load(1, 0, 10, 40), load(2, 10, 20, 40)], ALL), 40);
});

test('peak: a chain A–B–C where A and C never meet peaks at the larger pair, not all three', () => {
  // A 0–10, B 8–18, C 16–26: A+B at 8–10, B+C at 16–18, never all three.
  const chain = [load(1, 0, 10, 20), load(2, 8, 18, 15), load(3, 16, 26, 25)];
  assert.equal(peakSeats(chain, ALL), 40, 'B+C = 40 is the peak; A+B+C = 60 never happens');
});

test('peak: nested windows — a short event inside a long one adds only while it runs', () => {
  const nested = [load(1, 0, 100, 30), load(2, 40, 50, 15), load(3, 60, 70, 10)];
  assert.equal(peakSeats(nested, ALL), 45);
  assert.equal(peakSeats(nested, { start: T0 + 55 * H, end: T0 + 58 * H }), 30, 'clipped to a quiet stretch');
});

test('peak: undated drafts add nothing; open-ended events count to the end of time', () => {
  assert.equal(peakSeats([load(1, null, null, 50), load(2, 0, 10, 5)], ALL), 5);
  assert.equal(peakSeats([load(1, 0, null, 20), load(2, 1000, 1010, 20)], ALL), 40);
});

test('join: refused only when the peak inside THIS event’s window would pass the cap', () => {
  const others = [load(2, 5, 15, 30)];
  // Patron 50: event 1 (0–10) has 20, overlapping event 2's 30 → peak 50 already.
  assert.equal(friendsJoinVerdict({ tier: 'patron', target: load(1, 0, 10, 20), others, adding: 1 }).ok, false);
  // The same 20 seats on a board that never meets event 2 have the full 50.
  assert.equal(friendsJoinVerdict({ tier: 'patron', target: load(1, 20, 30, 20), others, adding: 30 }).ok, true);
  assert.equal(friendsJoinVerdict({ tier: 'patron', target: load(1, 20, 30, 20), others, adding: 31 }).ok, false);
  // An undated board is alone: only its own seats count.
  assert.equal(friendsJoinVerdict({ tier: 'supporter', target: load(1, null, null, 9), others, adding: 1 }).ok, true);
  assert.equal(friendsJoinVerdict({ tier: 'supporter', target: load(1, null, null, 10), others, adding: 1 }).ok, false);
});

test('join: SEATS, not people — the same friend on two overlapping boards counts twice', () => {
  // Five friends each on both of two overlapping Supporter boards: 10 seats, the whole cap, though
  // only five people. A sixth seat on either board is refused.
  const a = load(1, 0, 10, 5);
  const b = load(2, 0, 10, 5);
  assert.equal(peakSeats([a, b], ALL), 10);
  assert.equal(friendsJoinVerdict({ tier: 'supporter', target: a, others: [b], adding: 1 }).ok, false);
});

test('join: an edit (adding 0) is never refused, so a downgrade keeps everyone', () => {
  // A Patron's 50-seat board, now a Supporter (cap 10): nobody is kicked, nobody new gets in.
  assert.equal(friendsJoinVerdict({ tier: 'supporter', target: load(1, 0, 10, 50), others: [], adding: 0 }).ok, true);
  assert.equal(friendsJoinVerdict({ tier: 'supporter', target: load(1, 0, 10, 50), others: [], adding: 1 }).ok, false);
  assert.equal(friendsJoinVerdict({ tier: null, target: load(1, 0, 10, 0), others: [], adding: 1 }).ok, false, 'lapsed: no new joins');
});

test('re-date: moving an event onto another past the cap is refused; apart or shorter is fine', () => {
  const others = [load(2, 20, 30, 30)];
  const before = load(1, 0, 10, 30);
  // Onto event 2: 60 > 50.
  assert.equal(friendsRedateVerdict({ tier: 'patron', before, after: load(1, 25, 35, 30), others }).ok, false);
  // Touching it: fine.
  assert.equal(friendsRedateVerdict({ tier: 'patron', before, after: load(1, 30, 40, 30), others }).ok, true);
  // Already overlapping past the cap (after a downgrade), and shortened: never worse, so allowed.
  const over = load(1, 15, 30, 30);
  assert.equal(friendsRedateVerdict({ tier: 'champion', before: over, after: load(1, 15, 25, 30), others }).ok, true);
  // Moved apart: allowed.
  assert.equal(friendsRedateVerdict({ tier: 'champion', before: over, after: load(1, 40, 50, 30), others }).ok, true);
  // An empty new board in an already-over window adds nothing.
  assert.equal(friendsRedateVerdict({ tier: 'supporter', before: null, after: load(3, 20, 30, 0), others }).ok, true);
});

test('schedule: create needs a tier; going live counts the OTHER live events; untouched events are not judged', () => {
  const now = T0 + 1 * H;
  const live: FriendsEventRow = { id: 1, startDate: at(0), endDate: at(10), forceEndedAt: null, seats: 8 };
  const draft: FriendsEventRow = { id: 2, startDate: null, endDate: null, forceEndedAt: null, seats: 0 };
  // A Supporter makes a draft next to a live event: fine (a draft is not live).
  assert.equal(friendsScheduleVerdict({ tier: 'supporter', before: [live], after: [live, draft], now }).ok, true);
  // ...but dating it now makes two live: refused for a Supporter, fine for a Patron.
  const dated = { ...draft, startDate: at(1), endDate: at(5) };
  const v = friendsScheduleVerdict({ tier: 'supporter', before: [live, draft], after: [live, dated], now });
  assert.equal(!v.ok && v.reason, 'live-limit');
  assert.equal(friendsScheduleVerdict({ tier: 'patron', before: [live, draft], after: [live, dated], now }).ok, true);
  // No tier: no new event at all, even a draft.
  assert.equal(friendsScheduleVerdict({ tier: null, before: [], after: [draft], now }).ok, false);
  // No tier, an edit that changes no dates: goes through.
  assert.equal(friendsScheduleVerdict({ tier: null, before: [live], after: [{ ...live }], now }).ok, true);
});

test('schedule: a Patron’s two live events may not overlap past 50 seats', () => {
  const now = T0;
  const a: FriendsEventRow = { id: 1, startDate: at(0), endDate: at(10), forceEndedAt: null, seats: 40 };
  const b: FriendsEventRow = { id: 2, startDate: null, endDate: null, forceEndedAt: null, seats: 20 };
  const bOverlaps = { ...b, startDate: at(5), endDate: at(15) };
  const bApart = { ...b, startDate: at(10), endDate: at(20) };
  assert.equal(friendsScheduleVerdict({ tier: 'patron', before: [a, b], after: [a, bOverlaps], now }).ok, false, '40 + 20 > 50');
  assert.equal(friendsScheduleVerdict({ tier: 'patron', before: [a, b], after: [a, bApart], now }).ok, true);
});

test('invite tokens and the friends host’s pages', () => {
  assert.equal(isInviteToken('abcdefghijklmnopqrstuvwx'), true);
  assert.equal(isInviteToken('short'), false);
  assert.equal(isInviteToken('abcdefghijklmnopqrstuv/x'), false);
  assert.equal(friendsAllowsAdminPath('/admin/events'), true);
  assert.equal(friendsAllowsAdminPath('/admin/events/12/tiles'), true);
  assert.equal(friendsAllowsAdminPath('/admin/events/12/discord'), false);
  assert.equal(friendsAllowsAdminPath('/admin/dashboard'), false);
  assert.equal(friendsAllowsAdminPath('/admin/integrations'), false);
  assert.equal(friendsAllowsPublicPath('/events/12'), true);
  assert.equal(friendsAllowsPublicPath('/events/12/signup'), true);
  assert.equal(friendsAllowsPublicPath('/members'), false);
  assert.equal(friendsAllowsPublicPath('/'), false);
});
