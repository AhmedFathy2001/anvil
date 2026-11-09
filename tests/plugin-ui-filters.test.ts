import { test } from 'node:test';
import assert from 'node:assert/strict';

import { type BoardState, type BoardTile, filterChips, filterTiles } from '../src/lib/pluginUi/boardUi';

// The tile list's filter chips (lib/pluginUi boardUi): every option the old dropdown had, each still
// filtering the way it says; "Closest first" a sort link, not a chip.

const tile = (tileId: number, extra: Record<string, unknown> = {}) => ({ tileId, label: `Tile ${tileId}`, position: tileId, complete: false, closedAt: null, ...extra }) as unknown as BoardTile;
const TILES = [tile(1, { complete: true }), tile(2), tile(3), tile(4, { closedAt: '2026-11-01' }), tile(5)];
// 2 is halfway, 5 is nearly there, 3 untouched.
const progress = new Map([[2, { current: 5, goal: 10 }], [5, { current: 9, goal: 10 }]]);
const ids = (status: Parameters<typeof filterTiles>[2], tiles = TILES) => filterTiles(tiles, '', status, false, progress).map((t) => t.tileId);
const state = (status: BoardState['status']): BoardState => ({ event: 0, pre: false, q: '', status, page: 0 });
const texts = (n: unknown): string[] => (!n || typeof n !== 'object' ? [] : Array.isArray(n) ? n.flatMap(texts) : [...((n as { t?: string }).t === 'text' ? [(n as { s: string }).s] : []), ...Object.values(n).flatMap(texts)]);

test('each board filter keeps the tiles it names', () => {
  assert.deepEqual(ids('all'), [1, 2, 3, 4, 5]);
  assert.deepEqual(ids('open'), [2, 3, 5]);
  assert.deepEqual(ids('progress'), [2, 5]);
  assert.deepEqual(ids('new'), [3]);
  assert.deepEqual(ids('done'), [1]);
  assert.deepEqual(ids('closest'), [5, 2, 3], 'not done, furthest along first');
});

test('each race filter keeps the tiles it names', () => {
  const race = [tile(1, { raceStep: 0, raceState: 'done', complete: true }), tile(2, { raceStep: 1, raceState: 'open' }), tile(3, { raceStep: 2, raceState: 'ahead' }), tile(4, { raceStep: 1, raceState: 'closed' })];
  assert.deepEqual(ids('next', race), [2]);
  assert.deepEqual(ids('done', race), [1]);
  assert.deepEqual(ids('locked', race).sort(), [3, 4]);
});

test('the filter: one dropdown with every state and the closest-first sort; a race gets its own four', () => {
  const sel = (n: unknown) => JSON.parse(JSON.stringify(n)).c ?? JSON.parse(JSON.stringify(n));
  const board = JSON.stringify(filterChips(state('closest'), false));
  for (const w of ['All', 'Not done', 'Closest first', 'In progress', 'Not started', 'Done']) assert.ok(board.includes(`"label":"${w}"`), w);
  assert.ok(board.includes('"kind":"select"') && board.includes('"value":"closest"'));
  const race = JSON.stringify(filterChips(state('all'), true));
  for (const w of ['All', 'Next for us', 'Done', 'Locked']) assert.ok(race.includes(`"label":"${w}"`), w);
  void sel;
});
