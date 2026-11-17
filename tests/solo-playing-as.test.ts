import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardRow, entrantChip, playsAsIndividuals } from '../src/lib/competitionRows';

test('solo placement plays as individuals; a team board does not', () => {
  assert.equal(playsAsIndividuals({ teamPlacement: 'solo' }, 'teams'), true);
  assert.equal(playsAsIndividuals({ teamPlacement: 'auto' }, 'teams'), false);
  assert.equal(playsAsIndividuals({ teamPlacement: 'auto' }, 'individuals'), true);
});
test('entrant chip', () => {
  assert.equal(entrantChip(true, 1), '1 player');
  assert.equal(entrantChip(true, 3), '3 players');
  assert.equal(entrantChip(false, 2), '2 teams');
  assert.equal(entrantChip(false, 0), null);
});
test('a solo board row says Playing as, not Your team', () => {
  const row = boardRow(
    { id: 1, name: 'Solo', mode: 'bingo', status: 'live', shape: '5x5', chips: [entrantChip(true, 3)!], top: null, startDate: null, endDate: null, foot: null, iconUrl: null } as never,
    { teamNames: ['Lcl Member'], signedUp: true },
  );
  assert.equal(row.yours, 'Playing as Lcl Member');
});
