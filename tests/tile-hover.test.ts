import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tileHoverView } from '../src/lib/tileHover';

test('open tile with count progress', () => {
  const v = tileHoverView({ label: 'Bones', progress: { current: 12, required: 50 } });
  assert.equal(v.state, 'open');
  assert.equal(v.progress, '12 of 50');
});

test('combo wording wins over the raw count', () => {
  assert.equal(tileHoverView({ label: 'c', progress: { current: 1, required: 2, text: '1 of 2' } }).progress, '1 of 2');
});

test('done hides progress and names the team', () => {
  const v = tileHoverView({ label: 'x', doneBy: [{ name: 'Red' }], progress: { current: 50, required: 50 } });
  assert.equal(v.state, 'done');
  assert.equal(v.stateLabel, 'Done by Red');
  assert.equal(v.progress, null);
});

test('locked beats needs proof; manual tile needs proof', () => {
  assert.equal(tileHoverView({ label: 'x', locked: true, manualOnly: true }).state, 'locked');
  assert.equal(tileHoverView({ label: 'x', manualOnly: true }).state, 'needs_proof');
});

test('teammates going for it', () => {
  const v = tileHoverView({ label: 'x', claimedBy: [{ name: 'Al', mine: false }, { name: 'Me', mine: true }] });
  assert.equal(v.who, 'Going for it: Al, you');
});

test('stat progress uses grouped numbers', () => {
  assert.equal(tileHoverView({ label: 'x', stat: { current: 1500, goal: 10000 } }).progress, '1,500 of 10,000');
});
