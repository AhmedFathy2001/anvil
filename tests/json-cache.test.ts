import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createJsonCache } from '../src/lib/jsonCache';

function setup() {
  let calls = 0;
  let t = 0;
  let value: unknown = { n: 1 };
  let ok = true;
  const cache = createJsonCache(async () => { calls++; return { ok, json: async () => value }; }, () => t, 1000);
  return { cache, calls: () => calls, tick: (ms: number) => { t += ms; }, set: (v: unknown) => { value = v; }, fail: () => { ok = false; } };
}

test('concurrent loads share one request', async () => {
  const s = setup();
  await Promise.all([s.cache.load('a'), s.cache.load('a')]);
  assert.equal(s.calls(), 1);
});

test('a fresh value is served without a request, a stale one is refetched', async () => {
  const s = setup();
  await s.cache.load('a');
  await s.cache.load('a');
  assert.equal(s.calls(), 1);
  s.tick(1500);
  s.set({ n: 2 });
  assert.deepEqual(s.cache.peek('a'), { n: 1 }); // old value still readable while refetching
  assert.deepEqual(await s.cache.load('a'), { n: 2 });
  assert.equal(s.calls(), 2);
});

test('a failed read keeps the previous value and stores nothing new', async () => {
  const s = setup();
  assert.equal(await s.cache.load('x') !== undefined, true);
  s.tick(2000);
  s.fail();
  assert.deepEqual(await s.cache.load('x'), { n: 1 });
  const s2 = setup();
  s2.fail();
  assert.equal(await s2.cache.load('y'), undefined);
  assert.equal(s2.cache.peek('y'), undefined);
});

test('prefetch warms the cache', async () => {
  const s = setup();
  s.cache.prefetch('p');
  await s.cache.load('p');
  assert.equal(s.calls(), 1);
  assert.deepEqual(s.cache.peek('p'), { n: 1 });
});

test('an empty answer is an answer, and a read that never answers ends as a failed read', async () => {
  const empty = createJsonCache(async () => ({ ok: true, json: async () => [] }));
  assert.deepEqual(await empty.load('/a'), []);
  assert.deepEqual(empty.peek('/a'), []);
  const hung = createJsonCache(() => new Promise(() => {}), Date.now, 5_000, 20);
  assert.equal(await hung.load('/b'), undefined);
  assert.equal(hung.peek('/b'), undefined);
});
