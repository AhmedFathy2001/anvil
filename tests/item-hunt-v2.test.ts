// Item hunt v2 (lib/itemHunt): one list where a pet is a row, a progress stat per row, Due, and
// "when a player has all of them". tests/item-hunt.test.ts is left as it was: every v1 rule there
// still passes against the same code, which is the proof old hunts read and settle unchanged.
//
// Run: npx tsx --test tests/item-hunt-v2.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  type HuntConfig,
  type HuntDrop,
  autoRowStat,
  awaitingConfirmation,
  completionOf,
  countedDrops,
  dropScore,
  endingDrop,
  huntEndingWords,
  huntEndsAt,
  huntFromInput,
  huntKindWord,
  huntPanelLine,
  dueWords,
  huntReportItemIdsOf,
  huntRowProgress,
  huntRowStatKeys,
  huntRows,
  huntSettingsFromInput,
  huntStat,
  huntTargetsLabel,
  matchHuntReport,
  parseHunt,
  rankHunt,
  rowProgressWords,
  serializeHunt,
} from '@/lib/itemHunt';
import { huntFormFromConfig, huntPayload, huntPrizesPayload } from '@/lib/huntForm';
import { huntRates, killsPerDrop } from '@/lib/huntRates';
import { huntRowParts, mergeHuntRowStats } from '@/lib/weeklyMetric';

const GRAARDOR_PET = 12650;
const HERON = 13320;
const ROCKY = 20663;
const BCP = 11832;

const v2Input = (over: Record<string, unknown> = {}) => ({
  v: 2,
  rule: 'points',
  items: [
    { id: GRAARDOR_PET, name: 'Pet general graardor', points: 5 },
    { id: HERON, name: 'Heron', points: 3 },
    { id: ROCKY, name: 'Rocky', points: 2 },
    { id: BCP, name: 'Bandos chestplate', sources: ['General Graardor'], points: 1 },
  ],
  ends: { kind: 'all' },
  ...over,
});
const v2 = (over: Record<string, unknown> = {}): HuntConfig => {
  const r = huntFromInput(v2Input(over));
  assert.ok(r.ok, !r.ok ? r.error : '');
  return r.config;
};

