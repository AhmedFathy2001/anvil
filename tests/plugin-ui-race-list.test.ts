import { test } from 'node:test';
import assert from 'node:assert/strict';

import { type BoardContext, type BoardState, boardRowsUi, boardUi, pinAction } from '../src/lib/pluginUi/boardUi';
import { eventUi, homeUi, type HomeConfig, type HomeData } from '../src/lib/pluginUi/homeUi';
import { trackedCard } from '../src/lib/pluginUi/trackedUi';
import { raceBoard } from './plugin-ui-race.test';

function walk(n: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (!n || typeof n !== 'object') return out;
  if (Array.isArray(n)) n.forEach((x) => walk(x, out));
  else {
    out.push(n as Record<string, unknown>);
    Object.values(n).forEach((v) => walk(v, out));
  }
  return out;
}
const texts = (n: unknown) => walk(n).flatMap((x) => (x.t === 'text' ? [x.s as string] : x.t === 'button' ? [x.label as string] : []));

const ctx: BoardContext = { eventId: 77, claimBlock: null, pins: [], boardPath: '/events/77', progress: new Map() };
const st: BoardState = { event: 77, pre: false, q: '', status: 'all', page: 0 };

test('the tracked card lists every pin with a board label for other boards, an untrack each, and Untrack all', () => {
  const then = { a: 'load', v: 'home' } as const;
  const rows = [
    { tileId: 1, label: 'Kill 5 bosses', eventId: 77, board: null, cur: 2, goal: 5, done: false },
    { tileId: 9, label: 'Seers laps', eventId: 80, board: 'Clan Wars', cur: null, goal: null, done: false },
    { tileId: 2, label: 'Haul', eventId: 77, board: null, cur: 0, goal: 1, done: false },
  ];
  const card = trackedCard(rows, 77, then)!;
  const t = texts(card);
  assert.ok(t.includes('Tracked on screen') && t.includes('Clan Wars') && t.includes('Untrack all'));
  const pins = walk(card).filter((x) => (x.on as { a?: string } | undefined)?.a === 'pin').map((x) => x.on as { event: number; tile: number; on: boolean });
  assert.deepEqual(pins.map((p) => [p.event, p.tile]), [[77, 0], [77, 1], [80, 9], [77, 2]]);
  assert.ok(pins.every((p) => p.on === false));
  assert.equal(trackedCard([], 77, then), null);
  assert.ok(!texts(trackedCard([rows[0]], 77, then)).includes('Untrack all'));
});

test('the All tiles list: race header and track, chips, step groups, state chips', () => {
  const board = raceBoard([1]);
  const ui = boardUi(board, st, ctx, boardRowsUi(board, st, ctx));
  const t = texts(ui);
  assert.ok(t.some((x) => /^Step 2 of 4/.test(x)), 'the race page’s top card');
  assert.ok(walk(ui).some((x) => x.t === 'segs') && walk(ui).some((x) => x.t === 'step'));
  for (const c of ['All', 'Open', 'Done', 'Locked']) assert.ok(t.includes(c), c);
  assert.ok(!walk(ui).some((x) => x.t === 'input' && x.kind === 'select'), 'no dropdown');
  assert.ok(t.includes('Step 2') && t.includes('Finish'));
  assert.ok(!t.some((x) => /^Step \d · (Kill|One|Vorkath|Barrows|Raid|Wintertodt)/.test(x)), 'no “Step 2 ·” in rows');
  assert.ok(t.includes('Done') && t.includes('Next') && t.includes('Locked'));
  assert.ok(!t.includes('You are here') && !t.some((x) => /visible tiles/.test(x)));
});

test('another board: grouped by row on a square board, same rows', () => {
  const tiles = Array.from({ length: 9 }, (_, i) => ({ tileId: i + 1, label: `T${i + 1}`, position: i, complete: i === 0, points: 1, tileType: 'drop' }));
  const board = { yourTeamId: 1, readOnly: false, teams: [], tiles } as never;
  const t = texts(boardRowsUi(board, st, ctx));
  assert.ok(t.includes('Row 1') && t.includes('Row 3') && t.includes('Done'));
});

