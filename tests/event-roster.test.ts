// The plugin's Teams page, a page at a time: two teams of five, ten of 120, or 1,200 teams of one.
//
// Run: npx tsx --test tests/event-roster.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  pageParams,
  rosterOverview,
  rosterSearch,
  rosterTeam,
  type RosterInput,
  type RosterPersonIn,
  type RosterTeamIn,
} from '../src/lib/eventRoster.ts';

const team = (teamId: number, score: number | null, captainPlayerId: number | null = null): RosterTeamIn => ({
  teamId,
  name: `Team ${teamId}`,
  color: '#fff',
  score,
  scoreText: score == null ? null : `${score} tiles`,
  captainPlayerId,
});

let nextId = 1;
const person = (name: string, teamId: number | null, playerId: number | null = null): RosterPersonIn => ({
  participantId: nextId++,
  name,
  teamId,
  playerId,
});

test('page params: 1-based, default 25, never above 50, nonsense reads as the default', () => {
  assert.deepEqual(pageParams(null, null), { page: 1, pageSize: 25 });
  assert.deepEqual(pageParams('3', '10'), { page: 3, pageSize: 10 });
  assert.deepEqual(pageParams('0', '500'), { page: 1, pageSize: 50 });
  assert.deepEqual(pageParams('abc', '-4'), { page: 1, pageSize: 25 });
});

test('teams are ranked by score with shared ranks for ties, and your team rides along on every page', () => {
  const input: RosterInput = {
    teams: [team(1, 5), team(2, 9), team(3, 9), team(4, 1)],
    people: [person('Alice', 1, 100), person('Bob', 1), person('Cat', 2), person('Dan', 3), person('Eve', 4), person('Unplaced', null)],
    viewerPlayerId: 100,
    individuals: false,
  };
  const first = rosterOverview(input, 1, 2);
  assert.equal(first.mode, 'teams');
  if (first.mode !== 'teams') return;
  assert.deepEqual(first.teams.map((t) => [t.teamId, t.rank]), [[2, 1], [3, 1]]);
  assert.deepEqual([first.total, first.pages, first.unplaced], [4, 2, 1]);
  assert.equal(first.yourTeam?.teamId, 1);
  assert.equal(first.yourTeam?.rank, 3);
  assert.equal(first.yourTeam?.members, 2);

  const second = rosterOverview(input, 2, 2);
  if (second.mode !== 'teams') return assert.fail('teams mode');
  assert.deepEqual(second.teams.map((t) => [t.teamId, t.rank, t.yours]), [[1, 3, true], [4, 4, false]]);
});

test('a page past the end is the last page, not an empty one', () => {
  const input: RosterInput = { teams: [team(1, 1), team(2, 2)], people: [person('A', 1), person('B', 1), person('C', 2), person('D', 2)], viewerPlayerId: null, individuals: false };
  const out = rosterOverview(input, 99, 1);
  assert.deepEqual([out.page, out.pages], [2, 2]);
});

test('before the reveal teams have no score and no rank, ordered by name', () => {
  const input: RosterInput = { teams: [team(2, null), team(1, null)], people: [person('A', 1), person('B', 1), person('C', 2), person('D', 2)], viewerPlayerId: null, individuals: false };
  const out = rosterOverview(input, 1, 25);
  if (out.mode !== 'teams') return assert.fail('teams mode');
  assert.deepEqual(out.teams.map((t) => [t.teamId, t.rank, t.score]), [[1, null, null], [2, null, null]]);
});

test('every team one person: the players are ranked, not 300 one-member teams', () => {
  const teams = [team(1, 3), team(2, 7), team(3, 7)];
  const input: RosterInput = {
    teams,
    people: [person('Solo One', 1), person('Solo Two', 2, 42), person('Solo Three', 3)],
    viewerPlayerId: 42,
    individuals: false,
  };
  const out = rosterOverview(input, 1, 25);
  if (out.mode !== 'players') return assert.fail('players mode');
  assert.deepEqual(out.players.map((p) => [p.name, p.rank, p.score]), [
    ['Solo Three', 1, '7 tiles'],
    ['Solo Two', 1, '7 tiles'],
    ['Solo One', 3, '3 tiles'],
  ]);
  assert.equal(out.you?.name, 'Solo Two');
});

