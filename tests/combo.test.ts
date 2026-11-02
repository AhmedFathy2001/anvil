// Combo tiles (lib/combo, lib/comboProgress): the rule over the parts (any / all / nOf / mix), Solo vs
// Team, the parent's recompute from its parts, keeping parts off the board, and the panel fold. Pure.
//
// Run: npx tsx --test tests/combo.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  comboLabel,
  comboNeeded,
  comboSentence,
  evaluateCombo,
  evaluateMix,
  mixPercent,
  nestParts,
  parseComboRule,
  partFraction,
  serializeComboRule,
  tileWithPartIds,
  validateComboRule,
  validateComboWeight,
  withoutParts,
  type ComboRule,
} from '../src/lib/combo.ts';
import { comboProgressLine, comboView, partState, type PartInputs } from '../src/lib/comboProgress.ts';
import { boardTiles, missionTiles } from '../src/lib/eventRules.ts';
import { scoreTeams } from '../src/lib/boardScoring.ts';
import { computeMemberBreakdown, foldCombosForBreakdown } from '../src/lib/memberBreakdown.ts';
import { panelTiles } from '../src/lib/pluginPanel.ts';

const ANY: ComboRule = { mode: 'any' };
const ALL: ComboRule = { mode: 'all' };
const TWO: ComboRule = { mode: 'nOf', n: 2 };
const MIX: ComboRule = { mode: 'mix' };

test('rule validation and parsing', () => {
  assert.deepEqual(validateComboRule({ mode: 'any' }), { ok: true, value: { mode: 'any' } });
  assert.deepEqual(validateComboRule('{"mode":"nOf","n":2}', 4), { ok: true, value: { mode: 'nOf', n: 2 } });
  assert.deepEqual(validateComboRule({ mode: 'mix', n: 9 }), { ok: true, value: { mode: 'mix' } });
  assert.equal(validateComboRule({ mode: 'nOf', n: 3 }, 2).ok, false);
  assert.equal(validateComboRule({ mode: 'nOf' }).ok, false);
  assert.equal(validateComboRule({ mode: 'some' }).ok, false);
  assert.equal(validateComboRule('{bad').ok, false);
  assert.deepEqual(parseComboRule(null), { mode: 'any' });
  assert.deepEqual(parseComboRule('{bad'), { mode: 'any' });
  assert.equal(serializeComboRule({ mode: 'all', n: 3 }), '{"mode":"all"}');
  assert.equal(comboNeeded(ANY, 3), 1);
  assert.equal(comboNeeded(ALL, 3), 3);
  assert.equal(comboNeeded({ mode: 'nOf', n: 9 }, 3), 3);
  assert.deepEqual(validateComboWeight(0.5), { ok: true, value: 0.5 });
  assert.deepEqual(validateComboWeight(1), { ok: true, value: null });
  assert.equal(validateComboWeight(0).ok, false);
  assert.equal(validateComboWeight(1.5).ok, false);
});

test('any / all / nOf over a team’s part completions', () => {
  const parts = [11, 12, 13, 14];
  const done = [{ tileId: 12 }, { tileId: 14 }, { tileId: 99 }]; // 99 isn't a part
  assert.equal(evaluateCombo(ANY, parts, done).complete, true);
  assert.equal(evaluateCombo(ALL, parts, done).complete, false);
  assert.equal(evaluateCombo(ALL, parts, done).done, 2);
  assert.equal(evaluateCombo(TWO, parts, done).complete, true);
  assert.equal(evaluateCombo({ mode: 'nOf', n: 3 }, parts, done).complete, false);
  assert.equal(evaluateCombo(ANY, parts, []).complete, false);
  assert.equal(evaluateCombo(ANY, [], done).complete, false);
});

