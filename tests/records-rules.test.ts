// Records rules (lib/recordsRules): period boundaries, baseline rollover, gains and improvements.
// Run: npx tsx --test tests/records-rules.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOURS_PLAYED,
  baselinesToRoll,
  improvements,
  metricValues,
  movedMetrics,
  periodGains,
  periodStart,
} from '../src/lib/recordsRules.ts';

test('period starts are UTC; weeks start Monday', () => {
  const t = new Date('2026-11-08T15:30:00Z'); // a Sunday
  assert.equal(periodStart('day', t), '2026-11-08T00:00:00.000Z');
  assert.equal(periodStart('week', t), '2026-11-02T00:00:00.000Z');
  assert.equal(periodStart('month', t), '2026-11-01T00:00:00.000Z');
  assert.equal(periodStart('year', t), '2026-01-01T00:00:00.000Z');
  assert.equal(periodStart('week', new Date('2026-11-09T00:00:00Z')), '2026-11-09T00:00:00.000Z');
});

test('metricValues drops unranked and adds hours', () => {
  const v = metricValues(
    { skills: { attack: { rank: 1, level: 99, xp: 13_034_431 }, sailing: { rank: -1, level: 1, xp: -1 } }, bosses: { zulrah: { rank: 5, score: 120 }, obor: { rank: -1, score: -1 } } },
    { played: 10.5, bossed: 2 },
  );
  assert.deepEqual(v, { attack: 13_034_431, zulrah: 120, hours_played: 10.5, hours_bossed: 2 });
});

test('baselines roll from previous totals; first ever update uses current', () => {
  const now = new Date('2026-11-08T10:00:00Z');
  const fresh = baselinesToRoll([], {}, { zulrah: 10 }, now);
  assert.equal(fresh.length, 4);
  assert.deepEqual(fresh[0].values, { zulrah: 10 });

  const rolled = baselinesToRoll(
    [
      { period: 'day', periodStart: '2026-11-07T00:00:00.000Z', values: { zulrah: 1 } },
      { period: 'week', periodStart: '2026-11-02T00:00:00.000Z', values: { zulrah: 1 } },
      { period: 'month', periodStart: '2026-11-01T00:00:00.000Z', values: { zulrah: 1 } },
      { period: 'year', periodStart: '2026-01-01T00:00:00.000Z', values: { zulrah: 1 } },
    ],
    { zulrah: 8 },
    { zulrah: 10 },
    now,
  );
  assert.deepEqual(rolled.map((b) => b.period), ['day']);
  assert.deepEqual(rolled[0].values, { zulrah: 8 });
});

test('gains only for moved metrics present in the baseline', () => {
  assert.deepEqual(movedMetrics({ a: 1, b: 2 }, { a: 1, b: 5, c: 9 }), ['b']);
  assert.deepEqual(periodGains({ b: 2 }, { b: 5, c: 9 }, ['b', 'c']), { b: 3 });
  assert.deepEqual(periodGains({ b: 6 }, { b: 5 }, ['b']), {});
});

test('improvements beat the stored best (hours with a small epsilon)', () => {
  const best = new Map([['zulrah|day', 30], [`${HOURS_PLAYED}|day`, 5]]);
  const out = improvements(
    [
      { metric: 'zulrah', period: 'day', value: 31, startedAt: 'x' },
      { metric: 'zulrah', period: 'week', value: 31, startedAt: 'x' },
      { metric: HOURS_PLAYED, period: 'day', value: 5.0001, startedAt: 'x' },
      { metric: 'zulrah', period: 'month', value: 0, startedAt: 'x' },
    ].filter((c) => c.value > 0) as never,
    best,
  );
  assert.deepEqual(out.map((c: { metric: string; period: string }) => `${c.metric}|${c.period}`), ['zulrah|day', 'zulrah|week']);
});
