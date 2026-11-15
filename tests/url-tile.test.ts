import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTileParam, tileUrlStep } from '../src/lib/urlTile';

test('parseTileParam: only positive whole numbers name a tile', () => {
  assert.equal(parseTileParam('49'), 49);
  assert.equal(parseTileParam(null), null);
  assert.equal(parseTileParam(''), null);
  assert.equal(parseTileParam('0'), null);
  assert.equal(parseTileParam('-3'), null);
  assert.equal(parseTileParam('1.5'), null);
  assert.equal(parseTileParam('abc'), null);
});

test('opening the first tile pushes one entry and keeps the clan prefix and other params', () => {
  assert.deepEqual(tileUrlStep('http://x/c/ironforge/events/8?cat=boss#board', 49, false), {
    kind: 'push',
    url: '/c/ironforge/events/8?cat=boss&tile=49#board',
  });
});

test('switching tile while one is open rewrites the entry instead of stacking history', () => {
  assert.deepEqual(tileUrlStep('http://x/events/8?tile=49', 54, true), { kind: 'replace', url: '/events/8?tile=54' });
});

test('closing a tile we pushed steps back; closing a deep-linked one clears the parameter', () => {
  assert.deepEqual(tileUrlStep('http://x/events/8?tile=49', null, true), { kind: 'back' });
  assert.deepEqual(tileUrlStep('http://x/events/8?tile=49&cat=boss', null, false), { kind: 'replace', url: '/events/8?cat=boss' });
});

test('the hook never hands Next its own history state back (that silences useSearchParams)', () => {
  const src = readFileSync(new URL('../src/hooks/useUrlTile.ts', import.meta.url), 'utf8');
  const calls = src.match(/history\.(pushState|replaceState)\([^)]*\)/g) ?? [];
  assert.equal(calls.length, 2);
  for (const call of calls) assert.match(call, /\(null,/);
});
