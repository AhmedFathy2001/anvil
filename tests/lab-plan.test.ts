// The tile lab's planning half (lib/labPlan): per-format session defaults, team placement for big
// and solo fields, race route layouts, and the simulated field — which must never break a board's
// rules (race order, lockout, hidden tiles).
//
// Pure: no database. Run: npx tsx --test tests/lab-plan.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { EVENT_MODES } from '../src/lib/eventModes.ts';
import {
  LAB_FORMATS,
  MAX_LAB_FIELD,
  fieldPlayerName,
  fieldPlayerNames,
  labBoardSize,
  labFormat,
  labRouteLayout,
  labRules,
  labTileCount,
  labTileSeeds,
  labMissionSpec,
  labTilePlan,
  LAB_TILE_SET,
  planLabTeams,
  planSimulatedField,
  raceNextOptions,
  type SimTile,
} from '../src/lib/labPlan.ts';

test('every board format the site offers is a lab format, plus Solo', () => {
  for (const m of EVENT_MODES) assert.ok(LAB_FORMATS.some((f) => f.key === m.key), `${m.key} offered`);
  const solo = labFormat('solo');
  assert.equal(solo.format, 'bingo');
  assert.equal(solo.defaultPlacement, 'solo');
  assert.equal(labFormat('nonsense').key, 'classic');
});

test('format defaults: shape, scoring and sizes follow lib/eventModes', () => {
  const classic = labFormat('classic');
  assert.equal(classic.square, true);
  assert.equal(labTileCount(classic, labBoardSize(classic, undefined)), 25);
  assert.equal(labBoardSize(classic, 1), 1, 'one-tile grid stays allowed in the lab');
  assert.equal(labBoardSize(classic, 99), 12);

  const race = labFormat('race');
  assert.equal(race.format, 'tilerace');
  assert.equal(race.scoringMode, 'tiles');
  assert.equal(labBoardSize(race, 1), 3, 'a race needs three tiles');

  const leagues = labFormat('leagues');
  assert.equal(leagues.scoringMode, 'points');
  assert.equal(labTileCount(leagues, labBoardSize(leagues, 150)), 150);

  const ladder = labFormat('ladder');
  assert.equal(ladder.format, 'ladder');
  assert.equal(ladder.defaultPlacement, 'solo');
});

test('rules: plain boards post nothing; drawing formats carry their policy and run fast', () => {
  assert.deepEqual(labRules(labFormat('classic')), { rulesAtStart: false });
  const bounty = labRules(labFormat('bounty'))!;
  assert.equal(bounty.revealPolicy, 'bounty');
  assert.equal(labRules(labFormat('luckydraw'))!.revealIntervalMinutes, 5);
  assert.equal(labRules(labFormat('showdown'))!.revealPolicy, 'scheduled');
});

test('tile seeds: points boards get spread values, showdown tiles get staggered opening times', () => {
  const start = Date.parse('2026-11-08T12:00:00Z');
  const leagues = labTileSeeds(labFormat('leagues'), 6, start);
  assert.equal(leagues.length, 6);
  assert.ok(new Set(leagues.map((t) => t.points)).size > 1);
  assert.ok(labTileSeeds(labFormat('classic'), 2, start).every((t) => t.points === 1 && t.revealAt == null));
  const show = labTileSeeds(labFormat('showdown'), 3, start);
  assert.equal(show[0].revealAt, '2026-11-08T12:00:00.000Z');
  assert.ok(Date.parse(show[2].revealAt!) > Date.parse(show[1].revealAt!));
  // Real tiles, not "Step 1": the opener first, the raid last.
  const race = labTileSeeds(labFormat('race'), 3, start);
  assert.deepEqual(race.map((t) => t.label), ['Wintertodt crate', '2 Araxxor kills', 'Chambers of Xeric']);
});

test('lab tiles: real, creditable kinds; never the same tile twice; one start and one finish', () => {
  const kinds = new Set(LAB_TILE_SET.map((t) => t.tileType));
  for (const k of ['kill', 'drop', 'value', 'timed', 'pvp', 'diary', 'ca', 'clog', 'lap']) assert.ok(kinds.has(k), k);
  for (const n of [4, 10, 18, 25, 40]) {
    const plan = labTilePlan(n);
    assert.equal(plan.length, n);
    assert.equal(new Set(plan.map((t) => t.label)).size, n, `no repeats in ${n}`);
    assert.equal(plan[0].label, 'Wintertodt crate');
    assert.equal(plan[n - 1].label, 'Chambers of Xeric');
  }
  // A race laid out from them has one start and one finish (the diamond / two roads / braid).
  const ids = labTilePlan(10).map((_, i) => i + 1);
  for (const kind of ['diamond', 'lanes2', 'braid3'] as const) {
    const route = labRouteLayout(kind, ids);
    const last = Math.max(...route.map((e) => e.step));
    assert.equal(route.filter((e) => e.step === 0).length, 1, `${kind}: one start`);
    assert.equal(route.filter((e) => e.step === last).length, 1, `${kind}: one finish`);
  }
  assert.deepEqual(labRouteLayout('line', ids), []);
});

