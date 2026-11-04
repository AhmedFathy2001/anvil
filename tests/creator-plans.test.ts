// Creator-space plans (lib/creatorPlans): the players-at-once meter, the perks, and that every gate is a
// no-op until FREEMIUM_ENFORCED flips.
//
// Run: npm run test:creator-plans

import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as CP from '../src/lib/creatorPlans.ts';
import { CREATOR_PLANS } from '../src/lib/creatorCatalog.ts';
import { parseGates, validateGatesFor, type GateOptions } from '../src/lib/entryGates.ts';

function enforced<T>(fn: () => T): T {
  process.env.FREEMIUM_ENFORCED = 'true';
  try {
    return fn();
  } finally {
    delete process.env.FREEMIUM_ENFORCED;
  }
}

const C = CREATOR_PLANS;

function meterOf(name: string, players: number): CP.SeatMeter {
  return { peak: players, peakEvents: [{ name, players }], events: [{ name, players, when: 'live' }], current: true };
}

test('the approved table: players per event and the Partner name', () => {
  assert.deepEqual(
    [C.creator_free, C.creator_bronze, C.creator_silver, C.creator_gold, C.creator_partner].map((p) => p.playersPerEvent),
    [50, 150, 300, 1000, null],
  );
  assert.equal(C.creator_partner.name, 'Partner');
  assert.equal(C.creator_silver.name, 'Silver');
  assert.equal(CP.playersAtOnceCap('nonsense'), 50, 'unknown plan reads as Free');
  assert.equal(CP.playersAtOnceCap('gold'), 50, 'a clan tier reads as creator Free, not creator Gold');
  assert.equal(CP.liveEventLimit(C.creator_free), 1);
  assert.equal(CP.liveEventLimit(C.creator_bronze), 1);
  assert.equal(CP.liveEventLimit(C.creator_silver), null);
});

test('planForPlayers / nextCreatorPlan pick the smallest tier that fits', () => {
  assert.equal(CP.planForPlayers(40).id, 'creator_bronze', 'Free is never the upsell');
  assert.equal(CP.planForPlayers(151).id, 'creator_silver');
  assert.equal(CP.planForPlayers(1000).id, 'creator_gold');
  assert.equal(CP.planForPlayers(1001).id, 'creator_partner');
  assert.equal(CP.nextCreatorPlan('creator_free')?.id, 'creator_bronze');
  assert.equal(CP.nextCreatorPlan('creator_silver')?.id, 'creator_gold');
  assert.equal(CP.nextCreatorPlan('creator_gold'), null);
  assert.equal(CP.upgradeForPlayersLine(50), 'Upgrade to Bronze for 150 players at once.');
  assert.equal(CP.upgradeForPlayersLine(1000), 'Get in touch about a Partner plan for bigger events.');
});

test('generous phase: a full event, a second event, stream gates, !join and the overlay toggle all pass', () => {
  delete process.env.FREEMIUM_ENFORCED;
  assert.deepEqual(CP.eventRoomVerdict({ clanPlan: 'creator_free', players: 500, adding: 1 }), { ok: true });
  assert.deepEqual(CP.newEventVerdict({ clanPlan: 'creator_free', liveEvents: 4 }), { ok: true });
  assert.equal(CP.streamGateLock('creator_free'), null);
  assert.equal(CP.chatJoinAllowed('creator_free'), true);
  assert.equal(CP.overlayShowsMark({ clanPlan: 'creator_free', hideRequested: true }), false, 'anyone may hide it for now');
  assert.equal(CP.overlayShowsMark({ clanPlan: 'creator_free', hideRequested: false }), true, 'shown by default');
  // The meter still reads honestly, for the dashboard nudge.
  assert.equal(CP.overPlayerCap('creator_free', 51), true);
  assert.equal(CP.creatorPlanCard({ clanPlan: 'creator_free', meter: meterOf('B', 60) }).enforced, false);
});

test('enforced: players at once (one event on its own)', () => {
  enforced(() => {
    assert.deepEqual(CP.eventRoomVerdict({ clanPlan: 'creator_free', players: 49, adding: 1 }), { ok: true });
    const full = CP.eventRoomVerdict({ clanPlan: 'creator_free', players: 50, adding: 1 });
    assert.equal(full.ok, false);
    assert.match(full.ok ? '' : full.error, /This event is full/);
    // Adding two characters with room for one is refused as a whole.
    assert.equal(CP.eventRoomVerdict({ clanPlan: 'creator_bronze', players: 149, adding: 2 }).ok, false);
    // An edit adds nobody and is never refused, even over the cap after a downgrade.
    assert.deepEqual(CP.eventRoomVerdict({ clanPlan: 'creator_free', players: 300, adding: 0 }), { ok: true });
    assert.deepEqual(CP.eventRoomVerdict({ clanPlan: 'creator_gold', players: 999, adding: 1 }), { ok: true });
    assert.deepEqual(CP.eventRoomVerdict({ clanPlan: 'creator_partner', players: 100_000, adding: 1 }), { ok: true });
  });
});

