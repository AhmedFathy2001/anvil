// The tile creator's matcher on collection-log tiles (lib/taskMatch clogTileCandidates): new slots
// from any page, a page, or hand-picked items, and finishing a page.
//
// Run: npx tsx --test tests/clog-tile-match.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { browseCatalog, classifyMatches, matchTasks } from '../src/lib/taskMatch.ts';
import { clogPages } from '../src/lib/itemObtain.ts';
import { clogPageItems } from '../src/lib/clogDataset.ts';

const ctx = { clogPages: clogPages() };
const top = (q: string) => matchTasks(q, ctx)[0];
const idOf = (page: string, name: string) => clogPageItems(page).find((i) => i.name === name)!.id;

test('"10 new clog slots" is an any-page slots tile', () => {
  const c = top('10 new clog slots');
  assert.equal(c.source, 'clogtile');
  assert.deepEqual(c.config, { tileType: 'clog', countMode: 'slots', targetNpcs: null, trackedItemIds: null, requiredAmount: 10 });
  assert.equal(c.title, '10 new collection log slots');
  assert.equal(classifyMatches(matchTasks('10 new collection log slots', ctx)).status, 'ready');
});

test('"3 new barrows clog slots" picks the Barrows Chests page and every item on it', () => {
  const c = top('3 new barrows clog slots');
  assert.equal(c.config.tileType, 'clog');
  assert.deepEqual(c.config.targetNpcs, ['Barrows Chests']);
  assert.equal(c.config.trackedItemIds?.length, clogPageItems('Barrows Chests').length);
  assert.equal(c.config.requiredAmount, 3);
});

test('"new clog slot from dwh, tyrannical ring or chaos ele pet" resolves to the three items', () => {
  const c = top('new clog slot from dwh, tyrannical ring or chaos ele pet');
  assert.equal(c.config.tileType, 'clog');
  const ids = new Set(c.config.trackedItemIds ?? []);
  assert.equal(ids.size, 3);
  const named = (c.titleOne ?? '').toLowerCase();
  assert.match(named, /dragon warhammer/);
  assert.match(named, /tyrannical ring/);
  assert.match(named, /pet chaos elemental/);
  assert.equal(c.config.requiredAmount, 1);
});

test('"complete the wintertodt clog page" is a whole-page tile', () => {
  const c = top('complete the wintertodt clog page');
  assert.equal(c.config.tileType, 'clog');
  assert.equal(c.config.countMode, 'complete');
  assert.deepEqual(c.config.targetNpcs, ['Wintertodt']);
  assert.ok(c.config.trackedItemIds?.includes(idOf('Wintertodt', 'Phoenix')));
  assert.equal(c.amountField, null);
});

test('plain item and boss tasks are not read as clog tiles', () => {
  assert.notEqual(top('any barrows item')?.source, 'clogtile');
  assert.notEqual(top('50 zulrah')?.source, 'clogtile');
});

test('the Collection log browse lists the any-page tile', () => {
  const list = browseCatalog('clog');
  assert.equal(list[0].config.tileType, 'clog');
  assert.equal(list[0].flow, 'clog');
});
