// What a co-host may do with the host's tiles (lib/cohostBoardAccess).
//
// Run: node --experimental-strip-types --test tests/cohost-board-access.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { allows, parseBoardAccess, staffCanEditFrom } from '../src/lib/cohostBoardAccess.ts';

test('nothing stored reads the old single switch', () => {
  assert.deepEqual(parseBoardAccess({}, true), { suggest: 'staff', create: 'staff', edit: 'staff', delete: 'staff' });
  assert.deepEqual(parseBoardAccess(null, false), { suggest: 'nobody', create: 'nobody', edit: 'nobody', delete: 'nobody' });
});

test('per action, and only suggestions open to every player', () => {
  const a = parseBoardAccess({ suggest: 'players', create: 'nobody', edit: 'players', delete: 'bogus' }, true);
  assert.deepEqual(a, { suggest: 'players', create: 'nobody', edit: 'staff', delete: 'nobody' });
  assert.equal(allows(a, 'suggest', false), true);
  assert.equal(allows(a, 'edit', false), false);
  assert.equal(allows(a, 'edit', true), true);
  assert.equal(allows(a, 'create', true), false);
});

test('the old switch follows: on when staff may change the board at all', () => {
  assert.equal(staffCanEditFrom(parseBoardAccess({ suggest: 'staff' }, false)), false);
  assert.equal(staffCanEditFrom(parseBoardAccess({ edit: 'staff' }, false)), true);
});
