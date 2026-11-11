import { test } from 'node:test';
import assert from 'node:assert/strict';

import { accountCap, validAccountLimit } from '../src/lib/accountCap.ts';

test('0 is no limit, anything else is the cap', () => {
  assert.equal(accountCap(0), 99);
  assert.equal(accountCap(3), 3);
  assert.equal(accountCap(null), 1);
  assert.equal(accountCap(undefined), 1);
  for (const ok of [0, 1, 10]) assert.ok(validAccountLimit(ok), String(ok));
  for (const bad of [-1, 11, 1.5, '2', null]) assert.ok(!validAccountLimit(bad), String(bad));
});
