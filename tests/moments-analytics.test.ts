// The end-of-event summary over a board's highlight feed (lib/momentsAnalytics): the counters a
// clan argues about once the week is over.
//
// Run: npx tsx --test tests/moments-analytics.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { summariseMoments } from '../src/lib/momentsAnalytics.ts';
import type { MomentRow } from '../src/lib/momentsStore.ts';

let id = 0;
function row(over: Partial<MomentRow> & { rsn: string; kind: string }): MomentRow {
  return {
    id: ++id,
    itemId: null,
    itemName: null,
    quantity: 1,
    valueGp: null,
    source: null,
    kc: null,
    rarityDenominator: null,
    tier: null,
    occurredAt: '2026-08-18T12:00:00.000Z',
    ...over,
  } as MomentRow;
}

const FEED: MomentRow[] = [
  row({ rsn: 'Cyrisus', kind: 'death', source: 'Verzik Vitur' }),
  row({ rsn: 'Cyrisus', kind: 'death', source: 'Verzik Vitur' }),
  row({ rsn: 'Cyrisus', kind: 'death', source: 'Great Olm' }),
  row({ rsn: 'Bob', kind: 'death', source: 'Verzik Vitur' }),
  row({ rsn: 'Bob', kind: 'unique', itemName: 'Tanzanite fang', source: 'Zulrah', valueGp: 3_100_000, rarityDenominator: 1024 }),
  row({ rsn: 'Bob', kind: 'loot', itemName: 'Coins', source: 'Vorkath', valueGp: 12_000_000 }),
  row({ rsn: 'Zezima', kind: 'pet', itemName: 'Pet snakeling', source: 'Zulrah' }),
  row({ rsn: 'Zezima', kind: 'unique', itemName: 'Twisted bow', source: 'Chambers of Xeric', valueGp: 1_000_000_000, rarityDenominator: 34_500 }),
  row({ rsn: 'Zezima', kind: 'ca', itemName: 'Perfect Zulrah', tier: 'Master', source: 'Zulrah' }),
  row({ rsn: 'Bob', kind: 'ca', itemName: 'No Pressure', tier: 'Grandmaster', source: 'Alchemical Hydra' }),
];

test('counts every kind, and the people in it', () => {
  const s = summariseMoments(FEED);
  assert.deepEqual(s.counts, { pet: 1, unique: 2, death: 4, loot: 1, ca: 2, total: 10 });
  assert.equal(s.members.length, 3);
  // Sorted by how much of the feed each person is.
  assert.equal(s.members[0].rsn, 'Bob');
  assert.equal(s.members[0].total, 4);
});

test('the death counter, per member and by what killed them', () => {
  const s = summariseMoments(FEED);
  assert.deepEqual(s.deathBoard.map((m) => [m.rsn, m.deaths]), [['Cyrisus', 3], ['Bob', 1]]);
  // Nobody who survived the week is listed as having died zero times.
  assert.ok(!s.deathBoard.some((m) => m.rsn === 'Zezima'));
  assert.deepEqual(s.killers, [{ name: 'Verzik Vitur', count: 3 }, { name: 'Great Olm', count: 1 }]);
});

test('the standouts: most valuable, rarest, hardest', () => {
  const s = summariseMoments(FEED);
  assert.equal(s.biggestHaul?.itemName, 'Twisted bow');
  assert.equal(s.biggestHaul?.rsn, 'Zezima');
  // Rarest is the BIGGEST 1-in-N, not the biggest price — a bow is both here, a fang is neither.
  assert.equal(s.rarestDrop?.rarityDenominator, 34_500);
  assert.equal(s.hardestTask?.tier, 'Grandmaster');
  assert.equal(s.hardestTask?.rsn, 'Bob');
  // Value totals only count lines that were actually priced.
  assert.equal(s.gpSeen, 1_015_100_000);
  assert.equal(s.members.find((m) => m.rsn === 'Bob')?.lootGp, 15_100_000);
});

test('a feed with nothing in it summarises to nothing, not to zeroes that look like facts', () => {
  const s = summariseMoments([]);
  assert.equal(s.counts.total, 0);
  assert.deepEqual(s.members, []);
  assert.deepEqual(s.deathBoard, []);
  assert.deepEqual(s.killers, []);
  assert.equal(s.biggestHaul, null);
  assert.equal(s.rarestDrop, null);
  assert.equal(s.hardestTask, null);
  assert.equal(s.gpSeen, 0);
});

test('a death with no killer still counts as a death', () => {
  const s = summariseMoments([row({ rsn: 'Bob', kind: 'death' })]);
  assert.equal(s.counts.death, 1);
  assert.deepEqual(s.deathBoard.map((m) => m.deaths), [1]);
  // ...it just can't say what did it.
  assert.deepEqual(s.killers, []);
});

test('the lists are capped, and ties never wobble', () => {
  const many: MomentRow[] = [];
  for (let i = 0; i < 12; i++) many.push(row({ rsn: `Player${i}`, kind: 'death', source: `Boss${i}` }));
  const s = summariseMoments(many, 5);
  assert.equal(s.deathBoard.length, 5);
  assert.equal(s.killers.length, 5);
  // Everyone tied on one death, so the order is alphabetical rather than insertion order.
  assert.deepEqual(s.killers.map((k) => k.name), ['Boss0', 'Boss1', 'Boss10', 'Boss11', 'Boss2']);
});
