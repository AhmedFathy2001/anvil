// A players board's standings, cut for reading: top five, the viewer ± 2, the rest paged and searchable.
//
// Run: npx tsx --test tests/standings-window.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  competitionRanks,
  isManyTeams,
  isSoloLike,
  SOLO_MIN_TEAMS,
  standingsLayout,
  standingsPage,
  standingsWindow,
  type StandingsWindow,
} from '../src/lib/standingsWindow.ts';

interface R {
  id: number;
  name: string;
  score: number;
}
const field = (n: number): R[] => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Player ${i + 1}`, score: n - i }));
/** The window as ids with `|N|` for a gap of N. */
const shape = (w: StandingsWindow<R>) => w.parts.map((p) => (p.kind === 'gap' ? `|${p.skipped}|` : p.rows.map((r) => r.id).join(','))).join(' ');
const mineIs = (...ids: number[]) => (r: R) => ids.includes(r.id);

test('solo-like: solo placement always; otherwise a big board where nobody shares a team', () => {
  assert.equal(isSoloLike('solo', [1, 1]), true);
  assert.equal(isSoloLike('solo', []), true, 'before anyone joins');
  assert.equal(isSoloLike('auto', [1, 1, 1, 1]), false, 'four early sign-ups on an auto board are still teams');
  assert.equal(isSoloLike('draft', Array(SOLO_MIN_TEAMS).fill(1)), true);
  assert.equal(isSoloLike('draft', [...Array(SOLO_MIN_TEAMS).fill(1), 2]), false, 'one real team makes it a team board');
  assert.equal(isSoloLike(null, Array(SOLO_MIN_TEAMS).fill(0)), true, 'empty seats count as one-person teams');
});

test('competition ranks: ties share a rank, the next skips; null ranks nothing', () => {
  const rows = [{ s: 9 }, { s: 7 }, { s: 7 }, { s: 3 }, { s: null as number | null }];
  const r = competitionRanks(rows, (x) => x.s);
  assert.deepEqual(rows.map((x) => r.get(x) ?? null), [1, 2, 2, 4, null]);
});

test('a short board is drawn whole', () => {
  const w = standingsWindow(field(8), mineIs(8));
  assert.equal(shape(w), '1,2,3,4,5,6,7,8');
  assert.equal(w.complete, true);
});

test('top five, a gap, you with two either side, a trailing gap', () => {
  const w = standingsWindow(field(170), mineIs(50));
  assert.equal(shape(w), '1,2,3,4,5 |42| 48,49,50,51,52 |118|');
  assert.equal(w.total, 170);
  assert.equal(w.complete, false);
  assert.equal(w.mineMore, 0);
});

test('signed out (no line of yours): just the top and what is below', () => {
  assert.equal(shape(standingsWindow(field(170), () => false)), '1,2,3,4,5 |165|');
});

test('you in or near the top merge into one run', () => {
  assert.equal(shape(standingsWindow(field(170), mineIs(3))), '1,2,3,4,5 |165|');
  assert.equal(shape(standingsWindow(field(170), mineIs(7))), '1,2,3,4,5,6,7,8,9 |161|', 'touching the top joins it');
  // Ranks 6 and 7 skipped would leave a gap of 2 — kept as a gap; a single-row hole is filled.
  assert.equal(shape(standingsWindow(field(170), mineIs(10))), '1,2,3,4,5 |2| 8,9,10,11,12 |158|');
  assert.equal(shape(standingsWindow(field(170), mineIs(9))), '1,2,3,4,5,6,7,8,9,10,11 |159|', 'a one-row hole is drawn, not hidden');
});

test('you at the very bottom: no trailing gap, and a last lone row is drawn', () => {
  assert.equal(shape(standingsWindow(field(170), mineIs(170))), '1,2,3,4,5 |162| 168,169,170');
  assert.equal(shape(standingsWindow(field(170), mineIs(167))), '1,2,3,4,5 |159| 165,166,167,168,169,170');
});

test('several accounts: each gets its neighbours, capped at three, the rest counted', () => {
  const w = standingsWindow(field(170), mineIs(20, 22, 90, 140, 160));
  assert.equal(shape(w), '1,2,3,4,5 |12| 18,19,20,21,22,23,24 |63| 88,89,90,91,92 |78|');
  assert.equal(w.mineMore, 2);
  // A fourth account that happens to be visible (a neighbour of another) isn't "more".
  assert.equal(standingsWindow(field(170), mineIs(20, 30, 40, 41)).mineMore, 0);
});

test('ties keep the caller’s order; the window never reorders', () => {
  const rows: R[] = [
    { id: 1, name: 'A', score: 5 },
    { id: 2, name: 'B', score: 5 },
    { id: 3, name: 'C', score: 5 },
  ];
  assert.equal(shape(standingsWindow(rows, mineIs(3), { top: 1, around: 0 })), '1,2,3');
});

test('paging: 25 a page, clamped, in standing order', () => {
  const rows = field(170);
  const p1 = standingsPage(rows, (r) => r.name);
  assert.deepEqual([p1.page, p1.pages, p1.rows.length, p1.rows[0].id, p1.matched], [1, 7, 25, 1, 170]);
  const last = standingsPage(rows, (r) => r.name, { page: 99 });
  assert.deepEqual([last.page, last.rows.length, last.rows[0].id], [7, 20, 151]);
  assert.equal(standingsPage(rows, (r) => r.name, { page: 0 }).page, 1);
  assert.deepEqual(standingsPage([], (r: R) => r.name), { rows: [], page: 1, pages: 1, matched: 0 });
});

test('search: loose on case, spaces, underscores and dashes; keeps standing order; pages the hits', () => {
  const rows: R[] = [
    { id: 1, name: 'Zezima', score: 9 },
    { id: 2, name: 'Iron_Zez', score: 8 },
    { id: 3, name: 'B0aty', score: 7 },
    { id: 4, name: 'zez ima', score: 6 },
  ];
  const hit = standingsPage(rows, (r) => r.name, { query: 'ZEZ' });
  assert.deepEqual(hit.rows.map((r) => r.id), [1, 2, 4]);
  assert.deepEqual(standingsPage(rows, (r) => r.name, { query: 'iron zez' }).rows.map((r) => r.id), [2]);
  assert.deepEqual(standingsPage(rows, (r) => r.name, { query: 'zez-ima' }).rows.map((r) => r.id), [4]);
  const paged = standingsPage(rows, (r) => r.name, { query: 'z', pageSize: 2, page: 2 });
  assert.deepEqual([paged.rows.map((r) => r.id), paged.pages, paged.matched], [[4], 2, 3]);
  assert.equal(standingsPage(rows, (r) => r.name, { query: 'nobody' }).matched, 0);
});

test('many teams: 12+ teams of any size get the cut, worded as teams; small boards keep cards', () => {
  const thirty = Array.from({ length: 30 }, (_, i) => 2 + (i % 2));
  assert.equal(isManyTeams('auto', thirty), true);
  assert.equal(standingsLayout('auto', thirty), 'teams');
  assert.equal(standingsLayout('draft', Array(11).fill(3)), 'cards', '2–11 teams stay as today');
  assert.equal(standingsLayout('draft', [5, 5]), 'cards');
  assert.equal(standingsLayout('draft', Array(12).fill(3)), 'teams');
  // Solo-like wins: players wording, not teams.
  assert.equal(standingsLayout('solo', thirty), 'players');
  assert.equal(standingsLayout('draft', Array(20).fill(1)), 'players');
  assert.equal(isManyTeams('draft', Array(20).fill(1)), false);
  // A big board mixing one-person and bigger teams is a team board.
  assert.equal(standingsLayout('draft', [...Array(15).fill(1), 2]), 'teams');
});

test('many teams: your team with neighbours; on two teams, each shows', () => {
  assert.equal(shape(standingsWindow(field(30), mineIs(18))), '1,2,3,4,5 |10| 16,17,18,19,20 |10|');
  assert.equal(shape(standingsWindow(field(30), mineIs(12, 25))), '1,2,3,4,5 |4| 10,11,12,13,14 |8| 23,24,25,26,27 |3|');
});

test('search by team name or any member name', () => {
  const teams = [
    { id: 1, name: 'Red Raiders', members: ['Zezima', 'B0aty'] },
    { id: 2, name: 'Blue Moon', members: ['Lynx_Titan'] },
    { id: 3, name: 'Zez Squad', members: ['Other'] },
  ];
  const by = (q: string) => standingsPage(teams, (t) => [t.name, ...t.members], { query: q }).rows.map((t) => t.id);
  assert.deepEqual(by('zez'), [1, 3], 'a member on one, the team name on the other, standing order kept');
  assert.deepEqual(by('lynx titan'), [2]);
  assert.deepEqual(by('moon'), [2]);
  assert.deepEqual(by('nobody'), []);
});
