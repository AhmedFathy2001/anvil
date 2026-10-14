// Run: npx tsx --test tests/ttl-memo.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ttlMemo } from '../src/lib/ttlMemo.ts';

test('one computation serves concurrent and repeat callers inside the TTL', async () => {
  let runs = 0;
  const compute = async () => ++runs;
  const [a, b] = await Promise.all([ttlMemo('k1', compute, 1000), ttlMemo('k1', compute, 1000)]);
  assert.equal(a, 1);
  assert.equal(b, 1);
  assert.equal(await ttlMemo('k1', compute, 1000), 1);
  assert.equal(runs, 1);
});

test('a failure is not cached', async () => {
  let runs = 0;
  await assert.rejects(ttlMemo('k2', async () => { runs++; throw new Error('db down'); }, 1000));
  assert.equal(await ttlMemo('k2', async () => ++runs, 1000), 2);
});

test('expires after the TTL', async () => {
  let runs = 0;
  await ttlMemo('k3', async () => ++runs, 1);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(await ttlMemo('k3', async () => ++runs, 1), 2);
});
