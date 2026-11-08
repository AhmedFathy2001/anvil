import { test } from 'node:test';
import assert from 'node:assert/strict';
import { raceGraph, teamRoute } from '../src/lib/raceRoutes.ts';
import { gapWatch, panelSteps, raceFeed, raceFirsts, raceLines, raceStatCards, raceSummaryLine } from '../src/lib/raceSummary.ts';

// start(10) -> junction 20 (from 10 and 11) -> 30 | 31 -> 40
const tiles = [
  { id: 10, position: 0, raceStep: 0, raceNext: [20] },
  { id: 11, position: 1, raceStep: 0, raceNext: [20] },
  { id: 20, position: 2, raceStep: 1, raceNext: [30, 31] },
  { id: 30, position: 3, raceStep: 2, raceNext: [40] },
  { id: 31, position: 4, raceStep: 2, raceNext: [40] },
  { id: 40, position: 5, raceStep: 3, raceNext: [] },
];
const g = raceGraph(tiles);
const teams = [
  { id: 1, name: 'Iron Lads', color: '#f00' },
  { id: 2, name: 'Lab', color: '#0f0' },
  { id: 3, name: 'Slowpokes', color: '#00f' },
];
const c = (teamId: number, tileId: number, at: string) => ({ teamId, tileId, completedAt: at });
const completions = [
  // Iron Lads start on lane A (10) and come out of the junction on lane B (31): a road switch.
  c(1, 10, '2026-11-01 08:00:00'), c(1, 20, '2026-11-01 10:00:00'), c(1, 31, '2026-11-01 12:00:00'),
  c(2, 11, '2026-11-01 09:00:00'),
];
const label = (id: number) => `T${id}`;
const lines = raceLines(g, teams, completions);

test('race lines: order, steps behind, road and pace', () => {
  assert.deepEqual(lines.map((l) => l.team.name), ['Iron Lads', 'Lab', 'Slowpokes']);
  assert.deepEqual(lines.map((l) => l.behind), [0, 2, 3]);
  assert.equal(lines[0].road, 'B');
  assert.equal(lines[0].currentTileId, 31);
  assert.equal(lines[0].perStep, 2 * 3_600_000);
  assert.equal(lines[2].road, null);
});

test('the panel summary line', () => {
  assert.equal(raceSummaryLine(g, lines, 2), 'Lab · step 2 of 4 · 2nd, 2 behind Iron Lads');
  assert.equal(raceSummaryLine(g, lines, 1), 'Iron Lads · step 4 of 4 · 1st, 2 ahead');
  assert.equal(raceSummaryLine(g, lines, null), 'Iron Lads lead · 3 of 4');
});

test('panel steps: numbered, lanes only where a step has several, phases and crowds', () => {
  const route = teamRoute(g, [11]);
  const steps = panelSteps(g, route, label, lines);
  assert.deepEqual(steps.map((s) => s.heading), ['Step 1 of 4 · Start', 'Step 2 of 4 · Junction', 'Step 3 of 4', 'Step 4 of 4 · Finish']);
  assert.deepEqual(steps.map((s) => s.phase), ['done', 'current', 'later', 'later']);
  assert.deepEqual(steps[0].tiles.map((t) => [t.road, t.state]), [['A', 'closed'], ['B', 'done']]);
  assert.equal(steps[1].tiles[0].road, null, 'a single tile has no lane letter');
  assert.equal(steps[1].tiles[0].state, 'open');
  // Crowds: Lab stands at step 2 (done 1), Slowpokes at step 1, Iron Lads at step 4.
  assert.deepEqual(steps.map((s) => s.crowd), [1, 1, 0, 1]);
});

test('stat cards: leader, your team, busiest road, pace', () => {
  const cards = raceStatCards(g, lines, 2);
  assert.equal(cards.leader!.name, 'Iron Lads');
  assert.equal(cards.leader!.line, '3 of 4 · on road B');
  assert.deepEqual(cards.you, { line: '2nd · 1 of 4', sub: '2 behind' });
  assert.ok(cards.busiest!.sub.endsWith('of 3 teams went this way'));
  assert.equal(cards.pace!.line, '1 tile / 2h');
  assert.equal(cards.pace!.sub, 'leader finishes in ~2h');
});

test('gap watch speaks plainly', () => {
  const s = gapWatch(lines, g);
  assert.equal(s[0], 'Iron Lads are one tile from the finish.');
  assert.ok(s.includes('Lab are 2 tiles behind Iron Lads.'));
  assert.ok(s.includes('Slowpokes are one tile behind Lab — one finish ties it.'));
});

test('race firsts and the feed', () => {
  const f = raceFirsts(g, teams, completions, label);
  assert.deepEqual(f.map((x) => [x.key, x.team.name]), [['off-the-line', 'Iron Lads'], ['junction', 'Iron Lads'], ['road-switch', 'Iron Lads']]);
  const feed = raceFeed(g, teams, completions, label);
  assert.equal(feed[0].line, 'T31 — step 3 of 4 · road B');
  assert.equal(feed.length, 4);
});
