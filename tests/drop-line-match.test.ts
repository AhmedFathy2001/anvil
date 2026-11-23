// The tile creator's drop lines (lib/taskMatch dropLineCandidates): a page's uniques without its
// minor slots (lib/clogMinor), "different" pools, sets, one per slot, one from each boss — and a
// line that names drops is never quietly a kill count.
//
// Run: npx tsx --test tests/drop-line-match.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyMatches, matchTasks, type MatchContext } from '../src/lib/taskMatch.ts';
import { clogPages } from '../src/lib/itemObtain.ts';
import { rowToTileConfig } from '../src/lib/taskSuggestRows.ts';
import { clogTickIds, clogTickState } from '../src/lib/clogTickState.ts';
import { clogMinorIds } from '../src/lib/clogMinor.ts';
import seed from '../src/data/tileLibrarySeed.json';

// What lib/taskSuggest contextFor hands the matcher, less the network item mapping: the log's own
// items stand in for it, and the starter library is the seed.
const pages = clogPages();
const items = new Map<string, { id: number; name: string }>();
for (const p of pages) for (const it of p.items) if (!items.has(it.name.toLowerCase())) items.set(it.name.toLowerCase(), { id: it.id, name: it.name });
const library: NonNullable<MatchContext['library']> = [];
for (const t of (seed as { tasks: { key: string; label: string; category: string | null; points: number | null; config: Record<string, unknown> }[] }).tasks) {
  const config = rowToTileConfig(t.config as never, items as never);
  if (config) library.push({ key: `anvil-${t.key}`, label: t.label, category: t.category, points: t.points, config });
}
const ctx: MatchContext = { clogPages: pages, items: [...items.values()], library };
const top = (q: string) => matchTasks(q, ctx)[0];
const page = (name: string) => pages.find((p) => p.name === name)!;
const idOf = (name: string) => [...items.values()].find((i) => i.name === name)!.id;

test('a page names its minor slots, and only boss and raid pages have them', () => {
  assert.ok(clogMinorIds('Barrows Chests').has(idOf('Bolt rack')));
  assert.ok(clogMinorIds('Tombs of Amascut').has(idOf('Jewel of the sun')));
  // Common for their boss, but its unique all the same.
  for (const [page, item] of [['Skotizo', 'Dark claw'], ['The Hueycoatl', 'Hueycoatl hide'], ['Sarachnis', 'Giant egg sac(full)'], ['Brutus', 'Bottomless milk bucket (empty)']]) {
    assert.ok(!clogMinorIds(page).has(idOf(item)), item);
  }
  assert.ok(!clogMinorIds('Tombs of Amascut').has(idOf("Tumeken's guardian")));
  assert.ok(!clogMinorIds('Tombs of Amascut').has(idOf('Osmumten\'s fang')));
  assert.equal(clogMinorIds('Wintertodt').size, 0);
});

test('"4 different barrows pieces" is a distinct pool of the 24 pieces, no bolt racks', () => {
  for (const q of ['4 different barrows pieces', '4 barrows items no dupes']) {
    const c = top(q);
    assert.equal(c.config.tileType, 'drop', q);
    assert.equal(c.config.requiredAmount, 4, q);
    assert.equal(c.config.countMode, 'distinct', q);
    assert.equal(c.config.trackedItemIds!.length, 24, q);
    assert.ok(!c.config.trackedItemIds!.includes(idOf('Bolt rack')), q);
    assert.equal(classifyMatches(matchTasks(q, ctx)).status, 'ready', q);
  }
});

test('"3 different toa uniques" leaves the jewels, shrouds and kits out', () => {
  const c = top('3 different toa uniques');
  assert.equal(c.config.countMode, 'distinct');
  assert.equal(c.config.requiredAmount, 3);
  const ids = new Set(c.config.trackedItemIds);
  assert.ok(ids.has(idOf("Tumeken's shadow (uncharged)")));
  assert.ok(ids.has(idOf("Tumeken's guardian")));
  assert.ok(!ids.has(idOf('Jewel of the sun')));
  assert.ok(!ids.has(idOf('Masori crafting kit')));
});

test('"toa unique", "any toa purple", "vorkath unique" are one-drop pools over the uniques', () => {
  for (const [q, p] of [['toa unique', 'Tombs of Amascut'], ['any toa purple', 'Tombs of Amascut'], ['vorkath unique', 'Vorkath']] as const) {
    const c = top(q);
    assert.equal(c.config.tileType, 'drop', q);
    assert.equal(c.config.requiredAmount, 1, q);
    assert.equal(c.config.countMode ?? null, null, q);
    assert.deepEqual([...c.config.trackedItemIds!].sort(), page(p).items.filter((i) => !i.minor).map((i) => i.id).sort(), q);
  }
});

test('"dharok set" is the four Dharok pieces; "2 barrows sets" is any two full sets', () => {
  const d = top('dharok set');
  assert.equal(d.config.itemRequirements!.length, 4);
  assert.ok(d.config.itemRequirements!.every((r) => r.name.startsWith("Dharok's")));
  const two = top('2 barrows sets');
  assert.equal(two.config.itemRequirements!.length, 24);
  assert.equal(new Set(two.config.itemRequirements!.map((r) => r.group)).size, 6);
  assert.equal(two.config.setsRequired, 2);
  assert.equal(two.config.groupMode ?? null, null);
});

