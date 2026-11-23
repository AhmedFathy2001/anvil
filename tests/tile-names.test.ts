// New tile names read like a person wrote them (lib/tileNames, and every caller: the matcher's
// drop lines, clog tiles, the creator's item step). Never "Any of …" or "Any N of M items".
//
// Run: npx tsx --test tests/tile-names.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { itemPoolTitle } from '../src/lib/tileNames.ts';
import { clogTileTitle } from '../src/lib/clogTileWords.ts';
import { matchTasks } from '../src/lib/taskMatch.ts';
import { clogPages } from '../src/lib/itemObtain.ts';

const pages = clogPages();
const pagesById = new Map<number, string[]>();
for (const p of pages) for (const it of p.items) pagesById.set(it.id, [...(pagesById.get(it.id) ?? []), p.name]);
const petIds = new Set(pages.find((p) => p.name === 'All Pets')!.items.map((i) => i.id));
const byName = new Map<string, { id: number; name: string }>();
for (const p of pages) for (const it of p.items) if (!byName.has(it.name)) byName.set(it.name, { id: it.id, name: it.name });
const it = (...names: string[]) => names.map((n) => byName.get(n) ?? { id: -names.indexOf(n) - 1, name: n });
const page = (name: string, uniquesOnly = true) => pages.find((p) => p.name === name)!.items.filter((i) => !uniquesOnly || !i.minor);
const name = (items: { id: number; name: string }[], need: 'any' | 'each', amount = 1, distinct = false) =>
  itemPoolTitle({ items, need, amount, distinct, pagesOf: (id) => pagesById.get(id), petIds });

test('item pools are named by what they share', () => {
  const cases: [string, string][] = [
    [name(it('Zenyte shard'), 'any'), 'Zenyte shard'],
    [name(it('Zenyte shard'), 'any', 3), '3 × Zenyte shard'],
    [name(it('Twisted bow', 'Scythe of vitur'), 'any'), 'Tbow or Scythe'],
    [name(it('Twisted bow', 'Scythe of vitur', "Tumeken's shadow (uncharged)"), 'any', 2, true), '2 different: Tbow, Scythe or Shadow'],
    [name(page('Tombs of Amascut'), 'any'), 'ToA unique'],
    [name(page('Tombs of Amascut'), 'any', 3, true), '3 different ToA uniques'],
    [name(page('Barrows Chests'), 'any', 4, true), '4 different Barrows pieces'],
    [name(page('Barrows Chests'), 'each'), 'Every Barrows piece'],
    [name(it("Dharok's helm", "Dharok's greataxe", "Dharok's platebody", "Dharok's platelegs"), 'each'), "Dharok's set"],
    [name(it('Bandos hilt', 'Armadyl hilt', 'Saradomin hilt', 'Zamorak hilt'), 'any'), 'GWD hilt'],
    [name(it('Bandos hilt', 'Armadyl hilt', 'Saradomin hilt', 'Zamorak hilt'), 'any', 2, true), '2 different GWD hilts'],
  ];
  for (const [got, want] of cases) assert.equal(got, want);
});

test('quick-add drop lines name the tile the same way', () => {
  const ctx = { clogPages: pages };
  const cases: [string, string][] = [
    ['toa unique', 'ToA unique'],
    ['3 different toa uniques', '3 different ToA uniques'],
    ['4 different barrows pieces', '4 different Barrows pieces'],
    ['zulrah pet', 'Zulrah pet'],
    ['vorkath unique', 'Vorkath unique'],
    ['dharok set', "Dharok's set"],
    ['2 barrows sets', '2 Barrows sets'],
    ['one of each barrows slot', 'Barrows helm, body, legs & weapon'],
    ['a unique from each dt2 boss', 'A unique from each DT2 boss'],
    ['5 new barrows clog slots', '5 new Barrows log slots'],
    ['complete the barrows clog', 'Finish the Barrows log'],
  ];
  for (const [q, want] of cases) assert.equal(matchTasks(q, ctx)[0]?.title, want, q);
});

test('clog tiles', () => {
  assert.equal(clogTileTitle({ mode: 'slots', pages: ['Barrows Chests'], itemIds: [], required: 5 }), '5 new Barrows log slots');
  assert.equal(clogTileTitle({ mode: 'complete', pages: ['Barrows Chests'], itemIds: [], required: 1 }), 'Finish the Barrows log');
  assert.equal(clogTileTitle({ mode: 'complete', pages: ['Zulrah', 'Vorkath'], itemIds: [], required: 2 }), 'Finish the Zulrah & Vorkath logs');
  assert.equal(clogTileTitle({ mode: 'slots', pages: [], itemIds: [1, 2, 3], required: 2 }, ['Dragon warhammer', 'Tyrannical ring', 'Pet chaos elemental']), '2 new log slots from DWH, Tyrannical ring or Pet chaos elemental');
});

test('never "Any of …" or "Any N of M items"', () => {
  const ctx = { clogPages: pages };
  const lines = ['toa unique', 'any barrows item', 'any toa purple', 'zulrah pet', 'any pet from gwd', 'any GOTR rare reward', '3 new barrows clog slots'];
  for (const q of lines) {
    const t = matchTasks(q, ctx)[0]?.title ?? '';
    assert.ok(!/^Any of\b/i.test(t) && !/\bAny \d+ of \d+/i.test(t), `${q} → ${t}`);
  }
});
