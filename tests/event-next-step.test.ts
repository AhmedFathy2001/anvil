// The event home's "Next step": one plain thing to do, in the right order.
//
// Run: npm run test:nextstep

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { nextStep, type NextStepInput } from '../src/lib/eventNextStep.ts';

const base: NextStepInput = {
  stage: 'build',
  noun: { one: 'tile', many: 'tiles' },
  startDate: '2026-11-01T00:00:00.000Z',
  endDate: '2026-11-14T00:00:00.000Z',
  tileCount: 25,
  expectedTiles: 25,
  teamCount: 4,
  assignedPlayers: 20,
  signupCount: 20,
  pendingSignups: 0,
  flaggedProofs: 0,
  payoutCount: 0,
  unpaidPayouts: 0,
  blockers: [],
  individual: false,
};

test('build walks tiles → sign-ups → teams → dates → start, in that order', () => {
  assert.equal(nextStep({ ...base, tileCount: 0 }).action.kind === 'link' && (nextStep({ ...base, tileCount: 0 }).action as { tab: string }).tab, 'tiles');
  assert.match(nextStep({ ...base, tileCount: 20 }).title, /Add 5 more tiles/);
  assert.equal((nextStep({ ...base, pendingSignups: 3 }).action as { tab: string }).tab, 'signups');
  assert.equal(nextStep({ ...base, signupCount: 0, teamCount: 0, assignedPlayers: 0 }).title, 'Open sign-ups');
  assert.equal(nextStep({ ...base, teamCount: 0, assignedPlayers: 0 }).title, 'Make the teams');
  assert.equal(nextStep({ ...base, startDate: null }).title, 'Pick the dates');
  assert.equal(nextStep(base).action.kind, 'start');
});

test('an individual board never asks for teams', () => {
  const s = nextStep({ ...base, individual: true, teamCount: 0, assignedPlayers: 0, signupCount: 0 });
  assert.equal(s.action.kind, 'start');
});

test('running: flagged proofs come first, otherwise nothing needs you', () => {
  assert.equal(nextStep({ ...base, stage: 'run', flaggedProofs: 2 }).title, 'Check 2 proofs');
  assert.equal(nextStep({ ...base, stage: 'run' }).title, 'It’s running');
});

test('wrap: proofs, then set prizes, then pay them, then done', () => {
  assert.match(nextStep({ ...base, stage: 'wrap', flaggedProofs: 1 }).title, /Check 1 proof/);
  assert.equal(nextStep({ ...base, stage: 'wrap' }).title, 'Set the prizes');
  assert.equal(nextStep({ ...base, stage: 'wrap', payoutCount: 3, unpaidPayouts: 2 }).title, 'Pay 2 prizes');
  assert.equal(nextStep({ ...base, stage: 'wrap', payoutCount: 3 }).action.kind, 'none');
});
