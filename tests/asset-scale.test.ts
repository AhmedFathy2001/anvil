import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// `/img/wiki/<file>?x=N`: a nearest-neighbour upscale of a cached sprite, for Discord thumbnails.
// Throwaway disk store and a stubbed origin — no bucket, no database, no network.
process.env.ASSET_CACHE_DIR = mkdtempSync(path.join(os.tmpdir(), 'asset-scale-test-'));
delete process.env.S3_BUCKET;
delete process.env.STORAGE_DRIVER;

import { assetCacheKey, parseAssetScale, wikiImageUrl } from '../src/lib/assetUrls.ts';

let C: typeof import('../src/lib/assetCache.ts');
let GET: typeof import('../src/app/img/wiki/[...file]/route.ts').GET;
let sharp: (typeof import('sharp'))['default'];
let sprite: Buffer;
let big: Buffer;
let upstreamCalls = 0;

before(async () => {
  C = await import('../src/lib/assetCache.ts');
  ({ GET } = await import('../src/app/img/wiki/[...file]/route.ts'));
  sharp = (await import('sharp')).default;
  // A 3×2 sprite: opaque red, opaque blue, transparent / three more distinct pixels.
  const px = Buffer.from([255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 0, 0, 0, 255, 0, 255, 9, 9, 9, 255, 200, 100, 50, 128]);
  sprite = await sharp(px, { raw: { width: 3, height: 2, channels: 4 } }).png().toBuffer();
  big = await sharp({ create: { width: 320, height: 200, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 1 } } }).png().toBuffer();
  globalThis.fetch = (async (u: string | URL) => {
    upstreamCalls++;
    const body = String(u).includes('Big_render') ? big : sprite;
    return new Response(new Uint8Array(body), { status: 200, headers: { 'content-type': 'image/png' } });
  }) as typeof fetch;
});

test('only x=2, 3 or 4 is a scale; absent is 1; anything else is refused', () => {
  assert.equal(parseAssetScale(null), 1);
  assert.equal(parseAssetScale(undefined), 1);
  for (const ok of ['2', '3', '4']) assert.equal(parseAssetScale(ok), Number(ok));
  for (const bad of ['', '1', '5', '8', '0', '-2', '04', '2.0', '2x', ' 4', 'four', '44', '1e1']) {
    assert.equal(parseAssetScale(bad), null, JSON.stringify(bad));
  }
});

test('the URL and the cache key carry only a validated scale', () => {
  assert.equal(wikiImageUrl('Nex_icon.png', 4), '/img/wiki/Nex_icon.png?x=4');
  assert.equal(wikiImageUrl('Nex_icon.png'), '/img/wiki/Nex_icon.png');
  assert.equal(wikiImageUrl('Nex_icon.png', 7), '/img/wiki/Nex_icon.png');
  const ref = { kind: 'wiki', file: 'Nex_icon.png' } as const;
  assert.equal(assetCacheKey(ref), 'asset-cache/wiki/Nex_icon.png');
  assert.equal(assetCacheKey(ref, 4), 'asset-cache/wiki-x4/Nex_icon.png');
  assert.equal(assetCacheKey(ref, 9), 'asset-cache/wiki/Nex_icon.png');
});

test('upscale is pixel-exact nearest-neighbour with alpha kept', async () => {
  const out = await C.upscaleSprite(sprite, 4);
  assert.ok(out);
  const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 12);
  assert.equal(info.height, 8);
  assert.equal(info.channels, 4);
  const at = (x: number, y: number) => [...data.subarray((y * 12 + x) * 4, (y * 12 + x) * 4 + 4)];
  assert.deepEqual(at(0, 0), [255, 0, 0, 255]);
  assert.deepEqual(at(3, 3), [255, 0, 0, 255]);
  assert.deepEqual(at(4, 0), [0, 0, 255, 255]);
  assert.equal(at(8, 0)[3], 0, 'transparent stays transparent');
  assert.deepEqual(at(11, 7), [200, 100, 50, 128]);
  assert.equal(await C.upscaleSprite(sprite, 5), null);
  assert.equal(await C.upscaleSprite(big, 2), null, 'a 320px render is not a sprite');
});

const call = (q: string) => {
  const url = `http://localhost/img/wiki/Some_icon.png${q}`;
  return GET(Object.assign(new Request(url), { nextUrl: new URL(url) }) as never);
};

