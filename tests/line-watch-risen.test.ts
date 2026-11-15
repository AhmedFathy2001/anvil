import test from 'node:test';
import assert from 'node:assert/strict';
import { risenTeams } from '../src/components/board/LineWatch';

test('risenTeams reports only teams whose line count went up', () => {
  const prev = new Map([[1, 0], [2, 2]]);
  const now = [
    { id: 1, name: 'A', count: 1 },
    { id: 2, name: 'B', count: 2 },
    { id: 3, name: 'C', count: 3 },
  ];
  assert.deepEqual(risenTeams(prev, now).map((t) => t.id), [1]);
  assert.deepEqual(risenTeams(new Map([[1, 4]]), [{ id: 1, name: 'A', count: 3 }]), []);
});