test('net adding counts the same statuses on both sides (no rejected-row trade)', () => {
  // A rejected row deselected gives nothing back; a new account still takes a place.
  assert.equal(
    CP.signupNetAdding({ existing: [{ clanMemberId: 1, status: 'rejected' }], selectedIds: [2], invite: false }),
    1,
  );
  // A withdrawn row deselected gives nothing back either.
  assert.equal(
    CP.signupNetAdding({ existing: [{ clanMemberId: 1, status: 'withdrawn' }], selectedIds: [2], invite: false }),
    1,
  );
  // A rejected row re-selected through an invite becomes approved: that is a new place.
  assert.equal(
    CP.signupNetAdding({ existing: [{ clanMemberId: 1, status: 'rejected' }], selectedIds: [1], invite: true }),
    1,
  );
  // Re-selected without an invite it stays rejected: no place.
  assert.equal(
    CP.signupNetAdding({ existing: [{ clanMemberId: 1, status: 'rejected' }], selectedIds: [1], invite: false }),
    0,
  );
  // A swap of one on-board account for another is net zero; an edit is zero; a withdrawn row back is +1.
  assert.equal(CP.signupNetAdding({ existing: [{ clanMemberId: 1, status: 'pending' }], selectedIds: [2], invite: false }), 0);
  assert.equal(CP.signupNetAdding({ existing: [{ clanMemberId: 1, status: 'approved' }], selectedIds: [1], invite: false }), 0);
  assert.equal(CP.signupNetAdding({ existing: [{ clanMemberId: 1, status: 'withdrawn' }], selectedIds: [1], invite: false }), 1);
});

test('meteredPlan / isLiveEvent', () => {
  delete process.env.FREEMIUM_ENFORCED;
  assert.equal(CP.meteredPlan({ kind: 'creator', plan: 'creator_free' }), null, 'nothing metered while generous');
  enforced(() => {
    assert.equal(CP.meteredPlan({ kind: 'creator', plan: 'creator_bronze' }), 'creator_bronze');
    assert.equal(CP.meteredPlan({ kind: 'clan', plan: 'free' }), null, 'ordinary clans unchanged');
  });
  const now = Date.parse('2026-11-04T12:00:00Z');
  assert.equal(CP.isLiveEvent({ startDate: null, endDate: null, forceEndedAt: null }, now), false, 'an undated draft does not count');
  assert.equal(CP.isLiveEvent({ startDate: null, endDate: '2026-12-01T00:00:00Z', forceEndedAt: null }, now), false, 'no start date: still a draft');
  assert.equal(CP.isLiveEvent({ startDate: '2026-11-10T00:00:00Z', endDate: null, forceEndedAt: null }, now), true, 'scheduled');
  assert.equal(CP.isLiveEvent({ startDate: '2026-11-01T00:00:00Z', endDate: '2026-12-01T00:00:00Z', forceEndedAt: null }, now), true, 'running');
  assert.equal(CP.isLiveEvent({ startDate: '2026-10-01T00:00:00Z', endDate: '2026-11-01T00:00:00Z', forceEndedAt: null }, now), false, 'ended');
  assert.equal(CP.isLiveEvent({ startDate: '2026-11-01T00:00:00Z', endDate: null, forceEndedAt: '2026-11-02T00:00:00Z' }, now), false, 'force-ended');
});

test('enforced: one live event on Free and Bronze, several from Silver', () => {
  enforced(() => {
    assert.deepEqual(CP.newEventVerdict({ clanPlan: 'creator_free', liveEvents: 0 }), { ok: true });
    const second = CP.newEventVerdict({ clanPlan: 'creator_bronze', liveEvents: 1 });
    assert.equal(second.ok, false);
    assert.match(second.ok ? '' : second.error, /upgrade to Silver/);
    assert.deepEqual(CP.newEventVerdict({ clanPlan: 'creator_silver', liveEvents: 5 }), { ok: true });
  });
});

