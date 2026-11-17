// Item hunt rules (lib/itemHunt): which report counts, when two reports are one drop, and how the
// standings rank under each rule.
//
// Run: TESTS_OK=1 npx tsx --test tests/item-hunt.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  type DropSighting,
  type HuntConfig,
  type HuntDrop,
  bossKeyForSource,
  countedDrops,
  dropOriginWords,
  dropStatWords,
  endOnFirstAt,
  huntFromInput,
  huntStat,
  huntTargetsLabel,
  huntTitleLine,
  isSameDrop,
  killsOfForItems,
  manualSourceAllowed,
  matchHuntReport,
  mergeSighting,
  parseHunt,
  rankHunt,
  serializeHunt,
} from '@/lib/itemHunt';
import { competitionStat } from '@/lib/weeklyMetric';

const ONYX = 6571;
const base = (over: Partial<HuntConfig> = {}): HuntConfig => ({
  v: 1,
  target: 'items',
  items: [{ id: ONYX, name: 'Uncut onyx', sources: ['Zulrah'], count: 'drops' }],
  petGroup: null,
  rule: 'most',
  endOnFirst: false,
  killsOf: 'zulrah',
  xpSkill: null,
  ...over,
});
const anySource = (over: Partial<HuntConfig> = {}) => base({ items: [{ id: ONYX, name: 'Uncut onyx', sources: [], count: 'drops' }], killsOf: null, ...over });
const pets = (group = 'all', over: Partial<HuntConfig> = {}) => base({ target: 'pets', items: [], petGroup: group, rule: 'first', killsOf: null, ...over });

const START = Date.parse('2026-11-10T00:00:00Z');
const END = Date.parse('2026-11-17T00:00:00Z');
const window = { startMs: START, endMs: END };
const at = (h: number) => new Date(START + h * 3_600_000).toISOString();

let nextId = 1;
const drop = (rsn: string, hours: number, over: Partial<HuntDrop> = {}): HuntDrop => ({
  id: nextId++,
  rsnKey: rsn.toLowerCase(),
  itemId: ONYX,
  itemName: 'Uncut onyx',
  quantity: 1,
  source: 'Zulrah',
  kc: null,
  xp: null,
  statSkill: null,
  statBasis: null,
  occurredAt: at(hours),
  origin: 'plugin',
  status: 'counted',
  approvedBy: null,
  screenshotUrl: null,
  note: null,
  ...over,
});
const entrants = (...names: (string | [string, number])[]) =>
  names.map((n) => (typeof n === 'string' ? { rsn: n, statGain: 0 } : { rsn: n[0], statGain: n[1] }));
const report = (over: Record<string, unknown> = {}) => ({ kind: 'drop', itemId: ONYX, itemName: 'Uncut onyx', quantity: 1, source: 'Zulrah', kc: 400, occurredAt: at(1), dedupKey: 'drop|zulrah|6571|1', ...over });

// ── The create form ──────────────────────────────────────────────────────────────────────────

test('the form has to say where an item counts from', () => {
  const noChoice = huntFromInput({ target: 'items', rule: 'most', items: [{ id: ONYX, name: 'Uncut onyx', sources: [] }] });
  assert.equal(noChoice.ok, false);
  const any = huntFromInput({ target: 'items', rule: 'most', items: [{ id: ONYX, name: 'Uncut onyx', sources: [], anySource: true }] });
  assert.equal(any.ok, true);
  const picked = huntFromInput({ target: 'items', rule: 'first', endOnFirst: true, items: [{ id: ONYX, name: 'Uncut onyx', sources: ['Zulrah', 'zulrah ', 'Sol Heredit'] }] });
  assert.ok(picked.ok);
  assert.deepEqual(picked.config.items[0].sources, ['Zulrah', 'Sol Heredit']);
  assert.equal(picked.config.endOnFirst, true);
});

test('"end when the first one lands" only exists under "first to get it"', () => {
  const r = huntFromInput({ target: 'pets', petGroup: 'all', rule: 'most', endOnFirst: true });
  assert.ok(r.ok);
  assert.equal(r.config.endOnFirst, false);
});

