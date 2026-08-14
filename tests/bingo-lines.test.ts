import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  blackout,
  boardLines,
  completedLines,
  lineProgress,
  nearlyLines,
  positionsOf,
} from '../src/lib/bingoLines.ts';

test('a 5x5 board has 5 rows, 5 columns and 2 diagonals', () => {
  const lines = boardLines(5);
  assert.equal(lines.length, 12);
  assert.deepEqual(lines.find((l) => l.key === 'row-0')?.positions, [0, 1, 2, 3, 4]);
  assert.deepEqual(lines.find((l) => l.key === 'col-0')?.positions, [0, 5, 10, 15, 20]);
  assert.deepEqual(lines.find((l) => l.key === 'diag-down')?.positions, [0, 6, 12, 18, 24]);
  assert.deepEqual(lines.find((l) => l.key === 'diag-up')?.positions, [4, 8, 12, 16, 20]);
});

test('a board too small to have lines has none', () => {
  assert.deepEqual(boardLines(1), []);
  assert.deepEqual(boardLines(0), []);
  assert.deepEqual(boardLines(2.5), []);
});

test('a team that owns a row has that line, and is one from the crossing column', () => {
  // Row 2 complete (5..9), plus 0, 10 and 15 — which leaves column 0 needing only 20.
  const owned = new Set([5, 6, 7, 8, 9, 0, 10, 15]);
  const progress = lineProgress(5, owned);
  const complete = completedLines(progress);
  assert.deepEqual(complete.map((l) => l.key), ['row-1']);

  const nearly = nearlyLines(progress);
  const col0 = nearly.find((p) => p.line.key === 'col-0');
  assert.ok(col0, 'column 0 is one tile away');
  assert.deepEqual(col0.missing, [20]);
});

test('lines are per team — one team owning a tile never blocks another', () => {
  const ember = new Set([0, 1, 2, 3, 4]);
  const frost = new Set([0, 1, 2, 3]); // shares four tiles with Ember, still needs the fifth
  assert.equal(completedLines(lineProgress(5, ember)).length, 1);
  assert.equal(completedLines(lineProgress(5, frost)).length, 0);
  assert.deepEqual(nearlyLines(lineProgress(5, frost))[0].missing, [4]);
});

test('nearly excludes what is already finished, and respects the window', () => {
  const owned = new Set([0, 1, 2, 3, 4, 5, 6, 7]); // row 1 complete; row 2 has 3 of 5
  const progress = lineProgress(5, owned);
  assert.ok(!nearlyLines(progress).some((p) => p.line.key === 'row-0'), 'a finished line is not a chase');
  assert.ok(nearlyLines(progress, 2).some((p) => p.line.key === 'row-1'));
  assert.ok(!nearlyLines(progress, 1).some((p) => p.line.key === 'row-1'));
});

test('lines over positions the board never authored are skipped', () => {
  const existing = new Set(Array.from({ length: 24 }, (_, i) => i)); // position 24 missing
  const owned = new Set([20, 21, 22, 23]);
  const progress = lineProgress(5, owned, existing);
  assert.ok(!progress.some((p) => p.line.key === 'row-4'), 'a row with a hole is not a line');
  assert.ok(progress.some((p) => p.line.key === 'row-0'));
});

test('positionsOf collects every square to outline', () => {
  const lines = boardLines(3).filter((l) => l.key === 'row-0' || l.key === 'col-0');
  assert.deepEqual([...positionsOf(lines)].sort((a, b) => a - b), [0, 1, 2, 3, 6]);
});

test('blackout is measured against the tiles that exist', () => {
  assert.deepEqual(blackout(new Set([1, 2, 3]), 24), { done: 3, total: 24, pct: 13 });
  assert.deepEqual(blackout(new Set(), 0), { done: 0, total: 0, pct: 0 });
});
