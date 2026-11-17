// lib/eventLuckRules: event-only kills and drops, fed to the luck engine. Pure.
//
// Run: npx tsx --test tests/event-luck.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildEventLuckBoards, countEventDrops, eventBossGains, shapeEventLuck } from '../src/lib/eventLuckRules';
import { wouldHaveOnePercent } from '../src/lib/clogLuck';
import { buildLuckBoards } from '../src/lib/clogProfile';
import type { LuckCandidate } from '../src/lib/clogLuckBoard';

const snap = (vork: number, zul?: number) =>
  JSON.stringify({ skills: {}, bosses: { vorkath: { score: vork, rank: 1 }, ...(zul != null ? { zulrah: { score: zul, rank: 1 } } : {}) } });

const VISAGE: LuckCandidate = {
  itemId: 1, itemName: 'Draconic visage', page: 'Vorkath',
  sources: [{ source: 'Vorkath', bossKey: 'vorkath', denominator: 5000, rolls: 1, bundle: 1 }],
};
const VORKI: LuckCandidate = {
  itemId: 2, itemName: 'Vorki', page: 'Vorkath',
  sources: [{ source: 'Vorkath', bossKey: 'vorkath', denominator: 3000, rolls: 1, bundle: 1 }],
};
const PETS = new Set([2]);

test('gains are since the start, from the live push or a frozen snapshot', () => {
  const p = { accountId: 1, name: 'A', statsSnapshot: snap(100), cachedStats: snap(150), pluginStats: JSON.stringify({ vorkath: 180 }), frozenStats: null };
  assert.deepEqual(eventBossGains(p, ['vorkath']), { vorkath: 80 });
  assert.deepEqual(eventBossGains({ ...p, frozenStats: snap(120) }, ['vorkath']), { vorkath: 20 });
  // No starting snapshot is no gains — never a lifetime's worth.
  assert.deepEqual(eventBossGains({ ...p, statsSnapshot: null }, ['vorkath']), {});
});

test('drops count one per row; a pet line and its first-ever unlock are one pet', () => {
  const drops = countEventDrops(
    [
      { accountId: 1, kind: 'unique', itemId: 1, source: 'Vorkath' },
      { accountId: 1, kind: 'unique', itemId: 1, source: 'Vorkath' },
      { accountId: 1, kind: 'pet', itemId: null, source: 'Vorkath' },
      { accountId: 1, kind: 'unique', itemId: 2, source: 'Vorkath' }, // the same pet's log unlock
      { accountId: 2, kind: 'pet', itemId: null, source: 'The Vorkath' },
      { accountId: 2, kind: 'loot', itemId: 999, source: 'Vorkath' }, // not a luck item
    ],
    [VISAGE, VORKI],
    PETS,
  );
  assert.equal(drops.get(1)?.get(1), 2);
  assert.equal(drops.get(1)?.get(2), 1);
  assert.equal(drops.get(2)?.get(2), 1);
  assert.equal(drops.get(2)?.has(999), false);
});

test('only judged players reach the boards, judged on event kills alone', () => {
  const people = [
    { accountId: 1, name: 'Spoon', gains: { vorkath: 3_000 } },
    { accountId: 2, name: 'NoPlugin', gains: { vorkath: 20_000 } },
  ];
  const drops = new Map([[1, new Map([[1, 3]])]]);
  const shaped = shapeEventLuck([VISAGE], people, drops, new Set([1]));
  assert.deepEqual(shaped[0].members.map((m) => m.rsn), ['Spoon']);
  const { spooned, dry } = buildEventLuckBoards(shaped, 10);
  assert.equal(spooned[0]?.rsn, 'Spoon'); // 3 visages in 3,000 kills at 1 in 5,000 (0.6 expected)
  assert.equal(dry.length, 0); // NoPlugin would be "0 of 4" — we simply could not see their drops
});