test('a hunt needs a rule, a target and a known pet group', () => {
  assert.equal(huntFromInput({ target: 'items', items: [] , rule: 'most' }).ok, false);
  assert.equal(huntFromInput({ target: 'pets', petGroup: 'nope', rule: 'first' }).ok, false);
  assert.equal(huntFromInput({ target: 'pets', petGroup: 'all' }).ok, false);
});

test('the stored rules read back as they were written', () => {
  const cfg = base({ plannedEnd: '2026-11-17T00:00:00.000Z' });
  assert.deepEqual(parseHunt(serializeHunt(cfg)), cfg);
  assert.equal(parseHunt('not json'), null);
  assert.equal(parseHunt(null), null);
});

// ── Words ────────────────────────────────────────────────────────────────────────────────────

test('the title line names the item, its source and the rule', () => {
  assert.equal(huntTitleLine(base(), ''), 'Item hunt: Uncut onyx from Zulrah · most by the end');
  assert.equal(huntTitleLine(anySource({ rule: 'first' }), ''), 'Item hunt: Uncut onyx, any source · first to get it');
  assert.equal(huntTitleLine(pets('all', { rule: 'most' }), ''), 'Pet hunt: Any pet · most by the end');
  assert.equal(huntTargetsLabel(pets('skilling')), 'Skilling pets');
  const two = base({ items: [
    { id: 1, name: 'Tanzanite fang', sources: ['Zulrah'], count: 'drops' },
    { id: 2, name: 'Magic fang', sources: ['Zulrah'], count: 'drops' },
  ] });
  assert.equal(huntTargetsLabel(two), 'Tanzanite fang + Magic fang from Zulrah');
});

test('kills at the source: only when every chosen source is a hiscores boss', () => {
  assert.equal(bossKeyForSource('Zulrah'), 'zulrah');
  assert.equal(bossKeyForSource('Chambers of Xeric'), 'chambersOfXeric,chambersOfXericChallengeMode');
  assert.equal(bossKeyForSource('Abyssal demon'), null);
  assert.equal(killsOfForItems([{ id: 1, name: 'x', sources: ['Zulrah', 'Vorkath'], count: 'drops' }]), 'zulrah,vorkath');
  assert.equal(killsOfForItems([{ id: 1, name: 'x', sources: ['Zulrah', 'Abyssal demon'], count: 'drops' }]), null);
  assert.equal(killsOfForItems([{ id: 1, name: 'x', sources: [], count: 'drops' }]), null);
});

test('a hunt carries the stat it shows beside its drops, or none', () => {
  assert.deepEqual(huntStat(base()), { type: 'boss', metric: 'zulrah' });
  assert.deepEqual(huntStat(pets('skilling', { xpSkill: 'woodcutting' })), { type: 'skill', metric: 'woodcutting' });
  assert.equal(huntStat(pets()), null);
  assert.deepEqual(competitionStat({ type: 'hunt', metric: 'Uncut onyx from Zulrah', hunt: serializeHunt(base()) }), { type: 'boss', metric: 'zulrah' });
  assert.equal(competitionStat({ type: 'hunt', metric: 'Any pet', hunt: serializeHunt(pets()) }), null);
  assert.deepEqual(competitionStat({ type: 'boss', metric: 'zulrah' }), { type: 'boss', metric: 'zulrah' });
});

// ── Which report counts ──────────────────────────────────────────────────────────────────────

test('the same item counts from an allowed source and not from another', () => {
  assert.ok(matchHuntReport(base(), report()));
  assert.equal(matchHuntReport(base(), report({ source: 'Sol Heredit' })), null);
});

test('"any source" counts both, and a report with no source', () => {
  assert.ok(matchHuntReport(anySource(), report()));
  assert.ok(matchHuntReport(anySource(), report({ source: 'Sol Heredit' })));
  assert.ok(matchHuntReport(anySource(), report({ source: null })));
});

