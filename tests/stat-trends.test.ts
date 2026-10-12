import { test } from 'node:test';
import assert from 'node:assert/strict';

import { statTrends, trendLabel } from '../src/lib/statTrends';

function days(n: number, fill: (i: number) => { skills?: Record<string, number>; bosses?: Record<string, number> } | undefined) {
  return Array.from({ length: n }, (_, i) => ({ day: `d${i}`, deltas: fill(i) }));
}

test('this week is the last seven days, last week the seven before', () => {
  // 21 days: slayer 100/day for days 0-13, 300/day for the last 7.
  const t = statTrends(days(21, (i) => ({ skills: { slayer: i >= 14 ? 300 : 100 } })));
  assert.equal(t.skills.slayer.week, 2100);
  assert.equal(t.skills.slayer.prev, 700);
  assert.equal(t.skills.slayer.weeks.length, 8);
  assert.equal(t.days, 21);
});

test('bosses count kills the same way, and days with no detail are skipped', () => {
  const t = statTrends(days(14, (i) => (i % 2 ? { bosses: { vorkath: 3 } } : undefined)));
  // Odd days only: 7, 9, 11, 13 this week; 1, 3, 5 the week before.
  assert.equal(t.bosses.vorkath.week, 12);
  assert.equal(t.bosses.vorkath.prev, 9);
});

test('labels', () => {
  assert.deepEqual(trendLabel({ week: 2100, prev: 700, weeks: [] }), { text: '▲ 3.0×', tone: 'up' });
  assert.deepEqual(trendLabel({ week: 1200, prev: 1000, weeks: [] }), { text: '▲ 20%', tone: 'up' });
  assert.deepEqual(trendLabel({ week: 118_500, prev: 1000, weeks: [] }), { text: '▲ 119×', tone: 'up' });
  assert.deepEqual(trendLabel({ week: 50, prev: 100, weeks: [] }), { text: '▼ 50%', tone: 'down' });
  assert.deepEqual(trendLabel({ week: 5, prev: 0, weeks: [] }), { text: 'new', tone: 'up' });
  assert.equal(trendLabel(undefined).tone, 'none');
});
