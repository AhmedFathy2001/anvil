import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assetCacheKey,
  itemAssetUrl,
  normalizeWikiFile,
  parseAssetPath,
  parseItemId,
  proxyWikiUrl,
  upstreamUrl,
  wikiBusterFor,
  wikiImageUrl,
} from '../src/lib/assetUrls.ts';
import { absoluteAssetUrl } from '../src/lib/seo.ts';

// The /img routes are a fixed two-upstream cache, not a proxy: these checks are the whole allowlist.

test('wiki files: plain, thumbnail, parens, apostrophes, spaces and %-encoding normalise alike', () => {
  assert.equal(normalizeWikiFile('Stats_icon.png'), 'Stats_icon.png');
  assert.equal(normalizeWikiFile('Skull_(status)_icon.png'), 'Skull_(status)_icon.png');
  assert.equal(normalizeWikiFile('Skull_%28status%29_icon.png'), 'Skull_(status)_icon.png');
  assert.equal(normalizeWikiFile('Abyssal whip.png'), 'Abyssal_whip.png');
  assert.equal(
    normalizeWikiFile('thumb/Cormorant%27s_glove_equipped.png/320px-Cormorant%27s_glove_equipped.png?c52ae'),
    "thumb/Cormorant's_glove_equipped.png/320px-Cormorant's_glove_equipped.png",
  );
});

test('wiki files: traversal, odd shapes, non-raster types and junk are refused', () => {
  for (const bad of [
    '', '..', '../x.png', 'a/../b.png', '%2e%2e/x.png', 'x.png/..', 'dir/x.png', 'thumb/x.png',
    'a/b/c/d.png', 'x.svg', 'x.html', 'x', 'x.png%2F..', 'x%00.png', 'x\\y.png', '%E0%A4%A.png',
    `${'a'.repeat(300)}.png`,
  ]) {
    assert.equal(normalizeWikiFile(bad), null, bad);
  }
});

test('wikiImageUrl / proxyWikiUrl point at our route; other URLs pass through', () => {
  assert.equal(wikiImageUrl('Stats_icon.png'), '/img/wiki/Stats_icon.png');
  assert.equal(wikiImageUrl('Skull_(status)_icon.png'), '/img/wiki/Skull_(status)_icon.png');
  assert.equal(
    proxyWikiUrl('https://oldschool.runescape.wiki/images/thumb/Abyssal_Sire_%28phase_1%29.png/320px-Abyssal_Sire_%28phase_1%29.png?0db8f'),
    '/img/wiki/thumb/Abyssal_Sire_(phase_1).png/320px-Abyssal_Sire_(phase_1).png',
  );
  assert.equal(proxyWikiUrl('https://static.runelite.net/cache/item/icon/4151.png'), '/img/item/4151');
  assert.equal(proxyWikiUrl('https://media.example.com/a.png'), 'https://media.example.com/a.png');
  assert.equal(proxyWikiUrl(null), null);
});

test('item ids: positive integers only', () => {
  assert.equal(parseItemId('4151'), 4151);
  assert.equal(parseItemId('4151.png'), 4151);
  for (const bad of ['', '0', '-1', '1.5', '1e3', 'abc', '4151.gif', '1234567', '0x10', ' 1']) {
    assert.equal(parseItemId(bad), null, bad);
  }
  assert.equal(itemAssetUrl(4151), '/img/item/4151');
});

test('paths round-trip to refs, upstream URLs and storage keys', () => {
  const wiki = parseAssetPath('/img/wiki/Skull_(status)_icon.png');
  assert.deepEqual(wiki, { kind: 'wiki', file: 'Skull_(status)_icon.png' });
  assert.equal(upstreamUrl(wiki!), 'https://oldschool.runescape.wiki/images/Skull_(status)_icon.png');
  assert.equal(assetCacheKey(wiki!), 'asset-cache/wiki/Skull_~28status~29_icon.png');

  const item = parseAssetPath('/img/item/4151');
  assert.deepEqual(item, { kind: 'item', id: 4151 });
  assert.equal(upstreamUrl(item!), 'https://static.runelite.net/cache/item/icon/4151.png');
  assert.equal(assetCacheKey(item!), 'asset-cache/item/4151.png');

  const thumb = parseAssetPath("/img/wiki/thumb/Cormorant's_glove.png/320px-Cormorant's_glove.png");
  assert.equal(assetCacheKey(thumb!), 'asset-cache/wiki/thumb/Cormorant~27s_glove.png/320px-Cormorant~27s_glove.png');
  // `~` is escaped too, so two different names can never share a key.
  assert.notEqual(
    assetCacheKey({ kind: 'wiki', file: 'a~28.png' }),
    assetCacheKey({ kind: 'wiki', file: 'a(.png' }),
  );

  assert.equal(parseAssetPath('/img/wiki/../secret.png'), null);
  assert.equal(parseAssetPath('/img/other/x.png'), null);
});

