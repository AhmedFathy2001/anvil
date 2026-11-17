// Redoing stored daily hours from each day's movement (lib/dailyHoursRebuild). Pure.
//
// Run: npx tsx --test tests/daily-hours-rebuild.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { beforeDay, dayHours, rebuildDays } from '../src/lib/dailyHoursRebuild.ts';
import { computeEhpEhb } from '../src/lib/efficiency.ts';

const snap = (skills: Record<string, number>, bosses: Record<string, number> = {}) => ({
  skills: Object.fromEntries(Object.entries(skills).map(([k, xp]) => [k, { rank: 1, level: 1, xp }])),
  bosses: Object.fromEntries(Object.entries(bosses).map(([k, score]) => [k, { rank: 1, score }])),
});

test('a day’s movement comes off the snapshot, never below zero', () => {
  const end = snap({ agility: 5_000_000, mining: 100 }, { zulrah: 50 });
  const start = beforeDay(end, { skills: { agility: 300_000, mining: 500, fishing: 9 }, bosses: { zulrah: 20, vorkath: 3 } });
  assert.equal(start.skills.agility.xp, 4_700_000);
  assert.equal(start.skills.mining.xp, 0);
  assert.equal(start.bosses.zulrah.score, 30);
  assert.equal(end.skills.agility.xp, 5_000_000, 'the snapshot given is not changed');
  assert.deepEqual(beforeDay(end, null), { skills: end.skills, bosses: end.bosses });
});

test('a day of skilling is hours played; a day at a boss is hours bossed, not both', () => {
  const start = snap({ agility: 4_000_000, ranged: 10_000_000, hitpoints: 8_000_000 }, { zulrah: 100 });
  const skilling = dayHours(start, snap({ agility: 4_300_000, ranged: 10_000_000, hitpoints: 8_000_000 }, { zulrah: 100 }));
  assert.ok(skilling.ehpMilliGained > 0);
  assert.equal(skilling.ehbMilliGained, 0);

  const bossing = dayHours(start, snap({ agility: 4_000_000, ranged: 10_200_000, hitpoints: 8_070_000 }, { zulrah: 140 }));
  const zulrahHours = computeEhpEhb(snap({}, { zulrah: 40 })).ehb;
  assert.equal(bossing.ehbMilliGained, Math.round(zulrahHours * 1000));
  assert.equal(bossing.ehpMilliGained, 0, 'the combat XP from the kills is not a second set of hours');
});

test('days are redone newest first, each from the account as it stood', () => {
  const now = snap({ agility: 5_000_000 }, { zulrah: 60 });
  const out = rebuildDays(now, [
    { day: '2026-11-16', deltas: { skills: { agility: 200_000 } } },
    { day: '2026-11-15', deltas: { bosses: { zulrah: 20 } } },
    { day: '2026-11-14', deltas: {} },
  ]);
  assert.deepEqual([...out.keys()], ['2026-11-16', '2026-11-15', '2026-11-14']);
  assert.ok(out.get('2026-11-16')!.ehpMilliGained > 0);
  assert.equal(out.get('2026-11-16')!.ehbMilliGained, 0);
  assert.equal(out.get('2026-11-15')!.ehbMilliGained, Math.round(computeEhpEhb(snap({}, { zulrah: 20 })).ehb * 1000));
  assert.deepEqual(out.get('2026-11-14'), { ehpMilliGained: 0, ehbMilliGained: 0 });
});

test('ninety Bryophyta kills are a few hours, not most of a week', () => {
  const hours = computeEhpEhb(snap({}, { bryophyta: 90 })).ehb;
  assert.ok(hours > 3 && hours < 8, `got ${hours}`);
});
