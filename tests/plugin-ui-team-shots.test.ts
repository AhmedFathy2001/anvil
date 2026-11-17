import { test } from 'node:test';
import assert from 'node:assert/strict';

import { missingShotsLine, missingStartShots } from '../src/lib/pluginUi/teamsUi';
import { emptyLine } from '../src/lib/pluginUi/feedUi';

const members = [{ id: 1, name: 'Zed' }, { id: 2, name: 'Amy' }, { id: 3, name: 'Bo' }, { id: 4, name: 'Cy' }];

test('missing starting shots: none or rejected counts, pending and accepted do not', () => {
  const st = new Map([[1, 'accepted'], [3, 'pending'], [4, 'rejected']]);
  assert.deepEqual(missingStartShots(members, st, true), ['Amy', 'Cy']);
});

test('missing starting shots: nothing once the ask has closed', () => {
  assert.deepEqual(missingStartShots(members, new Map(), false), []);
});

test('missing starting shots line is short and caps the names', () => {
  assert.equal(missingShotsLine([]), null);
  assert.equal(missingShotsLine(['A', 'B']), 'Missing starting shot: A, B');
  assert.equal(missingShotsLine(['A', 'B', 'C', 'D', 'E', 'F']), 'Missing starting shot: A, B, C, D +2 more');
});

test('deaths and tiles feeds have their own empty line', () => {
  assert.notEqual(emptyLine('feed', 'deaths'), emptyLine('feed', 'all'));
  assert.notEqual(emptyLine('feed', 'tiles'), emptyLine('feed', 'all'));
});
