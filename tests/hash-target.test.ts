import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashTargetId } from '../src/lib/hashTarget';

test('hashTargetId decodes and strips', () => {
  assert.equal(hashTargetId('#prizes'), 'prizes');
  assert.equal(hashTargetId('#a%20b'), 'a b');
  assert.equal(hashTargetId('#%E0%A4%A'), '%E0%A4%A');
  assert.equal(hashTargetId(''), '');
  assert.equal(hashTargetId('#'), '');
});