test('an individual event ranks by ladder points, and a person\'s other accounts are not extra players', () => {
  const main = person('Main', null, 7);
  const alt = person('Alt', null, 7);
  const other = person('Other', null, 8);
  const idle = person('Idle', null, 9);
  const input: RosterInput = {
    teams: [],
    people: [main, alt, other, idle],
    viewerPlayerId: 7,
    individuals: true,
    individualPoints: [
      { participantId: other.participantId, name: 'Other', points: 50 },
      { participantId: main.participantId, name: 'Main', points: 20 },
    ],
  };
  const out = rosterOverview(input, 1, 25);
  if (out.mode !== 'players') return assert.fail('players mode');
  assert.deepEqual(out.players.map((p) => [p.name, p.rank]), [['Other', 1], ['Main', 2], ['Idle', null]]);
  assert.equal(out.you?.name, 'Main');
});

test("a team's members: captain first, then you, then by name — and paged", () => {
  const input: RosterInput = {
    teams: [team(1, 0, 5)],
    people: [person('zed', 1), person('Amy', 1), person('Me', 1, 9), person('Cap', 1, 5), person('Bo', 1)],
    viewerPlayerId: 9,
    individuals: false,
  };
  const page1 = rosterTeam(input, 1, 1, 3)!;
  assert.deepEqual(page1.players.map((p) => [p.name, p.captain, p.you]), [['Cap', true, false], ['Me', false, true], ['Amy', false, false]]);
  assert.deepEqual([page1.total, page1.pages, page1.team.members], [5, 2, 5]);
  assert.deepEqual(rosterTeam(input, 1, 2, 3)!.players.map((p) => p.name), ['Bo', 'zed']);
  assert.equal(rosterTeam(input, 999, 1, 3), null);
});

test('search finds across teams, names starting with the query first, spaces and underscores alike', () => {
  const input: RosterInput = {
    teams: [team(1, 0), team(2, 0)],
    people: [person('Mezez', 1), person('Zezima', 2), person('Iron_Zez', 1), person('Nobody', 2)],
    viewerPlayerId: null,
    individuals: false,
  };
  const out = rosterSearch(input, 'zez', 1, 25);
  assert.deepEqual(out.players.map((p) => [p.name, p.teamName]), [['Zezima', 'Team 2'], ['Iron_Zez', 'Team 1'], ['Mezez', 'Team 1']]);
  assert.equal(rosterSearch(input, 'iron zez', 1, 25).players[0]?.name, 'Iron_Zez');
  assert.equal(rosterSearch(input, '   ', 1, 25).total, 0);
});

test("a scored team's members: best share first, ranked within the team, ties by captain/you/name", () => {
  const people = [person('zed', 1), person('Amy', 1), person('Me', 1, 9), person('Cap', 1, 5)];
  const [zed, amy, me, cap] = people.map((p) => p.participantId);
  const input: RosterInput = {
    teams: [team(1, 30, 5)],
    people,
    viewerPlayerId: 9,
    individuals: false,
    memberPoints: new Map([[zed, 12], [amy, 0], [me, 6], [cap, 12]]),
    pointsUnit: 'pts',
  };
  const out = rosterTeam(input, 1, 1, 25)!;
  assert.deepEqual(
    out.players.map((p) => [p.name, p.rank, p.score]),
    [['Cap', 1, '12 pts'], ['zed', 1, '12 pts'], ['Me', 3, '6 pts'], ['Amy', 4, '0 pts']],
  );
});