test('teams: own characters share "Lab"; the field is dealt into teams of the asked size', () => {
  const own = [{ key: '1', name: 'Me', own: true }, { key: '2', name: 'Alt', own: true }];
  const field = fieldPlayerNames(90).map((n) => ({ key: n, name: `Lab~${n}`, own: false }));
  const planned = planLabTeams({ placement: 'team', entrants: [...own, ...field], teamSize: 3 });
  assert.equal(planned[0].name, 'Lab');
  assert.deepEqual(planned[0].members, ['1', '2']);
  assert.equal(planned.length, 31, '30 teams of 3 plus yours');
  assert.ok(planned.slice(1).every((t) => t.members.length === 3));
  assert.equal(new Set(planned.map((t) => t.name)).size, planned.length, 'names are unique');
  assert.equal(new Set(planned.map((t) => t.color)).size, planned.length, 'colours are unique');
});

test('teams: solo puts every entrant on their own, named after them, around existing names', () => {
  const planned = planLabTeams({
    placement: 'solo',
    entrants: [{ key: 'a', name: 'Lab~Field1', own: false }, { key: 'b', name: 'Lab~Field2', own: false }],
    teamSize: 3,
    existing: [{ name: 'Lab~Field1', color: '#dc2626' }],
  });
  assert.deepEqual(planned.map((t) => t.name), ['Lab~Field1 (2)', 'Lab~Field2']);
  assert.ok(planned.every((t) => t.members.length === 1 && t.color !== '#dc2626'));
  assert.equal(fieldPlayerNames(MAX_LAB_FIELD + 50).length, MAX_LAB_FIELD, 'field capped');
  const names = fieldPlayerNames(MAX_LAB_FIELD);
  assert.ok(names.every((n) => n.length <= 8), 'fits a test-user name');
  assert.equal(new Set(names).size, names.length, 'all distinct');
  assert.equal(names[998], 'Field999', 'earlier sessions\' rows are reused');
  assert.equal(fieldPlayerName(1000), 'F1000');
  assert.equal(fieldPlayerName(9_999_999).length, 8);
});

test('route layouts: every link goes to the next step; line stores nothing', () => {
  const ids = Array.from({ length: 10 }, (_, i) => 100 + i);
  assert.deepEqual(labRouteLayout('line', ids), []);
  for (const kind of ['lanes2', 'diamond', 'braid3'] as const) {
    const entries = labRouteLayout(kind, ids);
    assert.equal(entries.length, ids.length, `${kind} places every tile`);
    const stepOf = new Map(entries.map((e) => [e.id, e.step]));
    const last = Math.max(...entries.map((e) => e.step));
    for (const e of entries) {
      for (const to of e.next) assert.equal(stepOf.get(to), e.step + 1, `${kind}: link to next step`);
      if (e.step < last) assert.ok(e.next.length > 0, `${kind}: no dead end before the finish`);
    }
  }
  const diamond = labRouteLayout('diamond', ids);
  assert.equal(diamond.filter((e) => e.step === 0).length, 1, 'diamond has one start');
});

const T0 = Date.parse('2026-11-08T12:00:00Z');
const line = (n: number): SimTile[] => Array.from({ length: n }, (_, i) => ({ id: i + 1, position: i }));

test('simulated race: each team only ever takes a prefix of the line, in order', () => {
  const credits = planSimulatedField({
    race: true,
    allVisible: true,
    tiles: line(12),
    teams: Array.from({ length: 30 }, (_, i) => ({ id: 1000 + i, memberIds: [i * 3, i * 3 + 1, i * 3 + 2], done: [] })),
    seed: 7,
    startMs: T0,
    nowMs: T0 + 3_600_000,
    intensity: 1,
  });
  assert.ok(credits.length > 0);
  const byTeam = new Map<number, typeof credits>();
  for (const c of credits) byTeam.set(c.teamId, [...(byTeam.get(c.teamId) ?? []), c]);
  for (const [, list] of byTeam) {
    assert.deepEqual(list.map((c) => c.tileId), list.map((_, i) => i + 1), 'a prefix, in order');
    const times = list.map((c) => c.completedAt);
    assert.deepEqual(times, [...times].sort(), 'finished in race order');
  }
  // The field spreads out rather than all landing on the same step.
  assert.ok(new Set([...byTeam.values()].map((l) => l.length)).size > 3);
});