test('solo: one member must do it all; team-wide parts count for everyone', () => {
  const parts = [1, 2, 3];
  // Member 7 did part 1, member 8 did part 2: a team has both, no single member does.
  const split = [{ tileId: 1, creditPlayerId: 7 }, { tileId: 2, creditPlayerId: 8 }];
  assert.equal(evaluateCombo(TWO, parts, split, 'team').complete, true);
  assert.equal(evaluateCombo(TWO, parts, split, 'individual').complete, false);
  // A team-total part (no finisher) counts for every member: 7 now has 1 + 3.
  const withTeamPart = [...split, { tileId: 3, creditPlayerId: null }];
  const ev = evaluateCombo(TWO, parts, withTeamPart, 'individual');
  assert.equal(ev.complete, true);
  assert.equal(ev.done, 2);
  assert.ok(ev.finisherPlayerId === 7 || ev.finisherPlayerId === 8);
  // Solo "all": nobody has all three alone.
  assert.equal(evaluateCombo(ALL, parts, withTeamPart, 'individual').complete, false);
  assert.equal(evaluateCombo(ALL, parts, [...withTeamPart, { tileId: 2, creditPlayerId: 7 }], 'individual').finisherPlayerId, 7);
});

test('mix: "200 demonic gorilla kills or 2 zenytes" — 1 zenyte + 100 kills is 100%', () => {
  const parts = [{ id: 1 }, { id: 2 }];
  const state = new Map([
    [1, { done: false, current: 100, required: 200 }],
    [2, { done: false, current: 1, required: 2 }],
  ]);
  const ev = evaluateMix(parts, (id) => state.get(id));
  assert.equal(ev.complete, true);
  assert.equal(ev.share, 1);
  assert.equal(mixPercent(ev.share), '100%');
  // Half of one part alone is 25%.
  assert.equal(mixPercent(evaluateMix(parts, (id) => (id === 1 ? { done: false, current: 100, required: 200 } : undefined)).share), '50%');
});

test('mix: weights, a part capped at its own share, boolean parts', () => {
  // A whole gorilla part is only worth half the combo.
  const weighted = [{ id: 1, comboWeight: 0.5 }, { id: 2 }];
  const s = new Map([
    [1, { done: true }],
    [2, { done: false, current: 0, required: 2 }],
  ]);
  assert.equal(evaluateMix(weighted, (id) => s.get(id)).share, 0.5);
  assert.equal(evaluateMix(weighted, (id) => s.get(id)).complete, false);
  // Overshooting a part (400/200 kills) never counts past that part's own share.
  assert.equal(partFraction({ done: false, current: 400, required: 200 }), 1);
  assert.equal(evaluateMix([{ id: 1, comboWeight: 0.5 }, { id: 2, comboWeight: 0.5 }], (id) => (id === 1 ? { done: false, current: 400, required: 200 } : undefined)).share, 0.5);
  // A part with no partial progress (a timed clear) is 0 or all of its weight.
  assert.equal(partFraction({ done: false }), 0);
  assert.equal(partFraction({ done: true }), 1);
  // Thirds add up to done despite floating point.
  const thirds = [{ id: 1 }, { id: 2 }, { id: 3 }];
  assert.equal(evaluateMix(thirds, () => ({ done: false, current: 1, required: 3 })).complete, true);
});

test('mix: solo sums each member’s own, the team sums everyone’s', () => {
  const parts = [{ id: 1 }, { id: 2 }];
  const team = new Map([
    [1, { done: false, current: 100, required: 200 }],
    [2, { done: false, current: 1, required: 2 }],
  ]);
  // Member 7 has the 100 kills, member 8 the zenyte: the team is at 100%, no member is.
  const members = new Map([
    [7, (id: number) => (id === 1 ? { done: false, current: 100, required: 200 } : { done: false, current: 0, required: 2 })],
    [8, (id: number) => (id === 2 ? { done: false, current: 1, required: 2 } : { done: false, current: 0, required: 200 })],
  ]);
  assert.equal(evaluateMix(parts, (id) => team.get(id), 'team', members).complete, true);
  const solo = evaluateMix(parts, (id) => team.get(id), 'individual', members);
  assert.equal(solo.complete, false);
  assert.equal(solo.share, 0.5);
  // Member 7 finishes it alone with 200 kills.
  members.set(7, (id: number) => (id === 1 ? { done: false, current: 200, required: 200 } : { done: false, current: 0, required: 2 }));
  const done = evaluateMix(parts, (id) => team.get(id), 'individual', members);
  assert.equal(done.complete, true);
  assert.equal(done.finisherPlayerId, 7);
});

