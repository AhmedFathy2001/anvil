import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeHoverCard, type Box } from '../src/lib/tileHoverPlace';

const box = (left: number, top: number, w: number, h: number): Box => ({ left, top, right: left + w, bottom: top + h });
const card = { w: 224, h: 100 };
const overlaps = (a: { left: number; top: number }, b: Box) => a.left < b.right && a.left + card.w > b.left && a.top < b.bottom && a.top + card.h > b.top;

test('beside the board when there is room, never over the board', () => {
  const board = box(300, 100, 600, 600);
  const tile = box(320, 120, 100, 100);
  const p = placeHoverCard(tile, board, card, { w: 1440, h: 900 });
  assert.equal(overlaps(p, board), false);
  assert.equal(p.left, board.right + 8);
});
test('left of the board when the right is cramped', () => {
  const board = box(700, 100, 600, 600);
  const p = placeHoverCard(box(720, 120, 100, 100), board, card, { w: 1440, h: 900 });
  assert.equal(overlaps(p, board), false);
  assert.ok(p.left + card.w <= board.left);
});
test('under the board when neither side fits', () => {
  const board = box(8, 50, 1000, 600);
  const p = placeHoverCard(box(20, 60, 100, 100), board, card, { w: 1010, h: 900 });
  assert.equal(p.top, board.bottom + 8);
});
test('always on screen, even when the board fills the window', () => {
  const board = box(0, 0, 1000, 800);
  const v = { w: 1000, h: 800 };
  for (const tile of [box(0, 0, 100, 100), box(900, 700, 100, 100), box(450, 350, 100, 100)]) {
    const p = placeHoverCard(tile, board, card, v);
    assert.ok(p.left >= 8 && p.top >= 8 && p.left + card.w <= v.w - 8 && p.top + card.h <= v.h - 8);
    assert.equal(overlaps(p, tile), false);
  }
});
