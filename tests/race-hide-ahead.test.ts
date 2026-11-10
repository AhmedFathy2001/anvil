import { test } from 'node:test';
import assert from 'node:assert/strict';
import { raceGraph, raceRouteOpts, teamRoute, type TeamRoute } from '../src/lib/raceRoutes.ts';
import {
  HIDDEN_RACE_TILE_LABEL,
  buildRaceVeil,
  hiddenFromAnotherTeam,
  isRaceHidden,
  maskRaceTile,
  maskRaceTiles,
  raceSeenFor,
  raceTeamSeen,
  raceTileHidden,
} from '../src/lib/raceHideAhead.ts';
import { parseEventRules, validateEventRules } from '../src/lib/eventRules.ts';
import { curtainRoute } from '../src/lib/standingsVisibility.ts';

// A straight line of six: no steps stored.
const line = [1, 2, 3, 4, 5, 6].map((id, i) => ({ id, position: i }));

// A fork: step 0: 10 → step 1: 20 | 21 → step 2: 30 (from 20) | 31 (from 21) → step 3: 40 (end).
const fork = [
  { id: 10, position: 0, raceStep: 0, raceNext: [20, 21] },
  { id: 20, position: 1, raceStep: 1, raceNext: [30] },
  { id: 21, position: 2, raceStep: 1, raceNext: [31] },
  { id: 30, position: 3, raceStep: 2, raceNext: [40] },
  { id: 31, position: 4, raceStep: 2, raceNext: [40] },
  { id: 40, position: 5, raceStep: 3, raceNext: [] },
];

const sorted = (s: Set<number> | null) => (s == null ? null : [...s].sort((a, b) => a - b));

test('a team that has done nothing sees only the start (its next step)', () => {
  const g = raceGraph(line);
  assert.deepEqual(sorted(raceTeamSeen(g, teamRoute(g, []))), [1]);
});

test('a straight line: done tiles, the current step and the next one', () => {
  const g = raceGraph(line);
  // Done 1 and 2 (standing on 2): 3 is next and in view; 4, 5 and 6 are locked.
  assert.deepEqual(sorted(raceTeamSeen(g, teamRoute(g, [1, 2]))), [1, 2, 3]);
});

test('a finished team sees the whole board', () => {
  const g = raceGraph(line);
  assert.equal(raceTeamSeen(g, teamRoute(g, [1, 2, 3, 4, 5, 6])), null);
});

test('at a fork both roads show; past the fork only steps up to the next one', () => {
  const g = raceGraph(fork);
  assert.deepEqual(sorted(raceTeamSeen(g, teamRoute(g, [10]))), [10, 20, 21]);
  // Took road 20: step 2 is next, both of its tiles are in view (31 sits there too); the finish is not.
  assert.deepEqual(sorted(raceTeamSeen(g, teamRoute(g, [10, 20]))), [10, 20, 21, 30, 31]);
});

test('"Choose and lock in": the fork the team picks from is in view before any pick', () => {
  const g = raceGraph(fork);
  const route = teamRoute(g, [10], new Map());
  assert.deepEqual(route.open, []);
  assert.deepEqual(sorted(raceTeamSeen(g, route)), [10, 20, 21]);
});

test('"Roads stay open": an earlier fork still open keeps its road in view, never further', () => {
  const g = raceGraph(fork);
  const route = teamRoute(g, [10, 20], null, raceRouteOpts('open'));
  const seen = raceTeamSeen(g, route)!;
  assert.ok(seen.has(21), 'the other road at the passed fork is still open');
  assert.ok(!seen.has(40), 'the finish stays hidden');
});

test('a banked or admin-marked finish further on stays in view for its team', () => {
  const g = raceGraph(line);
  // Done 1 and (off the path) 5: 5 is done, so the team can read it.
  const seen = raceTeamSeen(g, teamRoute(g, [1, 5], null, { lenient: false }))!;
  assert.ok(seen.has(5));
  assert.ok(!seen.has(4));
});

function routesOf(g: ReturnType<typeof raceGraph>, done: Record<number, number[]>): Map<number, TeamRoute> {
  return new Map(Object.entries(done).map(([team, ids]) => [Number(team), teamRoute(g, ids)]));
}

test('the veil: each team its own, the public what every team sees, staff what any team sees', () => {
  const g = raceGraph(line);
  const veil = buildRaceVeil('players', g, routesOf(g, { 1: [1, 2, 3], 2: [] }));
  assert.deepEqual(sorted(raceSeenFor(veil, { teamIds: [1] })), [1, 2, 3, 4]);
  assert.deepEqual(sorted(raceSeenFor(veil, { teamIds: [2] })), [1]);
  assert.deepEqual(sorted(raceSeenFor(veil, { teamIds: [] })), [1]);
  assert.deepEqual(sorted(raceSeenFor(veil, 'staff')), [1, 2, 3, 4]);
  assert.equal(raceSeenFor(veil, 'all'), null);
  // A team the veil doesn't know (another event's id) reads as the public.
  assert.deepEqual(sorted(raceSeenFor(veil, { teamIds: [99] })), [1]);
});

