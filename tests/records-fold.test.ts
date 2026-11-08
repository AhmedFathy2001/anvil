// The records fold: the daily-history backfill (pure), the milestone feed filter, and that the old
// "Best days" view is gone. Run: npx tsx --test tests/records-fold.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { backfillRecords, type DailyHistoryRow } from '../src/lib/recordsRules.ts';
import { filterMoments } from '../src/lib/momentFilter.ts';

const row = (day: string, xp: number, zulrah = 0, ehpMilli = 0): DailyHistoryRow => ({
  day,
  xpGained: xp,
  ehpMilliGained: ehpMilli,
  ehbMilliGained: 0,
  deltas: zulrah ? JSON.stringify({ skills: { attack: xp }, bosses: { zulrah } }) : null,
});

test('backfill picks the best day, week, month and year from daily rows', () => {
  const rows = [
    row('2025-01-06', 100, 5), // Mon wk A (Jan)
    row('2025-01-07', 300, 0), // wk A: 400 total
    row('2025-01-13', 250, 2), // wk B (Jan): 250
    row('2025-02-03', 900, 1, 2500), // Feb, best single day, wk C
    row('2026-03-02', 50),
  ];
  const got = Object.fromEntries(backfillRecords(rows).map((r) => [`${r.metric}|${r.period}`, r]));
  assert.equal(got['overall|day'].value, 900);
  assert.equal(got['overall|week'].value, 900);
  assert.equal(got['overall|month'].value, 900); // Feb 900 beats Jan 650
  assert.equal(got['overall|year'].value, 1550); // 2025
  assert.equal(got['overall|week'].startedAt, '2025-02-03T00:00:00.000Z');
  assert.equal(got['zulrah|week'].value, 5);
  assert.equal(got['zulrah|year'].value, 8);
  assert.equal(got['hours_played|day'].value, 2.5);
  assert.equal(got['overall|day'].endedAt, '2025-02-03T00:00:00.000Z');
});

test('backfill tolerates corrupt deltas and empty history', () => {
  assert.deepEqual(backfillRecords([]), []);
  const r = backfillRecords([{ day: '2025-01-01', xpGained: 10, ehpMilliGained: 0, ehbMilliGained: 0, deltas: '{nope' }]);
  assert.equal(r.find((x) => x.metric === 'overall' && x.period === 'day')?.value, 10);
});

test('milestone filter returns milestone rows only', () => {
  const rows = [{ kind: 'pet' }, { kind: 'milestone' }, { kind: 'death' }, { kind: 'milestone' }, { kind: 'level' }];
  const got = filterMoments(rows, 'milestones');
  assert.equal(got.length, 2);
  assert.ok(got.every((r) => r.kind === 'milestone'));
  assert.equal(filterMoments(rows, 'all').length, 5);
});

test('the old Best days view is gone', () => {
  const tabs = readFileSync('src/app/members/[rsn]/ProfileTabs.tsx', 'utf8');
  assert.ok(!tabs.includes('Best days'));
  assert.ok(!readFileSync('src/lib/memberProfile.ts', 'utf8').includes('export async function getRecords'));
  assert.ok(existsSync('src/components/records/RecordsCard.tsx'));
});
