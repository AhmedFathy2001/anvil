import { test } from 'node:test';
import assert from 'node:assert/strict';
import { raceGraph } from '../src/lib/raceRoutes.ts';
import {
  easeOptionsByTile,
  easeRanks,
  easeRuleLines,
  easeTick,
  easeWaitText,
  isComboPartRow,
  isEaseOption,
  lifelineStatus,
  lifelineWouldOpen,
  liveEaseIds,
  tileOpenedAt,
  timedEaseAt,
  timedEaseLevel,
  timedLiveEaseIds,
  type EaseClock,
} from '../src/lib/raceEase.ts';
import { nestParts, partsByParent } from '../src/lib/combo.ts';
import { parseEventRules, validateEventRules } from '../src/lib/eventRules.ts';

const H = 3_600_000;
const START = 1_000_000_000_000;

// A straight line of four board tiles. Tile 1 has two easier options, tile 2 one, tile 3 none.
const board = [1, 2, 3, 4].map((id, i) => ({ id, position: i }));
const options = [
  { id: 11, parentTileId: 1, easeLevel: 1 },
  { id: 12, parentTileId: 1, easeLevel: 2 },
  { id: 21, parentTileId: 2, easeLevel: 1 },
];
const graph = raceGraph(board);
const clock = (over: Partial<EaseClock> = {}): EaseClock => ({ ease: { hours: 24 }, lifelines: null, startMs: START, now: START, ...over });
const sorted = (s: Set<number>) => [...s].sort((a, b) => a - b);

test('an easier option is a child row with a level; a combo part is a child row without one', () => {
  assert.equal(isEaseOption({ parentTileId: 1, easeLevel: 1 }), true);
  assert.equal(isEaseOption({ parentTileId: 1, easeLevel: null }), false);
  assert.equal(isEaseOption({ parentTileId: null, easeLevel: 1 }), false);
  assert.equal(isComboPartRow({ parentTileId: 1, easeLevel: null }), true);
  assert.equal(isComboPartRow({ parentTileId: 1, easeLevel: 2 }), false);
});

test('ranks count from 1 under each tile, whatever levels were stored', () => {
  const ranks = easeRanks([{ id: 5, parentTileId: 1, easeLevel: 7 }, { id: 4, parentTileId: 1, easeLevel: 3 }, { id: 9, parentTileId: 2, easeLevel: 1 }]);
  assert.deepEqual([ranks.get(4), ranks.get(5), ranks.get(9)], [1, 2, 1]);
  assert.deepEqual(easeOptionsByTile(options).get(1)!.map((o) => o.id), [11, 12]);
});

test('the tick counts whole intervals since the start, and is 0 with easing off or before the start', () => {
  assert.equal(easeTick({ hours: 24 }, START, START), 0);
  assert.equal(easeTick({ hours: 24 }, START, START + 24 * H - 1), 0);
  assert.equal(easeTick({ hours: 24 }, START, START + 24 * H), 1);
  assert.equal(easeTick({ hours: 12 }, START, START + 30 * H), 2);
  assert.equal(easeTick(null, START, START + 99 * H), 0);
  assert.equal(easeTick({ hours: 24 }, null, START + 99 * H), 0);
  assert.equal(easeTick({ hours: 24 }, START, START - H), 0);
});

test('timed easing walks the board: step 1 on the first tick, step 2 on the second, deeper levels a tick later each', () => {
  assert.equal(timedEaseLevel(0, 0), 0);
  assert.equal(timedEaseLevel(0, 1), 1);
  assert.equal(timedEaseLevel(1, 1), 0);
  assert.equal(timedEaseLevel(1, 2), 1);
  assert.equal(timedEaseLevel(0, 2), 2);
  assert.equal(timedEaseLevel(null, 5), 0);
  // Saturday 8 pm start, daily: nothing on day 0; tile 1's first on day 1; tile 1's second and tile 2's first on day 2.
  assert.deepEqual(sorted(liveEaseIds(clock(), graph, options, null)), []);
  assert.deepEqual(sorted(liveEaseIds(clock({ now: START + 24 * H }), graph, options, null)), [11]);
  assert.deepEqual(sorted(liveEaseIds(clock({ now: START + 48 * H }), graph, options, null)), [11, 12, 21]);
  assert.equal(timedEaseAt({ hours: 24 }, START, 1, 1), START + 48 * H);
  assert.equal(timedEaseAt(null, START, 1, 1), null);
});

test('a lifeline opens its tile for that team only: the first option, or all of them', () => {
  const first = clock({ ease: null, lifelines: { count: 3, afterHours: 12, opens: 'first' } });
  assert.deepEqual(sorted(liveEaseIds(first, graph, options, new Set([1]))), [11]);
  assert.deepEqual(sorted(liveEaseIds(first, graph, options, null)), []);
  const all = clock({ ease: null, lifelines: { count: 3, afterHours: 12, opens: 'all' } });
  assert.deepEqual(sorted(liveEaseIds(all, graph, options, new Set([1]))), [11, 12]);
  // What the clock alone opened is what the public may see: a lifeline never adds to it.
  assert.deepEqual(sorted(timedLiveEaseIds(all, graph, options)), []);
});

test('both switches on: the further of the two wins on each tile', () => {
  const both = clock({ now: START + 24 * H, lifelines: { count: 3, afterHours: 0, opens: 'first' } });
  assert.deepEqual(sorted(liveEaseIds(both, graph, options, new Set([2]))), [11, 21]);
});

