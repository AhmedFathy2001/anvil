// Recap derivations (lib/recapDerive) — the hour bucketing behind Night Owl / Early Bird and the
// snapshot diff behind Tunnel Vision / One-Track Mind.
//
// Run: node --experimental-strip-types --test tests/recap-derive.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { biggestGain, isEarlyHour, isNightHour, localHour } from '../src/lib/recapDerive.ts';

test('localHour: a bare SQLite timestamp is read as UTC, not local time', () => {
  // datetime('now') writes no zone marker; reading it as local time would shift every bucket.
  assert.equal(localHour('2026-08-11 02:30:00', null), 2);
  assert.equal(localHour('2026-08-11T02:30:00Z', null), 2);
});

test('localHour: buckets in the player\'s own timezone when they have one', () => {
  // 02:30 UTC is still the small hours in London, but a sensible mid-morning in Sydney.
  assert.equal(localHour('2026-08-11T02:30:00Z', 'Europe/London'), 3);
  assert.equal(localHour('2026-08-11T02:30:00Z', 'Australia/Sydney'), 12);
  // A player west of UTC flips the other way: 02:30 UTC is the previous evening in New York.
  assert.equal(localHour('2026-08-11T02:30:00Z', 'America/New_York'), 22);
});

test('localHour: junk degrades to UTC rather than throwing', () => {
  assert.equal(localHour('2026-08-11T02:30:00Z', 'Middle/Earth'), 2);
  assert.equal(localHour('not a date', null), null);
  assert.equal(localHour(null, null), null);
});

test('night and early buckets do not overlap', () => {
  assert.ok(isNightHour(0) && isNightHour(5));
  assert.ok(!isNightHour(6));
  assert.ok(isEarlyHour(6) && isEarlyHour(8));
  assert.ok(!isEarlyHour(9) && !isEarlyHour(5));
  for (let h = 0; h < 24; h++) {
    assert.ok(!(isNightHour(h) && isEarlyHour(h)), `hour ${h} counted twice`);
  }
});

const snap = (bosses: Record<string, number>, skills: Record<string, number> = {}) =>
  JSON.stringify({
    bosses: Object.fromEntries(Object.entries(bosses).map(([k, v]) => [k, { score: v }])),
    skills: Object.fromEntries(Object.entries(skills).map(([k, v]) => [k, { xp: v }])),
  });

test('biggestGain: finds the single biggest climb, not the biggest total', () => {
  const before = snap({ zulrah: 1000, vorkath: 50 });
  const after = snap({ zulrah: 1040, vorkath: 350 });
  // Zulrah has the higher KC; Vorkath is where the event actually went.
  assert.deepEqual(biggestGain(before, after, 'bosses'), { name: 'vorkath', gained: 300 });
});

test('biggestGain: covers bosses no tile ever tracked', () => {
  // Nothing on the board mentions Chaos Elemental; the grind still counts.
  const gain = biggestGain(snap({ chaosElemental: 0 }), snap({ chaosElemental: 212 }), 'bosses');
  assert.deepEqual(gain, { name: 'chaosElemental', gained: 212 });
});

test('biggestGain: unranked (-1) counts from zero, never as a phantom gain', () => {
  // Crossing onto the hiscores mid-event: -1 → 60 is 60 kills, not 61.
  assert.deepEqual(biggestGain(snap({ nex: -1 }), snap({ nex: 60 }), 'bosses'), { name: 'nex', gained: 60 });
  // And a still-unranked boss contributes nothing at all.
  assert.equal(biggestGain(snap({ nex: -1 }), snap({ nex: -1 }), 'bosses'), null);
});

test('biggestGain: overall is skipped, and a flat account wins nothing', () => {
  const before = snap({}, { overall: 1_000_000, mining: 500_000 });
  const after = snap({}, { overall: 1_400_000, mining: 900_000 });
  // 'overall' moved further than mining, but it's just the sum — mining is the story.
  assert.deepEqual(biggestGain(before, after, 'skills'), { name: 'mining', gained: 400_000 });
  assert.equal(biggestGain(before, before, 'skills'), null);
});

test('biggestGain: missing or malformed snapshots are silent, not fatal', () => {
  assert.equal(biggestGain(null, snap({ zulrah: 5 }), 'bosses'), null);
  assert.equal(biggestGain(snap({ zulrah: 5 }), null, 'bosses'), null);
  assert.equal(biggestGain('{not json', snap({ zulrah: 5 }), 'bosses'), null);
  assert.equal(biggestGain('{}', '{}', 'bosses'), null);
});
