// The plugin side panel's rows (lib/pluginPanel): tile rows that match the plugin's own in-game read
// (ClogTaskModelTest's cases, ported), "Active now" with the caller in it, and the schedule order.
//
// Run: npx tsx --test tests/plugin-panel.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { activeNow, collectionProgress, panelSchedule, panelTiles, ACTIVE_WINDOW_MS, type PanelTile } from '../src/lib/pluginPanel';

const req = (have: number, group: string | null, groupRequire = 0) => ({ requiredAmount: 1, currentAmount: have, group, groupRequire });
const base = (tileId: number, label = `Tile ${tileId}`) => ({ tileId, label, points: 0, position: 0, description: null });

test('a flat collection needs every item', () => {
  const reqs = [req(1, null), req(0, null)];
  assert.deepEqual(collectionProgress(reqs, null, 1), [1, 2, false]);
  reqs[1].currentAmount = 1;
  assert.deepEqual(collectionProgress(reqs, null, 1), [2, 2, true]);
});

test('any mode reports the closest set and completes on one', () => {
  const reqs = [req(1, 'Dharok'), req(0, 'Dharok'), req(0, 'Guthan'), req(0, 'Guthan')];
  assert.deepEqual(collectionProgress(reqs, 'any', 1), [1, 2, false]);
  reqs[1].currentAmount = 1;
  assert.deepEqual(collectionProgress(reqs, 'any', 1), [2, 2, true]);
});

test('all mode needs every set, each capped at its own requirement', () => {
  const reqs = ['Duke', 'Leviathan', 'Whisperer'].flatMap((b) => [req(0, b, 1), req(0, b, 1)]);
  assert.deepEqual(collectionProgress(reqs, 'all', 1), [0, 3, false]);
  reqs[0].currentAmount = 1;
  reqs[1].currentAmount = 1;
  assert.deepEqual(collectionProgress(reqs, 'all', 1), [1, 3, false]);
  assert.equal(collectionProgress(reqs, 'any', 1)[2], true);
  reqs[2].currentAmount = 1;
  reqs[4].currentAmount = 1;
  assert.deepEqual(collectionProgress(reqs, 'all', 1), [3, 3, true]);
});

test('partial sets, ungrouped items, case-folded names and stale requires', () => {
  const rares = Array.from({ length: 6 }, (_, i) => req(i < 2 ? 1 : 0, 'Rares', 3));
  assert.deepEqual(collectionProgress(rares, 'any', 1), [2, 3, false]);
  rares[2].currentAmount = 1;
  assert.deepEqual(collectionProgress(rares, 'any', 1), [3, 3, true]);

  const mixed = [req(0, null), req(1, 'Duke', 1)];
  assert.deepEqual(collectionProgress(mixed, 'all', 1), [1, 2, false]);
  assert.deepEqual(collectionProgress(mixed, 'any', 1), [1, 2, false]);

  assert.deepEqual(collectionProgress([req(1, 'Ahrim'), req(1, 'Ahrim'), req(0, 'Karil')], null, 1), [2, 2, true]);
  assert.deepEqual(collectionProgress([req(1, 'Duke', 1), req(0, 'duke', 1), req(0, 'Leviathan', 1)], 'all', 1), [1, 2, false]);
  assert.deepEqual(collectionProgress([req(1, 'Set', 4), req(1, 'Set', 4)], 'all', 1), [2, 2, true]);
});

test('several sets count across sets and within one', () => {
  const reqs = ['Ahrim', 'Ahrim', 'Dharok', 'Dharok'].map((g) => req(0, g));
  reqs[0].currentAmount = 1;
  reqs[1].currentAmount = 1;
  assert.deepEqual(collectionProgress(reqs, 'any', 2), [2, 4, false]);
  reqs[2].currentAmount = 1;
  assert.deepEqual(collectionProgress(reqs, 'any', 2), [3, 4, false]);
  reqs[3].currentAmount = 1;
  assert.deepEqual(collectionProgress(reqs, 'any', 2), [4, 4, true]);
  reqs[2].currentAmount = 0;
  reqs[3].currentAmount = 0;
  reqs[0].currentAmount = 2;
  reqs[1].currentAmount = 2;
  assert.deepEqual(collectionProgress(reqs, 'any', 2), [4, 4, true], 'one set twice');
});

