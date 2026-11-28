import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// `/img/mode/<key>/…`: a post's thumbnail with the game mode's icon badged on its corner
// (lib/assetCache renderModeBadge / getModeBadgedAsset). Throwaway disk store and a stubbed origin —
// no bucket, no database, no network.
//
// Run: npx tsx --test tests/mode-badge.test.ts
process.env.ASSET_CACHE_DIR = mkdtempSync(path.join(os.tmpdir(), 'mode-badge-test-'));
delete process.env.S3_BUCKET;
delete process.env.STORAGE_DRIVER;

let C: typeof import('../src/lib/assetCache.ts');
let GET: typeof import('../src/app/img/mode/[...path]/route.ts').GET;
let sharp: (typeof import('sharp'))['default'];
let item: Buffer;
let badge: Buffer;
let big: Buffer;
let huge: Buffer;
const fetched: string[] = [];

const solid = (width: number, height: number, r: number, g: number, b: number) =>
  sharp({ create: { width, height, channels: 4, background: { r, g, b, alpha: 1 } } }).png().toBuffer();

before(async () => {
  C = await import('../src/lib/assetCache.ts');
  ({ GET } = await import('../src/app/img/mode/[...path]/route.ts'));
  sharp = (await import('sharp')).default;
  item = await solid(36, 32, 255, 0, 0);
  badge = await solid(13, 13, 0, 0, 255);
  big = await solid(320, 200, 0, 255, 0);
  huge = await solid(900, 900, 0, 255, 0);
  globalThis.fetch = (async (u: string | URL) => {
    const url = String(u);
    fetched.push(url);
    const body = url.includes('Hardcore_Worlds_icon') ? badge : url.includes('Big_render') ? big : url.includes('Huge_render') ? huge : item;
    return new Response(new Uint8Array(body), { status: 200, headers: { 'content-type': 'image/png' } });
  }) as typeof fetch;
});

function get(p: string) {
  const url = `http://localhost${p}`;
  return GET(Object.assign(new Request(url, { headers: { 'x-forwarded-for': '203.0.113.9' } }), { nextUrl: new URL(url) }) as never);
}

async function pixel(png: Buffer, x: number, y: number): Promise<number[]> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * 4;
  return [...data.subarray(i, i + 4)];
}

test('an item sprite: 1.5x on a 64x58 canvas, the 20px badge in the bottom-right corner', async () => {
  const res = await get('/img/mode/hardcore/item/22374.png');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.equal(res.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  const png = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(png).metadata();
  assert.deepEqual([meta.width, meta.height], [64, 58]);
  assert.deepEqual(await pixel(png, 0, 0), [255, 0, 0, 255], 'the item at the top-left');
  assert.deepEqual(await pixel(png, 53, 47), [0, 0, 255, 255], 'the badge over the item corner');
  assert.deepEqual(await pixel(png, 63, 57), [0, 0, 255, 255], 'the badge in the canvas corner');
  assert.deepEqual(await pixel(png, 63, 0), [0, 0, 0, 0], 'transparent beside the item');
  assert.deepEqual(await pixel(png, 43, 50), [0, 0, 0, 0], 'transparent below the item, left of the badge');
  // Only our two upstreams, for the item and the mode's catalogued icon.
  for (const u of fetched) assert.ok(u.startsWith('https://static.runelite.net/') || u.startsWith('https://oldschool.runescape.wiki/images/'), u);
  assert.ok(fetched.some((u) => u.endsWith('/Hardcore_Worlds_icon.png')));
});

test('a second request is served from the cache without touching origin', async () => {
  const before = fetched.length;
  assert.equal((await get('/img/mode/hardcore/item/22374.png')).status, 200);
  assert.equal(fetched.length, before);
});

test('bigger art is fitted so the whole thumbnail stays inside 80px, the badge scaled with it', async () => {
  const res = await get('/img/mode/hardcore/wiki/Big_render.png');
  assert.equal(res.status, 200);
  const png = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(png).metadata();
  assert.ok(meta.width! <= 80 && meta.height! <= 80, `${meta.width}x${meta.height}`);
  assert.deepEqual([meta.width, meta.height], [78, 53]);
  assert.deepEqual(await pixel(png, 77, 52), [0, 0, 255, 255]);
});

test('art too big to be a thumbnail is not rendered', async () => {
  const res = await get('/img/mode/hardcore/wiki/Huge_render.png');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'public, max-age=300', 'the short-lived placeholder');
});

test('anything but a catalogued mode and one of our own assets is refused before any fetch', async () => {
  const before = fetched.length;
  for (const bad of [
    '/img/mode/echo-rush/item/1.png',
    '/img/mode/hardcore/item/abc.png',
    '/img/mode/hardcore/wiki/a.svg',
    '/img/mode/hardcore/wiki/..%2Fsecret.png',
    '/img/mode/hardcore/https%3A%2F%2Fevil.example%2Fa.png',
    '/img/mode/hardcore',
  ]) {
    assert.equal((await get(bad)).status, 404, bad);
  }
  assert.equal((await get('/img/mode/hardcore/item/22374.png?url=https://evil.example')).status, 400);
  assert.equal(fetched.length, before);
});

test('renderModeBadge: a tiny sprite is drawn at a whole-number scale, the badge stays 20px', async () => {
  const out = await C.renderModeBadge(await solid(25, 25, 9, 9, 9), badge);
  const meta = await sharp(out!).metadata();
  assert.deepEqual([meta.width, meta.height], [60, 60], '25px at 2x = 50, plus the 10px overhang');
  assert.equal(await C.renderModeBadge(Buffer.from('not an image'), badge).catch(() => null), null);
});
