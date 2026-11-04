import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickStarterBoard, spreadStarterRows, starterCount, type StarterBoardShape } from '../src/lib/starterTiles';

const task = (label: string, points: number) => ({ label, points, category: 'X', config: { tileType: 'drop' } });
const pool = Array.from({ length: 60 }, (_, i) => task(`Task ${i}`, i * 10));

test('starterCount: a grid is N×N, a race is N', () => {
  assert.equal(starterCount('bingo', 5), 25);
  assert.equal(starterCount('tilerace', 10), 10);
});

test('spread fills the board with unique tasks from easy to hard', () => {
  const rows = spreadStarterRows(pool, 25, { ordered: true, random: () => 0 });
  assert.equal(rows.length, 25);
  assert.equal(new Set(rows.map((r) => r.label)).size, 25);
  const pts = rows.map((r) => r.points ?? 0);
  assert.deepEqual(pts, [...pts].sort((a, b) => a - b), 'a race runs easiest first');
  assert.ok(pts[0] < 30 && pts[24] > 500, 'covers the whole range');
  assert.equal(rows[0].tileType, 'drop', 'keeps the tracking config');
});

test('spread drops duplicate labels and refuses a pool too small to fill the board', () => {
  const dupes = [...pool.slice(0, 10), task('task 0', 5), task(' ', 1)];
  assert.equal(spreadStarterRows(dupes, 11, { ordered: false }).length, 0);
  assert.equal(spreadStarterRows(dupes, 10, { ordered: false }).length, 10);
});

test('a grid is shuffled, not sorted', () => {
  let n = 0;
  const rand = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
  const pts = spreadStarterRows(pool, 25, { ordered: false, random: rand }).map((r) => r.points ?? 0);
  assert.notDeepEqual(pts, [...pts].sort((a, b) => a - b));
});

test('pickStarterBoard takes only a published Anvil board of the exact shape', () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `T${i}` }));
  const b = (o: Partial<StarterBoardShape> & { id: number }) => ({ origin: 'anvil' as const, status: 'published', mode: 'classic', boardSize: 5, tiles: rows(25), ...o });
  const boards = [
    b({ id: 1, origin: 'community' }),
    b({ id: 2, status: 'hidden' }),
    b({ id: 3, boardSize: 4, tiles: rows(16) }),
    b({ id: 4, tiles: [...rows(24), { label: '' }] }),
    b({ id: 5 }),
    b({ id: 6, mode: 'race', boardSize: 10, tiles: rows(10) }),
  ];
  assert.equal(pickStarterBoard(boards, 'bingo', 5)?.id, 5);
  assert.equal(pickStarterBoard(boards, 'tilerace', 10)?.id, 6);
  assert.equal(pickStarterBoard(boards, 'tilerace', 12), null);
});
