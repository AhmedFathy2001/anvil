// Per-member counter caps (lib/tileCaps): "100 GOTR searches paid for with energy earned during the
// event" is a kill tile over the searches counter, capped per member by two energy counters. The cap
// counters ride virtual plugin ids; their rows never count toward (or prove) the tile's own count. Pure.
//
// Run: npx tsx --test tests/tile-caps.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  capEntryLabel,
  capGoalForSlot,
  capPhrase,
  cappedProgress,
  capVirtualTileId,
  counterNoun,
  countsAsCompletionProof,
  decodeCapTileId,
  isGotrEnergyCapped,
  parseCapBy,
  validateCapBy,
  GOTR_ENERGY_CAPS,
} from '../src/lib/tileCaps.ts';
import { countProgress, itemAlreadyCounted, memberProgress } from '../src/lib/countProgress.ts';
import { panelTiles } from '../src/lib/pluginPanel.ts';
import { contributionRows } from '../src/lib/memberBreakdown.ts';
import { countTileTeams } from '../src/lib/tileTracker.ts';

const CAPS = [...GOTR_ENERGY_CAPS];
const row = (playerId: number, goal: string | null, amount: number, itemId: number | null = null) => ({ playerId, creditPlayerId: null, goal, amount, itemId });

test('virtual ids round-trip: -(tile * 8 + slot), slots 1..7 only', () => {
  assert.equal(capVirtualTileId(123, 1), -985);
  assert.equal(capVirtualTileId(123, 2), -986);
  assert.deepEqual(decodeCapTileId(-985), { tileId: 123, slot: 1 });
  assert.deepEqual(decodeCapTileId(capVirtualTileId(1, 7)), { tileId: 1, slot: 7 });
  assert.equal(decodeCapTileId(-984), null); // slot 0 is never a cap
  assert.equal(decodeCapTileId(5), null);
  assert.equal(decodeCapTileId(0), null);
  assert.equal(decodeCapTileId(-3), null); // tile 0
  assert.equal(decodeCapTileId(-1.5), null);
});

test('slots map to cap rows only when the tile has that cap', () => {
  assert.equal(capGoalForSlot(CAPS, 1), 'cap:0');
  assert.equal(capGoalForSlot(CAPS, 2), 'cap:1');
  assert.equal(capGoalForSlot(CAPS, 3), null);
  assert.equal(capGoalForSlot(CAPS, 0), null);
  assert.equal(capGoalForSlot([], 1), null);
});

test('validation: shape and bounds; empty clears', () => {
  assert.deepEqual(validateCapBy(null), { ok: true, value: null });
  assert.deepEqual(validateCapBy(''), { ok: true, value: null });
  assert.deepEqual(validateCapBy([]), { ok: true, value: null });
  assert.deepEqual(validateCapBy(JSON.stringify(CAPS)), { ok: true, value: CAPS });
  assert.deepEqual(parseCapBy([' GOTR elemental energy ', 'gotr elemental energy']), ['GOTR elemental energy']);
  assert.equal(validateCapBy(['a', 'b', 'c', 'd', 'e']).ok, false);
  assert.equal(validateCapBy([1]).ok, false);
  assert.equal(validateCapBy('{not json').ok, false);
  assert.deepEqual(parseCapBy('{not json'), []);
});

test('team: each member capped by their own energy, then summed', () => {
  const rows = [
    // A: 60 searches, 40 elemental, 50 catalytic → 40 count.
    row(1, null, 60), row(1, 'cap:0', 40), row(1, 'cap:1', 50),
    // B: 30 searches, plenty of energy → 30.
    row(2, null, 10), row(2, null, 20), row(2, 'cap:0', 100), row(2, 'cap:1', 90),
    // C: energy but no searches → 0. D: searches with no energy at all → 0.
    row(3, 'cap:0', 500), row(3, 'cap:1', 500),
    row(4, null, 25),
  ];
  const p = cappedProgress(rows, CAPS, 'team');
  assert.equal(p.current, 70);
  assert.equal(p.teamTotal, 70);
  assert.equal(p.finisherPlayerId, null);
  assert.equal(p.byMember.get(1), 40);
  assert.equal(p.byMember.get(2), 30);
  assert.equal(p.byMember.has(3), false);
  assert.equal(p.byMember.has(4), false);
  assert.deepEqual(p.raw, { own: 115, caps: [640, 640] });
  // countProgress reads a capped tile the same way when told its caps.
  assert.equal(countProgress(rows, 'team', null, CAPS).current, 70);
  assert.equal(memberProgress(rows, 1, null, CAPS), 40);
});

test('team: one member’s spare energy never pays for another’s searches', () => {
  const rows = [row(1, null, 100), row(2, 'cap:0', 100), row(2, 'cap:1', 100)];
  assert.equal(cappedProgress(rows, CAPS, 'team').current, 0);
});

