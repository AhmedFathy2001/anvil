import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCompetitionRecap, huntLuck } from '../src/lib/competitionRecap.ts';
import type { FeedMoment } from '../src/lib/competitionFeed.ts';

const days = ['2026-11-10', '2026-11-11', '2026-11-12'];
const entry = (rsn: string, d: number[], isMe = false) => ({ rsn, days: d, gained: d.reduce((n, v) => n + v, 0), isMe });
const entries = [entry('Ann', [50, 10, 0]), entry('Bob', [40, 40, 5]), entry('Cat', [30, 5, 60]), entry('Me', [5, 30, 0], true), entry('Quiet', [200, 200, 200])];
let id = 0;
const m = (rsn: string, kind: string, over: Partial<FeedMoment> = {}): FeedMoment => ({
  id: ++id, rsn, kind, itemName: null, quantity: 1, source: 'Zulrah', valueGp: null, kc: null, rarityDenominator: null, occurredAt: '2026-11-11T10:00:00.000Z', ...over,
});
const deaths = (rsn: string, n: number, source = 'Zulrah', day = '2026-11-11') => Array.from({ length: n }, () => m(rsn, 'death', { source, occurredAt: `${day}T10:00:00.000Z` }));
const recap = (moments: FeedMoment[], over: Partial<Parameters<typeof buildCompetitionRecap>[0]> = {}) =>
  buildCompetitionRecap({ type: 'boss', days, daily: true, entries, moments, ...over });

test('the lead: Quiet leads throughout, so it never changes hands', () => {
  const r = recap([]);
  assert.equal(r.leadChanges, 0);
  assert.deepEqual(r.leader, { rsn: 'Quiet', sinceDay: 0 });
  assert.deepEqual(r.biggestDay, { rsn: 'Quiet', value: 200, day: 0 });
});

test('the lead changing hands is counted, and the winner dated from their last take', () => {
  const r = recap([], { entries: entries.slice(0, 4) });
  // Ann, then Bob after day 2, then Cat after day 3.
  assert.equal(r.leadChanges, 2);
  assert.deepEqual(r.leader, { rsn: 'Cat', sinceDay: 2 });
});

test('without a trustworthy day-by-day there are no lead lines', () => {
  const r = recap([], { daily: false });
  assert.equal(r.leadChanges, null);
  assert.equal(r.biggestDay, null);
});

test('the three who died most share the blame, with where each died', () => {
  const r = recap([...deaths('Bob', 5, 'Vorkath'), ...deaths('Bob', 2), ...deaths('Ann', 4), ...deaths('Cat', 3), ...deaths('Me', 1)]);
  assert.deepEqual(r.deathBoard?.top.map((t) => `${t.rsn} ${t.count}`), ['Bob 7', 'Ann 4', 'Cat 3']);
  assert.deepEqual(r.deathBoard?.top[0].split, [{ source: 'Vorkath', count: 5 }, { source: 'Zulrah', count: 2 }]);
  assert.equal(r.deathBoard?.me?.count, 1);
  assert.deepEqual(r.deathBoard?.bySource, [
    { source: 'Zulrah', deaths: 10, most: { rsn: 'Ann', count: 4 } },
    { source: 'Vorkath', deaths: 5, most: { rsn: 'Bob', count: 5 } },
  ]);
  assert.deepEqual(r.deathBoard?.worstDay, { rsn: 'Bob', count: 7, source: null, day: '2026-11-11' });
});

test('the viewer is not repeated under the three when they are one of them', () => {
  assert.equal(recap(deaths('Me', 2)).deathBoard?.me, null);
});

test('ratios only count players the plugin was seen for', () => {
  // Quiet has 600 kills and no moments: not deathless, just unseen.
  const r = recap([...deaths('Bob', 5), ...deaths('Ann', 1), ...deaths('Cat', 1)]);
  assert.equal(r.killsPerDeath, Math.round((85 + 60 + 95) / 7));
  assert.deepEqual(r.deathBoard?.cleanest, { rsn: 'Cat', kills: 95, deaths: 1 });
});

test('luck: rarest, most drops per kill, and the longest week without one', () => {
  const r = recap([
    m('Ann', 'unique', { itemName: 'Tanzanite fang', rarityDenominator: 1024, kc: 311 }),
    m('Cat', 'pet', { itemName: 'Pet snakeling', rarityDenominator: 4000 }),
    m('Cat', 'unique', { itemName: 'Magic fang', rarityDenominator: 1024 }),
    ...deaths('Bob', 1),
  ]);
  assert.equal(r.drops, 3);
  assert.equal(r.pets, 1);
  assert.equal(r.luck?.rarest?.itemName, 'Pet snakeling');
  assert.deepEqual(r.luck?.luckiest, { rsn: 'Cat', drops: 2, kills: 95 });
  assert.deepEqual(r.luck?.driest, { rsn: 'Bob', kills: 85 });
});

test('an efficiency contest has no deaths or drops', () => {
  const r = recap([...deaths('Bob', 3), m('Ann', 'pet')], { type: 'efficiency' });
  assert.equal(r.deathBoard, null);
  assert.equal(r.luck, null);
  assert.equal(r.deaths, 0);
});

test('the viewer gets their own week', () => {
  const r = recap([...deaths('Me', 5), m('Me', 'unique', { itemName: 'Magic fang' })]);
  assert.deepEqual(r.mine, { bestDay: { value: 30, day: 1 }, drops: 1, deaths: 5, killsPerDeath: 7 });
});

test('hunt luck needs two hunters with drops; driest is the most kills with none', () => {
  const rows = [
    { rsn: 'Ann', count: 2, statGain: 400 },
    { rsn: 'Bob', count: 1, statGain: 100 },
    { rsn: 'Cat', count: 0, statGain: 900 },
    { rsn: 'Dee', count: 0, statGain: null },
  ];
  assert.deepEqual(huntLuck(rows), { luckiest: { rsn: 'Bob', drops: 1, kills: 100 }, driest: { rsn: 'Cat', kills: 900 } });
  assert.equal(huntLuck(rows.slice(0, 1)).luckiest, null);
});