test('a solo board of 170: the window is the top five and each of your accounts with neighbours', () => {
  const teams = Array.from({ length: 170 }, (_, i) => team(i + 1, 170 - i));
  // Ranks 2 and 3 tie: both rank 2, the next is 4.
  teams[2] = team(3, 169);
  const people = teams.map((t) => person(`P${t.teamId}`, t.teamId, t.teamId === 60 || t.teamId === 120 ? 7 : null));
  const input: RosterInput = { teams, people, viewerPlayerId: 7, individuals: false, solo: true };
  const o = rosterOverview(input, 1, 25, {});
  if (o.mode !== 'players') return assert.fail('players mode');
  assert.deepEqual(o.yours.map((p) => p.name), ['P60', 'P120'], 'every account of yours, in standing order');
  assert.deepEqual(o.players.slice(0, 4).map((p) => p.rank), [1, 2, 2, 4]);
  const w = o.window!;
  const shape = w.parts.map((p) => (p.kind === 'gap' ? `|${p.skipped}|` : p.rows.map((r) => r.name).join(','))).join(' ');
  assert.equal(shape, 'P1,P2,P3,P4,P5 |52| P58,P59,P60,P61,P62 |55| P118,P119,P120,P121,P122 |48|');
  assert.equal(rosterOverview(input, 1, 25).mode === 'players' && (rosterOverview(input, 1, 25) as { window?: unknown }).window, undefined, 'only when asked');
});

test('a mixed solo board self-corrects to compact teams; singleton entries name their player', () => {
  const input: RosterInput = {
    teams: [team(1, 5), team(2, 3)],
    people: [person('A', 1), person('B', 1), person('C', 2)],
    viewerPlayerId: null,
    individuals: false,
    solo: true,
  };
  const mixed = rosterOverview(input, 1, 25, {});
  assert.equal(mixed.mode, 'teams');
  if (mixed.mode !== 'teams') return;
  assert.ok(mixed.window, 'even a small mixed solo board stays compact');
  assert.deepEqual(mixed.teams.map((t) => [t.teamId, t.members, t.soleMember]), [[1, 2, null], [2, 1, 'C']]);
  assert.equal(rosterOverview({ ...input, solo: false }, 1, 25).mode, 'teams');
});

test('search on a players board carries each hit’s standing, not its team', () => {
  const input: RosterInput = {
    teams: [team(1, 9), team(2, 4), team(3, 4)],
    people: [person('Zezima', 1), person('Iron Zez', 2), person('Other', 3)],
    viewerPlayerId: null,
    individuals: false,
  };
  const r = rosterSearch(input, 'zez', 1, 25);
  assert.equal(r.ranked, true);
  assert.deepEqual(r.players.map((p) => [p.name, p.rank, p.score]), [['Zezima', 1, '9 tiles'], ['Iron Zez', 2, '4 tiles']]);
  const teamsBoard = rosterSearch({ ...input, people: [...input.people, person('Mate', 1)] }, 'zez', 1, 25);
  assert.equal(teamsBoard.ranked, undefined);
  assert.equal(teamsBoard.players[0].rank, null);
});

test('30 teams of 2–3: the window cuts teams around yours, and search finds teams by name', () => {
  const teams = Array.from({ length: 30 }, (_, i) => ({ ...team(i + 1, 300 - i * 10), name: i === 19 ? 'Zez Squad' : `Team ${i + 1}` }));
  const people = teams.flatMap((t) => [person(`A${t.teamId}`, t.teamId, t.teamId === 18 ? 9 : null), person(`B${t.teamId}`, t.teamId)]);
  const input: RosterInput = { teams, people, viewerPlayerId: 9, individuals: false };
  const o = rosterOverview(input, 1, 25, {});
  if (o.mode !== 'teams') return assert.fail('teams mode');
  const w = o.window!;
  const shape = w.parts.map((p) => (p.kind === 'gap' ? `|${p.skipped}|` : p.rows.map((r) => r.teamId).join(','))).join(' ');
  assert.equal(shape, '1,2,3,4,5 |10| 16,17,18,19,20 |10|');
  assert.ok(w.parts.some((p) => p.kind === 'rows' && p.rows.some((r) => r.teamId === 18 && r.yours && r.members === 2)));
  const hit = rosterSearch(input, 'zez', 1, 25);
  assert.deepEqual(hit.teams?.map((t) => t.name), ['Zez Squad']);
  // Eleven teams: no window, no team-name hits — a small board stays as it was.
  const small: RosterInput = { ...input, teams: teams.slice(0, 11), people: people.filter((p) => p.teamId! <= 11) };
  const so = rosterOverview(small, 1, 25, {});
  assert.equal(so.mode === 'teams' && so.window, undefined);
  assert.equal(rosterSearch({ ...small, teams: [...small.teams.slice(0, 10), { ...team(11, 1), name: 'Zez' }] }, 'zez', 1, 25).teams, undefined);
});
