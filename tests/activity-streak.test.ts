// Weekly activity streaks, the pure half (lib/activityStreak).
//
// Run: npx tsx --test tests/activity-streak.test.ts (no database).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isActiveDay, streakBriefLine, streakFrom, weekEndsAt, weekOf } from '../src/lib/activityStreak.ts';

const DAY = 86_400_000;
const add = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
/** Three active days (Wed, Thu, Fri) in each of the weeks starting at these Wednesdays. */
const weeksActive = (wednesdays: string[]) => wednesdays.flatMap((w) => [w, add(w, 1), add(w, 2)]);
const wedsBack = (fromWed: string, n: number) => Array.from({ length: n }, (_, i) => add(fromWed, -7 * (i + 1)));

// 2026-11-11 is a Wednesday.
const THIS_WED = '2026-11-11';

test('the week starts at the Wednesday reset', () => {
  assert.equal(weekOf('2026-11-11'), '2026-11-11');
  assert.equal(weekOf('2026-11-17'), '2026-11-11', 'Tuesday belongs to the week before the reset');
  assert.equal(weekOf('2026-11-10'), '2026-11-04');
  assert.equal(weekEndsAt('2026-11-13'), '2026-11-18T00:00:00.000Z');
});

test('a day counts on XP past the floor or any boss time, never on nothing', () => {
  assert.equal(isActiveDay({ xpGained: 1_000, ehbMilliGained: 0 }), true);
  assert.equal(isActiveDay({ xpGained: 200, ehbMilliGained: 0 }), false);
  assert.equal(isActiveDay({ xpGained: 0, ehbMilliGained: 5 }), true);
});

test('consecutive 3-day weeks make a streak; this week joins once it has its days', () => {
  const days = weeksActive(wedsBack(THIS_WED, 6));
  const mid = streakFrom(days, add(THIS_WED, 1));
  assert.equal(mid.weeks, 6);
  assert.equal(mid.safe, false);
  assert.equal(mid.thisWeek, 0);
  const done = streakFrom([...days, THIS_WED, add(THIS_WED, 1), add(THIS_WED, 2)], add(THIS_WED, 2));
  assert.equal(done.weeks, 7);
  assert.equal(done.safe, true);
  assert.equal(done.milestone?.name, 'Kindled');
  assert.equal(done.next?.weeks, 12);
});

test('two active days is not a week', () => {
  const w = wedsBack(THIS_WED, 1)[0];
  assert.equal(streakFrom([w, add(w, 1)], THIS_WED).weeks, 0);
});

test('a short week spends the month’s rest week and the streak carries on; a second one breaks it', () => {
  // 8 weeks back to 1 week back active, except one week in the middle.
  const weds = wedsBack(THIS_WED, 8);
  const gap = weds[3];
  const s = streakFrom(weeksActive(weds.filter((w) => w !== gap)), THIS_WED);
  assert.equal(s.weeks, 7, 'rest week kept it, without counting it');
  assert.ok(s.history.includes('rest'));
  // Two misses inside the same calendar month: only one rest week to spend.
  const twoGaps = [weds[1], weds[2]];
  assert.equal(weds[1].slice(0, 7), weds[2].slice(0, 7), 'test setup: same month');
  const t = streakFrom(weeksActive(weds.filter((w) => !twoGaps.includes(w))), THIS_WED);
  assert.equal(t.weeks, 1, 'broken at the second miss; only the last week counts');
  assert.equal(t.best, 5);
});

test('the login brief says what is needed, and nothing for someone who never played', () => {
  assert.equal(streakBriefLine(streakFrom([], THIS_WED)), null);
  const days = weeksActive(wedsBack(THIS_WED, 5));
  assert.match(streakBriefLine(streakFrom([...days, THIS_WED], THIS_WED))!, /^Week 6: 2 more active days before reset/);
  assert.match(streakBriefLine(streakFrom([...days, THIS_WED, add(THIS_WED, 1), add(THIS_WED, 2)], add(THIS_WED, 2)))!, /Week 6 locked in/);
  const fresh = streakFrom([THIS_WED], THIS_WED);
  assert.equal(streakBriefLine(fresh), '2 more active days this week starts a streak.');
});

test('days after today are ignored, so the answer never leaks the future', () => {
  assert.equal(streakFrom(weeksActive([THIS_WED]), add(THIS_WED, -1)).thisWeek, 0);
});

test('the login brief carries the streak on its second line, for everyone by default', async () => {
  const { composeBrief } = await import('../src/lib/chatBrief.ts');
  const { DEFAULT_BRIEF } = await import('../src/lib/chatFeedRules.ts');
  assert.ok(DEFAULT_BRIEF.includes('streak'));
  const lines = composeBrief(DEFAULT_BRIEF, { bingo: null, weeklies: [], clanEvents: [], goal: null, streak: 'Week 6 locked in.' });
  assert.deepEqual(lines, [{ tone: 'info', text: 'Week 6 locked in.' }]);
  assert.deepEqual(composeBrief(['bingo'], { bingo: null, weeklies: [], clanEvents: [], goal: null, streak: 'Week 6 locked in.' }), []);
});