test('part progress: count, capped count, collection, stat, boolean', () => {
  const sub = (playerId: number, amount: number, extra: object = {}) => ({ playerId, creditPlayerId: null, amount, goal: null, ...extra });
  // A kill counter.
  assert.deepEqual(partState({ id: 1, tileType: 'kill', requiredAmount: 200 }, { done: false, subs: [sub(7, 60), sub(8, 40)] }), { done: false, current: 100, required: 200 });
  assert.deepEqual(partState({ id: 1, tileType: 'kill', requiredAmount: 200 }, { done: false, subs: [sub(7, 60), sub(8, 40)] }, 7), { done: false, current: 60, required: 200 });
  // A capped counter (GOTR searches with event energy).
  const capped = { id: 2, tileType: 'kill', requiredAmount: 100, capBy: JSON.stringify(['GOTR elemental energy', 'GOTR catalytic energy']) };
  const rows = [sub(7, 60), { ...sub(7, 40), goal: 'cap:0' }, { ...sub(7, 50), goal: 'cap:1' }];
  assert.equal(partState(capped, { done: false, subs: rows }).current, 40);
  // A collection (2 of 3 pieces).
  const coll = { id: 3, tileType: 'drop', itemRequirements: JSON.stringify([{ itemId: 1, requiredAmount: 1 }, { itemId: 2, requiredAmount: 1 }, { itemId: 3, requiredAmount: 1 }]) };
  assert.deepEqual(partState(coll, { done: false, subs: [sub(7, 1, { itemId: 1 }), sub(8, 1, { itemId: 3 })] }), { done: false, current: 2, required: 3 });
  // A hiscores XP part.
  const stat = { id: 4, trackedStat: 'fishing', statType: 'skill', statGoal: 1000 };
  assert.deepEqual(partState(stat, { done: false, stat: [{ playerId: 7, gained: 300 }, { playerId: 8, gained: 200 }] }), { done: false, current: 500, required: 1000 });
  // A collection-log part: new slots are distinct (member, item) — a teammate's same item is a new slot,
  // a member's repeat isn't; whole pages are read off each log, so done or not here.
  const clog = { id: 6, tileType: 'clog', countMode: 'slots', requiredAmount: 5 };
  const slots = [sub(7, 1, { itemId: 1 }), sub(7, 1, { itemId: 1 }), sub(8, 1, { itemId: 1 }), sub(8, 1, { itemId: 2 })];
  assert.deepEqual(partState(clog, { done: false, subs: slots }), { done: false, current: 3, required: 5 });
  assert.deepEqual(partState(clog, { done: false, subs: slots }, 8), { done: false, current: 2, required: 5 });
  assert.deepEqual(partState({ ...clog, countMode: 'complete' }, { done: false, subs: slots }), { done: false });
  // A timed clear has no partial progress; a done part is done — for every member when nobody is named.
  assert.deepEqual(partState({ id: 5, tileType: 'timed', timedActivity: 'Inferno' }, { done: false }), { done: false });
  assert.deepEqual(partState({ id: 5, tileType: 'timed' }, { done: true, doneBy: null }, 8), { done: true });
  assert.deepEqual(partState({ id: 5, tileType: 'timed' }, { done: true, doneBy: 7 }, 8), { done: false });
});

