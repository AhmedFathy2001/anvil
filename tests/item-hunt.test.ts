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
  BURST_LIMIT,
  awaitingConfirmation,
  countedDrops,
  dropFlag,
  dropOriginWords,
  dropStatWords,
  endingDrop,
  huntEndingWords,
  huntEndsAt,
  serverDropKey,
  unconfirmedPrizeDrops,
  bossNames,
  defaultHuntTitle,
  huntFromInput,
  huntIconUrl,
  huntPets,
  huntStatLabel,
  killsOfForPets,
  MAX_PET_KILL_BOSSES,
  petKills,
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
import { BOSSES } from '@/lib/constants';
import { PET_GROUPS } from '@/lib/petGroups';
import { competitionStat } from '@/lib/weeklyMetric';

const ONYX = 6571;
const base = (over: Partial<HuntConfig> = {}): HuntConfig => ({
  v: 1,
  target: 'items',
  items: [{ id: ONYX, name: 'Uncut onyx', sources: ['Zulrah'], count: 'drops' }],
  petGroup: null,
  rule: 'most',
  ends: { kind: 'date' },
  confirm: 'staff',
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
  confirmed: false,
  flagReason: null,
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
  const picked = huntFromInput({ target: 'items', rule: 'first', ends: { kind: 'drops', n: 1 }, items: [{ id: ONYX, name: 'Uncut onyx', sources: ['Zulrah', 'zulrah ', 'Sol Heredit'] }] });
  assert.ok(picked.ok);
  assert.deepEqual(picked.config.items[0].sources, ['Zulrah', 'Sol Heredit']);
  assert.deepEqual(picked.config.ends, { kind: 'drops', n: 1, by: 'all' });
  assert.equal(picked.config.confirm, 'staff');
});