test('View all N uses the board’s real total, and a race board shows tracked tiles', () => {
  const cfg: HomeConfig = {
    event: { id: 5, name: 'Race', race: { steps: 4, stepsDone: 1, finished: false, mode: 'achieve', open: [], pickFrom: [], rank: 1, entrants: 5, leaderSteps: 1, atYourStep: 1, ahead: 0 }, endDate: null },
    board: { tilesComplete: 1, tilesTotal: 10, pointsScored: false },
    panel: { tiles: [{ tileId: 1, label: 'Kill 5 bosses', current: 1, goal: 5, points: 1, complete: false, position: 1, description: null }] },
  } as unknown as HomeConfig;
  const d = { cfg, live: true, inGame: true, feed: [], standings: [], weekly: new Map(), pins: [1, 6], pinRows: [
    { tileId: 1, label: 'Kill 5 bosses', eventId: 5, board: null, cur: 1, goal: 5, done: false },
    { tileId: 6, label: 'Wintertodt crate', eventId: 5, board: null, cur: null, goal: null, done: false },
  ], chosen: false, ownClan: null, boardPath: '/events/5', clanPath: '', now: Date.now(), raceBoard: { board: raceBoard([1]), ctx } } as unknown as HomeData;
  const t = texts(eventUi(d, 'board')!);
  assert.ok(t.includes('View all 10 tiles'), 'the real total, not the one visible tile');
  assert.ok(t.includes('Tracked on screen') && t.includes('Wintertodt crate') && t.includes('Untrack all'));
  assert.ok(t.indexOf('Tracked on screen') < t.indexOf('Standings'), 'near the top of the race page');
});

test('every live board row has rank, bar, count and the clock', () => {
  const mk = (eventId: number, rank: number | null, endDate: string | null) => ({ eventId, name: `B${eventId}`, clan: 'afk', clanName: 'AFK', teamId: eventId, teamName: `T${eventId}`, tilesComplete: 2, tilesTotal: 9, pointsScored: false, endDate, rank, of: rank ? 40 : 0 });
  const cfg = { event: { id: 1, name: 'Main', endDate: new Date(Date.now() + 3_600_000).toISOString() }, board: { tilesComplete: 3, tilesTotal: 10, pointsScored: false }, panel: { tiles: [] } } as unknown as HomeConfig;
  const soon = new Date(Date.now() + 3_600_000).toISOString();
  const far = new Date(Date.now() + 20 * 86_400_000).toISOString();
  const d = { cfg, live: true, inGame: true, feed: [], standings: [], weekly: new Map(), pins: [], chosen: false, ownClan: null, boardPath: null, clanPath: '', now: Date.now(),
    myBoards: [mk(2, 4, soon), mk(3, null, far)] } as unknown as HomeData;
  const ui = homeUi(d);
  const t = texts(ui);
  assert.ok(t.includes('4th of 40'), 'rank where standings are visible');
  assert.ok(!t.some((x) => /^\d+(st|nd|rd|th) of 0/.test(x)));
  assert.equal(walk(ui).filter((x) => x.t === 'countdown').length, 2, 'the main board and board 2 carry a clock');
  assert.ok(t.some((x) => /^Ends \d+ \w+$/.test(x)), 'a far-off end is a date');
  assert.equal(t.filter((x) => x === '2 / 9 tiles').length, 2);
});

test('a pin on a tile of an unrevealed board, or one the reveal rules hide, resolves to no label', async () => {
  const { revealedTileIds } = await import('../src/lib/pluginUi/trackedUi');
  const rules = JSON.stringify({ revealPolicy: 'bounty' });
  const found = [{ id: 1, eventId: 10 }, { id: 2, eventId: 11 }];
  // Event 11 hasn't revealed its tiles: nothing from it.
  assert.deepEqual([...revealedTileIds(found, [{ id: 10, rules: null, tilesRevealed: true }, { id: 11, rules: null, tilesRevealed: false }])], [1]);
  // A reveal-policy board: a tile that hasn't been drawn stays out.
  const hidden = revealedTileIds([{ id: 5, eventId: 12, revealedAt: null, tileType: 'drop' }], [{ id: 12, rules, tilesRevealed: true }]);
  assert.equal(hidden.has(5), false);
});

test('the tracked card gives a pin with progress a thin bar under its name (no blank space)', () => {
  const card = trackedCard([{ tileId: 1, label: '2 Araxxor kills', eventId: 77, board: null, cur: 0, goal: 2, done: false }], 77, { a: 'load', v: 'home' })!;
  assert.ok(walk(card).some((x) => x.t === 'bar'));
  assert.ok(texts(card).includes('0 / 2'));
});

test('a locked race step or a closed tile cannot be tracked, an open one can', () => {
  const base = { tileId: 5, complete: false } as never;
  const withState = (o: object) => ({ ...(base as object), ...o }) as never;
  const c = { ...ctx, pins: [] as number[] };
  assert.equal(pinAction(withState({ raceState: 'ahead' }), st, c), null);
  assert.equal(pinAction(withState({ raceState: 'closed' }), st, c), null);
  assert.equal(pinAction(withState({ closedAt: '2026-01-01' }), st, c), null);
  assert.ok(pinAction(withState({ raceState: 'open' }), st, c)?.on);
});

test('a tracked row with no progress is one line: the name and the ✕', () => {
  const card = trackedCard([{ tileId: 3, label: 'Step 1', eventId: 77, board: null, cur: null, goal: null, done: false }], 77, { a: 'load', v: 'home' })!;
  const line = walk(card).find((x) => x.t === 'row' && (x.c as { s?: string } | undefined)?.s === 'Step 1') as { r?: { s?: string } } | undefined;
  assert.equal(line?.r?.s, '✕');
});