test('a report with no source never counts for a restricted item', () => {
  assert.equal(matchHuntReport(base(), report({ source: null })), null);
  assert.equal(matchHuntReport(base(), report({ kind: 'clog', itemId: null, source: null })), null);
});

test('variant NPC names match the way they do for drop tiles', () => {
  // The tile matcher (lib/pluginFacts/match sourceMatches): case-insensitive, and a wiki qualifier
  // on the configured name answers to the in-game name the plugin reports.
  const cfg = base({ items: [{ id: ONYX, name: 'Uncut onyx', sources: ["Armoured zombie (Zemouregal's Fort)"], count: 'drops' }], killsOf: null });
  assert.ok(matchHuntReport(cfg, report({ source: 'Armoured zombie' })));
  assert.ok(matchHuntReport(cfg, report({ source: 'ARMOURED ZOMBIE' })));
  assert.equal(matchHuntReport(cfg, report({ source: 'Zombie' })), null);
});

test('an item is matched by id, or by name when the report has only a name', () => {
  assert.ok(matchHuntReport(anySource(), report({ kind: 'clog', itemId: null, itemName: 'uncut onyx', source: null })));
  assert.equal(matchHuntReport(anySource(), report({ itemId: 4151, itemName: 'Abyssal whip' })), null);
  assert.equal(matchHuntReport(anySource(), report({ kind: 'death' })), null);
});

test('quantity is carried; pets are always one', () => {
  assert.equal(matchHuntReport(anySource(), report({ quantity: 3 }))?.quantity, 3);
  assert.equal(matchHuntReport(pets(), { kind: 'pet', itemId: 12921, itemName: 'Pet snakeling', quantity: 5, source: 'Zulrah', occurredAt: at(1), dedupKey: 'k' })?.quantity, 1);
});

test('any pet takes every pet, named or not; a group takes its own', () => {
  const unnamed = { kind: 'pet', itemId: null, itemName: null, source: null, occurredAt: at(1), dedupKey: 'pet||1' };
  assert.equal(matchHuntReport(pets('all'), unnamed)?.itemName, 'A pet');
  assert.equal(matchHuntReport(pets('skilling'), unnamed), null);
  const snakeling = { kind: 'pet', itemId: 12921, itemName: 'Pet snakeling', source: 'Zulrah', occurredAt: at(1), dedupKey: 'pet|zulrah|1' };
  assert.ok(matchHuntReport(pets('all'), snakeling));
  assert.equal(matchHuntReport(pets('skilling'), snakeling), null);
  const beaver = { kind: 'clog', itemId: null, itemName: 'Beaver', source: null, occurredAt: at(1), dedupKey: 'clog|beaver' };
  assert.equal(matchHuntReport(pets('skilling'), beaver)?.itemId, 13322);
});

test('a manual proof may only name a source the hunt accepts', () => {
  assert.equal(manualSourceAllowed(base(), ONYX, 'Zulrah'), true);
  assert.equal(manualSourceAllowed(base(), ONYX, 'Sol Heredit'), false);
  assert.equal(manualSourceAllowed(base(), ONYX, null), false);
  assert.equal(manualSourceAllowed(anySource(), ONYX, 'Sol Heredit'), true);
  assert.equal(manualSourceAllowed(anySource(), ONYX, null), true);
  assert.equal(manualSourceAllowed(base(), 4151, 'Zulrah'), false);
});

// ── One drop, reported more than once ────────────────────────────────────────────────────────

const sight = (over: Partial<DropSighting> = {}): DropSighting => ({ kind: 'drop', itemId: ONYX, itemName: 'Uncut onyx', source: 'Zulrah', kc: 400, quantity: 1, atMs: START, dedupKey: 'drop|zulrah|6571|100', ...over });

test('the same client key is always the same drop', () => {
  assert.equal(isSameDrop(sight(), sight({ atMs: START + 5 * 60_000 })), true);
});

