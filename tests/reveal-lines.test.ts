// lib/revealLines: the in-game wording for tiles opening and missions going live, and the gate that
// keeps a still-hidden tile out of it. Pure — no database.
//
// Run: npx tsx --test tests/reveal-lines.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { playerVisibleReveals, revealLines, shortDuration, type RevealedTile } from '../src/lib/revealLines.ts';

const NOW = Date.parse('2026-11-09T12:00:00.000Z');
const at = new Date(NOW).toISOString();
let id = 0;
const tile = (label: string, extra: Partial<RevealedTile> = {}): RevealedTile => ({
  id: ++id, label, points: 5, mission: 0, rules: null, revealedAt: at, closedAt: null, parentTileId: null, ...extra,
});
const mission = (label: string, rules: object) => tile(label, { mission: 1, rules: JSON.stringify(rules) });

test('one new tile: name, board and points', () => {
  assert.deepEqual(revealLines('Lab session #14', [tile('Wintertodt crate')], true, NOW), [
    'New tile: Wintertodt crate · Lab session #14 (5 pts)',
  ]);
  assert.deepEqual(revealLines('Lab session #14', [tile('Zulrah', { points: 1 })], true, NOW), ['New tile: Zulrah · Lab session #14 (1 pt)']);
  // A board not scored on points says nothing about them.
  assert.deepEqual(revealLines('Winter', [tile('Zulrah')], false, NOW), ['New tile: Zulrah · Winter']);
});

test('several reveals at once collapse into one line', () => {
  assert.deepEqual(revealLines('Lab session #14', [tile('A'), tile('B'), tile('C')], true, NOW), ['3 new tiles on Lab session #14: A, B, C']);
  const many = Array.from({ length: 30 }, (_, i) => tile(`Some long tile name ${i}`));
  const [line] = revealLines('Board', many, true, NOW);
  assert.ok(line.length <= 160, line);
  assert.match(line, /^30 new tiles on Board: Some long tile name 0, .* \+\d+ more$/);
});

test('a mission says when it ends, or that the first team takes it', () => {
  // Missions expire in whole hours; one dropped half an hour ago (a catch-up tick) has 30m left.
  const late = { ...mission('Kill Vorkath', { expiryHours: 1 }), revealedAt: new Date(NOW - 30 * 60_000).toISOString() };
  assert.deepEqual(revealLines('Lab session #14', [late], true, NOW), [
    'Mission live: Kill Vorkath · Lab session #14 — ends in 30m',
  ]);
  assert.deepEqual(revealLines('B', [mission('Fire cape', { lockout: true })], true, NOW), ['Mission live: Fire cape · B — first team takes it']);
  assert.deepEqual(revealLines('B', [mission('Fire cape', { lockout: true, expiryHours: 2 })], true, NOW), [
    'Mission live: Fire cape · B — first team takes it, ends in 2h',
  ]);
  assert.deepEqual(revealLines('B', [mission('Open', {})], true, NOW), ['Mission live: Open · B']);
});

test('tiles and missions in one pass: a line each kind, missions collapse too', () => {
  assert.deepEqual(revealLines('B', [tile('A'), mission('M1', {}), mission('M2', {})], true, NOW), [
    'New tile: A · B (5 pts)',
    '2 missions live on B: M1, M2',
  ]);
});

test('durations', () => {
  assert.equal(shortDuration(30 * 60_000), '30m');
  assert.equal(shortDuration(90 * 60_000), '1h 30m');
  assert.equal(shortDuration(3 * 86_400_000), '3d');
});

test('only what players may see: hidden board, unannounced missions, closed tiles and combo parts stay out', () => {
  const shown = tile('Shown');
  const hiddenMission = tile('Secret', { mission: 1, revealedAt: null });
  const closed = tile('Closed', { closedAt: at });
  const part = tile('Part', { parentTileId: 1 });
  const unrevealed = tile('Later', { revealedAt: null });
  const rules = JSON.stringify({ revealPolicy: 'interval' });
  assert.deepEqual(
    playerVisibleReveals({ tilesRevealed: 1, rules }, [shown, hiddenMission, closed, part, unrevealed]).map((t) => t.label),
    ['Shown'],
  );
  // The host still keeps the whole board private: nothing.
  assert.deepEqual(playerVisibleReveals({ tilesRevealed: 0, rules }, [shown]), []);
});
