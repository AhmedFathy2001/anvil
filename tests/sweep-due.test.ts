import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PLUGIN_RECONCILE_MS, PLUGIN_BLIND_RECONCILE_MS, PLUGIN_UNPUSHABLE_KEYS, sweepDue } from '../src/lib/pollLadder';

const NOW = new Date('2026-10-12T12:00:00.000Z');
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();
const ahead = (min: number) => new Date(NOW.getTime() + min * 60_000).toISOString();

test('a missing baseline is always due', () => {
  assert.equal(sweepDue({ needsBaseline: true, nextDueAt: ahead(500), liveStatsAt: ago(1), polledAt: ago(1) }, NOW), true);
});

test('never polled is due, even while the plugin pushes', () => {
  assert.equal(sweepDue({ needsBaseline: false, nextDueAt: ahead(60), liveStatsAt: ago(1), polledAt: null }, NOW), true);
});

test('plugin pushing: skipped until the six-hour reconcile', () => {
  const base = { needsBaseline: false, nextDueAt: null, liveStatsAt: ago(2) };
  assert.equal(sweepDue({ ...base, polledAt: ago(30) }, NOW), false);
  assert.equal(sweepDue({ ...base, polledAt: ago(PLUGIN_RECONCILE_MS / 60_000 - 1) }, NOW), false);
  assert.equal(sweepDue({ ...base, polledAt: ago(PLUGIN_RECONCILE_MS / 60_000) }, NOW), true);
});

test('pushes stopped since the last poll: due once, right away', () => {
  assert.equal(sweepDue({ needsBaseline: false, nextDueAt: ahead(120), liveStatsAt: ago(25), polledAt: ago(60) }, NOW), true);
});

test('after that poll, back on the ordinary ladder', () => {
  const base = { needsBaseline: false, liveStatsAt: ago(90), polledAt: ago(30) };
  assert.equal(sweepDue({ ...base, nextDueAt: ahead(30) }, NOW), false);
  assert.equal(sweepDue({ ...base, nextDueAt: ago(1) }, NOW), true);
  assert.equal(sweepDue({ ...base, nextDueAt: null }, NOW), true);
});

test('no plugin at all: exactly the old ladder', () => {
  assert.equal(sweepDue({ needsBaseline: false, nextDueAt: ahead(10), liveStatsAt: null, polledAt: ago(10) }, NOW), false);
  assert.equal(sweepDue({ needsBaseline: false, nextDueAt: ago(10), liveStatsAt: null, polledAt: ago(10) }, NOW), true);
});

test('SQLite-style timestamps read the same', () => {
  assert.equal(sweepDue({ needsBaseline: false, nextDueAt: null, liveStatsAt: '2026-10-12 11:58:00', polledAt: '2026-10-12 11:00:00' }, NOW), false);
});

test('plugin pushing but a scored stat it cannot push: due every tick, not every six hours', () => {
  const base = { needsBaseline: false, nextDueAt: null, liveStatsAt: ago(2), pluginBlind: true };
  assert.equal(sweepDue({ ...base, polledAt: ago(5) }, NOW), false);
  assert.equal(sweepDue({ ...base, polledAt: ago(PLUGIN_BLIND_RECONCILE_MS / 60_000) }, NOW), true);
  assert.ok(PLUGIN_BLIND_RECONCILE_MS < 15 * 60_000); // under the sweep tick, or it skips every other one
  assert.ok(PLUGIN_UNPUSHABLE_KEYS.has('doomOfMokhaiotl'));
});