test('a loot report and its collection-log line are one drop', () => {
  const clog = sight({ kind: 'clog', itemId: ONYX, source: null, kc: null, atMs: START + 2_000, dedupKey: 'clog|uncut onyx' });
  assert.equal(isSameDrop(sight(), clog), true);
  // ...and by name alone, when the log line could not be given an id.
  assert.equal(isSameDrop(sight(), { ...clog, itemId: null }), true);
  // The log line a day later is not that drop.
  assert.equal(isSameDrop(sight(), { ...clog, atMs: START + 86_400_000 }), false);
});

test('a pet line and the line that names it are one pet', () => {
  const line = sight({ kind: 'pet', itemId: null, itemName: null, source: 'Zulrah', dedupKey: 'pet|zulrah||100' });
  const named = sight({ kind: 'clog', itemId: 12921, itemName: 'Pet snakeling', source: null, atMs: START + 1_200, dedupKey: 'clog|pet snakeling' });
  assert.equal(isSameDrop(line, named), true);
});

test('a first sighting with no source and a second with it are one drop', () => {
  assert.equal(isSameDrop(sight({ source: null, dedupKey: 'drop||6571|100' }), sight({ atMs: START + 20_000, dedupKey: 'drop|zulrah|6571|102' })), true);
});

test('one kill read twice across a bucket edge is one drop; two kills are two', () => {
  assert.equal(isSameDrop(sight(), sight({ atMs: START + 1_800, dedupKey: 'drop|zulrah|6571|101' })), true);
  assert.equal(isSameDrop(sight(), sight({ atMs: START + 45_000, dedupKey: 'drop|zulrah|6571|104' })), false);
});

test('two different sources are two drops, and so are two different items', () => {
  assert.equal(isSameDrop(sight(), sight({ source: 'Sol Heredit', atMs: START + 1_000, dedupKey: 'drop|sol heredit|6571|100' })), false);
  assert.equal(isSameDrop(sight(), sight({ itemId: 4151, itemName: 'Abyssal whip', atMs: START + 1_000, dedupKey: 'drop|zulrah|4151|100' })), false);
});

test('a second sighting fills in what the first was missing, and nothing else', () => {
  const stored = sight({ kind: 'pet', itemId: null, itemName: null, source: null, kc: null });
  assert.deepEqual(mergeSighting(stored, sight({ itemId: 12921, itemName: 'Pet snakeling', kc: 1204 })), { itemId: 12921, itemName: 'Pet snakeling', source: 'Zulrah', kc: 1204 });
  assert.equal(mergeSighting(sight(), sight({ kc: 999, source: 'Other' })), null);
  assert.deepEqual(mergeSighting(sight(), sight({ quantity: 3 })), { quantity: 3 });
});

// ── The window ───────────────────────────────────────────────────────────────────────────────

test('only drops between the start and the end count, edges included', () => {
  const drops = [
    drop('a', -0.001),
    drop('b', 0),
    drop('c', 24 * 7),
    drop('d', 24 * 7 + 0.001),
  ];
  assert.deepEqual(countedDrops(drops, window).map((d) => d.rsnKey), ['b', 'c']);
});

test('a proof waiting for staff, or turned down, does not count', () => {
  const drops = [drop('a', 1, { origin: 'manual', status: 'pending' }), drop('b', 2, { origin: 'manual', status: 'rejected' }), drop('c', 3, { origin: 'manual', status: 'counted', approvedBy: 'Olive' })];
  const rows = rankHunt(base(), entrants('a', 'b', 'c'), drops, window);
  assert.deepEqual(rows.map((r) => [r.rsn, r.count]), [['c', 1], ['a', 0], ['b', 0]]);
});

// ── Ranking ──────────────────────────────────────────────────────────────────────────────────

test('most by the end: count first, a tie to whoever reached it first', () => {
  const drops = [drop('early', 1), drop('late', 2), drop('early', 5), drop('late', 6), drop('one', 0.5)];
  const rows = rankHunt(base(), entrants('late', 'one', 'early', 'none'), drops, window);
  assert.deepEqual(rows.map((r) => [r.rank, r.rsn, r.count]), [[1, 'early', 2], [2, 'late', 2], [3, 'one', 1], [4, 'none', 0]]);
  assert.equal(rows[0].reachedAt, at(5));
  assert.equal(rows[0].firstAt, at(1));
});

