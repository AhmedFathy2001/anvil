// Undoing a Quick add: which tiles are the new ones (lib/quickAddUndo).
// Run: node --experimental-strip-types --test tests/quick-add-undo.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { tilesAddedSince, undoableAdd } from '../src/lib/quickAddUndo.ts';

test('only tiles that were not on the board before are new, in board order', () => {
  const after = [
    { id: 1, position: 0 },
    { id: 2, position: 1 },
    { id: 9, position: 3 },
    { id: 8, position: 2 },
  ];
  assert.deepEqual(tilesAddedSince([1, 2], after), [8, 9]);
  assert.deepEqual(tilesAddedSince([1, 2, 8, 9], after), []);
});

test('combo parts are not board tiles and are never swept up', () => {
  const after = [
    { id: 1, position: 0 },
    { id: 5, position: 1 },
    { id: 6, position: 1, parentTileId: 5 },
  ];
  assert.deepEqual(tilesAddedSince([1], after), [5]);
});

test('the undo is offered only when the new tiles match what the import created', () => {
  assert.equal(undoableAdd(3, [4, 5, 6]), true);
  // Someone else added a tile at the same moment: do not guess which are ours.
  assert.equal(undoableAdd(3, [4, 5, 6, 7]), false);
  // Nothing created (it only filled blank squares): nothing to delete.
  assert.equal(undoableAdd(0, []), false);
  assert.equal(undoableAdd(2, []), false);
});

import { quickAddUndoLine } from '../src/lib/quickAddUndo.ts';

test('the undo line says what Undo removes when some tiles filled blank squares', () => {
  assert.equal(quickAddUndoLine(1, 4), 'Last Quick add: 5 tiles added. Undo removes the 1 new tile; the 4 filled blank squares stay.');
  assert.equal(quickAddUndoLine(3, 0), 'Last Quick add: 3 tiles added.');
  assert.equal(quickAddUndoLine(2, 1), 'Last Quick add: 3 tiles added. Undo removes the 2 new tiles; the 1 filled blank square stays.');
});