test('absoluteAssetUrl puts our paths on the apex and leaves everything else alone', () => {
  assert.equal(absoluteAssetUrl('/img/item/4151'), 'https://anvilosrs.com/img/item/4151');
  assert.equal(absoluteAssetUrl('https://cdn.example.com/x.png'), 'https://cdn.example.com/x.png');
  assert.equal(absoluteAssetUrl(null), null);
});

test('cache-buster: a request query is ignored; the buster comes from our dataset', () => {
  const sire = 'thumb/Abyssal_Sire_(phase_1).png/320px-Abyssal_Sire_(phase_1).png';
  // Whatever the client appends, the ref (and so the key and the upstream URL) is the same.
  for (const q of ['', '?0db8f', '?0db8f=', '?deadbeef', '?abc123=', '?url=https://evil.example']) {
    assert.deepEqual(parseAssetPath(`/img/wiki/${sire}${q}`), { kind: 'wiki', file: sire }, q);
  }
  assert.equal(wikiBusterFor(sire), '0db8f');
  // A dataset file is fetched the way the wiki's API spells it, buster included — derived server-side.
  assert.equal(
    upstreamUrl({ kind: 'wiki', file: sire }),
    'https://oldschool.runescape.wiki/images/thumb/Abyssal_Sire_%28phase_1%29.png/320px-Abyssal_Sire_%28phase_1%29.png?0db8f',
  );
  // An unknown file gets the plain spelling and no buster, whatever the request carried.
  assert.equal(wikiBusterFor('Stats_icon.png'), null);
  const stats = parseAssetPath('/img/wiki/Stats_icon.png?0db8f')!;
  assert.equal(upstreamUrl(stats), 'https://oldschool.runescape.wiki/images/Stats_icon.png');
  // Our own URLs never carry a buster either.
  assert.equal(wikiImageUrl('Stats_icon.png?0db8f'), '/img/wiki/Stats_icon.png');
});

test('storage keys never contain a version segment', () => {
  const sire = 'thumb/Abyssal_Sire_(phase_1).png/320px-Abyssal_Sire_(phase_1).png';
  const a = assetCacheKey(parseAssetPath(`/img/wiki/${sire}?0db8f`)!);
  const b = assetCacheKey(parseAssetPath(`/img/wiki/${sire}?ffff`)!);
  assert.equal(a, b);
  assert.equal(a, 'asset-cache/wiki/thumb/Abyssal_Sire_~28phase_1~29.png/320px-Abyssal_Sire_~28phase_1~29.png');
  assert.doesNotMatch(a, /v-|\?|0db8f/);
});

test('thumbnails: only thumb/<file>/<allowlisted N>px-<same file>', () => {
  assert.equal(normalizeWikiFile('thumb/Zulrah.png/320px-Zulrah.png'), 'thumb/Zulrah.png/320px-Zulrah.png');
  for (const bad of [
    'thumb/Zulrah.png/321px-Zulrah.png',      // width not emitted by the app
    'thumb/Zulrah.png/32px-Zulrah.png',
    'thumb/Zulrah.png/1000px-Zulrah.png',
    'thumb/Zulrah.png/320px-Vorkath.png',     // different file
    'thumb/Zulrah.png/Zulrah.png',            // no width
    'thumb/Zulrah.png/320px-Zulrah.png.png',
    'thumb/Zulrah.png/0320px-Zulrah.png',
    'thumbs/Zulrah.png/320px-Zulrah.png',
    'thumb/Zulrah.png/320px-Zulrah.png/x.png',
  ]) {
    assert.equal(normalizeWikiFile(bad), null, bad);
    assert.equal(parseAssetPath(`/img/wiki/${bad}`), null, bad);
  }
});
