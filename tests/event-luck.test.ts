// lib/eventLuckRules: event-only kills and drops, fed to the luck engine. Pure.
//
// Run: npx tsx --test tests/event-luck.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { countEventDrops, eventBossGains, shapeEventLuck } from '../src/lib/eventLuckRules';
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
  const { spooned, dry } = buildLuckBoards(shaped, 10);
  assert.equal(spooned[0]?.rsn, 'Spoon'); // 3 visages in 3,000 kills at 1 in 5,000 (0.6 expected)
  assert.equal(dry.length, 0); // NoPlugin would be "0 of 4" — we simply could not see their drops
});
