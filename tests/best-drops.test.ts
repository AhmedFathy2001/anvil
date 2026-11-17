// A competition's best drops (lib/bestDrops): which of its moments are worth keeping in front of
// people for the whole competition, and in what order.
//
// Run: TESTS_OK=1 npx tsx --test tests/best-drops.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { type DropMoment, bestDropFacts, bestDropLine, rankBestDrops } from '@/lib/bestDrops';

let id = 1;
const m = (over: Partial<DropMoment>): DropMoment => ({
  id: id++,
  rsn: 'Lcl Member',
  kind: 'unique',
  itemId: 12922,
  itemName: 'Tanzanite fang',
  valueGp: 4_000_000,
  kc: null,
  rarityDenominator: 1024,
  occurredAt: '2026-11-10T12:00:00.000Z',
  ...over,
});

test('pets come first, whatever the rest is worth', () => {
  const ranked = rankBestDrops([
    m({ rsn: 'Rich', itemId: 20997, itemName: 'Twisted bow', valueGp: 1_600_000_000, rarityDenominator: 34_500 }),
    m({ rsn: 'Lucky', kind: 'pet', itemId: 12921, itemName: 'Pet snakeling', valueGp: null, rarityDenominator: 4000, kc: 1204 }),
  ]);
  assert.deepEqual(ranked.map((d) => d.rsn), ['Lucky', 'Rich']);
  assert.equal(ranked[0].pet, true);
});

test('then the rarest, a known rate ahead of an unknown one, then the dearest', () => {
  const ranked = rankBestDrops([
    m({ rsn: 'Priced', itemId: 1, itemName: 'A haul', kind: 'loot', rarityDenominator: null, valueGp: 90_000_000 }),
    m({ rsn: 'Common', itemId: 2, itemName: 'Visage', rarityDenominator: 512 }),
    m({ rsn: 'Rare', itemId: 3, itemName: 'Mutagen', rarityDenominator: 13_107 }),
    m({ rsn: 'Cheap', itemId: 4, itemName: 'A smaller haul', kind: 'loot', rarityDenominator: null, valueGp: 2_000_000 }),
  ]);
  assert.deepEqual(ranked.map((d) => d.rsn), ['Rare', 'Common', 'Priced', 'Cheap']);
});

test('deaths and everything that is not a drop are left out', () => {
  const ranked = rankBestDrops([
    m({ kind: 'death', itemId: null, itemName: null }),
    m({ kind: 'level', itemId: null, itemName: 'Cooking' }),
    m({ kind: 'ca', itemId: null, itemName: 'Vault of Death' }),
    m({ kind: 'unique', itemId: null, itemName: null }),
    m({}),
  ]);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].itemName, 'Tanzanite fang');
});

test('one line per person and item, with a count and the time of the first', () => {
  const ranked = rankBestDrops([
    m({ occurredAt: '2026-11-12T10:00:00.000Z', kc: 900 }),
    m({ occurredAt: '2026-11-10T09:00:00.000Z', kc: 512 }),
    m({ occurredAt: '2026-11-11T09:00:00.000Z' }),
    m({ rsn: 'Someone Else' }),
  ]);
  assert.equal(ranked.length, 2);
  const mine = ranked.find((d) => d.rsn === 'Lcl Member')!;
  assert.equal(mine.count, 3);
  assert.equal(mine.occurredAt, '2026-11-10T09:00:00.000Z');
  assert.equal(mine.kc, 512);
});

test('the same item by name alone still groups, and a pet nobody named is still a pet', () => {
  const ranked = rankBestDrops([
    m({ itemId: null, itemName: 'Jar of swamp' }),
    m({ itemId: null, itemName: 'jar of  swamp' }),
    m({ rsn: 'Mystery', kind: 'pet', itemId: null, itemName: null, rarityDenominator: null, valueGp: null }),
  ]);
  assert.deepEqual(ranked.map((d) => [d.rsn, d.itemName, d.count]), [['Mystery', 'A pet', 1], ['Lcl Member', 'Jar of swamp', 2]]);
});

test('an exact tie falls to whoever got it first, then the name: the same order every load', () => {
  const ranked = rankBestDrops([
    m({ rsn: 'Zed', occurredAt: '2026-11-10T12:00:00.000Z' }),
    m({ rsn: 'Amy', occurredAt: '2026-11-10T12:00:00.000Z' }),
    m({ rsn: 'Early', occurredAt: '2026-11-09T12:00:00.000Z' }),
  ]);
  assert.deepEqual(ranked.map((d) => d.rsn), ['Early', 'Amy', 'Zed']);
});

test('the facts under a line: the rate when known, the kill count when the report had it', () => {
  assert.deepEqual(bestDropFacts({ rarity: 5000, kc: 1204 }), ['1 in 5,000', 'at 1,204 kc']);
  assert.deepEqual(bestDropFacts({ rarity: null, kc: null }), []);
  const [line] = rankBestDrops([m({ kc: 1204 }), m({ occurredAt: '2026-11-11T12:00:00.000Z' })]);
  assert.equal(bestDropLine(line), '**Lcl Member** · Tanzanite fang ×2 (1 in 1,024, at 1,204 kc)');
  assert.equal(bestDropLine(rankBestDrops([m({ rarityDenominator: null })])[0]), '**Lcl Member** · Tanzanite fang');
});
