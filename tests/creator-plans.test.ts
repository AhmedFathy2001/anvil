// Creator-space plans (lib/creatorPlans): the per-event meter, the perks, and that every gate is a
// no-op until FREEMIUM_ENFORCED flips.
//
// Run: npm run test:creator-plans

import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as CP from '../src/lib/creatorPlans.ts';
import { PLANS, creatorPlanName } from '../src/lib/plans.ts';
import { validateGatesFor, type GateOptions } from '../src/lib/entryGates.ts';

function enforced<T>(fn: () => T): T {
  process.env.FREEMIUM_ENFORCED = 'true';
  try {
    return fn();
  } finally {
    delete process.env.FREEMIUM_ENFORCED;
  }
}

test('the approved table: players per event and the Partner name', () => {
  assert.deepEqual(
    [PLANS.free, PLANS.bronze, PLANS.silver, PLANS.gold, PLANS.custom].map((p) => p.playersPerEvent),
    [50, 150, 300, 1000, null],
  );
  assert.equal(creatorPlanName(PLANS.custom), 'Partner');
  assert.equal(creatorPlanName(PLANS.silver), 'Silver');
  assert.equal(CP.playersPerEventCap('nonsense'), 50, 'unknown plan reads as Free');
  assert.equal(CP.liveEventLimit(PLANS.free), 1);
  assert.equal(CP.liveEventLimit(PLANS.bronze), 1);
  assert.equal(CP.liveEventLimit(PLANS.silver), null);
});

test('planForPlayers / nextCreatorPlan pick the smallest tier that fits', () => {
  assert.equal(CP.planForPlayers(40).id, 'bronze', 'Free is never the upsell');
  assert.equal(CP.planForPlayers(151).id, 'silver');
  assert.equal(CP.planForPlayers(1000).id, 'gold');
  assert.equal(CP.planForPlayers(1001).id, 'custom');
  assert.equal(CP.nextCreatorPlan('free')?.id, 'bronze');
  assert.equal(CP.nextCreatorPlan('silver')?.id, 'gold');
  assert.equal(CP.nextCreatorPlan('gold'), null);
  assert.equal(CP.upgradeForPlayersLine(50), 'Upgrade to Bronze for 150 players.');
  assert.equal(CP.upgradeForPlayersLine(1000), 'Get in touch about a Partner plan for bigger events.');
});

test('generous phase: a full event, a second event, stream gates, !join and the overlay toggle all pass', () => {
  delete process.env.FREEMIUM_ENFORCED;
  assert.deepEqual(CP.eventRoomVerdict({ clanPlan: 'free', players: 500, adding: 1 }), { ok: true });
  assert.deepEqual(CP.newEventVerdict({ clanPlan: 'free', liveEvents: 4 }), { ok: true });
  assert.equal(CP.streamGateLock('free'), null);
  assert.equal(CP.chatJoinAllowed('free'), true);
  assert.equal(CP.overlayShowsMark({ clanPlan: 'free', hideRequested: true }), false, 'anyone may hide it for now');
  assert.equal(CP.overlayShowsMark({ clanPlan: 'free', hideRequested: false }), true, 'shown by default');
  // The meter still reads honestly, for the dashboard nudge.
  assert.equal(CP.overPlayerCap('free', 51), true);
  assert.equal(CP.creatorPlanCard({ clanPlan: 'free', biggest: { name: 'B', players: 60 } }).enforced, false);
});

test('enforced: players per event', () => {
  enforced(() => {
    assert.deepEqual(CP.eventRoomVerdict({ clanPlan: 'free', players: 49, adding: 1 }), { ok: true });
    const full = CP.eventRoomVerdict({ clanPlan: 'free', players: 50, adding: 1 });
    assert.equal(full.ok, false);
    assert.match(full.ok ? '' : full.error, /This event is full/);
    // Adding two characters with room for one is refused as a whole.
    assert.equal(CP.eventRoomVerdict({ clanPlan: 'bronze', players: 149, adding: 2 }).ok, false);
    // An edit adds nobody and is never refused, even over the cap after a downgrade.
    assert.deepEqual(CP.eventRoomVerdict({ clanPlan: 'free', players: 300, adding: 0 }), { ok: true });
    assert.deepEqual(CP.eventRoomVerdict({ clanPlan: 'gold', players: 999, adding: 1 }), { ok: true });
    assert.deepEqual(CP.eventRoomVerdict({ clanPlan: 'custom', players: 100_000, adding: 1 }), { ok: true });
  });
});

test('enforced: one live event on Free and Bronze, several from Silver', () => {
  enforced(() => {
    assert.deepEqual(CP.newEventVerdict({ clanPlan: 'free', liveEvents: 0 }), { ok: true });
    const second = CP.newEventVerdict({ clanPlan: 'bronze', liveEvents: 1 });
    assert.equal(second.ok, false);
    assert.match(second.ok ? '' : second.error, /upgrade to Silver/);
    assert.deepEqual(CP.newEventVerdict({ clanPlan: 'silver', liveEvents: 5 }), { ok: true });
  });
});

test('enforced: perks by tier', () => {
  enforced(() => {
    assert.equal(CP.streamGateLock('free'), 'Bronze');
    assert.equal(CP.streamGateLock('bronze'), null);
    assert.equal(CP.chatJoinAllowed('bronze'), false);
    assert.equal(CP.chatJoinAllowed('silver'), true);
    assert.equal(CP.overlayShowsMark({ clanPlan: 'silver', hideRequested: true }), true, 'Silver cannot hide it');
    assert.equal(CP.overlayShowsMark({ clanPlan: 'gold', hideRequested: true }), false);
    assert.equal(CP.overlayShowsMark({ clanPlan: 'gold', hideRequested: false }), true);
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
});

test('featured listing follows the plan paid for, creator spaces only', () => {
  delete process.env.FREEMIUM_ENFORCED;
  assert.equal(CP.featuredListing('creator', 'free'), false, 'not every creator while generous');
  assert.equal(CP.featuredListing('creator', 'bronze'), false);
  assert.equal(CP.featuredListing('creator', 'silver'), true);
  assert.equal(CP.featuredListing('clan', 'gold'), false, 'ordinary clans unchanged');
});

test('the plan card: meter, over, and the tier that fits', () => {
  delete process.env.FREEMIUM_ENFORCED;
  const small = CP.creatorPlanCard({ clanPlan: 'free', biggest: { name: 'Viewer Bingo', players: 42 } });
  assert.equal(small.planName, 'Free');
  assert.equal(small.playersCap, 50);
  assert.equal(small.over, false);
  assert.equal(small.next?.id, 'bronze');
  const big = CP.creatorPlanCard({ clanPlan: 'free', biggest: { name: 'Huge', players: 200 } });
  assert.equal(big.over, true);
  assert.equal(big.next?.id, 'silver', 'jumps to the tier that holds the event');
  assert.equal(CP.creatorPlanCard({ clanPlan: 'gold', biggest: null }).next, null);
  assert.equal(CP.creatorPlanCard({ clanPlan: 'custom', biggest: null }).planName, 'Partner');
});
