import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCompetitionFeed, feedLineMatches, placesAfter, watchedPlaces, type FeedMoment } from '../src/lib/competitionFeed.ts';

const days = ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'];
const entries = [
  { rsn: 'Ann', days: [50, 10, 0, 0], isMe: false },
  { rsn: 'Bob', days: [40, 40, 5, 0], isMe: false },
  { rsn: 'Cat', days: [30, 5, 60, 0], isMe: false },
  { rsn: 'Dee', days: [20, 0, 0, 0], isMe: false },
  { rsn: 'Me', days: [5, 30, 0, 0], isMe: true },
  { rsn: 'Idle', days: [0, 0, 0, 0], isMe: false },
];
const moment = (over: Partial<FeedMoment>): FeedMoment => ({
  id: 1, rsn: 'Ann', kind: 'unique', itemName: 'Tanzanite fang', quantity: 1, source: 'Zulrah', valueGp: null, kc: 311, rarityDenominator: 1024, occurredAt: '2026-11-11T10:00:00.000Z', ...over,
});
const feed = (over: Partial<Parameters<typeof buildCompetitionFeed>[0]> = {}) =>
  buildCompetitionFeed({ type: 'boss', days, elapsed: 3, ended: false, entries, payingPlaces: 0, moments: [], gainWords: (v) => `${v} KC`, ...over });
const linesOf = (f: ReturnType<typeof feed>, day: string) => f.find((d) => d.day === day)?.lines ?? [];

test('the podium is watched, or every paying place when more than three pay', () => {
  assert.equal(watchedPlaces(0), 3);
  assert.equal(watchedPlaces(2), 3);
  assert.equal(watchedPlaces(5), 5);
});

test('nobody holds a place on zero', () => {
  assert.deepEqual([...placesAfter(entries, 0)], [['Ann', 1], ['Bob', 2], ['Cat', 3], ['Dee', 4], ['Me', 5]]);
});

test('the first day sets the order: a daily update, no place changes', () => {
  const day1 = linesOf(feed(), '2026-11-10');
  assert.deepEqual(day1.map((l) => l.tag), ['day']);
  assert.equal(day1[0].rsn, 'Ann');
  assert.equal(day1[0].text, 'had the biggest day: +50 KC.');
});

test('only moves up into a watched place are lines; the rest is the daily update', () => {
  // After day 2: Bob 80, Ann 60, Cat 35 and Me 35 (Cat ahead on board order), Dee 20.
  const day2 = linesOf(feed(), '2026-11-11');
  assert.deepEqual(day2.map((l) => `${l.tag}:${l.rsn} ${l.text}`), [
    'day:Bob had the biggest day: +40 KC. You climbed 1 place to 4th.',
    'rank:Bob took 1st from Ann',
  ]);
  assert.equal(day2[0].mine, true);
});

test('the day in progress has place changes but no daily update yet', () => {
  // After day 3: Cat 95, Bob 85, Ann 60.
  const day3 = linesOf(feed(), '2026-11-12');
  assert.deepEqual(day3.map((l) => `${l.tag}:${l.rsn} ${l.text}`), ['rank:Cat took 1st from Bob']);
  assert.equal(linesOf(feed({ ended: true }), '2026-11-12')[0].tag, 'day');
});

test('a paying place below the podium is watched and says so', () => {
  const day2 = linesOf(feed({ payingPlaces: 4 }), '2026-11-11');
  const mine = day2.find((l) => l.tag === 'rank' && l.rsn === 'Me');
  assert.equal(mine?.text, 'took 4th from Dee');
  assert.equal(mine?.detail, 'a paying place');
  assert.equal(mine?.mine, true);
});

test('deaths are one line per person per day; a drop keeps its odds', () => {
  const moments = [
    moment({ id: 1 }),
    moment({ id: 2, rsn: 'Bob', kind: 'death', itemName: null, source: 'Zulrah', kc: null, rarityDenominator: null, occurredAt: '2026-11-11T08:00:00.000Z' }),
    moment({ id: 3, rsn: 'Bob', kind: 'death', itemName: null, source: 'Zulrah', kc: null, rarityDenominator: null, occurredAt: '2026-11-11T09:00:00.000Z' }),
    moment({ id: 4, rsn: 'Bob', kind: 'death', itemName: null, source: 'Zulrah', kc: null, rarityDenominator: null, occurredAt: '2026-11-11T12:00:00.000Z' }),
    moment({ id: 5, rsn: 'Gone', kind: 'pet', itemName: 'Pet snakeling' }),
  ];
  const day2 = linesOf(feed({ moments }), '2026-11-11').filter((l) => l.tag === 'drop' || l.tag === 'death');
  assert.deepEqual(day2.map((l) => `${l.rsn} ${l.text}`), ['Bob died 3 times to Zulrah', 'Ann got Tanzanite fang from Zulrah']);
  assert.equal(day2[1].detail, '1 in 1,024 · 311 KC');
});

test('an efficiency contest shows standings lines only', () => {
  const f = feed({ type: 'efficiency', moments: [moment({})] });
  assert.ok(f.flatMap((d) => d.lines).every((l) => l.tag === 'rank' || l.tag === 'day'));
});

test('newest day first, and the filters pick by kind or by owner', () => {
  const f = feed();
  assert.deepEqual(f.map((d) => d.day), ['2026-11-12', '2026-11-11', '2026-11-10']);
  const all = f.flatMap((d) => d.lines);
  assert.equal(all.filter((l) => feedLineMatches(l, 'standings')).length, all.length);
  assert.deepEqual(all.filter((l) => feedLineMatches(l, 'mine')).map((l) => l.key), ['day1']);
});
