import { test } from 'node:test';
import assert from 'node:assert/strict';
import { raceGraph } from '../src/lib/raceRoutes.ts';
import {
  easeOptionsByTile,
  easeRanks,
  easeTick,
  easeWaitText,
  isComboPartRow,
  isEaseOption,
  lifelineConfirmText,
  lifelineLine,
  lifelineSpendable,
  lifelineStatus,
  nextTimedLine,
  type TeamEasePayload,
  lifelineWouldOpen,
  liveEaseIds,
  tileOpenedAt,
  timedEaseAt,
  timedEaseLevel,
  timedLiveEaseIds,
  type EaseClock,
} from '../src/lib/raceEase.ts';
import { nestParts, partsByParent } from '../src/lib/combo.ts';
import { DEFAULT_EVENT_RULES, parseEventRules, validateEventRules } from '../src/lib/eventRules.ts';
import { tileToCsvRow } from '../src/lib/csvTiles.ts';
import { mechanicsLines } from '../src/lib/rulesMechanics.ts';
import { getDiscordDict } from '../src/lib/discordI18n/index.ts';
import type { Tile } from '../src/lib/types.ts';

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

test('waits read in plain words', () => {
  assert.equal(easeWaitText(START + 30_000, START), 'in under a minute');
  assert.equal(easeWaitText(START + 12 * 60_000, START), 'in 12m');
  assert.equal(easeWaitText(START + 5 * H + 20 * 60_000, START), 'in 5h 20m');
  assert.equal(easeWaitText(START + 3 * H, START), 'in 3h');
});

test('the web board and the plugin panel say the same thing about a lifeline', () => {
  const life = (state: 'ready' | 'wait' | 'spent' | 'not-open' | 'none-left' | 'nothing', readyAt: number | null = null) => ({ state, left: 2, total: 3, readyAt });
  const view = (over: Partial<TeamEasePayload> = {}): TeamEasePayload => ({ tiles: {}, lifelines: { left: 2, total: 3 }, canSpend: true, now: START, ...over });
  const tile = (state: Parameters<typeof life>[0], readyAt: number | null = null, live: { id: number; label: string; rank: number }[] = []) => ({ live, locked: live.length ? 0 : 1, nextTimedAt: null as number | null, lifeline: life(state, readyAt) });
  assert.equal(lifelineSpendable(view(), tile('ready')), true);
  assert.equal(lifelineSpendable(view({ canSpend: false }), tile('ready')), false);
  assert.equal(lifelineSpendable(view(), tile('wait', START + H)), false);
  assert.match(lifelineLine(view(), tile('ready'))!, /2 lifelines of 3 left/);
  assert.match(lifelineLine(view({ canSpend: false }), tile('ready'))!, /Your captain can use a lifeline/);
  assert.match(lifelineLine(view(), tile('wait', START + 5 * H))!, /works here in 5h/);
  assert.match(lifelineLine(view(), tile('spent'))!, /used a lifeline here/);
  assert.match(lifelineLine(view(), tile('not-open'))!, /once your team is playing it/);
  assert.match(lifelineLine(view(), tile('none-left'))!, /no lifelines left/);
  assert.match(lifelineLine(view(), undefined)!, /No easier option on this tile/);
  // Already open by the clock: nothing more to say about a lifeline.
  assert.equal(lifelineLine(view(), tile('nothing', null, [{ id: 1, label: 'Easy', rank: 1 }])), null);
  // No lifelines on this race: silence.
  assert.equal(lifelineLine(view({ lifelines: null }), tile('ready')), null);
  assert.match(lifelineConfirmText(1), /one of your team’s 1 lifeline on this tile/);
  assert.equal(nextTimedLine(view(), { ...tile('ready'), nextTimedAt: START + 8 * H }), 'An easier option opens for everyone in 8h.');
  assert.equal(nextTimedLine(view(), { ...tile('ready'), nextTimedAt: START - 1 }), null);
  assert.equal(nextTimedLine(view(), undefined), null);
});

test('a library row carries a tile’s easier options, without points or options of their own', () => {
  const easy = { id: 2, eventId: 1, position: 0, label: 'Easy', tileType: 'kill', requiredAmount: 50, points: 0, parentTileId: 1, easeLevel: 1 } as unknown as Tile;
  const hard = { id: 1, eventId: 1, position: 0, label: 'Hard', tileType: 'kill', requiredAmount: 100, points: 5, easier: [easy] } as unknown as Tile;
  const row = tileToCsvRow(hard);
  assert.equal(row.label, 'Hard');
  assert.equal(row.easier?.length, 1);
  assert.equal(row.easier![0].label, 'Easy');
  assert.equal('points' in row.easier![0], false);
  assert.equal('easier' in row.easier![0], false);
  assert.equal('easier' in tileToCsvRow({ ...hard, easier: [] } as unknown as Tile), false);
});

test('the rules post names both switches, in every Discord language', async () => {
  const english = await getDiscordDict('en');
  const race = { format: 'tilerace', scoringMode: 'tiles' } as Parameters<typeof mechanicsLines>[1];
  const rules = { ...DEFAULT_EVENT_RULES, raceEase: { hours: 24 }, raceLifelines: { count: 3, afterHours: 12, opens: 'first' as const } };
  const en = mechanicsLines(english, race, rules, 0, null, { total: 0, announced: 0 });
  assert.ok(en.some((l) => /Easier over time.*every 24h/.test(l)));
  assert.ok(en.some((l) => /Lifelines.*3 per team.*open to you for 12h/.test(l)));
  const noWait = mechanicsLines(english, race, { ...rules, raceLifelines: { count: 3, afterHours: 0, opens: 'first' as const } }, 0, null, { total: 0, announced: 0 });
  assert.ok(noWait.some((l) => /Lifelines/.test(l) && !/open to you/.test(l)));
  const off = mechanicsLines(english, race, DEFAULT_EVENT_RULES, 0, null, { total: 0, announced: 0 });
  assert.ok(!off.some((l) => /Lifelines|Easier over time/.test(l)));
  for (const lang of ['ar', 'da', 'de', 'es', 'fi', 'fr', 'it', 'ja', 'ko', 'nl', 'no', 'pl', 'pt-br', 'sv', 'zh-hans']) {
    const t = await getDiscordDict(lang);
    const lines = mechanicsLines(t, race, rules, 0, null, { total: 0, announced: 0 });
    for (const key of ['raceEase', 'raceLifelines'] as const) {
      const made = lines.find((l) => l.startsWith(t.rules[key].slice(0, 12)));
      assert.ok(made, `${lang}: ${key} line missing`);
      assert.ok(!/\{\w+\}/.test(made!), `${lang}: ${key} left a placeholder`);
      assert.notEqual(t.rules[key], english.rules[key], `${lang}: ${key} is still English`);
    }
    assert.ok(lines.some((l) => l.includes('12')), `${lang}: the wait is missing`);
  }
});
