import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEventLatest, latestTagOf, type LatestMoment } from '../src/lib/eventLatest.ts';

const moment = (over: Partial<LatestMoment>): LatestMoment => ({
  id: 1, rsn: 'Ann', kind: 'unique', itemName: 'Dragon pickaxe', quantity: 1, source: 'Chaos Elemental', valueGp: null, kc: 143, rarityDenominator: 256, occurredAt: '2026-11-17T10:00:00.000Z', ...over,
});

test('finishes and moments are one list, newest first, cut to five', () => {
  const lines = buildEventLatest({
    race: true,
    finishes: [
      { id: 1, who: 'Bob', label: 'Any Raids Unique', where: 'step 3 of 8 · road A', at: '2026-11-17 11:00:00' },
      { id: 2, who: 'Cat', label: "Belle's folly", where: 'step 4 of 8', at: '2026-11-17T08:00:00.000Z' },
    ],
    moments: [
      moment({}),
      moment({ id: 2, rsn: 'Dee', kind: 'death', itemName: null, source: 'Vorkath', kc: null, rarityDenominator: null, occurredAt: '2026-11-17T09:00:00.000Z', run: { n: 2 } }),
      ...[3, 4, 5, 6].map((id) => moment({ id, occurredAt: `2026-11-16T0${id}:00:00.000Z` })),
    ],
  });
  assert.equal(lines.length, 5);
  assert.deepEqual(lines.slice(0, 4).map((l) => `${l.tag}:${l.who} ${l.text}`), [
    'step:Bob finished Any Raids Unique',
    'drop:Ann got Dragon pickaxe from Chaos Elemental',
    'death:Dee died to Vorkath ×2',
    "step:Cat finished Belle's folly",
  ]);
  assert.equal(lines[0].detail, 'step 3 of 8 · road A');
  assert.equal(lines[1].detail, '1 in 256 · 143 KC');
});

test('a board that is not a race tags a finish as a tile', () => {
  const [line] = buildEventLatest({ race: false, finishes: [{ id: 1, who: 'Red', label: 'Zulrah', where: null, at: null }], moments: [] });
  assert.equal(line.tag, 'tile');
});

test('moment kinds map to their tag', () => {
  assert.deepEqual(['pet', 'unique', 'loot', 'death', 'clog', 'level', 'ca'].map(latestTagOf), ['pet', 'drop', 'drop', 'death', 'log', 'milestone', 'milestone']);
});