test('solo: the best single member, and who it was', () => {
  const rows = [
    row(1, null, 60), row(1, 'cap:0', 40), row(1, 'cap:1', 50),
    row(2, null, 55), row(2, 'cap:0', 55), row(2, 'cap:1', 70),
  ];
  const p = cappedProgress(rows, CAPS, 'individual');
  assert.equal(p.current, 55);
  assert.equal(p.finisherPlayerId, 2);
  assert.equal(p.teamTotal, 95);
  assert.equal(countProgress(rows, 'individual', null, CAPS).finisherPlayerId, 2);
});

test('uncapped: credit follows creditPlayerId; an unknown cap row is ignored', () => {
  const rows = [
    { playerId: 5, creditPlayerId: 1, goal: null, amount: 4 },
    { playerId: 1, creditPlayerId: null, goal: null, amount: 3 },
    { playerId: 2, creditPlayerId: null, goal: 'cap:3', amount: 99 },
  ];
  assert.equal(cappedProgress(rows, [], 'team').current, 7);
  assert.equal(cappedProgress(rows, [], 'solo').finisherPlayerId, 1);
});

test('cap rows never count toward the tile’s own requirement', () => {
  const rows = [row(1, null, 1, 26813), row(2, 'cap:0', 100), row(2, 'cap:1', 100)];
  assert.equal(countProgress(rows, 'team').current, 1);
  assert.equal(countProgress(rows, 'team').teamTotal, 1);
  assert.equal(countProgress(rows, 'individual').current, 1);
  assert.equal(memberProgress(rows, 2), 0);
  assert.equal(countProgress(rows, 'team', 'distinct').current, 1);
  assert.equal(itemAlreadyCounted([row(1, 'cap:0', 1, 26813)], 26813, 'team', null), false);
  // The tracker widget: uncapped tiles ignore cap rows; a capped one shows the capped team figure.
  const input = { teams: [{ teamId: 1, name: 'A', color: null }], trackingMode: 'team', completedTeamIds: new Set<number>(), viewerTeamId: null, viewerPlayerId: null, names: new Map() };
  const teams = countTileTeams(input, rows.map((r) => ({ ...r, teamId: 1 })));
  assert.equal(teams[0].current, 1);
  assert.deepEqual(teams[0].members.map((m) => m.amount), [1]);
  const capped = [row(1, null, 60), row(1, 'cap:0', 40), row(1, 'cap:1', 50)].map((r) => ({ ...r, teamId: 1 }));
  assert.equal(countTileTeams(input, capped, null, CAPS)[0].current, 40);
});

test('contribution: never a cap counter', () => {
  const rows = [
    { teamId: 1, tileId: 7, goal: null, amount: 60 },
    { teamId: 1, tileId: 7, goal: 'cap:0', amount: 900 },
  ];
  assert.deepEqual(contributionRows(rows).map((r) => r.goal), [null]);
});

test('words', () => {
  assert.equal(isGotrEnergyCapped(CAPS), true);
  assert.equal(isGotrEnergyCapped(['GOTR elemental energy']), false);
  assert.equal(capPhrase(CAPS), ' paid for with energy earned during the event');
  assert.equal(capPhrase([]), '');
  assert.equal(capPhrase(['Hunter Rumours']), ' (no more than the Hunter Rumours earned during the event)');
  assert.equal(counterNoun('GOTR elemental energy'), 'energy');
  assert.equal(counterNoun('Slayer tasks: Mortimer'), 'task');
  assert.equal(capEntryLabel('100 searches', 'GOTR elemental energy'), '100 searches — GOTR elemental energy');
});

test('plugin panel: cap entries are never rows', () => {
  const base = { position: 0, points: 0, description: null };
  const rows = panelTiles({
    trackedKills: [
      { ...base, tileId: 9, label: '100 searches', requiredAmount: 100, currentAmount: 37 },
      { ...base, tileId: capVirtualTileId(9, 1), label: '100 searches — GOTR elemental energy', requiredAmount: 1_000_000, currentAmount: 500, capOf: 9, unit: 'energy' },
    ],
    trackedTimed: [{ ...base, tileId: 50, label: 'Marlin runs', requiredAmount: 5, currentAmount: 3 }],
  });
  assert.deepEqual(rows.map((r) => r.tileId), [9, 50]);
  assert.equal(rows[0].current, 37);
  assert.equal(rows[1].sets, '3/5 runs');
});

test('completion proof: only the tile’s own rows, never a cap counter’s', () => {
  assert.equal(countsAsCompletionProof({ goal: null, imageUrl: 'https://media/s.png' }), true);
  assert.equal(countsAsCompletionProof({ goal: 'cap:0', imageUrl: 'https://media/e.png' }), false);
  assert.equal(countsAsCompletionProof({ goal: null, imageUrl: null }), false);
});
