import { test } from 'node:test';
import assert from 'node:assert/strict';

import { splitUnassigned } from '../src/lib/splitUnassigned.ts';

test('fills the smaller team first and ends within one', () => {
  const out = splitUnassigned(
    [1, 2],
    [
      { id: 10, teamId: 1 },
      { id: 11, teamId: 1 },
      { id: 12, teamId: null },
      { id: 13, teamId: null },
      { id: 14, teamId: null },
    ],
  );
  assert.deepEqual(out.map((a) => a.teamId), [2, 2, 1]);
  assert.deepEqual(out.map((a) => a.participantId), [12, 13, 14]);
});

test('no teams or nobody unassigned gives nothing', () => {
  assert.deepEqual(splitUnassigned([], [{ id: 1, teamId: null }]), []);
  assert.deepEqual(splitUnassigned([1], [{ id: 1, teamId: 1 }]), []);
});
