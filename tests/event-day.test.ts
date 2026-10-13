// Event days + the daily-digest snapshot (lib/eventDay) and turn-in counting (lib/turnIns).
//
// Run: node --experimental-strip-types --test tests/event-day.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DAY_MS, biggestComeback, dueDigestDay, eventDayCount, eventDayOf, rankTeams, totalGains, trimStats } from '../src/lib/eventDay.ts';
import { countTurnIns, turnInsOnTile } from '../src/lib/turnIns.ts';

const START = Date.parse('2026-10-14T18:00:00Z');
const END = START + 7 * DAY_MS;

test('eventDayOf: days count from the start, both stamp formats', () => {
  assert.equal(eventDayOf('2026-10-14 18:00:00', START), 1);
  assert.equal(eventDayOf('2026-10-15T17:59:59Z', START), 1);
  assert.equal(eventDayOf('2026-10-15 18:00:00', START), 2);
  assert.equal(eventDayOf('2026-10-14T17:00:00Z', START), null);
  assert.equal(eventDayOf('garbage', START), null);
});

test('eventDayCount: partial days round up', () => {
  assert.equal(eventDayCount(START, END), 7);
  assert.equal(eventDayCount(START, END + DAY_MS / 2), 8);
});

test('dueDigestDay: nothing before 24h, the latest full day after, never the final day', () => {
  assert.equal(dueDigestDay(START + DAY_MS - 1, START, END), null);
  assert.equal(dueDigestDay(START + DAY_MS, START, END), 1);
  assert.equal(dueDigestDay(START + 3.5 * DAY_MS, START, END), 3);
  assert.equal(dueDigestDay(START + 6 * DAY_MS + 1000, START, END), 6);
  // Day 7 ends at the event's end — the end post covers it.
  assert.equal(dueDigestDay(END, START, END), null);
  // An end 30 minutes after a day boundary is inside the grace too.
  assert.equal(dueDigestDay(START + 2 * DAY_MS, START, START + 2 * DAY_MS + 30 * 60 * 1000), null);
});

test('trimStats keeps xp/score only, drops ranks and zeroes', () => {
  const full = JSON.stringify({
    skills: { overall: { rank: 5, level: 2277, xp: 4_600_000_000 }, attack: { rank: 1, xp: 0 } },
    bosses: { zulrah: { rank: 9, score: 1200 }, vorkath: { rank: -1, score: -1 } },
    clues: { hard: { rank: 3, score: 40 } },
    activities: { lms: { score: 5 } },
  });
  assert.deepEqual(JSON.parse(trimStats(full)!), {
    skills: { overall: { xp: 4_600_000_000 } },
    bosses: { zulrah: { score: 1200 } },
    clues: { hard: { score: 40 } },
  });
  assert.equal(trimStats('nope'), null);
});

test('totalGains: overall XP and summed boss KC, never negative', () => {
  const a = JSON.stringify({ skills: { overall: { xp: 1000 } }, bosses: { zulrah: { score: 10 }, vorkath: { score: 5 } } });
  const b = JSON.stringify({ skills: { overall: { xp: 1500 } }, bosses: { zulrah: { score: 12 }, vorkath: { score: 9 }, kraken: { score: 1 } } });
  assert.deepEqual(totalGains(a, b), { xp: 500, kc: 7 });
  assert.deepEqual(totalGains(b, a), { xp: 0, kc: 0 });
  assert.deepEqual(totalGains(null, b), { xp: 0, kc: 0 });
});

test('rankTeams: ties share a rank', () => {
  const r = rankTeams([{ teamId: 1, score: 10 }, { teamId: 2, score: 20 }, { teamId: 3, score: 10 }, { teamId: 4, score: 1 }]);
  assert.deepEqual([r.get(2), r.get(1), r.get(3), r.get(4)], [1, 2, 2, 4]);
});

test('biggestComeback: worst-held rank to final rank, min climb respected', () => {
  const history = [new Map([[1, 1], [2, 2], [3, 4], [4, 3]]), new Map([[1, 2], [2, 1], [3, 3], [4, 4]])];
  const final = new Map([[3, 1], [1, 2], [2, 3], [4, 4]]);
  assert.deepEqual(biggestComeback(history, final, 2), { teamId: 3, from: 4, to: 1 });
  assert.equal(biggestComeback(history, new Map([[1, 1], [2, 2], [3, 3], [4, 4]]), 2), null);
});

test('turn-ins: a kill tile is one submission per person, drops count each', () => {
  const types = new Map<number, string>([[1, 'kill'], [2, 'drop']]);
  const rows = [
    ...Array.from({ length: 500 }, () => ({ tileId: 1, who: 'a' })),
    ...Array.from({ length: 30 }, () => ({ tileId: 1, who: 'b' })),
    { tileId: 2, who: 'a' },
    { tileId: 2, who: 'a' },
  ];
  assert.equal(countTurnIns(rows, (id) => types.get(id), (r) => r.who), 4);
  assert.equal(turnInsOnTile('kill', 500), 1);
  assert.equal(turnInsOnTile('drop', 3), 3);
  assert.equal(turnInsOnTile('kill', 0), 0);
});
