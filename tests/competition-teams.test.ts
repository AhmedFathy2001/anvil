// Team competitions — pure scoring (lib/competitionTeams): totals, averages, tie-breaks,
// auto-balance and late-joiner placement. No database.
//
// Run: npx tsx --test tests/competition-teams.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  autoBalance,
  competitionMode,
  ordinal,
  parseCompetitionMode,
  pastHalfway,
  rankGroups,
  smallestTeam,
  teamColour,
} from '../src/lib/competitionTeams.ts';
import { groupStandingsNodes, weeklyGroupsPayload, yourGroupCard } from '../src/lib/pluginUi/teamStandingsUi.ts';

const m = (rsn: string, gained: number, groupKey: number | null, gainAt: string | null = null) => ({ rsn, gained, groupKey, gainAt });

test('team total is the sum of members, average divides by members', () => {
  const r = rankGroups(
    [{ key: 1, name: 'Red' }, { key: 2, name: 'Blue' }],
    [m('a', 100, 1), m('b', 50, 1), m('c', 0, 1), m('d', 120, 2)],
  );
  assert.equal(r[0].name, 'Red');
  assert.equal(r[0].total, 150);
  assert.equal(r[0].members, 3);
  assert.equal(r[0].average, 50);
  assert.equal(r[1].total, 120);
  assert.equal(r[1].average, 120);
  assert.deepEqual(r.map((g) => g.rank), [1, 2]);
});

test('negative gains are floored at 0 and members are ranked inside the team', () => {
  const [g] = rankGroups([{ key: 1, name: 'A' }], [m('zed', -40, 1), m('amy', 10, 1), m('bob', 10, 1)]);
  assert.equal(g.total, 20);
  assert.deepEqual(g.entries.map((e) => [e.rank, e.rsn, e.gained]), [[1, 'amy', 10], [2, 'bob', 10], [3, 'zed', 0]]);
});

test('ties break by who reached the total first', () => {
  const r = rankGroups(
    [{ key: 1, name: 'Alpha' }, { key: 2, name: 'Beta' }],
    [
      m('a', 50, 1, '2026-11-05T12:00:00Z'),
      m('b', 50, 1, '2026-11-06T09:00:00Z'), // Alpha reached 100 at 11-06 09:00
      m('c', 100, 2, '2026-11-05T20:00:00Z'), // Beta reached 100 at 11-05 20:00 — first
    ],
  );
  assert.equal(r[0].name, 'Beta');
  assert.equal(r[0].reachedAt, '2026-11-05T20:00:00Z');
  assert.equal(r[1].reachedAt, '2026-11-06T09:00:00Z');
});

test('a tie with timing on one side only: the timed one ranks first', () => {
  const r = rankGroups(
    [{ key: 1, name: 'Aaa' }, { key: 2, name: 'Zzz' }],
    [m('a', 10, 1, null), m('z', 10, 2, '2026-11-05T00:00:00Z')],
  );
  assert.equal(r[0].name, 'Zzz');
});

test('ties with no timing fall back to name; empty groups still listed', () => {
  const r = rankGroups(
    [{ key: 3, name: 'Charlie' }, { key: 1, name: 'Bravo' }, { key: 2, name: 'Empty' }],
    [m('x', 7, 3), m('y', 7, 1)],
  );
  assert.deepEqual(r.map((g) => g.name), ['Bravo', 'Charlie', 'Empty']);
  assert.equal(r[2].members, 0);
  assert.equal(r[2].average, 0);
  assert.equal(r[2].reachedAt, null);
});

test('a zero-gain member does not move reachedAt', () => {
  const [g] = rankGroups([{ key: 1, name: 'A' }], [m('a', 5, 1, '2026-11-01T00:00:00Z'), m('b', 0, 1, '2026-11-09T00:00:00Z')]);
  assert.equal(g.reachedAt, '2026-11-01T00:00:00Z');
});

test('members in no group (or an unknown group) are left out of every total', () => {
  const r = rankGroups([{ key: 1, name: 'A' }], [m('a', 5, 1), m('b', 99, null), m('c', 99, 42)]);
  assert.equal(r[0].total, 5);
  assert.equal(r[0].members, 1);
});

test('clan totals use the same rules (clan id as key)', () => {
  const r = rankGroups(
    [{ key: 10, name: 'Host' }, { key: 20, name: 'Guest' }],
    [m('h1', 300, 10), m('h2', 300, 10), m('g1', 500, 20)],
  );
  assert.deepEqual(r.map((g) => [g.name, g.total, g.average]), [['Host', 600, 300], ['Guest', 500, 500]]);
});

