import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDirtyTracker, valuesEqual } from '../src/lib/unsavedChanges';

test('deep compare ignores key order and undefined, respects array order', () => {
  assert.ok(valuesEqual({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1, z: undefined }));
  assert.ok(!valuesEqual({ a: [1, 2] }, { a: [2, 1] }));
  assert.ok(!valuesEqual({ a: '' }, { a: 'x' }));
});

test('clean on mount, dirty on edit, clean again when changed back', () => {
  const t = createDirtyTracker({ name: 'a', tags: ['x'] });
  assert.equal(t.isDirty({ name: 'a', tags: ['x'] }), false);
  assert.equal(t.isDirty({ name: 'ab', tags: ['x'] }), true);
  assert.equal(t.isDirty({ name: 'a', tags: ['x'] }), false);
});

test('markSaved resets the baseline', () => {
  const t = createDirtyTracker({ name: 'a' });
  const edited = { name: 'b' };
  assert.equal(t.isDirty(edited), true);
  t.markSaved(edited);
  assert.equal(t.isDirty(edited), false);
  assert.equal(t.isDirty({ name: 'a' }), true);
});
