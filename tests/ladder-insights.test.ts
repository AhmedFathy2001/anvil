import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bestClaim,
  bestStreak,
  bestWeek,
  claimStreak,
  monthKey,
  monthLabel,
  monthWindow,
  monthWindowFor,
  pastSeasonKeys,
  projectSeason,
  rankMovement,
  seasonNumber,
  seasonProgress,
  trailingWindow,
  weekBuckets,
  buildFeed,
  type Claim,
} from '../src/lib/ladderInsights.ts';

const NOW = new Date('2026-08-14T09:00:00.000Z');

const claim = (playerId: number | null, day: string, points: number, label = 'task'): Claim => ({
  playerId,
  teamId: playerId ?? 0,
  tileId: 1,
  at: `${day}T12:00:00.000Z`,
  points,
  label,
});

test('month windows are exact UTC calendar months', () => {
  assert.deepEqual(monthWindow(NOW), {
    start: '2026-08-01T00:00:00.000Z',
    end: '2026-09-01T00:00:00.000Z',
  });
  assert.deepEqual(monthWindowFor('2026-07'), {
    start: '2026-07-01T00:00:00.000Z',
    end: '2026-08-01T00:00:00.000Z',
  });
  assert.equal(monthKey('2026-07-31T23:59:59.000Z'), '2026-07');
  assert.equal(monthLabel('2026-07'), 'July 2026');
});

test('trailing window ends now', () => {
  const w = trailingWindow(7, NOW);
  assert.equal(w.end, NOW.toISOString());
  assert.equal(w.start, '2026-08-07T09:00:00.000Z');
});

test('season number counts whole calendar months from the start date', () => {
  assert.equal(seasonNumber('2026-06-01T00:00:00.000Z', NOW), 3);
  assert.equal(seasonNumber('2026-08-30T00:00:00.000Z', NOW), 1);
  assert.equal(seasonNumber(null, NOW), 1);
});

test('season progress reports the day within the month', () => {
  const p = seasonProgress(NOW);
  assert.equal(p.day, 14);
  assert.equal(p.days, 31);
  assert.ok(p.fraction > 0.45 && p.fraction < 0.46);
});

test('rank movement is positive for a climb and null for a new entry', () => {
  const before = [
    { playerId: 1, name: 'a', points: 100, tasks: 1 },
    { playerId: 2, name: 'b', points: 90, tasks: 1 },
    { playerId: 3, name: 'c', points: 80, tasks: 1 },
  ];
  const now = [
    { playerId: 3, name: 'c', points: 300, tasks: 3 },
    { playerId: 1, name: 'a', points: 100, tasks: 1 },
    { playerId: 4, name: 'd', points: 95, tasks: 1 },
    { playerId: 2, name: 'b', points: 90, tasks: 1 },
  ];
  const m = rankMovement(now, before);
  assert.equal(m.get(3), 2); // 3rd -> 1st
  assert.equal(m.get(1), -1); // 1st -> 2nd
  assert.equal(m.get(2), -2); // 2nd -> 4th
  assert.equal(m.get(4), null); // wasn't on the board
});

test('a streak survives today having no claim yet, but not two empty days', () => {
  const consecutive = [
    claim(1, '2026-08-11', 10),
    claim(1, '2026-08-12', 10),
    claim(1, '2026-08-13', 10),
  ];
  // Last claim was yesterday — the day is not over, so the run still stands.
  assert.equal(claimStreak(consecutive, 1, NOW).current, 3);
  // One clear day missed breaks it.
  assert.equal(claimStreak(consecutive, 1, new Date('2026-08-15T09:00:00.000Z')).current, 0);
  // …but the longest run is history, and history doesn't break.
  assert.equal(claimStreak(consecutive, 1, new Date('2026-08-20T09:00:00.000Z')).longest, 3);
});

test('multiple claims on one day are one day of streak', () => {
  const sameDay = [claim(1, '2026-08-13', 10), claim(1, '2026-08-13', 25), claim(1, '2026-08-14', 5)];
  assert.equal(claimStreak(sameDay, 1, NOW).current, 2);
});

test('best streak scans every player', () => {
  const claims = [
    claim(1, '2026-08-01', 10),
    claim(1, '2026-08-02', 10),
    claim(2, '2026-08-01', 10),
    claim(2, '2026-08-02', 10),
    claim(2, '2026-08-03', 10),
  ];
  assert.deepEqual(bestStreak(claims, NOW), { playerId: 2, days: 3 });
});

test('unattributed claims never feed personal reads', () => {
  const claims = [claim(null, '2026-08-13', 50), claim(1, '2026-08-13', 10)];
  assert.equal(claimStreak(claims, 1, NOW).current, 1);
  assert.equal(bestClaim(claims, 1)?.points, 10);
  assert.equal(bestStreak(claims, NOW)?.playerId, 1);
});

test('week buckets are trailing 7-day windows, oldest first', () => {
  const claims = [
    claim(1, '2026-08-13', 40), // this week
    claim(1, '2026-08-09', 30), // this week
    claim(1, '2026-08-03', 20), // last week
    claim(1, '2026-07-26', 10), // the week before
  ];
  const b = weekBuckets(claims, 1, 3, NOW);
  assert.equal(b.length, 3);
  assert.equal(b[0].points, 10);
  assert.equal(b[1].points, 20);
  assert.equal(b[2].points, 70);
  assert.equal(b[2].tasks, 2);
});

test('projection needs a couple of days of history', () => {
  assert.equal(projectSeason(100, '2026-08-13T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NOW), null);
  assert.equal(projectSeason(0, '2026-08-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NOW), null);
  const p = projectSeason(234, '2026-08-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NOW);
  assert.ok(p !== null && p > 234, 'projects forward, never backwards');
});

test('past seasons exclude the month in progress', () => {
  const claims = [
    claim(1, '2026-08-13', 10),
    claim(1, '2026-07-20', 10),
    claim(1, '2026-06-02', 10),
  ];
  assert.deepEqual(pastSeasonKeys(claims, NOW), ['2026-07', '2026-06']);
});

test('best week is a rolling 7-day count, not a calendar week', () => {
  const claims = [
    claim(1, '2026-08-01', 10),
    claim(1, '2026-08-05', 10),
    claim(1, '2026-08-06', 10),
    claim(2, '2026-07-01', 10),
  ];
  assert.deepEqual(bestWeek(claims), { playerId: 1, tasks: 3, points: 30 });
});

test('feed interleaves claims with rotation, newest first', () => {
  const claims = [claim(1, '2026-08-13', 10, 'Kill 10 chickens')];
  const feed = buildFeed(
    claims,
    [{ label: 'Barrows chest', revealedAt: '2026-08-14T08:00:00.000Z', closedAt: null }],
    () => 'Kebab Enjoyer',
  );
  assert.equal(feed[0].kind, 'opened');
  assert.equal(feed[1].kind, 'claim');
  assert.equal(feed[1].playerName, 'Kebab Enjoyer');
});