test('autoBalance keeps sizes within one and evens strength', () => {
  const players = [100, 90, 80, 70, 60, 50, 40].map((s, i) => ({ id: i + 1, strength: s }));
  const split = autoBalance(players, 2);
  const sizes = [0, 0];
  const sums = [0, 0];
  for (const p of players) {
    const t = split.get(p.id)!;
    sizes[t]++;
    sums[t] += p.strength;
  }
  assert.ok(Math.abs(sizes[0] - sizes[1]) <= 1);
  assert.ok(Math.abs(sums[0] - sums[1]) <= 100, `sums ${sums}`);
  // deterministic
  assert.deepEqual([...autoBalance(players, 2)], [...split]);
});

test('autoBalance with no teams assigns nobody', () => {
  assert.equal(autoBalance([{ id: 1, strength: 1 }], 0).size, 0);
});

test('smallestTeam picks fewest members, first in list on a tie', () => {
  assert.equal(smallestTeam([{ id: 5, members: 3 }, { id: 6, members: 2 }, { id: 7, members: 2 }]), 6);
  assert.equal(smallestTeam([]), null);
});

test('mode parsing and helpers', () => {
  assert.equal(parseCompetitionMode('teams'), 'teams');
  assert.equal(parseCompetitionMode('nope'), null);
  assert.equal(competitionMode(null), 'solo');
  assert.equal(competitionMode('clans'), 'clans');
  assert.equal(teamColour('#ABCDEF'), '#abcdef');
  assert.equal(teamColour('red', 1), '#4f8cff');
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 103].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '103rd']);
});

test('halfway is the midpoint of the window, and not after it ends', () => {
  const a = '2026-11-01T00:00:00Z';
  const b = '2026-11-08T00:00:00Z';
  assert.equal(pastHalfway(a, b, Date.parse('2026-11-04T11:59:00Z')), false);
  assert.equal(pastHalfway(a, b, Date.parse('2026-11-04T12:00:00Z')), true);
  assert.equal(pastHalfway(a, b, Date.parse('2026-11-08T00:00:00Z')), false);
  assert.equal(pastHalfway('bad', b, 0), false);
});

test('panel payload: your team line, compact standings, nodes', () => {
  const groups = rankGroups(
    [{ key: 1, name: 'Red', colour: '#e5534b' }, { key: 2, name: 'Blue', colour: '#4f8cff' }, { key: 3, name: 'Green' }, { key: 4, name: 'Gold' }],
    [m('a', 2_000_000, 1), m('b', 1_200_000, 2), m('c', 500, 3), m('d', 0, 4)],
  );
  const view = {
    mode: 'teams' as const,
    groups: groups.map((g) => ({ ...g, isYours: g.key === 2 })),
    unassigned: [],
    yourGroupKey: 2,
  };
  const p = weeklyGroupsPayload('skill', view)!;
  assert.equal(p.noun, 'team');
  assert.equal(p.of, 4);
  assert.equal(p.you!.name, 'Blue');
  assert.equal(p.you!.line, 'Your team: 2nd of 4 · +1.2M XP');
  assert.deepEqual(p.standings.map((s) => [s.rank, s.name, s.you]), [[1, 'Red', false], [2, 'Blue', true], [3, 'Green', false], [4, 'Gold', false]]);
  assert.ok(yourGroupCard('skill', p));
  assert.equal(groupStandingsNodes('skill', p).length, 2 + 4);
  assert.equal(weeklyGroupsPayload('skill', null), null);
  // Not on any team → no top card.
  const none = weeklyGroupsPayload('boss', { ...view, groups: view.groups.map((g) => ({ ...g, isYours: false })), yourGroupKey: null })!;
  assert.equal(none.you, null);
  assert.equal(yourGroupCard('boss', none), null);
});

test('only an owner/admin may invite clans from the create form', async () => {
  const { inviteOnCreateRefused } = await import('../src/lib/competitionTeams.ts');
  assert.equal(inviteOnCreateRefused('clans', 2, false), true, 'moderator inviting: refused');
  assert.equal(inviteOnCreateRefused('clans', 2, true), false);
  assert.equal(inviteOnCreateRefused('clans', 0, false), false, 'creating without invites is fine');
  assert.equal(inviteOnCreateRefused('teams', 2, false), false);
});
