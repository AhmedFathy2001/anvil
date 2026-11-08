import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

import type { Board, BoardContext } from '../src/lib/pluginUi/boardUi';
import type { Node } from '../src/lib/pluginUi/nodes';
import { compactStandings, racePageUi, type RacePageOpts } from '../src/lib/pluginUi/raceUi';
import { raceGraph, rankRaceTeams, teamRoute } from '../src/lib/raceRoutes';

// A tile race's page on the plugin's Clan tab (lib/pluginUi/raceUi): where am I, do this next, the
// road as a track, compact standings, and each tile's detail as a nav pane.

// Three roads A/B/C over four steps; road B's step-2 tile splits to B and C, A's to A and B.
const TILES: [number, number, string, number[]][] = [
  [1, 0, 'Kill 5 bosses', [4]],
  [2, 0, 'One haul worth 1m+', [5]],
  [3, 0, 'Vorkath under 2:00', [6]],
  [4, 1, 'Barrows chest x10', [7, 8]],
  [5, 1, 'Raid or Zulrah unique x3', [8, 9]],
  [6, 1, 'Wintertodt crate', [9]],
  [7, 2, 'Kill a Revenant', [10]],
  [8, 2, 'PK Some Pker', [10]],
  [9, 2, "3 Seers' laps", [10]],
  [10, 3, 'Hard Ardougne diary', []],
];
const COLORS = ['#b38cff', '#7fd1ff', '#ff8f8f', '#9fe07f', '#ffd27a'];

/** 201 solo entrants; `mine` = what the viewer's team (189) has done; the field is spread out behind a finisher. */
export function raceBoard(mine: number[]): Board {
  const graph = raceGraph(TILES.map(([id, step, , next]) => ({ id, position: id, raceStep: step, raceNext: next })));
  const teams = Array.from({ length: 201 }, (_, i) => i + 1).map((id) => {
    let done: number[] = id === 189 ? mine : id === 146 ? [3, 6, 9, 10] : id < 40 ? [2, 5, 8] : id < 110 ? [1 + (id % 3)] : [];
    if (id >= 40 && id < 60) done = [2, 5];
    return { teamId: id, name: `Lab~Field${id}`, color: COLORS[id % COLORS.length], completedTileIds: done };
  });
  const completions = teams.flatMap((t) => t.completedTileIds.map((tileId, k) => ({ teamId: t.teamId, tileId, completedAt: new Date(Date.UTC(2026, 10, 8, 10, t.teamId % 60, k)).toISOString() })));
  const ranked = rankRaceTeams(graph, teams.map((t) => ({ id: t.teamId, name: t.name })), completions);
  const route = teamRoute(graph, mine);
  const me = ranked.find((r) => r.teamId === 189)!;
  return {
    yourTeamId: 189,
    readOnly: false,
    race: {
      steps: 4, mode: 'achieve', path: route.path, open: route.open, pickFrom: route.pickFrom, finished: route.finished,
      rank: me.rank, entrants: ranked.length, leaderSteps: ranked[0].stepsDone, field: [],
      standings: ranked.map((r) => ({ teamId: r.teamId, rank: r.rank, stepsDone: r.stepsDone, finished: r.finished })),
    },
    teams,
    tiles: TILES.map(([id, step, label, next]) => ({
      tileId: id, label, position: id, raceStep: step, raceNext: next, raceState: route.state.get(id) ?? null,
      description: id === 5 ? 'Any unique from Chambers of Xeric, Theatre of Blood, Tombs of Amascut or Zulrah. Screenshot is taken for you.' : null,
      tier: id === 5 ? 'Troll' : null, tileType: 'drop', complete: mine.includes(id), points: 1, autoTrackDisabled: true,
    })),
  } as unknown as Board;
}

const ctx = (progress: [number, number, number][] = []): BoardContext => ({
  eventId: 77, claimBlock: null, pins: [], boardPath: '/events/77',
  progress: new Map(progress.map(([id, current, goal]) => [id, { current, goal }])),
});
const opts = (c: BoardContext): RacePageOpts => ({
  title: 'Lab session', back: { a: 'load', v: 'home', args: {} }, rest: [], ctx: c,
  teams: { a: 'load', v: 'teams', args: {} }, reload: { a: 'load', v: 'home', args: { open: 'board' } }, pick: { event: '0', home: 'board' },
});

function walk(n: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (!n || typeof n !== 'object') return out;
  if (Array.isArray(n)) n.forEach((x) => walk(x, out));
  else {
    out.push(n as Record<string, unknown>);
    Object.values(n).forEach((v) => walk(v, out));
  }
  return out;
}
const texts = (n: unknown) => walk(n).filter((x) => x.t === 'text').map((x) => x.s as string);
type Slot = Extract<Node, { t: 'slot' }>;

