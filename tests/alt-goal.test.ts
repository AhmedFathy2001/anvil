// Either/or tiles (lib/altGoal): the alternative's capped progress, the virtual plugin ids, and the
// one rule that matters — alternative rows never count toward the tile's own requirement. Pure.
//
// Run: npx tsx --test tests/alt-goal.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  altEntryLabel,
  countsAsCompletionProof,
  altGoalPhrase,
  altGoalProgressNote,
  altGoalUnitSingular,
  altProgress,
  altVirtualTileId,
  decodeAltTileId,
  goalForSlot,
  memberAltProgress,
  parseAltGoal,
  validateAltGoal,
  GOTR_ENERGY_CAPS,
  GOTR_SEARCHES,
  type AltGoal,
} from '../src/lib/altGoal.ts';
import { countProgress, itemAlreadyCounted, memberProgress } from '../src/lib/countProgress.ts';
import { howItCounts } from '../src/lib/collectionSets.ts';
import { panelTiles } from '../src/lib/pluginPanel.ts';
import { contributionRows } from '../src/lib/memberBreakdown.ts';
import { countTileTeams } from '../src/lib/tileTracker.ts';

const GOTR: AltGoal = { targets: [GOTR_SEARCHES], amount: 100, capBy: [...GOTR_ENERGY_CAPS] };

const row = (playerId: number, goal: string | null, amount: number, itemId: number | null = null) => ({ playerId, creditPlayerId: null, goal, amount, itemId });

test('virtual ids round-trip: -(parent * 8 + slot)', () => {
  assert.equal(altVirtualTileId(123, 0), -984);
  assert.equal(altVirtualTileId(123, 2), -986);
  assert.deepEqual(decodeAltTileId(-984), { parentId: 123, slot: 0 });
  assert.deepEqual(decodeAltTileId(-986), { parentId: 123, slot: 2 });
  assert.deepEqual(decodeAltTileId(altVirtualTileId(1, 7)), { parentId: 1, slot: 7 });
  assert.equal(decodeAltTileId(5), null);
  assert.equal(decodeAltTileId(0), null);
  assert.equal(decodeAltTileId(-3), null); // parent 0
  assert.equal(decodeAltTileId(-1.5), null);
});

test('slots map to goal values only when the goal has them', () => {
  assert.equal(goalForSlot(GOTR, 0), 'alt');
  assert.equal(goalForSlot(GOTR, 1), 'cap:0');
  assert.equal(goalForSlot(GOTR, 2), 'cap:1');
  assert.equal(goalForSlot(GOTR, 3), null);
  assert.equal(goalForSlot({ targets: ['Zulrah'], amount: 5 }, 1), null);
});

test('validation: shape, bounds, caps', () => {
  assert.deepEqual(validateAltGoal(null), { ok: true, value: null });
  assert.deepEqual(validateAltGoal(''), { ok: true, value: null });
  const ok = validateAltGoal(JSON.stringify(GOTR));
  assert.ok(ok.ok && ok.value?.capBy?.length === 2);
  assert.equal(validateAltGoal({ targets: [], amount: 5 }).ok, false);
  assert.equal(validateAltGoal({ targets: ['Zulrah'], amount: 0 }).ok, false);
  assert.equal(validateAltGoal({ targets: ['Zulrah'], amount: 2.5 }).ok, false);
  assert.equal(validateAltGoal({ targets: ['A'], amount: 1, capBy: ['A'] }).ok, false);
  assert.equal(validateAltGoal({ targets: ['A'], amount: 1, capBy: ['B', 'C', 'D', 'E', 'F'] }).ok, false);
  // Empty capBy is stored as no cap at all.
  assert.deepEqual(parseAltGoal({ targets: [' Zulrah '], amount: 5, capBy: [] }), { targets: ['Zulrah'], amount: 5 });
  assert.equal(parseAltGoal('{not json'), null);
});

