// Team placement's pure rules (lib/teamPlacement): which team a new sign-up joins, how many teams
// auto-balance makes, and when a players-pick team is full. The locked, concurrent version is in
// tests/team-placement-db.test.ts.
//
// Run: npm run test:placement

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_AUTO_TEAM_COUNT,
  autoTargetCount,
  checkPick,
  chooseAutoTeam,
  fewestPlayers,
  isTeamFull,
  nextTeamColour,
  nextTeamName,
  normaliseTeamCap,
  normaliseTeamCount,
  placementOf,
  soloTeamName,
  PLACEMENT_COLOURS,
  type TeamLoad,
} from '../src/lib/teamPlacement.ts';

const t = (id: number, size: number, name = `Team ${id}`, color: string | null = null): TeamLoad => ({ id, name, size, color });

test('fewest players wins; a tie goes to the lowest id', () => {
  assert.equal(fewestPlayers([t(3, 2), t(1, 3), t(2, 2)])?.id, 2);
  assert.equal(fewestPlayers([t(5, 0), t(4, 0)])?.id, 4);
  assert.equal(fewestPlayers([]), null);
});

test('auto: the first sign-up on an empty board creates Team 1', () => {
  const c = chooseAutoTeam([], 4);
  assert.equal(c.kind, 'create');
  assert.equal(c.kind === 'create' && c.name, 'Team 1');
});

test('auto: teams are created one per sign-up until the host count exists, then balanced', () => {
  // Simulate 10 sign-ups into a 4-team board, applying each choice.
  const board: TeamLoad[] = [];
  let nextId = 1;
  for (let i = 0; i < 10; i++) {
    const c = chooseAutoTeam(board, 4);
    if (c.kind === 'create') board.push({ id: nextId++, name: c.name, color: c.color, size: 1 });
    else board.find((x) => x.id === c.teamId)!.size++;
  }
  assert.deepEqual(board.map((x) => x.name), ['Team 1', 'Team 2', 'Team 3', 'Team 4']);
  assert.deepEqual(board.map((x) => x.size), [3, 3, 2, 2]);
  assert.equal(new Set(board.map((x) => x.color)).size, 4, 'distinct colours');
});

test('auto: an existing empty team is filled before a new one is made', () => {
  const c = chooseAutoTeam([t(1, 2), t(2, 0)], 4);
  assert.deepEqual(c, { kind: 'existing', teamId: 2 });
});

test('auto: with no count set, the host-built teams are the target; none built means the default', () => {
  assert.equal(autoTargetCount(3, null), 3);
  assert.equal(autoTargetCount(0, null), DEFAULT_AUTO_TEAM_COUNT);
  assert.equal(autoTargetCount(5, 2), 5, 'never fewer than exist');
  assert.equal(autoTargetCount(2, 6), 6);
  assert.deepEqual(chooseAutoTeam([t(1, 1), t(2, 1), t(3, 1)], null), { kind: 'existing', teamId: 1 });
});

test('names and colours never collide with what is on the board', () => {
  assert.equal(nextTeamName(['Team 1', 'team 2', 'Red']), 'Team 3');
  assert.equal(nextTeamColour([PLACEMENT_COLOURS[0]]), PLACEMENT_COLOURS[1]);
  const past = nextTeamColour([...PLACEMENT_COLOURS]);
  assert.match(past, /^#[0-9a-f]{6}$/);
  assert.ok(!(PLACEMENT_COLOURS as readonly string[]).includes(past));
});

test('solo teams are named after the character, de-duplicated', () => {
  assert.equal(soloTeamName('Zezima', []), 'Zezima');
  assert.equal(soloTeamName('Zezima', ['zezima']), 'Zezima (2)');
  assert.equal(soloTeamName('Zezima', ['Zezima', 'Zezima (2)']), 'Zezima (3)');
  assert.equal(soloTeamName('  ', []), 'Player');
});

test('pick: a cap refuses the player who would overfill; no cap never does', () => {
  assert.deepEqual(checkPick(t(1, 4), 5), { ok: true });
  assert.deepEqual(checkPick(t(1, 5), 5), { ok: false, reason: 'full' });
  assert.deepEqual(checkPick(t(1, 4), 5, 2), { ok: false, reason: 'full' }, 'two accounts need two places');
  assert.deepEqual(checkPick(t(1, 500), null), { ok: true });
  assert.deepEqual(checkPick(t(1, 500), 0), { ok: true });
  assert.deepEqual(checkPick(undefined, 5), { ok: false, reason: 'no-such-team' });
  assert.equal(isTeamFull(t(1, 5), 5), true);
  assert.equal(isTeamFull(t(1, 4), 5), false);
  assert.equal(isTeamFull(t(1, 99), null), false);
});

test('placementOf: unknown reads as draft, and per_clan always places by clan', () => {
  assert.equal(placementOf({ teamPlacement: 'auto' }), 'auto');
  assert.equal(placementOf({ teamPlacement: 'solo' }), 'solo');
  assert.equal(placementOf({ teamPlacement: 'bogus' }), 'draft');
  assert.equal(placementOf({ teamPlacement: null }), 'draft');
  assert.equal(placementOf({ teamPlacement: 'auto', teamFormation: 'per_clan' }), 'draft');
});

test('host inputs are validated', () => {
  assert.equal(normaliseTeamCount(4), 4);
  assert.equal(normaliseTeamCount(null), null);
  assert.equal(normaliseTeamCount(1), 'invalid');
  assert.equal(normaliseTeamCount(51), 'invalid');
  assert.equal(normaliseTeamCount(2.5), 'invalid');
  assert.equal(normaliseTeamCap(0), null);
  assert.equal(normaliseTeamCap(10), 10);
  assert.equal(normaliseTeamCap(-1), 'invalid');
});
