// Back-to-back repeats in a feed (lib/feedRuns): one row with "×N" for a run of the same person's
// deaths, or of identical rows; distinct drops, pets and achievements never merge.
// Run: npx tsx --test tests/feed-runs.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { RUN_GAP_MS, collapseMomentRuns, collapseRuns, runKey, runTooltip, stampMs } from '../src/lib/feedRuns.ts';
import { momentRow, momentTitle, parseMomentsFeedId } from '../src/lib/pluginUi/feedUi.ts';
import { momentSentence } from '../src/lib/moments.ts';

const T0 = Date.parse('2026-11-05T12:00:00Z');
const at = (minAgo: number) => new Date(T0 - minAgo * 60_000).toISOString();
let nextId = 100;
const m = (over: Record<string, unknown> = {}) => ({
  id: nextId--,
  rsn: 'Drenvox',
  kind: 'death',
  itemId: null as number | null,
  itemName: null as string | null,
  quantity: 1,
  valueGp: null as number | null,
  source: 'Vorkath' as string | null,
  teamId: null as number | null,
  tier: null as string | null,
  sourceKind: null as string | null,
  occurredAt: at(0),
  ...over,
});

test('a run of one person’s deaths is one row: the newest one’s id and time, with the count', () => {
  const list = [m({ id: 9, occurredAt: at(0) }), m({ id: 8, occurredAt: at(5) }), m({ id: 7, occurredAt: at(10) })];
  const out = collapseMomentRuns(list);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 9, 'the newest moment’s id (and so its reactions)');
  assert.equal(out[0].occurredAt, at(0), 'the newest moment’s time');
  assert.deepEqual(out[0].run, { n: 3, firstAt: at(10), mixed: false, ids: [9, 8, 7] });
  assert.equal(momentTitle(out[0]), 'Died to Vorkath ×3');
  assert.equal(momentSentence(out[0]), 'died to Vorkath ×3');
  const row = momentRow(out[0]);
  assert.equal(row.id, 'm9');
  assert.equal(row.at, at(0));
  assert.equal(row.title, 'Died to Vorkath ×3');
});

test('a single row reads as before', () => {
  const [one] = collapseMomentRuns([m()]);
  assert.equal(one.run, undefined);
  assert.equal(momentTitle(one), 'Died to Vorkath');
  assert.equal(momentSentence(one), 'died to Vorkath');
});

test('different killers: the count leads, the latest killer after it', () => {
  const out = collapseMomentRuns([m({ source: 'Zulrah', occurredAt: at(0) }), m({ source: 'Vorkath', occurredAt: at(2) }), m({ source: null, occurredAt: at(4) })]);
  assert.equal(out.length, 1);
  assert.equal(out[0].run?.mixed, true);
  assert.equal(momentTitle(out[0]), 'Died ×3 · last to Zulrah');
  assert.equal(momentSentence(out[0]), 'died ×3, last to Zulrah');
  const [noKiller] = collapseMomentRuns([m({ source: null }), m({ source: 'Vorkath', occurredAt: at(1) })]);
  assert.equal(momentTitle(noKiller), 'Died ×2');
});

test('only back-to-back: anything between two deaths keeps them apart', () => {
  const out = collapseMomentRuns([
    m({ occurredAt: at(0) }),
    m({ kind: 'unique', itemId: 22006, itemName: 'Skeletal visage', source: 'Vorkath', occurredAt: at(1) }),
    m({ occurredAt: at(2) }),
    m({ rsn: 'Mossy', occurredAt: at(3) }),
    m({ occurredAt: at(4) }),
    m({ occurredAt: at(5) }),
  ]);
  assert.deepEqual(out.map((x) => x.run?.n ?? 1), [1, 1, 1, 1, 2]);
});

test('the person is judged by normalised name', () => {
  const out = collapseMomentRuns([m({ rsn: 'GIM_nisbro' }), m({ rsn: 'gim nisbro ', occurredAt: at(1) })]);
  assert.equal(out.length, 1);
  assert.equal(out[0].rsn, 'GIM_nisbro', 'the newest row’s own spelling');
});

test('neighbours further apart than the window are two rows; the window is between neighbours', () => {
  assert.equal(RUN_GAP_MS, 6 * 60 * 60 * 1000);
  const gapMin = RUN_GAP_MS / 60_000;
  assert.equal(collapseMomentRuns([m({ occurredAt: at(0) }), m({ occurredAt: at(gapMin + 1) })]).length, 2, 'just over: apart');
  assert.equal(collapseMomentRuns([m({ occurredAt: at(0) }), m({ occurredAt: at(gapMin) })]).length, 1, 'exactly the window: together');
  // A chain of deaths five hours apart stays one run, though its ends are a day apart.
  const chain = [0, 300, 600, 900, 1200].map((x) => m({ occurredAt: at(x) }));
  const [run] = collapseMomentRuns(chain);
  assert.equal(run.run?.n, 5);
  // A death today and one yesterday aren't back-to-back.
  assert.equal(collapseMomentRuns([m({ occurredAt: at(0) }), m({ occurredAt: at(24 * 60) })]).length, 2);
});

