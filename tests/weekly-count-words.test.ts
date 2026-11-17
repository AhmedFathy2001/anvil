// Run: node --experimental-strip-types --test tests/weekly-count-words.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countScored, enteredWord, scoredOfEntered } from '../src/lib/weeklyCountWords.ts';

test('entered counts everyone, scored only those above zero', () => {
  assert.deepEqual(countScored([5, 0, null, undefined, -2, 12]), { entered: 6, scored: 2 });
  assert.deepEqual(countScored([]), { entered: 0, scored: 0 });
});

test('one wording for the pair and for the headcount', () => {
  assert.equal(scoredOfEntered(9, 170), '9 of 170 have scored');
  assert.equal(scoredOfEntered(1, 1), '1 of 1 has scored');
  assert.equal(enteredWord(170), '170 entered');
});