test('enforced: perks by tier', () => {
  enforced(() => {
    assert.equal(CP.streamGateLock('creator_free'), 'Bronze');
    assert.equal(CP.streamGateLock('creator_bronze'), null);
    assert.equal(CP.chatJoinAllowed('creator_bronze'), false);
    assert.equal(CP.chatJoinAllowed('creator_silver'), true);
    assert.equal(CP.overlayShowsMark({ clanPlan: 'creator_silver', hideRequested: true }), true, 'Silver cannot hide it');
    assert.equal(CP.overlayShowsMark({ clanPlan: 'creator_gold', hideRequested: true }), false);
    assert.equal(CP.overlayShowsMark({ clanPlan: 'creator_gold', hideRequested: false }), true);
  });
});

test('stream gates are "anything but Discord", so new platforms inherit the lock', () => {
  assert.equal(CP.isStreamGateKind('twitch-follow'), true);
  assert.equal(CP.isStreamGateKind('kick-follow'), true);
  assert.equal(CP.isStreamGateKind('youtube-member'), true);
  assert.equal(CP.isStreamGateKind('discord-role'), false);
  assert.equal(CP.isStreamGateKind('discord-booster'), false);
  assert.equal(CP.usesStreamGate({ anyOf: [{ kind: 'discord-booster' }] }), false);
  assert.equal(CP.usesStreamGate({ anyOf: [{ kind: 'discord-booster' }, { kind: 'twitch-sub' }] }), true);
  assert.equal(CP.usesStreamGate(null), false);

  const opts: GateOptions = {
    twitch: { configured: true, channel: { login: 'x', canHaveSubs: true, broken: false }, connectUrl: null },
    discord: { connected: true, roles: [] },
    streamLock: 'Bronze',
  };
  const locked = validateGatesFor({ anyOf: [{ kind: 'twitch-follow' }] }, opts);
  assert.equal(locked.ok, false);
  assert.match(locked.ok ? '' : locked.error, /Bronze feature/);
  assert.deepEqual(validateGatesFor({ anyOf: [{ kind: 'discord-booster' }] }, opts), { ok: true }, 'Discord is free');
  assert.deepEqual(validateGatesFor({ anyOf: [{ kind: 'twitch-follow' }] }, { ...opts, streamLock: null }), { ok: true });

  // Kick and YouTube kinds are locked the same way, ahead of their own connection checks.
  const ready: GateOptions = {
    ...opts,
    kick: { configured: true, channel: { slug: 'k', broken: false, followersOnlyChat: false }, connectUrl: null },
    youtube: { configured: true, channel: { title: 'Y', broken: false }, connectUrl: null },
  };
  for (const kind of ['kick-follow', 'kick-sub', 'youtube-sub', 'youtube-member'] as const) {
    const parsed = parseGates({ anyOf: [{ kind }] });
    assert.ok(parsed, `${kind} parses`);
    assert.ok(CP.usesStreamGate(parsed), `${kind} is a stream gate`);
    const v = validateGatesFor(parsed, ready);
    assert.equal(v.ok, false, `${kind} locked below Bronze`);
    assert.match(v.ok ? '' : v.error, /Bronze feature/);
    assert.deepEqual(validateGatesFor(parsed, { ...ready, streamLock: null }), { ok: true }, `${kind} allowed on Bronze+`);
  }
});

test('featured listing follows the plan paid for, creator spaces only', () => {
  delete process.env.FREEMIUM_ENFORCED;
  assert.equal(CP.featuredListing('creator', 'creator_free'), false, 'not every creator while generous');
  assert.equal(CP.featuredListing('creator', 'creator_bronze'), false);
  assert.equal(CP.featuredListing('creator', 'creator_silver'), true);
  assert.equal(CP.featuredListing('clan', 'gold'), false, 'ordinary clans unchanged');
});

test('the plan card: meter, over, and the tier that fits', () => {
  delete process.env.FREEMIUM_ENFORCED;
  const small = CP.creatorPlanCard({ clanPlan: 'creator_free', meter: meterOf('Viewer Bingo', 42) });
  assert.equal(small.planName, 'Free');
  assert.equal(small.playersCap, 50);
  assert.equal(small.over, false);
  assert.equal(small.next?.id, 'creator_bronze');
  const big = CP.creatorPlanCard({ clanPlan: 'creator_free', meter: meterOf('Huge', 200) });
  assert.equal(big.over, true);
  assert.equal(big.next?.id, 'creator_silver', 'jumps to the tier that holds the event');
  assert.equal(CP.creatorPlanCard({ clanPlan: 'creator_gold', meter: null }).next, null);
  assert.equal(CP.creatorPlanCard({ clanPlan: 'creator_partner', meter: null }).planName, 'Partner');
  // A past event that ran big is not "over" now, but still steers the suggestion.
  const past = CP.creatorPlanCard({ clanPlan: 'creator_free', meter: { ...meterOf('Old', 200), events: [], current: false } });
  assert.equal(past.over, false);
  assert.equal(past.next?.id, 'creator_silver');
});