test('the route refuses a bad scale before touching the cache', async () => {
  const before = upstreamCalls;
  for (const q of ['?x=5', '?x=1', '?x=', '?x=2&x=4', '?x=abc']) {
    const res = await call(q);
    assert.equal(res.status, 400, q);
  }
  assert.equal(upstreamCalls, before);
});

test('a scaled variant is generated once, cached immutably, and served as PNG', async () => {
  const before = upstreamCalls;
  const a = await call('?x=3');
  assert.equal(a.status, 200);
  assert.equal(a.headers.get('content-type'), 'image/png');
  assert.equal(a.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  const meta = await sharp(Buffer.from(await a.arrayBuffer())).metadata();
  assert.equal(meta.width, 9);
  assert.equal(meta.height, 6);
  const b = await call('?x=3');
  assert.equal(b.status, 200);
  assert.equal(upstreamCalls - before, 1, 'one origin fetch for the original, none for the repeat');
  // The original is served unscaled from the same cache.
  const plain = await sharp(Buffer.from(await (await call('')).arrayBuffer())).metadata();
  assert.equal(plain.width, 3);
});

// ── Item sprites: the same rules on /img/item/<id>.png ──

const callItem = async (id: string, q: string) => {
  const { GET: ITEM } = await import('../src/app/img/item/[id]/route.ts');
  return ITEM(new Request(`http://localhost/img/item/${id}${q}`), { params: Promise.resolve({ id }) });
};

test('item URLs and cache keys carry only a validated scale', async () => {
  const { itemAssetUrl } = await import('../src/lib/assetUrls.ts');
  assert.equal(itemAssetUrl(20997, 4), '/img/item/20997.png?x=4');
  assert.equal(itemAssetUrl(20997), '/img/item/20997.png');
  assert.equal(itemAssetUrl(20997, 6), '/img/item/20997.png');
  assert.equal(assetCacheKey({ kind: 'item', id: 20997 }), 'asset-cache/item/20997.png');
  assert.equal(assetCacheKey({ kind: 'item', id: 20997 }, 4), 'asset-cache/item-x4/20997.png');
});

test('the item route refuses a bad scale before touching the cache', async () => {
  const before = upstreamCalls;
  for (const q of ['?x=5', '?x=1', '?x=', '?x=3&x=3', '?x=nope']) assert.equal((await callItem('4151.png', q)).status, 400, q);
  assert.equal(upstreamCalls, before);
});

test('an item upscale is generated once, PNG, immutable', async () => {
  const before = upstreamCalls;
  const a = await callItem('4151.png', '?x=4');
  assert.equal(a.status, 200);
  assert.equal(a.headers.get('content-type'), 'image/png');
  assert.equal(a.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal((await sharp(Buffer.from(await a.arrayBuffer())).metadata()).width, 12);
  await callItem('4151.png', '?x=4');
  assert.equal(upstreamCalls - before, 1);
});

test('Discord thumbnails ask for the 4× sprite; big pictures and odd URLs pass through', async () => {
  const { scaledSpritePath } = await import('../src/lib/assetUrls.ts');
  const { discordAssetUrl } = await import('../src/lib/seo.ts');
  assert.equal(scaledSpritePath('/img/item/20997.png'), '/img/item/20997.png?x=4');
  assert.equal(scaledSpritePath('/img/wiki/Nex_icon.png'), '/img/wiki/Nex_icon.png?x=4');
  assert.equal(scaledSpritePath('/img/wiki/Slayer_icon.png'), '/img/wiki/Slayer_icon.png?x=4');
  assert.equal(scaledSpritePath('/img/wiki/thumb/Nex.png/320px-Nex.png'), '/img/wiki/thumb/Nex.png/320px-Nex.png');
  assert.equal(scaledSpritePath('/img/item/20997.png?x=2'), '/img/item/20997.png?x=2');
  assert.equal(scaledSpritePath('https://cdn.example/x.png'), 'https://cdn.example/x.png');
  assert.match(discordAssetUrl('/img/item/20997.png'), /^https?:\/\/[^/]+\/img\/item\/20997\.png\?x=4$/);

  const { buildPluginEmbed } = await import('../src/lib/pluginEmbeds.ts');
  const out = buildPluginEmbed('drop', { rsn: 'Zezima', source: 'Chambers of Xeric', items: [{ id: 20997, name: 'Twisted bow', qty: 1, value: 1_200_000_000 }] });
  assert.ok(out.ok);
  assert.match(out.ok ? out.embed.thumbnail?.url ?? '' : '', /\/img\/item\/20997\.png\?x=4$/);
});