const START = Date.parse('2026-11-10T00:00:00Z');
const END = Date.parse('2026-11-17T00:00:00Z');
const window = { startMs: START, endMs: END };
const at = (h: number) => new Date(START + h * 3_600_000).toISOString();
let nextId = 1;
const drop = (rsn: string, hours: number, itemId: number, over: Partial<HuntDrop> = {}): HuntDrop => ({
  id: nextId++,
  rsnKey: rsn.toLowerCase(),
  itemId,
  itemName: String(itemId),
  quantity: 1,
  source: null,
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

// ── Reading and writing ─────────────────────────────────────────────────────────────────────

test('v2: pets and items in one list, each row with its own stat picked from the data', () => {
  const c = v2();
  assert.equal(c.v, 2);
  assert.equal(c.target, 'items');
  assert.deepEqual(
    c.items.map((it) => [it.name, !!it.pet, it.stat?.type ?? null, it.stat?.metric ?? null, it.points]),
    [
      ['Pet general graardor', true, 'boss', 'generalGraardor', 5],
      // Skilling pets take their skill from src/data/skillPets.json.
      ['Heron', true, 'skill', 'fishing', 3],
      ['Rocky', true, 'skill', 'thieving', 2],
      // An item takes the kills at its source, when that source is a hiscores boss.
      ['Bandos chestplate', false, 'boss', 'generalGraardor', 1],
    ],
  );
  // The hunt-wide stat (what the sweep reads, the plugin pushes) is the bosses the rows show.
  assert.deepEqual(huntStat(c), { type: 'boss', metric: 'generalGraardor' });
  assert.deepEqual(huntRowStatKeys(c), ['boss:generalGraardor', 'skill:fishing', 'skill:thieving']);
  assert.deepEqual(c.ends, { kind: 'all' });
  // Stored and read back, it is the same config.
  assert.deepEqual(parseHunt(serializeHunt(c)), c);
});

test('v2: "Closest to it" can be overridden or set to nothing; a bad one is nothing', () => {
  const c = v2({
    items: [
      { id: HERON, name: 'Heron', stat: { type: 'skill', metric: 'cooking' } },
      { id: ROCKY, name: 'Rocky', stat: null },
      { id: GRAARDOR_PET, name: 'Pet general graardor', stat: { type: 'boss', metric: 'notABoss' } },
      { id: BCP, name: 'Bandos chestplate', sources: [], anySource: true },
    ],
  });
  assert.deepEqual(c.items.map((it) => it.stat), [{ type: 'skill', metric: 'cooking' }, null, null, null]);
  // No boss row: the hunt-wide stat is the first skill.
  assert.deepEqual(huntStat(c), { type: 'skill', metric: 'cooking' });
});

test('v2: a pet is known by its id, never by a flag; items still need a source choice', () => {
  const notPet = huntFromInput({ v: 2, rule: 'most', items: [{ id: BCP, name: 'Bandos chestplate', pet: true, sources: [] }] });
  assert.equal(notPet.ok, false);
  const r = huntFromInput({ v: 2, rule: 'most', items: [{ id: HERON, name: 'Whatever', sources: ['Somewhere'], count: 'quantity' }] });
  assert.ok(r.ok);
  assert.deepEqual(r.config.items[0], { id: HERON, name: 'Heron', sources: [], count: 'drops', pet: true, stat: { type: 'skill', metric: 'fishing' } });
  assert.equal(huntFromInput({ v: 2, rule: 'most', items: [] }).ok, false);
});

test('v2: words', () => {
  const c = v2();
  assert.equal(huntKindWord(c), 'Item hunt');
  assert.equal(huntKindWord(v2({ items: [{ id: HERON, name: 'Heron' }, { id: ROCKY, name: 'Rocky' }] })), 'Pet hunt');
  assert.equal(huntTargetsLabel(c), 'Pet general graardor + Heron + Rocky + 1 more');
  assert.equal(huntEndingWords({ kind: 'all' }), 'when a player has all of them');
  assert.deepEqual(huntSettingsFromInput({ ends: { kind: 'all' } }).ends, { kind: 'all' });
});

test('v1 configs are untouched: a v1 pet hunt reads as before, and as rows of its pets', () => {
  const raw = JSON.stringify({ v: 1, target: 'pets', items: [], petGroup: 'gwd', rule: 'first', ends: { kind: 'date' }, confirm: 'staff', killsOf: null, xpSkill: null });
  const c = parseHunt(raw);
  assert.ok(c);
  assert.equal(c.v, 1);
  assert.equal(c.target, 'pets');
  assert.equal(c.petGroup, 'gwd');
  assert.deepEqual(huntRowStatKeys(c), []);
  const rows = huntRows(c);
  assert.ok(rows.length >= 4);
  assert.ok(rows.every((r) => r.pet && r.stat === null));
  // A v1 hunt never gets Due: no row has a stat of its own.
  assert.equal(huntRowProgress(c, { 'boss:generalGraardor': 0 }, { 'boss:generalGraardor': 100 }, {}).due, null);
});

// ── Matching ────────────────────────────────────────────────────────────────────────────────

test('v2: a pet row takes the pet from anywhere; an item row keeps its source rule', () => {
  const c = v2();
  const pet = matchHuntReport(c, { kind: 'pet', itemId: HERON, itemName: 'Heron', quantity: 3, source: 'Fishing spot', occurredAt: at(1), dedupKey: 'k' });
  assert.deepEqual(pet, { itemId: HERON, itemName: 'Heron', quantity: 1, source: 'Fishing spot' });
  assert.equal(matchHuntReport(c, { kind: 'drop', itemId: BCP, itemName: 'Bandos chestplate', source: 'Zulrah', occurredAt: at(1), dedupKey: 'k' }), null);
  assert.ok(matchHuntReport(c, { kind: 'drop', itemId: BCP, itemName: 'Bandos chestplate', source: 'General Graardor', occurredAt: at(1), dedupKey: 'k' }));
  // Points score per row, pets included.
  assert.equal(dropScore(c, { itemId: GRAARDOR_PET, quantity: 1 }), 5);
  // Only items are asked of the plugin by id; it reports every pet anyway.
  assert.deepEqual(huntReportItemIdsOf(c), [BCP]);
});

// ── Due ─────────────────────────────────────────────────────────────────────────────────────

test('rates come from the drop dataset only: Graardor pet 1 in 5,000, skills none', () => {
  assert.equal(killsPerDrop(GRAARDOR_PET, 'generalGraardor'), 5000);
  assert.equal(killsPerDrop(BCP, 'generalGraardor'), 381);
  assert.equal(killsPerDrop(GRAARDOR_PET, 'zulrah'), null);
  const rates = huntRates(v2());
  assert.deepEqual(rates, { [GRAARDOR_PET]: { 'boss:generalGraardor': 5000 }, [BCP]: { 'boss:generalGraardor': 381 } });
});

test('Due adds up each row\'s share of its drop rate; XP rows show a gain and add nothing', () => {
  const c = v2({ items: v2Input().items.slice(0, 3) });
  const rates = huntRates(c);
  const base = { 'boss:generalGraardor': 1000, 'skill:fishing': 5_000_000, 'skill:thieving': 100 };
  const now = { 'boss:generalGraardor': 3140, 'skill:fishing': 6_200_000, 'skill:thieving': 300_100 };
  const p = huntRowProgress(c, base, now, rates);
  assert.ok(p.due != null && Math.abs(p.due - 2140 / 5000) < 1e-9);
  assert.deepEqual(p.rows.map((r) => [r.label, r.gain, r.due == null ? null : Math.round(r.due * 100), r.rate]), [
    ['General Graardor', 2140, 43, 5000],
    ['Fishing', 1_200_000, null, null],
    ['Thieving', 300_000, null, null],
  ]);
  assert.deepEqual(p.rows.map(rowProgressWords), ['General Graardor +2,140 kc', 'Fishing +1.2M XP', 'Thieving +300K XP']);
  // Not read yet: no gain and no Due, never a zero that ranks as one.
  const none = huntRowProgress(c, null, null, rates);
  assert.equal(none.due, null);
  assert.equal(none.rows[0].gain, null);
  // No row with a rate: no Due at all.
  assert.equal(huntRowProgress(c, base, now, {}).due, null);
});

test('players with a drop rank first as always; the rest by Due; without Due as before', () => {
  const c = v2({ ends: { kind: 'date' } });
  const drops = [drop('got', 2, HERON)];
  const ranked = rankHunt(
    c,
    [
      { rsn: 'low', statGain: 900, due: 0.1 },
      { rsn: 'got', statGain: 0, due: 0 },
      { rsn: 'high', statGain: 10, due: 0.6 },
    ],
    drops,
    window,
  );
  assert.deepEqual(ranked.map((r) => r.rsn), ['got', 'high', 'low']);
  // Nobody has a Due: the stat gain orders them, exactly like v1.
  const plain = rankHunt(c, [{ rsn: 'low', statGain: 900 }, { rsn: 'high', statGain: 10 }], [], window);
  assert.deepEqual(plain.map((r) => r.rsn), ['low', 'high']);
});

// ── When a player has all of them ───────────────────────────────────────────────────────────

test('"all of them": the first to hold every row wins and ends it; the rest rank by points', () => {
  const c = v2({ items: v2Input().items.slice(0, 3) });
  const drops = [
    drop('a', 1, GRAARDOR_PET, { confirmed: true }),
    drop('b', 2, HERON),
    drop('b', 3, ROCKY),
    drop('a', 4, HERON, { confirmed: true }),
    drop('b', 5, GRAARDOR_PET),
    drop('a', 6, ROCKY, { confirmed: true }),
  ];
  const done = completionOf(c, countedDrops(drops, window));
  assert.equal(done.get('b'), at(5));
  assert.equal(done.get('a'), at(6));
  const end = endingDrop(c, drops, window);
  assert.equal(end?.at, at(5));
  // It rests on the winner's own drops only.
  assert.deepEqual(end?.deciding.map((d) => d.rsnKey), ['b', 'b', 'b']);
  // Staff confirm by default: b's three are not confirmed yet, so it has not ended.
  assert.equal(huntEndsAt(c, drops, window), null);
  assert.equal(awaitingConfirmation(c, drops, window).length, 3);
  assert.equal(huntEndsAt({ ...c, confirm: 'auto' }, drops, window), at(5));

  // Closed at b's last drop: a has not finished inside the window and ranks by points behind.
  const rows = rankHunt(c, [{ rsn: 'a', statGain: 0 }, { rsn: 'b', statGain: 0 }, { rsn: 'c', statGain: 0 }], drops, { startMs: START, endMs: Date.parse(at(5)) });
  assert.deepEqual(rows.map((r) => [r.rsn, r.count, r.held, r.completeAt]), [
    ['b', 10, 3, at(5)],
    ['a', 8, 2, null],
    ['c', 0, 0, null],
  ]);
  const line = huntPanelLine(c, rows[1], null);
  assert.equal(line.figure, '8 pts, 2/3');
});

test('how due reads: tenths under 10%, never a flat 0% for a few kills of a rare pet', () => {
  assert.equal(dueWords(0.0004), '<0.1%');
  assert.equal(dueWords(0.004), '0.4%');
  assert.equal(dueWords(0.0612), '6.1%');
  assert.equal(dueWords(0.61), '61%');
  const c = v2({ items: v2Input().items.slice(0, 2) });
  assert.equal(huntPanelLine(c, { count: 0, held: 0, due: 0, drops: [] }, null).figure, 'no kc yet');
  assert.equal(huntPanelLine(c, { count: 0, held: 0, due: 0.004, drops: [] }, null).figure, '0.4% due');
});

test('"all of them" with nobody finishing runs to the end date', () => {
  const c = v2({ items: v2Input().items.slice(0, 2) });
  assert.equal(endingDrop(c, [drop('a', 1, HERON)], window), null);
  assert.equal(autoRowStat({ id: 13322, name: 'Beaver', sources: [] })?.metric, 'woodcutting');
});

// ── Reading the stats ───────────────────────────────────────────────────────────────────────

test('row stats: each key off one read, start fixed at the first reading, current only up', () => {
  const snap = { skills: { fishing: { xp: 1_000_000 } }, bosses: { generalGraardor: { score: -1 } } } as never;
  const read = huntRowParts(snap, ['skill:fishing', 'boss:generalGraardor', 'boss:missing', 'nonsense'], { fishing: 1_000_500 });
  assert.deepEqual(read, { 'skill:fishing': 1_000_500, 'boss:generalGraardor': 0 });
  const first = mergeHuntRowStats(null, null, read);
  assert.deepEqual(first.baseline, read);
  const later = mergeHuntRowStats(first.baseline, first.current, { 'skill:fishing': 999_000, 'boss:generalGraardor': 12, 'skill:thieving': 50 });
  assert.deepEqual(later.baseline, { ...read, 'skill:thieving': 50 });
  assert.deepEqual(later.current, { 'skill:fishing': 1_000_500, 'boss:generalGraardor': 12, 'skill:thieving': 50 });
  assert.equal(mergeHuntRowStats(later.baseline, later.current, { 'boss:generalGraardor': 12 }).changed, false);
});

// ── The form ────────────────────────────────────────────────────────────────────────────────

test('the form: a v1 pet hunt opens as pet rows, and what it posts is a v2 hunt the server takes', () => {
  const v1 = parseHunt(JSON.stringify({ v: 1, target: 'pets', items: [], petGroup: 'gwd', petIds: [GRAARDOR_PET, 12649], rule: 'first', ends: { kind: 'date' }, confirm: 'staff', killsOf: null, xpSkill: null }));
  assert.ok(v1);
  const form = huntFormFromConfig(v1);
  assert.deepEqual(
    form.items.map((it) => [it.id, it.pet, it.stat]).sort((a, b) => Number(a[0]) - Number(b[0])),
    [
      [GRAARDOR_PET, true, 'boss:generalGraardor'],
      [12649, true, 'boss:kreeArra'],
    ].sort((a, b) => Number(a[0]) - Number(b[0])),
  );
  const back = huntFromInput(huntPayload({ ...form, ends: { kind: 'all' } }));
  assert.ok(back.ok);
  assert.equal(back.config.v, 2);
  assert.deepEqual(back.config.ends, { kind: 'all' });
  // "Nothing" survives the trip: it is posted as null, not re-picked.
  const none = huntFromInput(huntPayload({ ...form, items: form.items.map((it) => ({ ...it, stat: '' })) }));
  assert.ok(none.ok);
  assert.deepEqual(none.config.items.map((it) => it.stat), [null, null]);
  // The prizes shortcut sets a ladder only when every place has an amount.
  assert.equal(huntPrizesPayload({ ...form, prizes: [10_000_000, 0] }), null);
  assert.deepEqual(huntPrizesPayload({ ...form, prizes: [10_000_000, 5_000_000] }), { places: [{ gp: 10_000_000 }, { gp: 5_000_000 }], payZeroGain: false });
});
