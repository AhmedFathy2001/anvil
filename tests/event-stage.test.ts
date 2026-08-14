// Event stage derivation (lib/eventStage) — which of the three jobs the admin workspace is showing:
// Build (get it to the start line), Run (watch it and decide), Wrap (settle up and file it away).
//
// Run: node --experimental-strip-types --test tests/event-stage.test.ts
// (lib/eventStage imports nothing from `@/`, so Node's native TS type-stripping runs it directly.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { eventStage, lifecycleSteps, type StageCounts } from '../src/lib/eventStage.ts';

const NOW = Date.parse('2026-08-14T12:00:00Z');
const iso = (offsetDays: number) => new Date(NOW + offsetDays * 86_400_000).toISOString();

const READY: StageCounts = {
  tileCount: 25,
  expectedTiles: 25,
  teamCount: 4,
  assignedPlayers: 16,
  signupCount: 16,
  pendingSignups: 0,
  unpaidPayouts: 0,
  payoutCount: 0,
  surveyResponses: 0,
  hasSurvey: false,
  blockers: [],
};

test('an event with no start date is still being built', () => {
  assert.equal(eventStage({ startDate: null, endDate: null, forceEndedAt: null }, NOW), 'build');
});

test('a start date in the future is still build; in the past it is running', () => {
  assert.equal(eventStage({ startDate: iso(3), endDate: iso(17), forceEndedAt: null }, NOW), 'build');
  assert.equal(eventStage({ startDate: iso(-3), endDate: iso(11), forceEndedAt: null }, NOW), 'run');
});

test('past its end date, or force-ended, means wrap', () => {
  assert.equal(eventStage({ startDate: iso(-20), endDate: iso(-6), forceEndedAt: null }, NOW), 'wrap');
  assert.equal(eventStage({ startDate: iso(-2), endDate: iso(12), forceEndedAt: iso(-1) }, NOW), 'wrap');
});

test('an open-ended event keeps running — only force-end finishes it', () => {
  assert.equal(eventStage({ startDate: iso(-90), endDate: null, forceEndedAt: null }, NOW), 'run');
});

test('exactly one lifecycle step is marked now, in every stage', () => {
  const cases = [
    { startDate: null, endDate: null, forceEndedAt: null },
    { startDate: iso(3), endDate: iso(17), forceEndedAt: null },
    { startDate: iso(-3), endDate: iso(11), forceEndedAt: null },
    { startDate: iso(-20), endDate: iso(-6), forceEndedAt: null },
  ];
  for (const event of cases) {
    const steps = lifecycleSteps(event, READY, NOW);
    assert.equal(steps.filter((s) => s.state === 'now').length, 1, JSON.stringify(event));
  }
});

test('while building, now sits on the first unmet requirement', () => {
  const noDates = lifecycleSteps({ startDate: null, endDate: null, forceEndedAt: null }, READY, NOW);
  assert.equal(noDates.find((s) => s.state === 'now')?.key, 'built');

  const halfWritten = lifecycleSteps(
    { startDate: iso(5), endDate: iso(19), forceEndedAt: null },
    { ...READY, tileCount: 3 },
    NOW,
  );
  assert.equal(halfWritten.find((s) => s.state === 'now')?.key, 'tiles');

  const noTeams = lifecycleSteps(
    { startDate: iso(5), endDate: iso(19), forceEndedAt: null },
    { ...READY, teamCount: 0, assignedPlayers: 0 },
    NOW,
  );
  assert.equal(noTeams.find((s) => s.state === 'now')?.key, 'teams');
});

test('a fully set up but unstarted event points at Running', () => {
  const steps = lifecycleSteps({ startDate: iso(5), endDate: iso(19), forceEndedAt: null }, READY, NOW);
  assert.equal(steps.find((s) => s.state === 'now')?.key, 'running');
});

test('after the end, now sits on payouts until nothing is owed', () => {
  const ended = { startDate: iso(-20), endDate: iso(-6), forceEndedAt: null };

  const owing = lifecycleSteps(ended, { ...READY, payoutCount: 3, unpaidPayouts: 2 }, NOW);
  assert.equal(owing.find((s) => s.state === 'now')?.key, 'payouts');
  assert.match(owing[5].detail, /2 unpaid/);

  const settled = lifecycleSteps(ended, { ...READY, payoutCount: 3, unpaidPayouts: 0 }, NOW);
  assert.equal(settled[5].state, 'done');
  // Nothing owed and nothing running: the board is finished, so no step claims to need attention.
  assert.equal(settled.filter((s) => s.state === 'now').length, 0);
});

test('a board with no tiles authored never reads as done while it can still be fixed', () => {
  const steps = lifecycleSteps({ startDate: iso(-1), endDate: iso(13), forceEndedAt: null }, { ...READY, tileCount: 0 }, NOW);
  assert.equal(steps.find((s) => s.key === 'tiles')?.state, 'todo');
  assert.match(steps.find((s) => s.key === 'tiles')!.detail, /0 of 25/);
});

test('once it is over the setup steps read as history, not as chores', () => {
  const steps = lifecycleSteps(
    { startDate: iso(-20), endDate: iso(-6), forceEndedAt: null },
    { ...READY, tileCount: 0, teamCount: 0, assignedPlayers: 0, payoutCount: 1, unpaidPayouts: 1 },
    NOW,
  );
  for (const step of steps.filter((s) => s.key !== 'payouts')) {
    assert.equal(step.state, 'done', `${step.key} should read as done on a finished event`);
  }
  // The counts stay honest even though the step is no longer asking for anything.
  assert.match(steps.find((s) => s.key === 'tiles')!.detail, /0 of 25/);
  assert.equal(steps.find((s) => s.key === 'payouts')?.state, 'now');
});