test('rows cover every tracked kind', () => {
  const rows = panelTiles({
    trackedDrops: [
      { ...base(1), currentAmount: 3, requiredAmount: 5 },
      { ...base(2), currentAmount: 0, requiredAmount: 1, itemRequirements: [req(1, null), req(0, null)] },
    ],
    trackedStats: [{ ...base(3), currentAmount: 100, goalAmount: 100 }],
    trackedKills: [{ ...base(4), currentAmount: 4, requiredAmount: 10, points: 7 }],
    trackedTimed: [{ ...base(5), completed: true, points: 3 }],
    trackedValues: [{ ...base(6), mode: 'total', thresholdGp: 50_000_000, currentGp: 12_500_000 }],
    trackedLms: [{ ...base(7), currentAmount: 0, requiredAmount: 0 }],
    completedTiles: [{ tileId: 4 }],
  });
  const row = (id: number) => rows.find((r) => r.tileId === id)!;
  assert.equal(rows.length, 7);
  assert.equal(row(1).complete, false);
  assert.deepEqual([row(2).current, row(2).goal], [1, 2]);
  assert.equal(row(3).complete, true);
  assert.equal(row(4).complete, true, "the site's completion wins over the count");
  assert.equal(row(5).complete, true);
  assert.deepEqual([row(6).current, row(6).goal], [12_500_000, 50_000_000]);
  assert.equal(row(7).goal, 1, 'a goal-less placement tile still has a bar');
});

const tile = (tileId: number, complete = false): PanelTile => ({ ...base(tileId), current: 0, goal: 1, points: 0, complete });

test('active now puts the caller in, first, and drops stale or finished tiles', () => {
  const now = 10_000_000;
  const out = activeNow(
    [tile(1), tile(2), tile(3, true), tile(4)],
    [
      { tileId: 1, name: 'Zezima', self: false, atMs: now - 60_000, gain: 40 },
      { tileId: 1, name: 'Me', self: true, atMs: now - 30_000, gain: 12 },
      { tileId: 2, name: 'Zezima', self: false, atMs: now - 10_000 },
      { tileId: 3, name: 'Me', self: true, atMs: now },
      { tileId: 4, name: 'Old', self: false, atMs: now - ACTIVE_WINDOW_MS - 1 },
    ],
    now,
  );
  assert.deepEqual(out.map((a) => a.tileId), [2, 1], 'newest first; finished and stale tiles left out');
  assert.deepEqual(out[1].workers, ['You', 'Zezima']);
  assert.equal(out[1].self, true);
  assert.deepEqual(out[1].gains, { Zezima: 40, You: 12 });
  assert.equal(out[0].gains, undefined, 'a submission carries no gain');
});

test('active now is capped', () => {
  const tiles = [1, 2, 3, 4, 5, 6].map((id) => tile(id));
  const out = activeNow(tiles, tiles.map((t) => ({ tileId: t.tileId, name: 'A', self: false, atMs: 1000 + t.tileId })), 2000);
  assert.deepEqual(out.map((a) => a.tileId), [6, 5, 4, 3]);
});

test('the schedule hides the shown board and lists live first, then soonest', () => {
  const bingo = (id: number, status: 'active' | 'upcoming', startDate: string, title = `Bingo ${id}`) =>
    ({ id, title, startDate, endDate: null, status, boardSize: null, tileCount: null, format: 'bingo', scoringMode: 'tiles' });
  const weekly = (id: number, status: string, startDate: string) =>
    ({ id, title: `W${id}`, type: 'sotw', metric: 'mining', metricLabel: 'Mining', status, startDate, endDate: '2099-01-01' });
  const { scheduled, weeklies } = panelSchedule(
    {
      bingos: [bingo(1, 'upcoming', '2026-11-02'), bingo(2, 'active', '2026-10-01'), bingo(3, 'upcoming', '2026-11-01'), bingo(4, 'active', '2026-10-20', 'Mine')],
      weeklies: [weekly(1, 'upcoming', '2026-11-01'), weekly(2, 'active', '2026-10-24')],
    },
    { ids: [2], title: 'Mine' },
  );
  assert.deepEqual(scheduled.map((b) => b.id), [3, 1]);
  assert.deepEqual(weeklies.map((w) => w.id), [2, 1]);
});