test('most by the end: an exact tie on time falls back to the name, the same every load', () => {
  const rows = rankHunt(base(), entrants('zed', 'amy'), [drop('zed', 1), drop('amy', 1)], window);
  assert.deepEqual(rows.map((r) => r.rsn), ['amy', 'zed']);
});

test('first to get it: the order they got it, however many they got after', () => {
  const drops = [drop('second', 3), drop('first', 1), drop('second', 4), drop('second', 5)];
  const rows = rankHunt(base({ rule: 'first' }), entrants('second', 'first'), drops, window);
  assert.deepEqual(rows.map((r) => r.rsn), ['first', 'second']);
  assert.equal(rows[1].count, 3);
});

test('everyone without a drop follows, driest first', () => {
  const rows = rankHunt(base({ rule: 'first' }), entrants(['wet', 20], ['dry', 412], ['got', 3], 'idle'), [drop('got', 2)], window);
  assert.deepEqual(rows.map((r) => r.rsn), ['got', 'dry', 'wet', 'idle']);
  assert.equal(rows[1].statGain, 412);
});

test('end when the first one lands: only the first drop counts', () => {
  const cfg = base({ rule: 'first', endOnFirst: true });
  const drops = [drop('later', 3), drop('winner', 1), drop('winner', 2)];
  assert.equal(endOnFirstAt(cfg, drops, window), at(1));
  const rows = rankHunt(cfg, entrants('later', 'winner'), drops, window);
  assert.deepEqual(rows.map((r) => [r.rsn, r.count]), [['winner', 1], ['later', 0]]);
  // Off by default: it keeps running and lists the finishers in order.
  assert.equal(endOnFirstAt(base({ rule: 'first' }), drops, window), null);
  assert.equal(endOnFirstAt(base({ rule: 'most', endOnFirst: true }), drops, window), null);
});

test('quantity mode adds up the stack; the default counts each drop once', () => {
  const stacks = [drop('a', 1, { quantity: 3 }), drop('a', 2, { quantity: 2 }), drop('b', 1, { quantity: 1 }), drop('b', 2), drop('b', 3)];
  const drops = rankHunt(base(), entrants('a', 'b'), stacks, window);
  assert.deepEqual(drops.map((r) => [r.rsn, r.count]), [['b', 3], ['a', 2]]);
  const qty = rankHunt(base({ items: [{ id: ONYX, name: 'Uncut onyx', sources: ['Zulrah'], count: 'quantity' }] }), entrants('a', 'b'), stacks, window);
  assert.deepEqual(qty.map((r) => [r.rsn, r.count]), [['a', 5], ['b', 3]]);
});

test('a staff-added drop counts like any other and says who approved it', () => {
  const added = drop('noplugin', 2, { origin: 'manual', status: 'counted', approvedBy: 'Olive Owner', kc: 1204, statBasis: 'stated' });
  const rows = rankHunt(base(), entrants('noplugin', 'plugin'), [added, drop('plugin', 3)], window);
  assert.deepEqual(rows.map((r) => r.rsn), ['noplugin', 'plugin']);
  assert.equal(dropOriginWords(added), 'manual proof (approved by Olive Owner)');
  assert.equal(dropOriginWords(drop('x', 1)), 'plugin');
});

test('the number a drop landed at reads as kill count or XP, or not at all', () => {
  assert.equal(dropStatWords({ kc: 1204, xp: null, statSkill: null }), 'at 1,204 kc');
  assert.equal(dropStatWords({ kc: null, xp: 13034431, statSkill: 'woodcutting' }), 'at 13,034,431 Woodcutting XP');
  assert.equal(dropStatWords({ kc: null, xp: null, statSkill: null }), null);
});