test('a tile opened for a team when the tile before it was finished; a start tile at the whistle', () => {
  const doneAt = new Map([[1, START + 5 * H]]);
  assert.equal(tileOpenedAt(graph, 1, doneAt, START), START);
  assert.equal(tileOpenedAt(graph, 2, doneAt, START), START + 5 * H);
  assert.equal(tileOpenedAt(graph, 3, doneAt, START), null);
  // A road pick made later moves the open to the pick.
  assert.equal(tileOpenedAt(graph, 2, doneAt, START, START + 7 * H), START + 7 * H);
  assert.equal(tileOpenedAt(graph, 99, doneAt, START), null);
});

test('a lifeline needs an easier option to open, one left, the tile in play, and the wait served', () => {
  const rule = { count: 2, afterHours: 12, opens: 'first' as const };
  const base = { rule, tileId: 2, spentTiles: new Set<number>(), wouldOpen: 1, open: true, openedAt: START, now: START + 13 * H };
  assert.equal(lifelineStatus(base).state, 'ready');
  assert.equal(lifelineStatus(base).left, 2);
  assert.equal(lifelineStatus({ ...base, rule: null }).state, 'off');
  assert.equal(lifelineStatus({ ...base, wouldOpen: 0 }).state, 'nothing');
  assert.equal(lifelineStatus({ ...base, spentTiles: new Set([2]) }).state, 'spent');
  assert.equal(lifelineStatus({ ...base, spentTiles: new Set([1, 3]) }).state, 'none-left');
  assert.equal(lifelineStatus({ ...base, open: false }).state, 'not-open');
  const waiting = lifelineStatus({ ...base, now: START + 11 * H });
  assert.equal(waiting.state, 'wait');
  assert.equal(waiting.readyAt, START + 12 * H);
  assert.equal(lifelineStatus({ ...base, rule: { ...rule, afterHours: 0 }, now: START }).state, 'ready');
});

test('what a lifeline would newly open leaves out what the clock already opened', () => {
  const list = easeOptionsByTile(options).get(1)!;
  const first = { count: 3, afterHours: 0, opens: 'first' as const };
  const all = { count: 3, afterHours: 0, opens: 'all' as const };
  assert.equal(lifelineWouldOpen(first, list, new Set()), 1);
  assert.equal(lifelineWouldOpen(first, list, new Set([11])), 0);
  assert.equal(lifelineWouldOpen(all, list, new Set([11])), 1);
  assert.equal(lifelineWouldOpen(null, list, new Set()), 0);
});

test('a combo keeps its parts apart from an easier option hung on the same tile', () => {
  const rows = [
    { id: 1, parentTileId: null, tileType: 'combo', easeLevel: null },
    { id: 2, parentTileId: 1, tileType: 'kill', easeLevel: null },
    { id: 3, parentTileId: 1, tileType: 'kill', easeLevel: null },
    { id: 4, parentTileId: 1, tileType: 'kill', easeLevel: 1 },
    { id: 5, parentTileId: null, tileType: 'kill', easeLevel: null },
    { id: 6, parentTileId: 5, tileType: 'drop', easeLevel: 1 },
  ];
  assert.deepEqual(partsByParent(rows).get(1)!.map((p) => p.id), [2, 3]);
  const nested = nestParts(rows);
  assert.deepEqual(nested.map((t) => t.id), [1, 5]);
  assert.deepEqual(nested[0].parts!.map((p) => p.id), [2, 3]);
  assert.deepEqual(nested[0].easier!.map((p) => p.id), [4]);
  assert.equal(nested[1].parts, undefined);
  assert.deepEqual(nested[1].easier!.map((p) => p.id), [6]);
});

test('the rules store both switches, drop them when off, and refuse nonsense', () => {
  assert.equal(parseEventRules(null).raceEase, null);
  assert.equal(parseEventRules(null).raceLifelines, null);
  const saved = validateEventRules({ raceEase: { hours: 12 }, raceLifelines: { count: 3, afterHours: 12, opens: 'all' } });
  assert.ok(!('error' in saved));
  const back = parseEventRules((saved as { rules: string | null }).rules);
  assert.deepEqual(back.raceEase, { hours: 12 });
  assert.deepEqual(back.raceLifelines, { count: 3, afterHours: 12, opens: 'all' });
  assert.deepEqual(validateEventRules({ raceEase: null, raceLifelines: null }), { rules: null });
  assert.ok('error' in validateEventRules({ raceEase: { hours: 0 } }));
  assert.ok('error' in validateEventRules({ raceEase: { hours: 1.5 } }));
  assert.ok('error' in validateEventRules({ raceLifelines: { count: 0 } }));
  assert.ok('error' in validateEventRules({ raceLifelines: { count: 3, opens: 'some' } }));
  assert.deepEqual(parseEventRules(JSON.stringify({ raceLifelines: { count: 2 } })).raceLifelines, { count: 2, afterHours: 0, opens: 'first' });
});

test('waits and rule lines read in plain words', () => {
  assert.equal(easeWaitText(START + 30_000, START), 'in under a minute');
  assert.equal(easeWaitText(START + 12 * 60_000, START), 'in 12m');
  assert.equal(easeWaitText(START + 5 * H + 20 * 60_000, START), 'in 5h 20m');
  assert.equal(easeWaitText(START + 3 * H, START), 'in 3h');
  assert.deepEqual(easeRuleLines(null, null), []);
  const lines = easeRuleLines({ hours: 24 }, { count: 3, afterHours: 12, opens: 'first' });
  assert.equal(lines.length, 2);
  assert.match(lines[0], /every day after the start/);
  assert.match(lines[1], /3 per team/);
  assert.match(lines[1], /open to you for 12 hours/);
  assert.match(easeRuleLines({ hours: 12 }, null)[0], /every 12 hours/);
});
