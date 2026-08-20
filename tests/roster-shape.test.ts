import test from 'node:test';
import assert from 'node:assert/strict';
import { coverageGaps, hoursMidpoint, rosterShape } from '../src/lib/rosterShape.ts';
import type { SignupProfile } from '../src/lib/signup.ts';

const p = (over: Partial<SignupProfile> = {}): SignupProfile => ({ ...over });

test('hoursMidpoint: the middle of a range, and what a half-stated one means', () => {
  assert.equal(hoursMidpoint({ min: 10, max: 20 }), 15);
  // One end only is the answer they gave — not half of it.
  assert.equal(hoursMidpoint({ min: 8 }), 8);
  assert.equal(hoursMidpoint({ max: 8 }), 8);
  assert.equal(hoursMidpoint(undefined), 0);
  assert.equal(hoursMidpoint({}), 0);
});

test('rosterShape: coverage is a share of the people who answered, not of the roster', () => {
  const shape = rosterShape([
    p({ bosses: ['zulrah', 'vorkath'], activeWeeklyHours: { min: 20, max: 30 }, timezone: 'UTC+0' }),
    p({ bosses: ['zulrah'], activeWeeklyHours: { min: 10, max: 10 }, timezone: 'UTC+0' }),
    // Signed up, said nothing: counted in size, never in the denominator.
    p(),
  ]);
  assert.equal(shape.size, 3);
  assert.equal(shape.answered, 2);
  assert.deepEqual(shape.bosses[0], { key: 'zulrah', count: 2, pct: 100 });
  assert.deepEqual(shape.bosses[1], { key: 'vorkath', count: 1, pct: 50 });
  assert.equal(shape.activeHoursPerWeek, 35);
  assert.equal(shape.busiestWeek, 25);
});

test('rosterShape: people who never said where they play are their own bucket', () => {
  const shape = rosterShape([
    p({ timezone: 'UTC+1', activeWeeklyHours: { min: 12, max: 12 } }),
    p({ timezone: 'UTC-5', activeWeeklyHours: { min: 6, max: 6 } }),
    p({ activeWeeklyHours: { min: 4, max: 4 } }),
  ]);
  // Unstated sorts last however many of them there are — it isn't a place.
  assert.equal(shape.timezones.at(-1)?.tz, null);
  assert.equal(shape.timezones.at(-1)?.players, 1);
  const utc1 = shape.timezones.find((t) => t.tz === 'UTC+1');
  assert.equal(utc1?.weeklyHours, 12);
});

test('coverageGaps: what the board asks for that nobody runs', () => {
  const shape = rosterShape([p({ bosses: ['zulrah', 'vorkath'] })]);
  assert.deepEqual(coverageGaps(shape, ['zulrah', 'nex', 'vorkath', 'nex']), ['nex']);
  // A board that asks for nothing can't be short of anything.
  assert.deepEqual(coverageGaps(shape, []), []);
});
