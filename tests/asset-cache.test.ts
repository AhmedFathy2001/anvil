import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The read-through cache's throttle behaviour, against a throwaway disk store and a stubbed origin.
// No bucket (S3_BUCKET unset → disk), no database.
process.env.ASSET_CACHE_DIR = mkdtempSync(path.join(os.tmpdir(), 'asset-cache-test-'));
delete process.env.S3_BUCKET;
delete process.env.STORAGE_DRIVER;

// Imported after the env above is set (the store directory is chosen on first use).
let C: typeof import('../src/lib/assetCache.ts');
let isKnownAsset: typeof import('../src/lib/assetKnown.ts').isKnownAsset;
let rateLimitByKey: typeof import('../src/lib/rate-limit.ts').rateLimitByKey;
before(async () => {
  C = await import('../src/lib/assetCache.ts');
  ({ isKnownAsset } = await import('../src/lib/assetKnown.ts'));
  ({ rateLimitByKey } = await import('../src/lib/rate-limit.ts'));
});

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

let upstreamCalls = 0;
let release: (() => void) | null = null;
let hold = false;
globalThis.fetch = (async () => {
  upstreamCalls++;
  if (hold) await new Promise<void>((r) => { release = r; });
  return new Response(new Uint8Array(PNG), { status: 200, headers: { 'content-type': 'image/png' } });
}) as typeof fetch;

const req = (ip: string) => ({ headers: { get: (n: string) => (n === 'cf-connecting-ip' ? ip : null) } });

test('a throttled miss is a 429 that no cache may keep, and nothing is fetched', async () => {
  const before = upstreamCalls;
  const got = await C.getAsset({ kind: 'item', id: 101 }, { allowMiss: async () => false });
  assert.equal(got, 'limited');
  assert.equal(upstreamCalls, before);

  const res = C.limitedResponse();
  assert.equal(res.status, 429);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('retry-after'), '60');
  // The public short-lived placeholder is only for genuine upstream failures.
  assert.match(C.placeholderResponse().headers.get('cache-control')!, /^public, max-age=300$/);
});

test('a caller joining an in-flight fetch is never throttled', async () => {
  hold = true;
  const ref = { kind: 'item', id: 202 } as const;
  const first = C.getAsset(ref, { allowMiss: async () => true });
  // Wait until the origin fetch is actually running (so it is the in-flight entry).
  while (!release) await new Promise((r) => setTimeout(r, 5));
  let asked = 0;
  const joiner = C.getAsset(ref, { allowMiss: async () => { asked++; return false; } });
  hold = false;
  release!();
  const [a, b] = await Promise.all([first, joiner]);
  assert.equal(asked, 0, 'joiner must not consult the throttle');
  assert.ok(a && a !== 'limited');
  assert.ok(b && b !== 'limited');
  assert.equal(a, b);
});

test('a hit is never throttled either', async () => {
  const got = await C.getAsset({ kind: 'item', id: 202 }, { allowMiss: async () => false });
  assert.ok(got && got !== 'limited');
});

test('names the app references bypass the global ceiling; unknown names do not', async () => {
  const known = { kind: 'wiki', file: 'Hitpoints_icon.png' } as const;
  const dataset = { kind: 'wiki', file: 'thumb/Abyssal_Sire_(phase_1).png/320px-Abyssal_Sire_(phase_1).png' } as const;
  const unknown = { kind: 'wiki', file: 'Totally_random_thing.png' } as const;
  assert.equal(isKnownAsset(known), true);
  assert.equal(isKnownAsset(dataset), true);
  assert.equal(isKnownAsset(unknown), false);
  assert.equal(isKnownAsset({ kind: 'item', id: 4151 }), false);

  // Burn the whole global budget for this window.
  for (let i = 0; i < C.MISS_GLOBAL.limit; i++) await rateLimitByKey('asset-miss', 'global', C.MISS_GLOBAL);

  assert.equal(await C.missThrottle(req('203.0.113.1'))(unknown), false);
  assert.equal(await C.missThrottle(req('203.0.113.2'))({ kind: 'item', id: 4151 }), false);
  assert.equal(await C.missThrottle(req('203.0.113.3'))(known), true);
  assert.equal(await C.missThrottle(req('203.0.113.4'))(dataset), true);
});

test('the per-IP cap still applies to known names', async () => {
  const known = { kind: 'wiki', file: 'Stats_icon.png' } as const;
  const allow = C.missThrottle(req('198.51.100.7'));
  let ok = 0;
  for (let i = 0; i < 70; i++) if (await allow(known)) ok++;
  assert.equal(ok, 60);
});
