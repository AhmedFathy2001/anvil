// Event start-readiness safeguard (lib/eventReadiness) — the checks between "the clock says start"
// and "the event goes live": a draft mid-way or an event with no assigned teams must never start
// (scheduled cron start OR admin start-now) until resolved.
//
// Run: node --experimental-strip-types --test tests/event-readiness.test.ts
// (lib/eventReadiness imports nothing from `@/`, so Node's native TS type-stripping runs it directly.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeStartReadiness,
  describeStartBlockers,
  isDraftInProgress,
  startBlockerLabel,
} from '../src/lib/eventReadiness.ts';

test('a fully set up event is ready: draft completed (or never used), players on teams', () => {
  for (const draftStatus of ['none', 'completed']) {
    const r = computeStartReadiness({ draftStatus, teamCount: 4, assignedPlayerCount: 20, totalPlayerCount: 20 });
    assert.equal(r.ready, true);
    assert.deepEqual(r.blockers, []);
    assert.equal(r.unassignedPlayerCount, 0);
  }
});

test('a draft that has begun but not finished blocks the start — active AND paused', () => {
  for (const draftStatus of ['active', 'paused']) {
    assert.equal(isDraftInProgress(draftStatus), true);
    const r = computeStartReadiness({ draftStatus, teamCount: 4, assignedPlayerCount: 10, totalPlayerCount: 20 });
    assert.equal(r.ready, false);
    assert.ok(r.blockers.includes('draft-in-progress'));
  }
  assert.equal(isDraftInProgress('none'), false);
  assert.equal(isDraftInProgress('completed'), false);
});

test('no teams at all blocks the start (and suppresses the redundant no-assigned-players blocker)', () => {
  const r = computeStartReadiness({ draftStatus: 'none', teamCount: 0, assignedPlayerCount: 0, totalPlayerCount: 12 });
  assert.equal(r.ready, false);
  assert.deepEqual(r.blockers, ['no-teams']);
});

test('teams exist but nobody is assigned → blocked; one assigned player is enough to start', () => {
  const empty = computeStartReadiness({ draftStatus: 'none', teamCount: 3, assignedPlayerCount: 0, totalPlayerCount: 12 });
  assert.equal(empty.ready, false);
  assert.deepEqual(empty.blockers, ['no-assigned-players']);

  const one = computeStartReadiness({ draftStatus: 'completed', teamCount: 3, assignedPlayerCount: 1, totalPlayerCount: 12 });
  assert.equal(one.ready, true);
  assert.equal(one.unassignedPlayerCount, 11); // surfaced as a warning, never a block (benching is legit)
});

test('blockers stack: mid-draft with zero teams reports both', () => {
  const r = computeStartReadiness({ draftStatus: 'active', teamCount: 0, assignedPlayerCount: 0, totalPlayerCount: 5 });
  assert.deepEqual(r.blockers, ['draft-in-progress', 'no-teams']);
});

test('labels/summaries exist for every blocker and read as sentences', () => {
  const r = computeStartReadiness({ draftStatus: 'paused', teamCount: 0, assignedPlayerCount: 0, totalPlayerCount: 0 });
  for (const b of r.blockers) {
    assert.ok(startBlockerLabel(b).length > 10);
  }
  const summary = describeStartBlockers(r.blockers);
  assert.ok(summary.includes('draft'));
  assert.ok(summary.includes('; ')); // joined list
});

test('unassigned count never goes negative on inconsistent inputs', () => {
  const r = computeStartReadiness({ draftStatus: 'none', teamCount: 2, assignedPlayerCount: 9, totalPlayerCount: 4 });
  assert.equal(r.unassignedPlayerCount, 0);
});