test('one of each barrows slot: helm, top, bottom and weapon, every set, needs 1', () => {
  for (const q of ['one of each barrows slot', '1 barrows helm, 1 top, 1 legs and 1 weapon']) {
    const c = top(q);
    const reqs = c.config.itemRequirements!;
    assert.equal(c.config.groupMode, 'all', q);
    assert.deepEqual([...new Set(reqs.map((r) => r.group))], ['Helm', 'Top', 'Bottom', 'Weapon'], q);
    assert.ok(reqs.every((r) => r.groupRequire === 1), q);
    for (const g of ['Helm', 'Top', 'Bottom', 'Weapon']) assert.equal(reqs.filter((r) => r.group === g).length, 6, `${q} ${g}`);
    assert.ok(reqs.some((r) => r.group === 'Top' && r.name === "Verac's brassard"));
    assert.ok(reqs.some((r) => r.group === 'Bottom' && r.name === "Guthan's chainskirt"));
  }
});

test('"a unique from each dt2 boss" is one group per boss, every set, needs 1', () => {
  const c = top('a unique from each dt2 boss');
  const reqs = c.config.itemRequirements!;
  assert.equal(c.config.groupMode, 'all');
  assert.equal(new Set(reqs.map((r) => r.group)).size, 4);
  assert.ok(reqs.every((r) => r.groupRequire === 1));
  assert.ok(!reqs.some((r) => r.name === "Awakener's orb" || / tablet$/.test(r.name)));
});

test('"<boss> pet" is just that boss’s pet, not its whole page', () => {
  for (const [q, pet] of [['zulrah pet', 'Pet snakeling'], ['pet from vorkath', 'Vorki'], ['vorkath pet', 'Vorki']] as const) {
    const c = top(q);
    assert.equal(c.config.tileType, 'drop', q);
    assert.deepEqual(c.config.trackedItemIds, [idOf(pet)], q);
  }
  const gwd = top('any pet from gwd');
  assert.equal(gwd.config.trackedItemIds!.length, 4);
  const each = top('a pet from each gwd boss');
  assert.equal(each.config.groupMode, 'all');
  assert.equal(new Set(each.config.itemRequirements!.map((r) => r.group)).size, 4);
});

test('a drop line it cannot read is never a confident kill count', () => {
  const found = matchTasks('3 zulrah purples from the blue phase', ctx);
  const best = found[0];
  if (best) assert.ok(!(best.confident && best.config.tileType === 'kill'));
  // A plain kill line still is one.
  assert.equal(classifyMatches(matchTasks('50 vorkath kills', ctx)).status, 'ready');
});

test('an unread drop line gets a "try:" line; a read one or a kill line gets none', async () => {
  const { dropLineHelp } = await import('../src/lib/taskMatch.ts');
  assert.match(dropLineHelp('3 purples from the blue phase', ctx) ?? '', /Name the boss or raid/);
  assert.equal(dropLineHelp('toa unique', ctx), null);
  assert.equal(dropLineHelp('50 vorkath kills', ctx), null);
});

test('clog log-slot lines still go to the collection-log tile', () => {
  assert.equal(top('3 new barrows clog slots').config.tileType, 'clog');
});

test('a slot tile keeps its sets when bulk-added (draftToCsvRow)', async () => {
  const { draftToCsvRow } = await import('../src/lib/tileCreatorConfig.ts');
  const c = top('one of each barrows slot');
  const row = draftToCsvRow({ label: c.title, config: c.config, points: 10, trackingMode: 'team' });
  assert.equal(row.groupMode, 'all');
  assert.equal(row.items!.length, 24);
  assert.ok(row.items!.every((i) => i.group && i.groupRequire === 1));
  const sets = draftToCsvRow({ label: 'x', config: top('2 barrows sets').config, points: 10, trackingMode: 'team' });
  assert.equal(sets.setsRequired, 2);
  const pool = draftToCsvRow({ label: 'x', config: top('4 different barrows pieces').config, points: 10, trackingMode: 'team' });
  assert.equal(pool.countMode, 'distinct');
  assert.equal(pool.requiredAmount, 4);
});

test('the "Uniques only" switch: state off the ticks', () => {
  const its = [{ id: 1 }, { id: 2 }, { id: 3, minor: true }];
  assert.equal(clogTickState(its, new Set([1, 2])), 'uniques');
  assert.equal(clogTickState(its, new Set([1, 2, 3])), 'all');
  assert.equal(clogTickState(its, new Set([1])), 'custom');
  assert.deepEqual(clogTickIds(its, true), [1, 2]);
  assert.deepEqual(clogTickIds(its, false), [1, 2, 3]);
  // A page with no minor slots is never "uniques only".
  assert.equal(clogTickState([{ id: 1 }], new Set([1])), 'all');
});
