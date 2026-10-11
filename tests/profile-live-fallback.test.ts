// A character the hiscores sweep hasn't reached yet still has a profile when the plugin has pushed
// its XP: snapshotFromLiveStats turns the live overlay into a hiscores-shaped snapshot.
//
// Run: npx tsx --test tests/profile-live-fallback.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { snapshotFromLiveStats } from '../src/lib/liveSnapshot.ts';

test('live XP becomes levels, an overall total and boss KC', () => {
  const snap = snapshotFromLiveStats(JSON.stringify({ attack: 13_034_431, hitpoints: 82, zulrah: 12, notASkill: 5 }));
  assert.ok(snap);
  assert.equal(snap.skills.attack.level, 99);
  assert.equal(snap.skills.hitpoints.level, 1);
  assert.equal(snap.skills.overall.xp, 13_034_431 + 82);
  assert.equal(snap.skills.overall.level, 100);
  assert.equal(snap.bosses.zulrah.score, 12);
  assert.equal(snap.skills.notASkill, undefined);
});

test('nothing pushed, nothing invented', () => {
  assert.equal(snapshotFromLiveStats(null), null);
  assert.equal(snapshotFromLiveStats('{}'), null);
  assert.equal(snapshotFromLiveStats(JSON.stringify({ zulrah: 3 })), null);
});