// One item at 1 in 1,000, so `kills / 1000` is the expectation.
const FANG: LuckCandidate = {
  itemId: 7, itemName: 'Tanzanite fang', page: 'Zulrah',
  sources: [{ source: 'Zulrah', bossKey: 'zulrah', denominator: 1000, rolls: 1, bundle: 1 }],
};
const shape = (people: [id: number, name: string, kills: number, got: number][], item = FANG) =>
  shapeEventLuck(
    [item],
    people.map(([accountId, name, kills]) => ({ accountId, name, gains: { zulrah: kills } })),
    new Map(people.filter((p) => p[3] > 0).map((p) => [p[0], new Map([[item.itemId, p[3]]])])),
    new Set(people.map((p) => p[0])),
  );

test('spooned on an event has no floor: one drop where 0.05 was expected counts', () => {
  const shaped = shape([[1, 'Lucky', 50, 1]]);
  assert.equal(shaped[0].members[0].expected, 0.05);
  const event = buildEventLuckBoards(shaped, 10);
  assert.deepEqual(event.spooned.map((e) => e.rsn), ['Lucky']);
  assert.ok(event.spooned[0].assessment.tail < 0.05); // 1 - e^-0.05 = 4.9%
  // The lifetime boards are unchanged: the same result is below their half-a-drop floor.
  const lifetime = buildLuckBoards(shaped, 10);
  assert.equal(lifetime.spooned.length, 0);
  assert.equal(lifetime.dry.length, 0);
});

test('the 5% bar still holds without the floor: one drop where 0.07 was expected is 6.8%, not spooned', () => {
  const shaped = shape([[1, 'Close', 70, 1]]);
  assert.equal(shaped[0].members[0].expected, 0.07);
  assert.equal(buildEventLuckBoards(shaped, 10).spooned.length, 0);
  // Two drops on the same kills is 0.2%: spooned here, and still left off a lifetime board.
  const twice = shape([[1, 'Twice', 70, 2]]);
  assert.deepEqual(buildEventLuckBoards(twice, 10).spooned.map((e) => e.rsn), ['Twice']);
  assert.equal(buildLuckBoards(twice, 10).spooned.length, 0);
});

test('one drop where two were expected is not spooned, and kills with no drop at 0.07 is nothing', () => {
  const event = buildEventLuckBoards(shape([[1, 'Fair', 2_000, 1], [2, 'Fresh', 70, 0]]), 10);
  assert.equal(event.spooned.length, 0);
  assert.equal(event.dry.length, 0);
  assert.equal(event.goingDry.length, 0);
});

test('dry keeps the 5% bar: none where 3 were expected is dry, none where 2.9 were is not', () => {
  // e^-3 is 4.98%, e^-2.9 is 5.5%.
  const event = buildEventLuckBoards(shape([[1, 'Dry', 3_000, 0], [2, 'Nearly', 2_900, 0]]), 10);
  assert.deepEqual(event.dry.map((e) => e.rsn), ['Dry']);
  assert.deepEqual(event.goingDry, [], 'going dry is only shown when nobody is dry');
});

test('going dry: only with nobody dry, furthest along first, three at most, one drop expected at least', () => {
  const event = buildEventLuckBoards(
    [
      ...shape([[1, 'A', 2_500, 0], [2, 'B', 1_000, 0], [3, 'C', 990, 0], [4, 'Got one', 2_800, 1]]),
      ...shape([[5, 'D', 2_000, 0], [6, 'E', 1_500, 0], [1, 'A', 2_900, 0]], { ...FANG, itemId: 8, itemName: 'Magic fang' }),
    ],
    10,
  );
  assert.equal(event.dry.length, 0);
  // A appears once (their furthest item); C is under one expected drop; "Got one" has a drop.
  assert.deepEqual(event.goingDry.map((e) => `${e.rsn}:${e.itemName}`), ['A:Magic fang', 'D:Magic fang', 'B:Tanzanite fang']);
  assert.equal(wouldHaveOnePercent(event.goingDry[2].assessment.expectedLow), 63);
  assert.equal(wouldHaveOnePercent(event.goingDry[0].assessment.expectedLow), 94);
});