test('simulated race continues from where a team already is', () => {
  const credits = planSimulatedField({
    race: true,
    allVisible: true,
    tiles: line(6),
    teams: [{ id: 1, memberIds: [5], done: [1, 2] }],
    seed: 3,
    startMs: T0,
    nowMs: T0 + 60_000,
    intensity: 1,
  });
  credits.forEach((c, i) => assert.equal(c.tileId, 3 + i));
  assert.ok(credits.every((c) => c.creditPlayerId === 5));
});

test('simulated branching race walks the links and commits to one road', () => {
  // Step 0: 1 → (2 | 3); step 2: 4 (merge).
  const tiles: SimTile[] = [
    { id: 1, position: 0, raceStep: 0, raceNext: [2, 3] },
    { id: 2, position: 1, raceStep: 1, raceNext: [4] },
    { id: 3, position: 2, raceStep: 1, raceNext: [4] },
    { id: 4, position: 3, raceStep: 2, raceNext: [] },
  ];
  assert.deepEqual(raceNextOptions(tiles, new Set()), [1]);
  assert.deepEqual(raceNextOptions(tiles, new Set([1])).sort(), [2, 3]);
  assert.deepEqual(raceNextOptions(tiles, new Set([1, 3])), [4]);
  assert.deepEqual(raceNextOptions(tiles, new Set([1, 3, 4])), [], 'finished');
  const credits = planSimulatedField({
    race: true,
    allVisible: true,
    tiles,
    teams: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, memberIds: [], done: [] })),
    seed: 11,
    startMs: T0,
    nowMs: T0 + 60_000,
    intensity: 1,
  });
  const byTeam = new Map<number, number[]>();
  for (const c of credits) byTeam.set(c.teamId, [...(byTeam.get(c.teamId) ?? []), c.tileId]);
  for (const [, ids] of byTeam) {
    assert.equal(ids[0], 1);
    assert.ok(!(ids.includes(2) && ids.includes(3)), 'never both roads');
    if (ids.includes(4)) assert.equal(ids.length, 3);
  }
});

test('simulated field skips hidden, closed, combo-part and taken lockout tiles', () => {
  const tiles: SimTile[] = [
    { id: 1, position: 0 },
    { id: 2, position: 1, revealedAt: null },
    { id: 3, position: 2, parentTileId: 1 },
    { id: 4, position: 3, mission: 1, revealedAt: null },
    { id: 5, position: 4, mission: 1, revealedAt: '2026-11-08T12:00:00Z', lockout: true },
    { id: 6, position: 5, revealedAt: '2026-11-08T12:00:00Z', closedAt: '2026-11-08T12:10:00Z' },
  ];
  // A board with a reveal policy: only revealed tiles are open (2 is hidden there).
  const credits = planSimulatedField({
    race: false,
    allVisible: false,
    tiles,
    teams: Array.from({ length: 40 }, (_, i) => ({ id: i + 1, memberIds: [i], done: [] })),
    seed: 5,
    startMs: T0,
    nowMs: T0 + 60_000,
    intensity: 1,
  });
  const ids = new Set(credits.map((c) => c.tileId));
  for (const hidden of [1, 2, 3, 4, 6]) assert.ok(!ids.has(hidden), `tile ${hidden} not credited`);
  assert.equal(credits.filter((c) => c.tileId === 5).length, 1, 'lockout mission goes to one team only');
});

test('simulated field is repeatable for a seed and respects intensity 0', () => {
  const input = {
    race: false,
    allVisible: true,
    tiles: line(25),
    teams: Array.from({ length: 10 }, (_, i) => ({ id: i + 1, memberIds: [i], done: [] })),
    seed: 42,
    startMs: T0,
    nowMs: T0 + 600_000,
    intensity: 0.8,
  };
  assert.deepEqual(planSimulatedField(input), planSimulatedField(input));
  assert.deepEqual(planSimulatedField({ ...input, intensity: 0 }), []);
  for (const c of planSimulatedField(input)) assert.match(c.completedAt, /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
});

test('mission tile: a real plan tile not already used, a harder copy once all are', () => {
  const first = labMissionSpec([]);
  assert.equal(first.label, LAB_TILE_SET[0].label);
  assert.notEqual(first.tileType, 'mission');
  const used = LAB_TILE_SET.map((t) => t.label);
  assert.equal(labMissionSpec(used.slice(0, 5)).label, LAB_TILE_SET[5].label);
  const harder = labMissionSpec(used);
  assert.ok(!used.includes(harder.label) && /×2$/.test(harder.label));
  assert.ok(harder.targetNpcs || harder.trackedItemIds || harder.timedActivity || harder.requiredAmount > 1);
});