test('a finished team sees through the veil; with no teams the public sees the start only', () => {
  const g = raceGraph(line);
  const done = buildRaceVeil('players', g, routesOf(g, { 1: [1, 2, 3, 4, 5, 6], 2: [1] }));
  assert.equal(raceSeenFor(done, { teamIds: [1] }), null);
  const empty = buildRaceVeil('players', g, new Map());
  assert.deepEqual(sorted(raceSeenFor(empty, { teamIds: [] })), [1]);
});

test('hiddenFromAnotherTeam: a tile only the leader can see stays in the leader’s channel', () => {
  const g = raceGraph(line);
  const veil = buildRaceVeil('players', g, routesOf(g, { 1: [1, 2, 3], 2: [] }));
  assert.equal(hiddenFromAnotherTeam(veil, 3, 1), true, 'team 2 cannot see tile 3 yet');
  assert.equal(hiddenFromAnotherTeam(veil, 1, 1), false, 'everyone sees tile 1');
  assert.equal(hiddenFromAnotherTeam(veil, 1, 2), false, 'nor does it matter which team posts it');
  assert.equal(hiddenFromAnotherTeam(veil, 999, 1), false, 'a tile off the route (a mission) is never the veil’s');
  assert.equal(hiddenFromAnotherTeam(null, 3, 1), false, 'no veil, nothing hidden');
});

test('maskRaceTile keeps the slot and roads, drops every content field', () => {
  const tile = {
    id: 5, eventId: 1, position: 4, raceStep: 4, raceNext: [6], parentTileId: null,
    label: 'Giant key', icon: '/i/key.png', description: 'Get a giant key from Obor', tileType: 'drop',
    trackedItemIds: '[20754]', itemRequirements: '[{"itemId":20754,"name":"Giant key"}]', sourceNpcs: '["Obor"]',
    trackedStat: 'obor', statType: 'kc', statGoal: 5, category: 'Bosses', requiredAmount: 3, autoTrackDisabled: false,
    parts: [{ id: 7, label: 'part' }],
  };
  const m = maskRaceTile(tile);
  assert.equal(m.id, 5);
  assert.equal(m.position, 4);
  assert.equal(m.raceStep, 4);
  assert.deepEqual(m.raceNext, [6]);
  assert.equal(m.label, HIDDEN_RACE_TILE_LABEL);
  for (const k of ['icon', 'description', 'trackedItemIds', 'itemRequirements', 'sourceNpcs', 'trackedStat', 'statType', 'statGoal', 'category'] as const) {
    assert.equal(m[k], null, k);
  }
  assert.equal(m.tileType, 'standard');
  assert.equal(m.requiredAmount, 1);
  assert.equal(m.autoTrackDisabled, true);
  assert.deepEqual(m.parts, []);
  assert.ok(isRaceHidden(m));
  assert.ok(!JSON.stringify(m).toLowerCase().includes('giant'));
  assert.ok(!JSON.stringify(m).toLowerCase().includes('obor'));
});

test('maskRaceTiles masks hidden cells, drops their parts, leaves seen tiles and missions alone', () => {
  const g = raceGraph(line);
  const veil = buildRaceVeil('players', g, routesOf(g, { 1: [] }));
  const seen = raceSeenFor(veil, { teamIds: [1] });
  const list = [
    ...line.map((t) => ({ ...t, label: `T${t.id}`, parentTileId: null as number | null })),
    { id: 50, position: 0, label: 'Part of 5', parentTileId: 5 },
    { id: 60, position: 9, label: 'Mission', parentTileId: null },
  ];
  const out = maskRaceTiles(veil, seen, list);
  assert.deepEqual(out.map((t) => t.label), ['T1', HIDDEN_RACE_TILE_LABEL, HIDDEN_RACE_TILE_LABEL, HIDDEN_RACE_TILE_LABEL, HIDDEN_RACE_TILE_LABEL, HIDDEN_RACE_TILE_LABEL, 'Mission']);
  assert.equal(raceTileHidden(veil, seen, { id: 50, parentTileId: 5 }), true);
  // Seeing through (null) changes nothing.
  assert.equal(maskRaceTiles(veil, null, list), list);
});

test('the setting: off by default, stored only when on, validated', () => {
  assert.equal(parseEventRules(null).raceHideAhead, 'off');
  assert.equal(parseEventRules('{"raceHideAhead":"bogus"}').raceHideAhead, 'off');
  assert.deepEqual(validateEventRules({ raceHideAhead: 'off' }), { rules: null });
  const on = validateEventRules({ raceHideAhead: 'staff' });
  assert.ok('rules' in on && on.rules);
  assert.equal(parseEventRules(on.rules).raceHideAhead, 'staff');
  assert.ok('error' in validateEventRules({ raceHideAhead: 'everyone' }));
});

test('Discord: a progress post naming a tile hidden from another team stays with its team', () => {
  assert.deepEqual(curtainRoute('tileComplete', 4, false, true), { shared: false, teamOnly: 4 });
  assert.deepEqual(curtainRoute('submissions', 4, false, false), { shared: true, teamOnly: null });
  // Not a progress post (a reveal, the start): unaffected.
  assert.deepEqual(curtainRoute('eventStart', 4, false, true), { shared: true, teamOnly: null });
});