test('team: each member capped by their own energy, then summed', () => {
  const rows = [
    // A: 60 searches, 40 elemental, 50 catalytic → 40 count.
    row(1, 'alt', 60), row(1, 'cap:0', 40), row(1, 'cap:1', 50),
    // B: 30 searches, plenty of energy → 30.
    row(2, 'alt', 10), row(2, 'alt', 20), row(2, 'cap:0', 100), row(2, 'cap:1', 90),
    // C: energy but no searches → 0. D: searches with no energy at all → 0.
    row(3, 'cap:0', 500), row(3, 'cap:1', 500),
    row(4, 'alt', 25),
    // Primary rows are another goal entirely.
    row(1, null, 3, 26813),
  ];
  const p = altProgress(rows, GOTR, 'team');
  assert.equal(p.current, 70);
  assert.equal(p.teamTotal, 70);
  assert.equal(p.finisherPlayerId, null);
  assert.equal(p.byMember.get(1), 40);
  assert.equal(p.byMember.get(2), 30);
  assert.equal(p.byMember.has(3), false);
  assert.equal(p.byMember.has(4), false);
  assert.deepEqual(p.raw, { alt: 115, caps: [640, 640] });
});

test('team: one member’s spare energy never pays for another’s searches', () => {
  const rows = [row(1, 'alt', 100), row(2, 'cap:0', 100), row(2, 'cap:1', 100)];
  assert.equal(altProgress(rows, GOTR, 'team').current, 0);
});

test('solo: the best single member, and who it was', () => {
  const rows = [
    row(1, 'alt', 60), row(1, 'cap:0', 40), row(1, 'cap:1', 50),
    row(2, 'alt', 55), row(2, 'cap:0', 55), row(2, 'cap:1', 70),
  ];
  const p = altProgress(rows, GOTR, 'individual');
  assert.equal(p.current, 55);
  assert.equal(p.finisherPlayerId, 2);
  assert.equal(p.teamTotal, 95);
  assert.equal(memberAltProgress(rows, GOTR, 1), 40);
  assert.equal(memberAltProgress(rows, GOTR, 9), 0);
});

test('uncapped goal: raw count, credit follows creditPlayerId', () => {
  const goal: AltGoal = { targets: ['Zulrah'], amount: 10 };
  const rows = [
    { playerId: 5, creditPlayerId: 1, goal: 'alt', amount: 4 },
    { playerId: 1, creditPlayerId: null, goal: 'alt', amount: 3 },
    { playerId: 2, creditPlayerId: null, goal: 'cap:0', amount: 99 }, // no such cap → ignored
  ];
  const team = altProgress(rows, goal, 'team');
  assert.equal(team.current, 7);
  assert.equal(altProgress(rows, goal, 'solo').finisherPlayerId, 1);
});

test('alt rows never count toward the primary requirement', () => {
  const rows = [row(1, null, 1, 26813), row(1, 'alt', 100), row(2, 'cap:0', 100), row(2, 'cap:1', 100)];
  // 100 searches are not 100 items on a one-item drop tile.
  assert.equal(countProgress(rows, 'team').current, 1);
  assert.equal(countProgress(rows, 'team').teamTotal, 1);
  assert.equal(countProgress(rows, 'individual').current, 1);
  assert.equal(memberProgress(rows, 1), 1);
  assert.equal(memberProgress(rows, 2), 0);
  assert.equal(countProgress(rows, 'team', 'distinct').current, 1);
  // A distinct pool doesn't see an alt row as an item already counted.
  assert.equal(itemAlreadyCounted([row(1, 'alt', 1, 26813)], 26813, 'team', null), false);
  // The tracker widget's bars and member lines read the same way.
  const teams = countTileTeams(
    { teams: [{ teamId: 1, name: 'A', color: null }], trackingMode: 'team', completedTeamIds: new Set(), viewerTeamId: null, viewerPlayerId: null, names: new Map() },
    rows.map((r) => ({ ...r, teamId: 1 })),
  );
  assert.equal(teams[0].current, 1);
  assert.deepEqual(teams[0].members.map((m) => m.amount), [1]);
});

test('contribution: the goal the tile was reached by, never the caps', () => {
  const both = [
    { teamId: 1, tileId: 7, goal: null, amount: 1 },
    { teamId: 1, tileId: 7, goal: 'alt', amount: 60 },
    { teamId: 1, tileId: 8, goal: 'alt', amount: 100 },
    { teamId: 1, tileId: 8, goal: 'cap:0', amount: 900 },
    { teamId: 2, tileId: 7, goal: 'alt', amount: 5 },
  ];
  assert.deepEqual(
    contributionRows(both).map((r) => `${r.teamId}:${r.tileId}:${r.goal}`),
    ['1:7:null', '1:8:alt', '2:7:alt'],
  );
});