// ── Players at once across overlapping events ────────────────────────────────────────────────────

const NOW = Date.UTC(2026, 9, 1); // Oct 1, 2026 — before every window below
const at = (d: number) => new Date(Date.UTC(2026, 9, d)).toISOString();
const ev = (id: number, name: string, from: number | null, to: number | null, seats: number, forceEndedAt: string | null = null): CP.HostEventSeats => ({
  id,
  name,
  startDate: from == null ? null : at(from),
  endDate: to == null ? null : at(to),
  forceEndedAt,
  seats,
});

test('enforced: overlapping events share the cap; apart they get it each', () => {
  enforced(() => {
    // Gold = 1,000. Oct 7–10 and Oct 8–11 → 1,000 combined.
    const a = ev(1, 'Day Bingo', 7, 10, 600);
    const b = ev(2, 'Night Bingo', 8, 11, 399);
    const join = (target: CP.HostEventSeats, others: CP.HostEventSeats[], adding: number) =>
      CP.eventRoomVerdict({ clanPlan: 'creator_gold', players: target.seats, adding, eventId: target.id, dates: target, others, now: NOW });
    assert.equal(join(b, [a, b], 1).ok, true, '999 → 1,000');
    const full = join(b, [a, b], 2);
    assert.equal(full.ok, false);
    if (!full.ok) {
      assert.equal(full.total, 1001);
      assert.match(full.error, /^This event is full\. The host’s Gold plan seats 1,000 players at once, counted across all their events running at the same time\. Ask the host — a Partner plan would make room\.$/);
    }
    // …and the other event is just as full: the cap is shared.
    assert.equal(join(a, [a, b], 2).ok, false);
    // Oct 1–3 and Oct 7–10 → 1,000 each.
    const early = ev(3, 'Early', 1, 3, 999);
    assert.equal(join(a, [early, a], 400).ok, true);
    // A single event on its own → the whole cap.
    assert.equal(join(a, [a], 400).ok, true);
    assert.equal(join(a, [a], 401).ok, false);
    // The tier that fits is named: Free 50, a 30 + 20 overlap wanting one more → Bronze.
    const f1 = ev(4, 'F1', 7, 10, 30);
    const f2 = ev(5, 'F2', 8, 11, 20);
    const v = CP.eventRoomVerdict({ clanPlan: 'creator_free', players: 20, adding: 1, eventId: 5, dates: f2, others: [f1, f2], now: NOW });
    assert.match(v.ok ? '' : v.error, /Free plan seats 50 players at once.*Bronze \(150 at once\) would make room/);
  });
  // Generous phase: never refuses, however full.
  assert.equal(CP.eventRoomVerdict({ clanPlan: 'creator_free', players: 500, adding: 1, eventId: 1, dates: ev(1, 'A', 7, 10, 500), others: [ev(2, 'B', 7, 10, 500)], now: NOW }).ok, true);
});

test('seats, not people: one person on two overlapping boards counts twice', () => {
  enforced(() => {
    // Partner aside, the smallest cap is 50; 49 + 1 (the same person, already on the other board) = 50.
    const a = ev(1, 'A', 7, 10, 25);
    const b = ev(2, 'B', 8, 11, 24);
    // The person on A signs up to B too: B goes 24 → 25, peak 50. Fine; a second such person is not.
    assert.equal(CP.eventRoomVerdict({ clanPlan: 'creator_free', players: 24, adding: 1, eventId: 2, dates: b, others: [a, b], now: NOW }).ok, true);
    const b25 = { ...b, seats: 25 };
    assert.equal(CP.eventRoomVerdict({ clanPlan: 'creator_free', players: 25, adding: 1, eventId: 2, dates: b25, others: [a, b25], now: NOW }).ok, false);
    assert.equal(CP.seatMeter([ev(1, 'A', 7, 10, 1), ev(2, 'B', 8, 11, 1)], NOW)?.peak, 2, 'one person in both = 2');
  });
});