test('distinct drops, pets and achievements never merge', () => {
  const drop = (itemId: number, itemName: string, minAgo: number) => m({ kind: 'unique', itemId, itemName, source: 'Vorkath', valueGp: 1_000_000, occurredAt: at(minAgo) });
  assert.equal(collapseMomentRuns([drop(22006, 'Skeletal visage', 0), drop(11286, 'Draconic visage', 1)]).length, 2);
  assert.equal(collapseMomentRuns([m({ kind: 'pet', itemName: 'Vorki', source: null }), m({ kind: 'pet', itemName: 'Ikkle hydra', source: null, occurredAt: at(1) })]).length, 2);
  assert.equal(
    collapseMomentRuns([m({ kind: 'clog', itemName: 'Dragon pickaxe', source: null }), m({ kind: 'clog', itemName: 'Dragon axe', source: null, occurredAt: at(1) })]).length,
    2,
  );
  // Same item, different amounts: two different rows of text.
  assert.equal(
    collapseMomentRuns([m({ kind: 'loot', itemId: 1, itemName: 'Coins', quantity: 5 }), m({ kind: 'loot', itemId: 1, itemName: 'Coins', quantity: 6, occurredAt: at(1) })]).length,
    2,
  );
  // The same drop by two people is two stories too.
  assert.equal(collapseMomentRuns([drop(22006, 'Skeletal visage', 0), { ...drop(22006, 'Skeletal visage', 1), rsn: 'Mossy' }]).length, 2);
});

test('an identical repeat of another kind does collapse, keeping its own wording', () => {
  const rune = (minAgo: number) => m({ kind: 'loot', itemId: 1319, itemName: 'Rune 2h sword', source: 'Vorkath', valueGp: 38_000, occurredAt: at(minAgo) });
  const [run] = collapseMomentRuns([rune(0), rune(3), rune(6)]);
  assert.equal(run.run?.n, 3);
  assert.equal(run.run?.mixed, false);
  assert.equal(momentTitle(run), 'Rune 2h sword ×3');
  assert.equal(momentSentence(run), 'looted Rune 2h sword from Vorkath ×3');
});

test('a Hardcore Worlds fall is never part of a run', () => {
  const fall = m({ tier: 'hardcore', occurredAt: at(0) });
  assert.equal(runKey(fall), null);
  const out = collapseMomentRuns([fall, m({ occurredAt: at(1) }), m({ occurredAt: at(2) })]);
  assert.deepEqual(out.map((x) => x.run?.n ?? 1), [1, 2]);
});

test('display order is kept as given, never re-sorted', () => {
  const ids = collapseMomentRuns([m({ id: 1, rsn: 'A' }), m({ id: 2, rsn: 'B' }), m({ id: 3, rsn: 'A' })]).map((x) => x.id);
  assert.deepEqual(ids, [1, 2, 3]);
});

test('generic: a null key breaks a run (a finished tile between two deaths)', () => {
  type I = { k: string | null; t: number; v: string };
  const list: I[] = [
    { k: 'd', t: 10, v: 'a' },
    { k: 'd', t: 9, v: 'b' },
    { k: null, t: 8, v: 'tile' },
    { k: 'd', t: 7, v: 'c' },
    { k: null, t: 6, v: 'x' },
    { k: null, t: 5, v: 'y' },
  ];
  const groups = collapseRuns(list, (i) => i.k, (i) => i.t, 100);
  assert.deepEqual(groups.map((g) => g.map((i) => i.v)), [['a', 'b'], ['tile'], ['c'], ['x'], ['y']]);
});

test('stored timestamps read in either form', () => {
  assert.equal(stampMs('2026-11-05 12:00:00'), T0);
  assert.equal(stampMs('2026-11-05T12:00:00.000Z'), T0);
  assert.equal(collapseMomentRuns([m({ occurredAt: '2026-11-05 12:00:00' }), m({ occurredAt: '2026-11-05T11:59:00.000Z' })]).length, 1);
});

test('the hover line names the count and the span', () => {
  const [run] = collapseMomentRuns([m({ occurredAt: at(0) }), m({ occurredAt: at(90) })]);
  assert.match(runTooltip(run.run, run.occurredAt) ?? '', /^2 in a row, .*10:30.* to .*12:00.* UTC$/);
  assert.equal(runTooltip(undefined, at(0)), undefined);
});

test('a live list id reads back to its scope and filter', () => {
  assert.deepEqual(parseMomentsFeedId('moments:clan:3'), { kind: 'clan', id: 3, filter: 'all', teamId: null });
  assert.deepEqual(parseMomentsFeedId('moments:event:9:deaths'), { kind: 'event', id: 9, filter: 'deaths', teamId: null });
  assert.deepEqual(parseMomentsFeedId('moments:event:9:team:4'), { kind: 'event', id: 9, filter: 'team', teamId: 4 });
  assert.equal(parseMomentsFeedId('chat:9'), null);
});