test('how it ends: the end date by default, or a number of drops; staff confirm unless the clan says otherwise', () => {
  const plain = huntFromInput({ target: 'pets', petGroup: 'all', rule: 'most' });
  assert.ok(plain.ok);
  assert.deepEqual(plain.config.ends, { kind: 'date' });
  assert.equal(plain.config.confirm, 'staff');
  const n = huntFromInput({ target: 'pets', petGroup: 'all', rule: 'most', ends: { kind: 'drops', n: 5.7, by: 'player' }, confirm: 'auto' });
  assert.ok(n.ok);
  assert.deepEqual(n.config.ends, { kind: 'drops', n: 5, by: 'player' });
  assert.equal(n.config.confirm, 'auto');
  const zero = huntFromInput({ target: 'pets', petGroup: 'all', rule: 'first', ends: { kind: 'drops', n: 0 } });
  assert.ok(zero.ok);
  assert.deepEqual(zero.config.ends, { kind: 'drops', n: 1, by: 'all' });
  assert.equal(huntEndingWords({ kind: 'date' }), 'at the end date');
  assert.equal(huntEndingWords({ kind: 'drops', n: 1, by: 'all' }), 'when the first one lands');
  assert.equal(huntEndingWords({ kind: 'drops', n: 3, by: 'all' }), 'after 3 drops');
  assert.equal(huntEndingWords({ kind: 'drops', n: 5, by: 'player' }), 'when one player has 5');
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

// ── How it ends ──────────────────────────────────────────────────────────────────────────────

const firstLands = (over: Partial<HuntConfig> = {}) => base({ rule: 'first', ends: { kind: 'drops', n: 1, by: 'all' }, ...over });

test('at the end date: no drop ever ends it', () => {
  const drops = [drop('a', 1, { confirmed: true }), drop('b', 2, { confirmed: true })];
  assert.equal(huntEndsAt(base(), drops, window), null);
  assert.deepEqual(awaitingConfirmation(base(), drops, window), []);
});

test('when the first one lands, staff confirming: a report alone never ends the hunt', () => {
  const reported = [drop('later', 3), drop('winner', 1)];
  assert.equal(huntEndsAt(firstLands(), reported, window), null);
  assert.deepEqual(awaitingConfirmation(firstLands(), reported, window).map((d) => d.rsnKey), ['winner']);
  // It keeps running and counting: both are in the standings, in order.
  assert.deepEqual(rankHunt(firstLands(), entrants('later', 'winner'), reported, window).map((r) => [r.rsn, r.count]), [['winner', 1], ['later', 1]]);
  // Staff confirm the first drop: that is what ends it, at the drop's own time.
  const confirmed = [drop('later', 3), drop('winner', 1, { confirmed: true })];
  assert.equal(huntEndsAt(firstLands(), confirmed, window), at(1));
  assert.deepEqual(awaitingConfirmation(firstLands(), confirmed, window), []);
  // Staff reject it instead: it leaves the standings and the next drop is the one waiting.
  const rejected = [drop('later', 3), drop('winner', 1, { status: 'rejected' })];
  assert.equal(huntEndsAt(firstLands(), rejected, window), null);
  assert.deepEqual(awaitingConfirmation(firstLands(), rejected, window).map((d) => d.rsnKey), ['later']);
});

test('confirming a later drop does not end the hunt past an earlier one still open', () => {
  const drops = [drop('early', 1), drop('late', 2, { confirmed: true })];
  assert.equal(huntEndsAt(firstLands(), drops, window), null);
});

test('count plugin drops automatically: the deciding drop ends it by itself', () => {
  const cfg = firstLands({ confirm: 'auto' });
  assert.equal(huntEndsAt(cfg, [drop('later', 3), drop('winner', 1)], window), at(1));
  assert.deepEqual(awaitingConfirmation(cfg, [drop('winner', 1)], window), []);
  // A held report is not counted, so it cannot end the hunt even in this mode.
  assert.equal(huntEndsAt(cfg, [drop('held', 1, { status: 'review', flagReason: 'x' })], window), null);
  // Nor can a member's proof that staff have not approved.
  assert.equal(huntEndsAt(cfg, [drop('asked', 1, { origin: 'manual', status: 'pending' })], window), null);
});

test('after N drops: N across everyone, at the Nth drop', () => {
  const cfg = base({ ends: { kind: 'drops', n: 3, by: 'all' }, confirm: 'auto' });
  assert.equal(huntEndsAt(cfg, [drop('a', 1), drop('b', 2)], window), null);
  const three = [drop('a', 1), drop('b', 2), drop('a', 4), drop('c', 5)];
  assert.equal(huntEndsAt(cfg, three, window), at(4));
  assert.equal(endingDrop(cfg, three, window)?.deciding.length, 3);
});

test('after N drops by one player: first to N', () => {
  const cfg = base({ ends: { kind: 'drops', n: 2, by: 'player' }, confirm: 'auto' });
  const drops = [drop('a', 1), drop('b', 2), drop('c', 3), drop('b', 6), drop('a', 7)];
  assert.equal(huntEndsAt(cfg, drops, window), at(6));
});

test('after N drops, staff confirming: every drop the result rests on has to be confirmed', () => {
  const cfg = base({ ends: { kind: 'drops', n: 2, by: 'all' } });
  const one = [drop('a', 1, { confirmed: true }), drop('b', 2)];
  assert.equal(huntEndsAt(cfg, one, window), null);
  assert.deepEqual(awaitingConfirmation(cfg, one, window).map((d) => d.rsnKey), ['b']);
  assert.equal(huntEndsAt(cfg, [drop('a', 1, { confirmed: true }), drop('b', 2, { confirmed: true })], window), at(2));
});

test('quantity mode counts the stack toward N', () => {
  const cfg = base({ items: [{ id: ONYX, name: 'Uncut onyx', sources: ['Zulrah'], count: 'quantity' }], ends: { kind: 'drops', n: 5, by: 'all' }, confirm: 'auto' });
  assert.equal(huntEndsAt(cfg, [drop('a', 1, { quantity: 3 }), drop('b', 2, { quantity: 2 }), drop('c', 3)], window), at(2));
});

// ── Trust ────────────────────────────────────────────────────────────────────────────────────

test('prizes wait for the winners\' drops to be confirmed, unless the clan chose automatic', () => {
  const drops = [drop('first', 1, { confirmed: true }), drop('second', 2), drop('third', 3)];
  const rows = rankHunt(base({ rule: 'first' }), entrants('first', 'second', 'third'), drops, window);
  assert.deepEqual(unconfirmedPrizeDrops(base({ rule: 'first' }), rows, 1), []);
  assert.deepEqual(unconfirmedPrizeDrops(base({ rule: 'first' }), rows, 2).map((d) => d.rsnKey), ['second']);
  assert.deepEqual(unconfirmedPrizeDrops(base({ rule: 'first', confirm: 'auto' }), rows, 3), []);
  // A place nobody won holds nothing up.
  assert.deepEqual(unconfirmedPrizeDrops(base(), rankHunt(base(), entrants('nobody'), [], window), 3), []);
});

test('the prize hold is asked of the rows that are paid, not of the public board', () => {
  const cfg = base({ rule: 'first' });
  // A guest got it first and is unconfirmed; the clan does not pay guests, so the settle ranks the
  // hunt over the members only. The paying member's drop is confirmed: nothing holds the payout.
  const drops = [drop('guest', 1), drop('member', 2, { confirmed: true }), drop('other', 3)];
  const eligible = rankHunt(cfg, entrants('member', 'other'), drops, window);
  assert.deepEqual(eligible.map((r) => r.rsn), ['member', 'other']);
  assert.deepEqual(unconfirmedPrizeDrops(cfg, eligible, 1), []);
  // The public board would have looked at the guest and held it for the wrong reason.
  const publicBoard = rankHunt(cfg, entrants('guest', 'member', 'other'), drops, window);
  assert.deepEqual(unconfirmedPrizeDrops(cfg, publicBoard, 1).map((d) => d.rsnKey), ['guest']);

  // The other way round: the excluded guest above is confirmed, the member who is actually paid is
  // not. Looking at the public top place would miss it; the paid rows hold.
  const drops2 = [drop('guest', 1, { confirmed: true }), drop('member', 2)];
  const paid = rankHunt(cfg, entrants('member'), drops2, window);
  assert.deepEqual(unconfirmedPrizeDrops(cfg, paid, 1).map((d) => d.rsnKey), ['member']);
  assert.deepEqual(unconfirmedPrizeDrops(cfg, rankHunt(cfg, entrants('guest', 'member'), drops2, window), 1), []);
});

test('the stored key is built on the server from what happened, in ten-second buckets', () => {
  const t = Date.parse('2026-11-10T12:00:03Z');
  const a = serverDropKey({ kind: 'drop', itemId: ONYX, itemName: 'Uncut onyx', source: 'Zulrah' }, t);
  assert.equal(a, `drop|${ONYX}|zulrah|${Math.floor(t / 10_000)}`);
  // The same drop reported again a few seconds on is the same key; a different source or a later
  // bucket is not. Nothing the client calls it is part of it.
  assert.equal(serverDropKey({ kind: 'drop', itemId: ONYX, itemName: null, source: ' ZULRAH ' }, t + 4_000), a);
  assert.notEqual(serverDropKey({ kind: 'drop', itemId: ONYX, itemName: null, source: 'Sol Heredit' }, t), a);
  assert.notEqual(serverDropKey({ kind: 'drop', itemId: ONYX, itemName: null, source: 'Zulrah' }, t + 10_000), a);
  assert.equal(serverDropKey({ kind: 'pet', itemId: null, itemName: null, source: null }, t), `pet|||${Math.floor(t / 10_000)}`);
});

test('a report that looks wrong is held for staff with the reason', () => {
  const ok = { reportedKc: 512, singleBoss: true, baseline: 400, current: 510, recentSameItem: 0 };
  assert.equal(dropFlag(ok), null);
  // Below the site's own reading.
  assert.match(dropFlag({ ...ok, reportedKc: 300 })!, /below the site's reading of 510/);
  // Far above it. A normal hiscores lag is not "far".
  assert.equal(dropFlag({ ...ok, reportedKc: 560 }), null);
  assert.match(dropFlag({ ...ok, reportedKc: 5000 })!, /far above/);
  // No kill at the source since the hunt started, and the report does not say otherwise.
  assert.match(dropFlag({ ...ok, current: 400, reportedKc: null })!, /No kills at the source/);
  assert.match(dropFlag({ ...ok, current: 400, reportedKc: 400 })!, /No kills at the source/);
  // The plugin's own count is past the starting line: the hiscores just have not caught up.
  assert.equal(dropFlag({ ...ok, current: 400, reportedKc: 401 }), null);
  // Too many of one item in a short window.
  assert.match(dropFlag({ ...ok, recentSameItem: BURST_LIMIT })!, /within 10 minutes/);
  assert.equal(dropFlag({ ...ok, recentSameItem: BURST_LIMIT - 1 }), null);
});

test('kill-count checks only run against one boss with a starting line', () => {
  // Several bosses summed, a non-boss source, or no reading yet: nothing to compare with.
  assert.equal(dropFlag({ reportedKc: 3, singleBoss: false, baseline: 400, current: 400, recentSameItem: 0 }), null);
  assert.equal(dropFlag({ reportedKc: 3, singleBoss: true, baseline: null, current: null, recentSameItem: 0 }), null);
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
  assert.equal(dropOriginWords(drop('x', 1, { confirmed: true, approvedBy: 'Olive Owner' })), 'plugin (confirmed by Olive Owner)');
});

test('the number a drop landed at reads as kill count or XP, or not at all', () => {
  assert.equal(dropStatWords({ kc: 1204, xp: null, statSkill: null }), 'at 1,204 kc');
  assert.equal(dropStatWords({ kc: null, xp: 13034431, statSkill: 'woodcutting' }), 'at 13,034,431 Woodcutting XP');
  assert.equal(dropStatWords({ kc: null, xp: null, statSkill: null }), null);
});

// ── Pets picked out of a group ───────────────────────────────────────────────────────────────

const OLMLET = 20851;
const ZIK = 22473;
const TUMEKEN = 27352;
const SNAKELING = 12921;
const BEAVER = 13322;
const groupPets = (key: string) => PET_GROUPS.find((g) => g.key === key)!.items;

test('a pet hunt can be narrowed to some pets of its group; the whole group is stored as before', () => {
  const two = huntFromInput({ target: 'pets', petGroup: 'raids', petIds: [ZIK, OLMLET, SNAKELING, 'x', ZIK], rule: 'first' });
  assert.ok(two.ok);
  // Group order, own pets only: the snakeling is not a raid pet.
  assert.deepEqual(two.config.petIds, [OLMLET, ZIK]);
  assert.deepEqual(huntPets(two.config).map((p) => p.name), ['Olmlet', "Lil' zik"]);
  assert.equal(huntTargetsLabel(two.config), "Olmlet + Lil' zik");
  assert.equal(defaultHuntTitle(two.config), "Pet hunt: Olmlet + Lil' zik");
  assert.ok(huntIconUrl(two.config)?.includes(String(OLMLET)));

  const whole = huntFromInput({ target: 'pets', petGroup: 'raids', petIds: [OLMLET, ZIK, TUMEKEN], rule: 'first' });
  assert.ok(whole.ok);
  assert.equal('petIds' in whole.config, false);
  assert.equal(huntTargetsLabel(whole.config), 'Raid pets');
  const none = huntFromInput({ target: 'pets', petGroup: 'raids', rule: 'first' });
  assert.ok(none.ok);
  assert.equal('petIds' in none.config, false);
  assert.equal(huntPets(none.config).length, 3);

  assert.equal(huntFromInput({ target: 'pets', petGroup: 'raids', petIds: [], rule: 'first' }).ok, false);
  assert.equal(huntFromInput({ target: 'pets', petGroup: 'raids', petIds: [SNAKELING], rule: 'first' }).ok, false);
  // Items never carry a pet list.
  const items = huntFromInput({ target: 'items', items: [{ id: ONYX, name: 'Uncut onyx', sources: ['Zulrah'] }], petIds: [OLMLET], rule: 'most' });
  assert.ok(items.ok);
  assert.equal('petIds' in items.config, false);
  assert.deepEqual(huntPets(items.config), []);
});

test('a narrowed pet hunt counts only the pets picked, and reads back as it was stored', () => {
  const narrowed = pets('raids', { petIds: [OLMLET, ZIK] });
  const report = (itemId: number | null, itemName: string | null, kind = 'pet') => ({ kind, itemId, itemName, source: null, occurredAt: at(1), dedupKey: `k${itemId}` });
  assert.equal(matchHuntReport(narrowed, report(OLMLET, 'Olmlet'))?.itemId, OLMLET);
  assert.equal(matchHuntReport(narrowed, report(null, "lil' zik", 'clog'))?.itemId, ZIK);
  assert.equal(matchHuntReport(narrowed, report(TUMEKEN, "Tumeken's guardian")), null);
  // The same hunt without the list still takes the third.
  assert.equal(matchHuntReport(pets('raids'), report(TUMEKEN, "Tumeken's guardian"))?.itemId, TUMEKEN);

  // "Any pet" with pets left out: an unnamed pet could be one of those, so it waits for its name.
  const most = pets('all', { petIds: groupPets('all').map((p) => p.id).filter((id) => id !== SNAKELING) });
  assert.equal(matchHuntReport(most, report(null, null)), null);
  assert.equal(matchHuntReport(most, report(SNAKELING, 'Pet snakeling')), null);
  assert.equal(matchHuntReport(most, report(BEAVER, 'Beaver'))?.itemId, BEAVER);

  assert.deepEqual(parseHunt(serializeHunt(narrowed)), narrowed);
  // A hunt stored before pets could be picked has no list and is the whole group.
  const old = parseHunt(JSON.stringify({ v: 1, target: 'pets', items: [], petGroup: 'slayer', rule: 'first', ends: { kind: 'date' }, confirm: 'staff', killsOf: 'kraken', xpSkill: null }));
  assert.ok(old);
  assert.equal('petIds' in old, false);
  assert.equal(huntPets(old).length, groupPets('slayer').length);
  // …and keeps the one boss it was created with, which a new pet hunt could not ask for.
  assert.equal(old.killsOf, 'kraken');
});

test('a pet hunt shows kills at the bosses its pets come from, added together', () => {
  assert.equal(killsOfForPets([{ id: SNAKELING, name: 'Pet snakeling' }]), 'zulrah');
  const raids = petKills(groupPets('raids'));
  assert.equal(raids.killsOf, 'chambersOfXeric,chambersOfXericChallengeMode,theatreOfBlood,theatreOfBloodHardMode,tombsOfAmascut,tombsOfAmascutExpertMode');
  assert.deepEqual(raids.bosses, ['Chambers of Xeric', 'Theatre of Blood', 'Tombs of Amascut']);
  for (const key of ['slayer', 'gwd', 'raids', 'wilderness', 'dt2']) {
    const got = petKills(groupPets(key));
    assert.ok(got.killsOf, key);
    assert.ok(got.bosses.length <= MAX_PET_KILL_BOSSES, key);
    for (const k of got.killsOf.split(',')) assert.ok(BOSSES.some((b) => b.key === k), `${key}: ${k}`);
  }
  // One pet with no boss and there is no honest sum; too many bosses and the sum says nothing.
  const mixed = petKills([{ id: SNAKELING, name: 'Pet snakeling' }, { id: BEAVER, name: 'Beaver' }]);
  assert.equal(mixed.killsOf, null);
  assert.deepEqual(mixed.noBoss, ['Beaver']);
  const boss = petKills(groupPets('boss'));
  assert.equal(boss.killsOf, null);
  assert.deepEqual(boss.noBoss, []);
  assert.ok(boss.bosses.length > MAX_PET_KILL_BOSSES);
  assert.equal(petKills(groupPets('all')).killsOf, null);
  assert.equal(petKills([]).killsOf, null);
});

test('the server builds the kill count of a pet hunt itself: the form only says whether to show one', () => {
  const shown = huntFromInput({ target: 'pets', petGroup: 'slayer', petIds: [12655, 13247], rule: 'first', killsOf: 'zulrah', xpSkill: 'slayer' });
  assert.ok(shown.ok);
  assert.equal(shown.config.killsOf, 'cerberus,kraken');
  assert.equal(shown.config.xpSkill, null);
  assert.deepEqual(huntStat(shown.config), { type: 'boss', metric: 'cerberus,kraken' });
  const off = huntFromInput({ target: 'pets', petGroup: 'slayer', rule: 'first', killsOf: null });
  assert.ok(off.ok);
  assert.equal(off.config.killsOf, null);
  // Asked for, but these pets have no such number: none, and the XP choice stands.
  const skilling = huntFromInput({ target: 'pets', petGroup: 'skilling', rule: 'first', killsOf: 'zulrah', xpSkill: 'woodcutting' });
  assert.ok(skilling.ok);
  assert.equal(skilling.config.killsOf, null);
  assert.equal(skilling.config.xpSkill, 'woodcutting');
  const any = huntFromInput({ target: 'pets', petGroup: 'all', rule: 'first', killsOf: 'zulrah' });
  assert.ok(any.ok);
  assert.equal(any.config.killsOf, null);
});

test('many bosses are named shortly beside the standings', () => {
  assert.deepEqual(bossNames('zulrah,chambersOfXeric,vorkath'), ['Zulrah', 'Chambers of Xeric', 'Vorkath']);
  assert.equal(huntStatLabel(base()), 'Zulrah');
  assert.equal(huntStatLabel(base({ killsOf: 'chambersOfXeric,chambersOfXericChallengeMode' })), 'Chambers of Xeric (any mode)');
  assert.equal(huntStatLabel(pets('raids', { killsOf: petKills(groupPets('raids')).killsOf })), 'Chambers of Xeric + Theatre of Blood + Tombs of Amascut');
  assert.equal(huntStatLabel(pets('dt2', { killsOf: petKills(groupPets('dt2')).killsOf })), 'Duke Sucellus, Vardorvis and 2 more');
});

test('points hunt: each item scores its points, a tie goes to whoever reached it first', () => {
  const TBOW = 20997, OLM = 20851, ARC = 21079;
  const cfg = base({
    rule: 'points',
    items: [
      { id: TBOW, name: 'Twisted bow', sources: [], count: 'drops', points: 25 },
      { id: OLM, name: 'Olmlet', sources: [], count: 'drops', points: 10 },
      { id: ARC, name: 'Arcane prayer scroll', sources: [], count: 'drops', points: 2 },
    ],
    killsOf: null,
  });
  const d = (rsn: string, h: number, id: number, name: string) => drop(rsn, h, { itemId: id, itemName: name });
  const rows = rankHunt(cfg, entrants('Arcs', 'Olm', 'Bow', 'Late'), [
    d('Arcs', 1, ARC, 'Arcane prayer scroll'), d('Arcs', 2, ARC, 'Arcane prayer scroll'), d('Arcs', 3, ARC, 'Arcane prayer scroll'),
    d('Olm', 4, OLM, 'Olmlet'),
    d('Bow', 5, TBOW, 'Twisted bow'),
    d('Late', 6, OLM, 'Olmlet'),
  ], window);
  assert.deepEqual(rows.map((r) => [r.rsn, r.count]), [['Bow', 25], ['Olm', 10], ['Late', 10], ['Arcs', 6]]);
  // Only each player's first of each item: three scrolls are worth one.
  const once = rankHunt({ ...cfg, repeat: 'first' }, entrants('Arcs'), [d('Arcs', 1, ARC, 'Arcane prayer scroll'), d('Arcs', 2, ARC, 'Arcane prayer scroll')], window);
  assert.equal(once[0].count, 2);
  // "End after N drops" still counts drops: two drops end a 2-drop hunt whatever their points.
  const ending = endingDrop({ ...cfg, ends: { kind: 'drops', n: 2, by: 'all' } }, [d('Bow', 1, TBOW, 'Twisted bow'), d('Olm', 2, OLM, 'Olmlet')], window);
  assert.equal(ending?.at, at(2));
});

test('points hunt: the form is checked and stored', () => {
  const ok = huntFromInput({ target: 'items', rule: 'points', repeat: 'first', items: [{ id: 1, name: 'Bow', anySource: true, points: 5000 }, { id: 2, name: 'Scroll', anySource: true }], ends: { kind: 'date' } });
  assert.ok(ok.ok);
  if (!ok.ok) return;
  assert.deepEqual(ok.config.items.map((i) => i.points), [1000, 1], 'capped at 1,000 and 1 by default');
  assert.equal(ok.config.repeat, 'first');
  assert.equal(parseHunt(serializeHunt(ok.config))?.rule, 'points', 'survives storing');
  const pets = huntFromInput({ target: 'pets', rule: 'points', petGroup: 'all', ends: { kind: 'date' } });
  assert.equal(pets.ok, false, 'points are for item hunts');
  const most = huntFromInput({ target: 'items', rule: 'most', repeat: 'first', items: [{ id: 1, name: 'Bow', anySource: true, points: 5 }], ends: { kind: 'date' } });
  assert.ok(most.ok && most.config.items[0].points === undefined && most.config.repeat === undefined, 'a most-drops hunt keeps no points');
});