test('words: phrase, unit, note, plugin labels', () => {
  assert.equal(altGoalPhrase(GOTR), '100 reward searches paid for with energy earned during the event');
  assert.equal(altGoalPhrase({ targets: [GOTR_SEARCHES], amount: 100 }), '100 reward searches');
  assert.equal(altGoalPhrase({ targets: ['Hunter Rumours'], amount: 25 }), '25 Hunter Rumours');
  assert.equal(altGoalPhrase({ targets: ['Cow'], amount: 50 }), '50 Cow kills');
  assert.equal(altGoalUnitSingular(GOTR), 'search');
  assert.equal(altGoalUnitSingular({ targets: ['Cow'], amount: 1 }), 'kill');
  assert.equal(altGoalUnitSingular({ targets: ['Hunter Rumours'], amount: 1 }), 'rumour');
  assert.equal(altGoalProgressNote(GOTR, 37), 'or 37/100 searches');
  assert.equal(altGoalProgressNote(GOTR, 140), 'or 100/100 searches');
  assert.equal(altEntryLabel('GOTR rare', GOTR, 0), 'GOTR rare — or 100 searches');
  assert.equal(altEntryLabel('GOTR rare', GOTR, 1), 'GOTR rare — GOTR elemental energy');
});

test('howItCounts names the alternative', () => {
  const rule = howItCounts({ tileType: 'drop', requiredAmount: 1, poolSize: 6, altGoal: JSON.stringify(GOTR) });
  assert.equal(rule, 'Get any ONE of the items below. Or instead: 100 reward searches paid for with energy earned during the event.');
  assert.equal(howItCounts({ tileType: 'kill', requiredAmount: 5, altGoal: { targets: ['Cow'], amount: 50 } }), 'Or instead: 50 Cow kills.');
  assert.equal(howItCounts({ tileType: 'kill', requiredAmount: 5 }), null);
});

test('plugin panel: alt entries fold into the parent row as a note', () => {
  const base = { position: 0, points: 0, description: null };
  const rows = panelTiles({
    trackedDrops: [{ ...base, tileId: 42, label: 'GOTR rare', points: 10, requiredAmount: 1, currentAmount: 0 }],
    trackedKills: [
      { ...base, tileId: 9, label: 'Zulrah', requiredAmount: 5, currentAmount: 2 },
      { ...base, tileId: altVirtualTileId(42, 0), label: 'GOTR rare — or 100 searches', requiredAmount: 100, currentAmount: 37, altOf: 42, altRole: 'goal', unit: 'search' },
      { ...base, tileId: altVirtualTileId(42, 1), label: 'GOTR rare — GOTR elemental energy', requiredAmount: 1_000_000, currentAmount: 500, altOf: 42, altRole: 'cap', unit: 'energy' },
    ],
    trackedTimed: [{ ...base, tileId: 50, label: 'Marlin runs', requiredAmount: 5, currentAmount: 3 }],
  });
  assert.deepEqual(rows.map((r) => r.tileId), [42, 9, 50]);
  assert.equal(rows[0].sets, 'or 37/100 searches');
  assert.equal(rows[0].goal, 1);
  assert.equal(rows[1].sets, undefined);
  assert.equal(rows[2].sets, '3/5 runs');
  assert.equal(rows[2].current, 3);
});

test('completion proof: only the goal that completed the tile can prove it', () => {
  const item = { goal: null, imageUrl: 'https://media/x.png' };
  const search = { goal: 'alt', imageUrl: 'https://media/s.png' };
  const energy = { goal: 'cap:0', imageUrl: 'https://media/e.png' };
  const bareSearch = { goal: 'alt', imageUrl: null };
  // Alternative completion: its own screenshot only — not an item's, not an energy proof.
  assert.equal(countsAsCompletionProof(search, 'alt'), true);
  assert.equal(countsAsCompletionProof(item, 'alt'), false);
  assert.equal(countsAsCompletionProof(energy, 'alt'), false);
  assert.equal(countsAsCompletionProof(bareSearch, 'alt'), false);
  // Primary completion is not loosened: alt and cap screenshots don't prove the tile's own goal.
  assert.equal(countsAsCompletionProof(item, 'primary'), true);
  assert.equal(countsAsCompletionProof(search, 'primary'), false);
  assert.equal(countsAsCompletionProof(energy, 'primary'), false);
  assert.equal(countsAsCompletionProof({ goal: null, imageUrl: null }, 'primary'), false);
});