test('comboView: what the board shows', () => {
  const parts = [
    { id: 1, label: '200 Demonic gorilla kills', tileType: 'kill', requiredAmount: 200 },
    { id: 2, label: 'Zenyte shards', tileType: 'drop', requiredAmount: 2 },
  ];
  const inputs = new Map<number, PartInputs>([
    [1, { done: false, subs: [{ playerId: 7, amount: 50, goal: null }] }],
    [2, { done: false, subs: [{ playerId: 8, amount: 1, goal: null }] }],
  ]);
  const mix = comboView({ comboRule: '{"mode":"mix"}' }, parts, (id) => inputs.get(id)!);
  assert.equal(mix.complete, false);
  assert.equal(mix.summary, '75%');
  assert.equal(comboProgressLine(mix), '75% — 50/200 200 Demonic gorilla kills, 1/2 Zenyte shards');
  const any = comboView({ comboRule: '{"mode":"any"}' }, parts, (id) => ({ ...inputs.get(id)!, done: id === 2 }));
  assert.equal(any.complete, true);
  assert.equal(any.summary, '1 of 1 done');
  const all = comboView({ comboRule: '{"mode":"all"}' }, parts, (id) => ({ ...inputs.get(id)!, done: id === 2 }));
  assert.equal(all.summary, '1 of 2 done');
});

test('words', () => {
  assert.equal(comboLabel(ANY, ['A Vorkath unique', '200 Vorkath KC']), 'A Vorkath unique or 200 Vorkath KC');
  assert.equal(comboLabel(ALL, ['A', 'B', 'C']), 'A, B and C');
  assert.equal(comboLabel(TWO, ['A', 'B', 'C']), '2 of: A, B, C');
  assert.equal(comboLabel(MIX, ['A', 'B']), 'A or B (any mix)');
  assert.equal(comboSentence(ANY, ['A', 'B']), 'Done when the team does any one of: A; B.');
  assert.equal(comboSentence(ALL, ['A', 'B'], true), 'Done when one player does both of: A; B.');
  assert.equal(comboSentence(TWO, ['A', 'B', 'C']), 'Done when the team does any two of: A; B; C.');
  assert.match(comboSentence(MIX, ['A', 'B']), /any mix of: A; B — each part adds its share, done at 100%\./);
});

test('parts are never board cells: boardTiles, scoring, nesting', () => {
  const tiles = [
    { id: 1, points: 10, mission: 0, parentTileId: null, tileType: 'combo' },
    { id: 2, points: 0, mission: 0, parentTileId: 1, tileType: 'kill' },
    { id: 3, points: 0, mission: 0, parentTileId: 1, tileType: 'drop' },
    { id: 4, points: 5, mission: 0, parentTileId: null, tileType: 'drop' },
    { id: 5, points: 7, mission: 1, parentTileId: null, tileType: 'drop' },
  ];
  assert.deepEqual(boardTiles(tiles).map((t) => t.id), [1, 4]);
  assert.deepEqual(missionTiles(tiles).map((t) => t.id), [5]);
  assert.deepEqual(withoutParts(tiles).map((t) => t.id), [1, 4, 5]);
  const nested = nestParts(tiles);
  assert.deepEqual(nested.map((t) => t.id), [1, 4, 5]);
  assert.deepEqual(nested[0].parts?.map((p) => p.id), [2, 3]);
  assert.deepEqual([...tileWithPartIds(nested, 1)], [1, 2, 3]);
  assert.deepEqual([...tileWithPartIds(nested, 4)], [4]);
  // Part completions never score, in either scoring mode — not even on a tile-count board.
  const completions = [{ teamId: 1, tileId: 2 }, { teamId: 1, tileId: 3 }, { teamId: 1, tileId: 4 }];
  const [tilesMode] = scoreTeams({ scoringMode: 'tiles', tiles, completions, teams: [{ id: 1 }] });
  assert.equal(tilesMode.score, 1);
  assert.equal(tilesMode.total, 2);
  const [points] = scoreTeams({ scoringMode: 'points', tiles, completions: [...completions, { teamId: 1, tileId: 1 }], teams: [{ id: 1 }] });
  assert.equal(points.boardScore, 15);
});

