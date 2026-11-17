import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countRunning, runningLabel, runningParts, runningTotal } from '../src/lib/runningCount';

test('events and competitions are counted separately and named', () => {
  const c = countRunning([{ kind: 'event' }, { kind: 'weekly' }, { kind: 'bingo' }, { kind: 'weekly' }]);
  assert.deepEqual(c, { events: 2, competitions: 2 });
  assert.equal(runningTotal(c), 4);
  assert.equal(runningLabel(c), '2 events and 2 competitions running');
});

test('singular, one kind only, and nothing', () => {
  assert.equal(runningLabel({ events: 1, competitions: 0 }), '1 event running');
  assert.equal(runningLabel({ events: 0, competitions: 3 }), '3 competitions running');
  assert.equal(runningLabel({ events: 1, competitions: 1 }), '1 event and 1 competition running');
  assert.equal(runningLabel({ events: 0, competitions: 0 }), 'nothing running');
  assert.equal(runningParts({ events: 0, competitions: 0 }), '');
});