test('at the start fork: Not started, every road open, the road ahead unknown, you after the top three', () => {
  const page = racePageUi(raceBoard([]), opts(ctx())) as Slot;
  assert.equal(page.t, 'slot');
  assert.equal(page.nav, true);
  assert.equal(page.open, 'main');
  const main = page.panes!.main;
  const s = texts(main);
  assert.ok(s.includes('Not started'));
  assert.ok(s.includes('189th of 201'));
  assert.ok(s.some((x) => x.includes('Lab~Field146 already finished')));
  assert.ok(s.includes('Get any one of these. The first you finish picks your road.'));
  for (const name of ['Kill 5 bosses', 'One haul worth 1m+', 'Vorkath under 2:00']) assert.ok(s.includes(name), name);
  assert.deepEqual(walk(main).filter((x) => x.chip && (x as { w?: number }).w === 18).map((x) => x.s), ['A', 'B', 'C']);
  assert.ok(s.includes('After that'));
  assert.ok(s.includes('Depends on your road'));
  assert.ok(s.includes('Roads cross here: you can switch'));
  assert.ok(s.includes('Hard Ardougne diary · same for everyone'));
  const segs = walk(main).find((x) => x.t === 'segs') as { c: string[] };
  assert.deepEqual(segs.c, ['#4a4a4a', '#4a4a4a', '#4a4a4a', '#4a4a4a']);
  assert.deepEqual(walk(main).filter((x) => x.t === 'step').map((x) => x.dot), ['todo', 'todo', 'end']);
  // Exactly one way back on the page.
  assert.equal(s.filter((x) => /all events|back/i.test(x)).length, 1);
});

test('mid-race on road B: one tile, its count, the road with names and the switch', () => {
  const page = racePageUi(raceBoard([2]), opts(ctx([[5, 1, 3]]))) as Slot;
  const main = page.panes!.main;
  const s = texts(main);
  assert.ok(s.includes('Step 2 of 4'));
  assert.ok(s.includes('Road B'));
  assert.ok(s.includes('1/3'));
  assert.ok(s.some((x) => x.startsWith('Only this one counts now')));
  assert.ok(s.includes('Your road'));
  assert.deepEqual(walk(main).filter((x) => x.t === 'step').map((x) => x.dot), ['done', 'now', 'todo', 'end']);
  assert.ok(s.includes('Step 2 · you are here'));
  assert.ok(s.includes('PK Some Pker'));
  assert.ok(s.includes("C: 3 Seers' laps"));
  const segs = walk(main).find((x) => x.t === 'segs') as { c: string[] };
  assert.deepEqual(segs.c, ['#5fd35f', '#ff981f', '#4a4a4a', '#4a4a4a']);
  assert.ok(s.includes('· · ·'));
  assert.ok(s.some((x) => /^\d+ {2}You$/.test(x)));
});

test('a tile opens in place: one Back, what counts, where it goes, who, proofs', () => {
  const page = racePageUi(raceBoard([2]), opts(ctx([[5, 1, 3]]))) as Slot;
  const detail = page.panes!['t:5'];
  const s = texts(detail);
  assert.equal(s.filter((x) => /back|all events/i.test(x)).length, 1);
  assert.equal(s[0], 'Back to the race');
  assert.ok(s.includes('Step 2 · Road B'));
  assert.ok(s.includes('Do this next'));
  assert.ok(s.includes('1 of 3'));
  assert.ok(s.includes('What counts'));
  assert.ok(s.includes('One haul worth 1m+ ✓'));
  assert.ok(s.includes('PK Some Pker'));
  assert.ok(s.some((x) => x.startsWith('At step 3 you can switch to Road C')));
  assert.ok(s.includes('Done it'));
  assert.ok(s.some((x) => /^\+\d+ more$/.test(x)));
  assert.ok(walk(detail).some((x) => x.t === 'slot' && x.id === 'proofs'));
  const back = walk(detail).find((x) => (x.on as { a?: string })?.a === 'pane' && (x.on as { pane?: string }).pane === 'main');
  assert.ok(back, 'Back goes to the main pane');
  // Every route tile has its pane.
  assert.equal(Object.keys(page.panes!).filter((k) => k.startsWith('t:')).length, 10);
});

test('compact standings: top three, you, then the rest on click', () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ rank: i + 1, you: i === 11 }));
  const line = (r: { rank: number }): Node => ({ t: 'text', s: String(r.rank) });
  const out = compactStandings(rows, (r) => r.you, line, null, 'k');
  const tog = out[0] as Extract<Node, { t: 'toggle' }>;
  assert.equal(tog.t, 'toggle');
  assert.deepEqual(texts(tog.off), ['1', '2', '3', '· · ·', '12', 'View all 20']);
  assert.equal(texts(tog.lit).length, 21);
  // A big field pages through the Teams view instead.
  const big = compactStandings(rows, (r) => r.you, line, { a: 'load', v: 'teams' }, 'k', 500);
  assert.deepEqual(texts(big), ['1', '2', '3', '· · ·', '12', 'View all 500']);
  // Nothing to hide: no link.
  assert.deepEqual(texts(compactStandings(rows.slice(0, 3), () => false, line, null, 'k')), ['1', '2', '3']);
});

// RACE_FIXTURES=<dir> writes the three states as views for the plugin's offscreen render test.
if (process.env.RACE_FIXTURES) {
  const dir = process.env.RACE_FIXTURES;
  const start = racePageUi(raceBoard([]), opts(ctx())) as Slot;
  const mid = racePageUi(raceBoard([2]), opts(ctx([[5, 1, 3]]))) as Slot;
  writeFileSync(`${dir}/race-start.json`, JSON.stringify({ ui: start }));
  writeFileSync(`${dir}/race-mid.json`, JSON.stringify({ ui: mid }));
  writeFileSync(`${dir}/race-detail.json`, JSON.stringify({ ui: { ...mid, open: 't:5' } }));
}
