import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCompetitionAwards, type AwardEntry } from '../src/lib/competitionAwards.ts';

// These awards exist because a week's data arrives at different times for different people — the
// plugin within seconds, the sweep hours later. So the thing being pinned here is that NONE of them
// can be won by arriving first: every one is decided by the shape of the days, and feeding the same
// week in a different order, or late, must crown the same person.

const ctx = {
  elapsed: 7,
  clanTotal: 1000,
  fmt: (n: number) => `${n}`,
  dayLabel: (i: number) => `day ${i + 1}`,
};

const entry = (rsn: string, days: number[], extra: Partial<AwardEntry> = {}): AwardEntry => ({
  rsn,
  gained: days.reduce((a, b) => a + b, 0),
  days,
  streak: extra.streak ?? days.filter((d) => d > 0).length,
  trackable: extra.trackable ?? true,
  ...extra,
});

const find = (awards: ReturnType<typeof buildCompetitionAwards>, key: string) => awards.find((a) => a.key === key);

test('opening day goes to the biggest day-one gain, not the first row', () => {
  const awards = buildCompetitionAwards(
    [entry('Zeta', [50, 0, 0, 0, 0, 0, 0]), entry('Alpha', [10, 90, 0, 0, 0, 0, 0])],
    ctx,
  );
  assert.equal(find(awards, 'day-one')?.who, 'Zeta');
});

test('the same week in a different order gives the same winners', () => {
  const week: AwardEntry[] = [
    entry('Ann', [10, 20, 30, 0, 0, 0, 0]),
    entry('Bob', [0, 0, 5, 5, 90, 0, 0]),
    entry('Cid', [40, 0, 0, 0, 0, 0, 0]),
  ];
  const a = buildCompetitionAwards(week, ctx);
  const b = buildCompetitionAwards([...week].reverse(), ctx);
  assert.deepEqual(a, b);
});

test('a tie is broken by name rather than by row order', () => {
  const awards = buildCompetitionAwards(
    [entry('Zed', [40, 0, 0, 0, 0, 0, 0]), entry('Abe', [40, 0, 0, 0, 0, 0, 0])],
    ctx,
  );
  assert.equal(find(awards, 'day-one')?.who, 'Abe');
});

test('biggest day names the day it happened', () => {
  const awards = buildCompetitionAwards([entry('Ann', [10, 10, 80, 10, 0, 0, 0])], ctx);
  const big = find(awards, 'big-day');
  assert.equal(big?.value, '80');
  assert.equal(big?.detail, 'day 3');
});

test('per-day rate ignores days off, and needs more than one day behind it', () => {
  // Grinder played every day; Sniper played twice and did more per day.
  const awards = buildCompetitionAwards(
    [entry('Grinder', [10, 10, 10, 10, 10, 10, 10]), entry('Sniper', [60, 60, 0, 0, 0, 0, 0])],
    ctx,
  );
  assert.equal(find(awards, 'per-day')?.who, 'Sniper');
});

test('a single huge day cannot take the per-day rate', () => {
  const awards = buildCompetitionAwards(
    [entry('Oneshot', [500, 0, 0, 0, 0, 0, 0]), entry('Steady', [20, 20, 20, 0, 0, 0, 0])],
    ctx,
  );
  assert.equal(find(awards, 'per-day')?.who, 'Steady');
});

test('late surge needs the surge to beat an even spread, not just be at the end', () => {
  const even = buildCompetitionAwards([entry('Even', [10, 10, 10, 10, 10, 10, 10])], ctx);
  assert.equal(find(even, 'late-surge'), undefined);

  const surged = buildCompetitionAwards([entry('Late', [0, 0, 0, 0, 0, 40, 60])], ctx);
  assert.equal(find(surged, 'late-surge')?.who, 'Late');
});

test('late surge is not offered before there is a week to have been quiet through', () => {
  const awards = buildCompetitionAwards([entry('Late', [0, 0, 90])], { ...ctx, elapsed: 3 });
  assert.equal(find(awards, 'late-surge'), undefined);
});

test('carrying the clan is suppressed on a small field', () => {
  const two = buildCompetitionAwards([entry('Ann', [900]), entry('Bob', [100])], { ...ctx, elapsed: 1 });
  assert.equal(find(two, 'share'), undefined);
});

test('carrying the clan needs a real share, not just the top of the pile', () => {
  const spread = [entry('Ann', [100]), entry('Bob', [90]), entry('Cid', [90]), entry('Dee', [80])];
  const awards = buildCompetitionAwards(spread, { ...ctx, elapsed: 1, clanTotal: 1000 });
  assert.equal(find(awards, 'share'), undefined);

  const carried = [entry('Ann', [500]), entry('Bob', [90]), entry('Cid', [90])];
  assert.equal(find(buildCompetitionAwards(carried, { ...ctx, elapsed: 1, clanTotal: 1000 }), 'share')?.who, 'Ann');
});

test('guests rank on the board but cannot win a day-shaped award', () => {
  const awards = buildCompetitionAwards(
    [entry('Guest', [999, 0, 0, 0, 0, 0, 0], { trackable: false }), entry('Member', [10, 0, 0, 0, 0, 0, 0])],
    ctx,
  );
  assert.equal(find(awards, 'day-one')?.who, 'Member');
});

test('days after today are not counted', () => {
  // Day 6 exists in the array but the week is only three days old.
  const awards = buildCompetitionAwards([entry('Ann', [10, 10, 10, 0, 0, 900, 0])], { ...ctx, elapsed: 3 });
  assert.equal(find(awards, 'big-day')?.value, '10');
});

test('a week nobody has scored in has no awards', () => {
  assert.deepEqual(buildCompetitionAwards([entry('Ann', [0, 0, 0, 0, 0, 0, 0])], ctx), []);
});