test('member breakdown: a combo’s points go to whoever worked its parts', () => {
  const tiles = [
    { id: 1, points: 10, tileType: 'combo', parentTileId: null },
    { id: 2, points: 0, tileType: 'kill', parentTileId: 1, requiredAmount: 200 },
    { id: 3, points: 0, tileType: 'drop', parentTileId: 1, requiredAmount: 2 },
  ];
  const players = [{ id: 7, name: 'Ann', teamId: 1 }, { id: 8, name: 'Bo', teamId: 1 }];
  const submissions = [
    { teamId: 1, tileId: 2, creditPlayerId: 7, amount: 150 },
    { teamId: 1, tileId: 2, creditPlayerId: 8, amount: 50 },
    { teamId: 1, tileId: 3, creditPlayerId: 8, amount: 1 },
    { teamId: 1, tileId: 3, creditPlayerId: 8, amount: 5, goal: 'cap:0' }, // never work
  ];
  const completions = [{ teamId: 1, tileId: 1 }, { teamId: 1, tileId: 2 }];
  const folded = foldCombosForBreakdown({ players, tiles, completions, submissions });
  assert.deepEqual(folded.tiles.map((t) => t.id), [1]);
  assert.deepEqual(folded.completions.map((c) => c.tileId), [1]);
  const bd = computeMemberBreakdown({ teamId: 1, scoringMode: 'points', players, tiles, completions, submissions });
  const pts = Object.fromEntries(bd.map((m) => [m.name, m.points]));
  // Part 2: Ann 750 / Bo 250 of 1000; part 3: Bo 1000 → Ann 3.75, Bo 6.25 of the combo's 10 (shown rounded).
  assert.equal(pts.Ann + pts.Bo, 10);
  assert.ok(pts.Ann >= 3 && pts.Ann <= 4, `Ann ${pts.Ann}`);
  assert.ok(pts.Bo >= 6 && pts.Bo <= 7, `Bo ${pts.Bo}`);
});

test('plugin panel: parts fold under their combo row', () => {
  const base = { position: 0, points: 0, description: null };
  const rows = panelTiles({
    trackedKills: [{ ...base, tileId: 2, label: '100 searches', requiredAmount: 100, currentAmount: 37 }],
    trackedDrops: [{ ...base, tileId: 3, label: 'GOTR rare', requiredAmount: 1, currentAmount: 0 }],
    trackedStats: [{ ...base, tileId: 9, label: 'Fishing', goalAmount: 10, currentAmount: 2 }],
    trackedCombos: [
      { tileId: 1, label: 'GOTR rare or 100 searches', points: 10, position: 3, description: null, needed: 1, done: 0, parts: [{ tileId: 3, label: 'GOTR rare' }, { tileId: 2, label: '100 searches' }] },
    ],
  });
  assert.deepEqual(rows.map((r) => r.tileId), [9, 1]);
  const combo = rows[1];
  assert.equal(combo.current, 0);
  assert.equal(combo.goal, 1);
  assert.equal(combo.points, 10);
  assert.equal(combo.sets, '0 of 1 · GOTR rare 0/1 · 100 searches 37/100');
  assert.deepEqual(combo.parts?.map((p) => p.tileId), [3, 2]);
  // A mix combo's bar is in percent.
  const mix = panelTiles({
    trackedKills: [{ ...base, tileId: 2, label: 'Gorillas', requiredAmount: 200, currentAmount: 100 }],
    trackedDrops: [{ ...base, tileId: 3, label: 'Zenytes', requiredAmount: 2, currentAmount: 1 }],
    trackedCombos: [
      { tileId: 1, label: 'Gorillas or zenytes', points: 10, position: 0, description: null, needed: 1, done: 0, rule: 'mix', parts: [{ tileId: 2, label: 'Gorillas' }, { tileId: 3, label: 'Zenytes', weight: 0.5 }] },
    ],
  });
  assert.equal(mix[0].current, 75);
  assert.equal(mix[0].goal, 100);
  assert.match(mix[0].sets ?? '', /^75%/);
});