test('datesRoomVerdict: moving onto another event says which and the total; shortening is fine', () => {
  enforced(() => {
    const other = ev(1, 'Summer Bingo', 10, 15, 700);
    const me = { id: 2, seats: 400 };
    const before = ev(2, 'Mine', 1, 5, 400);
    const no = CP.datesRoomVerdict({ clanPlan: 'creator_gold', event: me, before, after: ev(2, 'Mine', 1, 12, 400), others: [other, before], now: NOW });
    assert.equal(no.ok, false);
    assert.equal(
      no.ok ? '' : no.error,
      'Those dates would overlap Summer Bingo (700): 1,100 players at once with this event’s 400. Your Gold plan allows 1,000 players at once across events running at the same time. Pick dates that don’t overlap, or get in touch about a Partner plan.',
    );
    assert.equal(CP.datesRoomVerdict({ clanPlan: 'creator_gold', event: me, before, after: ev(2, 'Mine', 2, 4, 400), others: [other], now: NOW }).ok, true, 'shorter');
    assert.equal(CP.datesRoomVerdict({ clanPlan: 'creator_gold', event: me, before, after: ev(2, 'Mine', 20, 25, 400), others: [other], now: NOW }).ok, true, 'apart');
    // Free, upgrade named.
    const f = CP.datesRoomVerdict({ clanPlan: 'creator_free', event: { id: 2, seats: 30 }, before: null, after: ev(2, 'M', 11, 12, 30), others: [ev(1, 'Other', 10, 15, 30)], now: NOW });
    assert.match(f.ok ? '' : f.error, /upgrade to Bronze for 150\.$/);
    // Partner has no cap.
    assert.equal(CP.datesRoomVerdict({ clanPlan: 'creator_partner', event: me, before, after: ev(2, 'Mine', 1, 12, 400), others: [other], now: NOW }).ok, true);
  });
  // Generous phase: dates always move.
  assert.equal(CP.datesRoomVerdict({ clanPlan: 'creator_free', event: { id: 2, seats: 400 }, before: null, after: ev(2, 'M', 10, 12, 400), others: [ev(1, 'O', 10, 15, 700)], now: NOW }).ok, true);
});

test('seatMeter: the peak at once, the events behind it, drafts on their own, past as a fallback', () => {
  const rows = [ev(1, 'A', 7, 10, 30), ev(2, 'B', 8, 11, 25), ev(3, 'C', 20, 22, 40), ev(4, 'Draft', null, null, 10)];
  const m = CP.seatMeter(rows, NOW)!;
  assert.equal(m.peak, 55);
  assert.deepEqual(m.peakEvents.map((e) => e.name), ['A', 'B']);
  assert.equal(m.current, true);
  assert.deepEqual(m.events.map((e) => [e.name, e.when]), [['C', 'upcoming'], ['A', 'upcoming'], ['B', 'upcoming'], ['Draft', 'draft']]);
  // A draft bigger than any overlap is the peak on its own.
  assert.equal(CP.seatMeter([ev(1, 'A', 7, 10, 30), ev(4, 'Big draft', null, null, 90)], NOW)!.peakEvents[0].name, 'Big draft');
  // Everything over: the biggest past event, not "current".
  const later = Date.UTC(2026, 10, 30);
  const past = CP.seatMeter(rows.slice(0, 3), later)!;
  assert.equal(past.current, false);
  assert.equal(past.peak, 40);
  // A force-ended event frees its seats from then on.
  const ended = CP.seatMeter([ev(1, 'A', 7, 30, 30, at(8)), ev(2, 'B', 7, 30, 25)], Date.UTC(2026, 9, 9))!;
  assert.equal(ended.peak, 25);
  assert.equal(CP.seatMeter([], NOW), null);
});

test('eventIsFull: one more would be refused, across overlaps', () => {
  enforced(() => {
    const rows = [ev(1, 'A', 7, 10, 30), ev(2, 'B', 8, 11, 20), ev(3, 'C', 20, 22, 10)];
    assert.equal(CP.eventIsFull('creator_free', rows, 1, NOW), true);
    assert.equal(CP.eventIsFull('creator_free', rows, 2, NOW), true);
    assert.equal(CP.eventIsFull('creator_free', rows, 3, NOW), false);
  });
  assert.equal(CP.eventIsFull('creator_free', [ev(1, 'A', 7, 10, 500)], 1, NOW), false, 'never full while generous');
});
