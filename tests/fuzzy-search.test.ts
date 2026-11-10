// Typo-tolerant picker search (lib/fuzzySearch) and the tile-creator searches wired to it.
//
// Run: npx tsx --test tests/fuzzy-search.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildSearchIndex, editDistance, fuzzySearch, searchIndex } from '../src/lib/fuzzySearch.ts';
import { expandShorthands, filterCatalog, browseCatalog, matchTasks } from '../src/lib/taskMatch.ts';
import { killPickHits } from '../src/lib/tileCreatorConfig.ts';

const ITEMS = [
  'Zenyte',
  'Zenyte shard',
  'Zenyte amulet',
  'Uncut zenyte',
  'Abyssal whip',
  'Abyssal dagger',
  'Abyssal bludgeon',
  'Whip',
  'Twisted bow',
  "Tumeken's shadow",
  'Dragon pickaxe',
  'Dragon dagger',
  'Bow string',
  'Zulrah scales',
  'Ship',
  'Shield left half',
].map((name, id) => ({ id, name }));
const itemName = (i: { name: string }) => i.name;
const names = (q: string, opts = {}) => fuzzySearch(ITEMS, q, itemName, { alternates: [expandShorthands(q)], ...opts }).map((i) => i.name);

test('editDistance counts a transposition as one edit and stops past max', () => {
  assert.equal(editDistance('znyte', 'zenyte'), 1);
  assert.equal(editDistance('zulrha', 'zulrah'), 1);
  assert.equal(editDistance('abcdefgh', 'zzzzzzzz', 2), 3);
});

test('znyte offers the Zenyte items', () => {
  const got = names('znyte');
  for (const n of ['Zenyte', 'Zenyte shard', 'Zenyte amulet', 'Uncut zenyte']) assert.ok(got.includes(n), `${n} in ${got}`);
  assert.equal(got[0], 'Zenyte');
  // A misspelt start still finds it while typing.
  assert.ok(names('znyt').includes('Zenyte shard'));
  assert.ok(names('zenyte shrd').includes('Zenyte shard'));
});

test('a typo next to a correct word is forgiven, even a short one', () => {
  assert.deepEqual(names('abyssal wip'), ['Abyssal whip']);
  assert.deepEqual(names('abysal whip'), ['Abyssal whip']);
  assert.deepEqual(names('tumekens shadw'), ["Tumeken's shadow"]);
});

test('zulra finds Zulrah, in items and in the monster picker', () => {
  assert.ok(names('zulra').includes('Zulrah scales')); // a prefix already
  assert.ok(names('zlurah').includes('Zulrah scales')); // transposition
  const monsters = ['Zulrah', 'Vorkath', 'Zalcano', 'Cow'];
  assert.deepEqual(fuzzySearch(monsters, 'zulra', (n) => n), ['Zulrah']);
  assert.deepEqual(fuzzySearch(monsters, 'zlurah', (n) => n), ['Zulrah']);
  assert.deepEqual(fuzzySearch(monsters, 'vorkth', (n) => n), ['Vorkath']);
});

test('short queries are never fuzzed', () => {
  assert.deepEqual(names('wip'), []);
  assert.deepEqual(names('zny'), []);
  assert.deepEqual(names('bw'), []);
  // …but still substring-match as before.
  assert.ok(names('bow').includes('Twisted bow'));
});

test('ranking: exact > prefix > word-start > substring > typo', () => {
  const index = buildSearchIndex(['Whip', 'Whipped cream', 'Abyssal whip', 'Bullwhip', 'Ship'], (n) => n);
  const hits = searchIndex(index, 'whip');
  assert.deepEqual(hits.map((h) => h.item), ['Whip', 'Whipped cream', 'Abyssal whip', 'Bullwhip', 'Ship']);
  assert.deepEqual(hits.map((h) => h.tier), [0, 1, 2, 4, 5]);
});

test('typos only fill room the plain matches leave', () => {
  const many = Array.from({ length: 30 }, (_, i) => `Zenyte thing ${i}`).concat(['Zenite']);
  assert.ok(!fuzzySearch(many, 'zenyte', (n) => n, { limit: 20 }).includes('Zenite'));
  assert.ok(fuzzySearch(many.slice(25), 'zenyte', (n) => n, { limit: 20 }).includes('Zenite'));
});

test('OSRS shorthand and filters ride along', () => {
  assert.equal(names('tbow')[0], 'Twisted bow');
  assert.equal(names('dpick')[0], 'Dragon pickaxe');
  assert.deepEqual(names('znyte', { filter: (i: { name: string }) => i.name !== 'Zenyte' })[0], 'Zenyte shard');
});

test('alphabetical tie-break, as the item route sorts within a tier', () => {
  assert.deepEqual(names('abyssal', { tieBreak: 'alpha' }), ['Abyssal bludgeon', 'Abyssal dagger', 'Abyssal whip']);
});

test('a few thousand names stay fast', () => {
  const big = Array.from({ length: 30000 }, (_, i) => `Item ${i} dragon ${['scimitar', 'longsword', 'platebody'][i % 3]} ${i % 97}`);
  const t = performance.now();
  fuzzySearch(big, 'dragn scimtar', (n) => n);
  fuzzySearch(big, 'qqqqqq zzzzz', (n) => n);
  assert.ok(performance.now() - t < 1500, `took ${performance.now() - t}ms`);
});

test('kill picker: typos find bosses, nicknames still work, picks drop out', () => {
  assert.equal(killPickHits('zulra', [], [])[0]?.label, 'Zulrah');
  assert.equal(killPickHits('vorkth', [], [])[0]?.label, 'Vorkath');
  assert.ok(killPickHits('herbiboar', [], []).some((h) => h.note === 'Plugin counter'));
  assert.ok(killPickHits('zulrah', ['Zulrah'], []).length >= 1);
  assert.ok(!killPickHits('zulrah', [], ['zulrah']).some((h) => h.label === 'Zulrah'));
  assert.ok(killPickHits('Cave krakn', ['Cave kraken'], []).some((h) => h.label === 'Cave kraken'));
});

test('browse filter is typo-tolerant', () => {
  const all = browseCatalog('bosses');
  const got = filterCatalog(all, 'vorkth');
  assert.ok(got.some((c) => /vorkath/i.test(c.title)), got.map((c) => c.title).join(', '));
});

test('free-text task box already corrects znyte against the item catalogue', () => {
  const ctx = { items: ITEMS };
  const got = matchTasks('znyte', ctx);
  assert.ok(got.some((c) => /zenyte/i.test(c.title)), got.map((c) => c.title).join(', '));
});
