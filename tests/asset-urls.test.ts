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
    '/img/wiki/thumb/Abyssal_Sire_(phase_1).png/320px-Abyssal_Sire_(phase_1).png?0db8f',
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

  // A dataset URL keeps the wiki's cache-buster and its API spelling upstream — the edge-cached one.
  const sire = parseAssetPath('/img/wiki/thumb/Abyssal_Sire_(phase_1).png/320px-Abyssal_Sire_(phase_1).png?0db8f');
  assert.deepEqual(sire, {
    kind: 'wiki', file: 'thumb/Abyssal_Sire_(phase_1).png/320px-Abyssal_Sire_(phase_1).png', v: '0db8f',
  });
  assert.equal(
    upstreamUrl(sire!),
    'https://oldschool.runescape.wiki/images/thumb/Abyssal_Sire_%28phase_1%29.png/320px-Abyssal_Sire_%28phase_1%29.png?0db8f',
  );
  assert.equal(assetCacheKey(sire!), 'asset-cache/wiki/v-0db8f/thumb/Abyssal_Sire_~28phase_1~29.png/320px-Abyssal_Sire_~28phase_1~29.png');
  // Next hands a route `?0db8f` as `?0db8f=`; same ref.
  assert.deepEqual(parseAssetPath('/img/wiki/Stats_icon.png?0db8f='), { kind: 'wiki', file: 'Stats_icon.png', v: '0db8f' });
  // Only a short hex buster is forwarded; any other query is dropped.
  assert.deepEqual(parseAssetPath('/img/wiki/Stats_icon.png?url=https://evil.example'), { kind: 'wiki', file: 'Stats_icon.png' });

  assert.equal(parseAssetPath('/img/wiki/../secret.png'), null);
  assert.equal(parseAssetPath('/img/other/x.png'), null);
});

test('absoluteAssetUrl puts our paths on the apex and leaves everything else alone', () => {
  assert.equal(absoluteAssetUrl('/img/item/4151'), 'https://anvilosrs.com/img/item/4151');
  assert.equal(absoluteAssetUrl('https://cdn.example.com/x.png'), 'https://cdn.example.com/x.png');
  assert.equal(absoluteAssetUrl(null), null);
});
