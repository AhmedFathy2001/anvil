// Finding a collection log page by boss name and nickname, not only by the page's own name
// (lib/clogPageSearch). The cases worth pinning are the pages the game names after a PLACE.
//
// Run: npx tsx --test tests/clog-page-search.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveClogPage, searchClogPages } from '../src/lib/clogPageSearch.ts';

test('pages named for the place are found by the boss and its nicknames', () => {
  for (const q of ['zuk', 'TzKal-Zuk', 'tzkal', 'inferno']) assert.equal(resolveClogPage(q), 'The Inferno', q);
  for (const q of ['jad', 'TzTok-Jad', 'fight caves']) assert.equal(resolveClogPage(q), 'The Fight Caves', q);
  for (const q of ['sol', 'sol heredit', 'colo']) assert.equal(resolveClogPage(q), 'Fortis Colosseum', q);
  assert.equal(resolveClogPage('phosani'), 'The Nightmare');
  assert.equal(resolveClogPage('cg'), 'The Gauntlet');
  assert.equal(resolveClogPage('rex'), 'Dagannoth Kings');
});

test('the match says which boss found it, and not when the page name itself did', () => {
  assert.deepEqual(searchClogPages('zuk', 1), [{ page: 'The Inferno', via: 'TzKal-Zuk' }]);
  assert.deepEqual(searchClogPages('inferno', 1), [{ page: 'The Inferno', via: null }]);
  assert.deepEqual(searchClogPages('Vorkath', 1), [{ page: 'Vorkath', via: null }]);
});

test('ordinary page searches still work, and nonsense finds nothing', () => {
  assert.equal(resolveClogPage('barrows'), 'Barrows Chests');
  assert.equal(resolveClogPage('elite treasure'), 'Elite Treasure Trails');
  assert.equal(resolveClogPage('zzqx'), null);
  assert.equal(searchClogPages('', 5).length, 5);
});

test('a BOTW on a boss whose page is named for the place still finds its uniques (lib/moments)', async () => {
  const { bossClogPage } = await import('../src/lib/moments.ts');
  assert.equal(bossClogPage('tzKalZuk'), 'The Inferno');
  assert.equal(bossClogPage('tzTokJad'), 'The Fight Caves');
  assert.equal(bossClogPage('solHeredit'), 'Fortis Colosseum');
  assert.equal(bossClogPage('chambersOfXericChallengeMode'), 'Chambers of Xeric');
  assert.equal(bossClogPage('vorkath'), 'Vorkath');
});
