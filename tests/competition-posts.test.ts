// A competition's Discord posts (lib/competitionPosts): the switches, the slot maths, who gets named,
// and the embeds. Pure, no database.
//
// Run: TESTS_OK=1 npx tsx --test tests/competition-posts.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  COMPETITION_POST_TYPES,
  amountWords,
  biggestClimber,
  clanCompetitionDefault,
  closestRace,
  dailyRecapEmbed,
  daySlotData,
  decideCompetitionPost,
  dueRecapDay,
  endingSoonDue,
  endingSoonEmbed,
  fitEmbed,
  halfwayEmbed,
  halfwayReportDue,
  momentClash,
  newOnBoard,
  noDropYetLine,
  parseClanCompetitionPosts,
  parseCompetitionPostOverrides,
  parseDaySlotData,
  recapSlot,
  recapSlotDay,
  sampleCompetitionEmbed,
  topGaps,
  topMovers,
  topWithMoves,
  type BoardLine,
  type DaySlotData,
  type PostSubject,
} from '../src/lib/competitionPosts.ts';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const START = Date.parse('2026-11-02T18:00:00.000Z');
const WEEK_END = START + 7 * DAY;

const skill: PostSubject = { type: 'skill', title: 'SOTW: Agility', endDate: new Date(WEEK_END).toISOString() };
const hunt: PostSubject = {
  type: 'hunt',
  title: 'Fang hunt',
  endDate: new Date(WEEK_END).toISOString(),
  hunt: { kind: 'Item hunt', line: 'Tanzanite fang from Zulrah · most by the end', rule: 'most', tracks: 'kills' },
};

const board: BoardLine[] = [
  { rsn: 'Ada', gained: 900_000 },
  { rsn: 'Bo', gained: 859_000 },
  { rsn: 'Cy', gained: 300_000 },
  { rsn: 'Di', gained: 120_000 },
  { rsn: 'Ed', gained: 0 },
];
const prev: DaySlotData = { p: { ada: [500_000, 2, 0], bo: [800_000, 1, 0], cy: [300_000, 3, 0] } };

const fieldsOf = (e: { fields?: { name: string; value: string }[] } | null) => Object.fromEntries((e?.fields ?? []).map((f) => [f.name, f.value]));
const sizeOf = (e: { title?: string; description?: string; author?: { name: string }; fields?: { name: string; value: string }[] }) =>
  (e.title?.length ?? 0) + (e.description?.length ?? 0) + (e.author?.name.length ?? 0) + (e.fields ?? []).reduce((n, f) => n + f.name.length + f.value.length, 0);

// ── switches ─────────────────────────────────────────────────────────────────────────────────────

test('with nothing stored, only the start and the results post', () => {
  const on = COMPETITION_POST_TYPES.filter((t) => clanCompetitionDefault(t.key, {})).map((t) => t.key);
  assert.deepEqual(on, ['start', 'results']);
  for (const t of COMPETITION_POST_TYPES) assert.equal(decideCompetitionPost(t.key, {}, {}, true), t.key === 'start' || t.key === 'results');
});

test('stored switches are read strictly: unknown keys and non-booleans are dropped', () => {
  assert.deepEqual(parseClanCompetitionPosts('{"daily":true,"halfway":"yes","nope":true,"results":false}'), { daily: true, results: false });
  assert.deepEqual(parseClanCompetitionPosts('not json'), {});
  assert.deepEqual(parseClanCompetitionPosts(null), {});
  assert.deepEqual(parseCompetitionPostOverrides({ daily: 'on', halfway: 'off', endingSoon: true, x: 'on' }), { daily: 'on', halfway: 'off' });
});

test('a competition beats its clan; a partner clan is never switched on by the host', () => {
  assert.equal(decideCompetitionPost('daily', { daily: true }, {}, true), true);
  assert.equal(decideCompetitionPost('daily', { daily: true }, { daily: 'off' }, true), false);
  assert.equal(decideCompetitionPost('daily', {}, { daily: 'on' }, true), true);
  // The other side of a clan vs clan: its own setting, and the host's 'off' silences it too.
  assert.equal(decideCompetitionPost('daily', {}, { daily: 'on' }, false), false);
  assert.equal(decideCompetitionPost('daily', { daily: true }, { daily: 'on' }, false), true);
  assert.equal(decideCompetitionPost('daily', { daily: true }, { daily: 'off' }, false), false);
  assert.equal(decideCompetitionPost('results', {}, { results: 'off' }, false), false);
});

// ── slots ────────────────────────────────────────────────────────────────────────────────────────

test('daily recap: every 24h from the start, the latest day only, never the day the competition ends on', () => {
  assert.equal(dueRecapDay(START + DAY - 1, START, WEEK_END), null);
  assert.equal(dueRecapDay(START + DAY, START, WEEK_END), 1);
  assert.equal(dueRecapDay(START + 2 * DAY + 5 * HOUR, START, WEEK_END), 2);
  // Down for three days: the latest day, once, not three.
  assert.equal(dueRecapDay(START + 4 * DAY + 60_000, START, WEEK_END), 4);
  assert.equal(dueRecapDay(START + 6 * DAY + 60_000, START, WEEK_END), 6);
  // Day 7 closes at the end: the results cover it.
  assert.equal(dueRecapDay(WEEK_END + 60_000, START, WEEK_END), null);
});

test('never for a competition shorter than 48 hours', () => {
  const end = START + 47 * HOUR;
  assert.equal(dueRecapDay(START + 25 * HOUR, START, end), null);
  assert.equal(halfwayReportDue(START + 30 * HOUR, START, end), false);
  assert.equal(endingSoonDue(START + 30 * HOUR, START, end), false);
  // Exactly 48 hours is long enough.
  assert.equal(dueRecapDay(START + 25 * HOUR, START, START + 2 * DAY), 1);
});

test('halfway from the midpoint to the end; ending soon inside the last 24 hours but not the last one', () => {
  assert.equal(halfwayReportDue(START + 3.5 * DAY - 1, START, WEEK_END), false);
  assert.equal(halfwayReportDue(START + 3.5 * DAY, START, WEEK_END), true);
  assert.equal(halfwayReportDue(WEEK_END, START, WEEK_END), false);
  assert.equal(endingSoonDue(WEEK_END - DAY - 1, START, WEEK_END), false);
  assert.equal(endingSoonDue(WEEK_END - DAY, START, WEEK_END), true);
  assert.equal(endingSoonDue(WEEK_END - 2 * HOUR, START, WEEK_END), true);
  assert.equal(endingSoonDue(WEEK_END - 30 * 60_000, START, WEEK_END), false);
});

test('slot names round-trip', () => {
  assert.equal(recapSlot(3), 'day:3');
  assert.equal(recapSlotDay('day:12'), 12);
  assert.equal(recapSlotDay('ending'), null);
});

test('one post per moment: which recap days land on ending soon or on halfway', () => {
  // A week: day 6 closes 24h before the end; halfway (3.5 days) is on no day boundary.
  assert.deepEqual(momentClash(START, WEEK_END, 6), { endingSoon: true, halfway: false });
  assert.deepEqual(momentClash(START, WEEK_END, 3), { endingSoon: false, halfway: false });
  // Four days: day 2 is halfway, day 3 is ending soon.
  assert.deepEqual(momentClash(START, START + 4 * DAY, 2), { endingSoon: false, halfway: true });
  assert.deepEqual(momentClash(START, START + 4 * DAY, 3), { endingSoon: true, halfway: false });
  // Two days: halfway itself is the last 24 hours.
  assert.equal(momentClash(START, START + 2 * DAY).endingSoon, true);
  assert.equal(momentClash(START, WEEK_END).endingSoon, false);
});

// ── who ──────────────────────────────────────────────────────────────────────────────────────────

test('a slot keeps scorers only, with their place', () => {
  const data = daySlotData([...board, { rsn: 'Flo', gained: 0, kills: 40 }]);
  assert.deepEqual(data.p, { ada: [900_000, 1, 0], bo: [859_000, 2, 0], cy: [300_000, 3, 0], di: [120_000, 4, 0], flo: [0, 0, 40] });
  assert.deepEqual(parseDaySlotData(JSON.stringify(data)), data);
  assert.equal(parseDaySlotData('garbage'), null);
  assert.equal(parseDaySlotData(null), null);
});

test('top movers are the gain since the last slot, and since the start without one', () => {
  assert.deepEqual(topMovers(board, prev), [
    { rsn: 'Ada', gain: 400_000 },
    { rsn: 'Di', gain: 120_000 },
    { rsn: 'Bo', gain: 59_000 },
  ]);
  assert.deepEqual(topMovers(board, null, 2), [{ rsn: 'Ada', gain: 900_000 }, { rsn: 'Bo', gain: 859_000 }]);
  // A gain corrected downwards is nobody's move.
  assert.deepEqual(topMovers([{ rsn: 'Ada', gained: 10 }], { p: { ada: [50, 1, 0] } }), []);
});

test('the top five carry their change in place; day one has no arrows', () => {
  assert.deepEqual(topWithMoves(board, prev).map((l) => [l.rsn, l.place, l.moved]), [['Ada', 1, 1], ['Bo', 2, -1], ['Cy', 3, 0], ['Di', 4, 0]]);
  assert.ok(topWithMoves(board, null).every((l) => l.moved === 0));
});

test('new on the board: scored now, had nothing at the last slot', () => {
  assert.deepEqual(newOnBoard(board, prev), ['Di']);
  assert.deepEqual(newOnBoard(board, null), []);
});

test('biggest climber, closest race and the gaps at the top', () => {
  assert.deepEqual(biggestClimber([{ ada: 4, bo: 1, cy: 2 }, { ada: 2, bo: 1 }], board), { rsn: 'Ada', from: 4, to: 1 });
  assert.equal(biggestClimber([{ ada: 2, bo: 1 }], board), null, 'one place is not a climb worth a line');
  assert.deepEqual(topGaps(board, 3), [
    { place: 2, ahead: 'Ada', behind: 'Bo', gap: 41_000 },
    { place: 3, ahead: 'Bo', behind: 'Cy', gap: 559_000 },
  ]);
  assert.deepEqual(closestRace(board), { place: 2, ahead: 'Ada', behind: 'Bo', gap: 41_000 });
  assert.equal(closestRace([{ rsn: 'Ada', gained: 5 }]), null);
  assert.equal(closestRace([{ rsn: 'Ada', gained: 5 }, { rsn: 'Bo', gained: 0 }]), null, 'somebody on zero is not in a race');
});

test('amounts read in the competition’s own unit', () => {
  assert.equal(amountWords('skill', 41_000), '41,000 XP');
  assert.equal(amountWords('boss', 12), '12 KC');
  assert.equal(amountWords('efficiency', 3250), '3.25 hours');
  assert.equal(amountWords('hunt', 1), '1 drop');
  assert.equal(amountWords('hunt', 3), '3 drops');
  assert.equal(noDropYetLine(14, 3120, 'kills'), '14 players, 3,120 kills, no drop yet');
  assert.equal(noDropYetLine(1, 0, null), '1 player, no drop yet');
});

// ── embeds ───────────────────────────────────────────────────────────────────────────────────────

test('daily recap: movers, top five with arrows, who joined, best drops', () => {
  const e = dailyRecapEmbed({ subject: skill, day: 3, fromDay: 2, board, prev, bestDrops: ['**Cy** · Giant squirrel (1 in 26,404)'] })!;
  assert.equal(e.author?.name, 'Skill of the Week · day 3');
  assert.equal(e.title, '📅 SOTW: Agility');
  assert.match(e.description!, /^\*\*Ada\*\* had the biggest day: \*\*\+400,000 XP\*\*\. Ends <t:\d+:R>\.$/);
  const f = fieldsOf(e);
  assert.deepEqual(Object.keys(f), ['Top movers, last 24 hours', 'Top 4', 'New on the board', 'Best drops today']);
  assert.equal(f['Top movers, last 24 hours'], '1. **Ada** +400,000 XP\n2. **Di** +120,000 XP\n3. **Bo** +59,000 XP');
  assert.equal(f['Top 4'], '🥇 **Ada** — +900,000 XP ▲1\n🥈 **Bo** — +859,000 XP ▼1\n🥉 **Cy** — +300,000 XP\n4. **Di** — +120,000 XP');
  assert.equal(f['New on the board'], '**Di**');
  assert.equal(f['Best drops today'], '🥇 **Cy** · Giant squirrel (1 in 26,404)');
});

test('daily recap after an outage covers the days it missed, in one post', () => {
  const e = dailyRecapEmbed({ subject: skill, day: 5, fromDay: 2, board, prev })!;
  assert.equal(e.author?.name, 'Skill of the Week · days 3–5');
  assert.ok(fieldsOf(e)['Top movers, since the last recap']);
});

test('daily recap: nothing moved, nothing posted', () => {
  const same = daySlotData(board);
  assert.equal(dailyRecapEmbed({ subject: skill, day: 3, fromDay: 2, board, prev: same }), null);
  assert.equal(dailyRecapEmbed({ subject: skill, day: 1, fromDay: 0, board: [{ rsn: 'Ed', gained: 0 }], prev: null }), null);
  // A drop on a day nobody gained is still a day worth a post.
  const e = dailyRecapEmbed({ subject: skill, day: 3, fromDay: 2, board, prev: same, bestDrops: ['**Cy** · Pet'] });
  assert.match(e!.description!, /drops landed/);
});

test('item hunt daily recap: drops landed, leaders, and "no drop yet"', () => {
  const hb: BoardLine[] = [{ rsn: 'Ada', gained: 2, kills: 900 }, { rsn: 'Bo', gained: 0, kills: 2220 }];
  const e = dailyRecapEmbed({ subject: hunt, day: 2, fromDay: 1, board: hb, prev: { p: { ada: [1, 1, 500], bo: [0, 0, 1000] } }, huntDrops: ['**Ada** · Tanzanite fang (at 880 kc)'] })!;
  assert.equal(e.author?.name, 'Item hunt · day 2');
  assert.match(e.description!, /^\*\*Tanzanite fang from Zulrah · most by the end\*\*\n1 drop landed\./);
  assert.deepEqual(fieldsOf(e), { 'Drops, last 24 hours': '**Ada** · Tanzanite fang (at 880 kc)', Leader: '🥇 **Ada** — 2 drops' });

  // Nobody has one, but people are killing: say so.
  const dry = dailyRecapEmbed({ subject: hunt, day: 1, fromDay: 0, board: [{ rsn: 'Ada', gained: 0, kills: 900 }, { rsn: 'Bo', gained: 0, kills: 2220 }], prev: null, huntDrops: [] })!;
  assert.match(dry.description!, /2 players, 3,120 kills, no drop yet\./);
  assert.deepEqual(dry.fields, []);

  // No drop and no kill since yesterday: no post.
  const still = { p: { ada: [0, 0, 900], bo: [0, 0, 2220] } } as DaySlotData;
  assert.equal(dailyRecapEmbed({ subject: hunt, day: 2, fromDay: 1, board: [{ rsn: 'Ada', gained: 0, kills: 900 }, { rsn: 'Bo', gained: 0, kills: 2220 }], prev: still, huntDrops: [] }), null);
});

test('halfway report: standings, climber, closest race, pace, best drops', () => {
  const e = halfwayEmbed({ subject: skill, board, history: [{ ada: 4, bo: 1 }], startMs: START, endMs: WEEK_END, nowMs: START + 3.5 * DAY, bestDrops: ['**Cy** · Giant squirrel'] })!;
  assert.equal(e.author?.name, 'Skill of the Week · halfway');
  assert.match(e.description!, /^Halfway there\. \*\*Ada\*\* leads with \*\*\+900,000 XP\*\*\./);
  const f = fieldsOf(e);
  assert.deepEqual(Object.keys(f), ['Standings so far', 'Biggest climber', 'Closest race', 'Pace', 'Best drops so far']);
  assert.equal(f['Biggest climber'], '**Ada** climbed from 4th to 1st');
  assert.equal(f['Closest race'], '2nd is 41,000 XP behind 1st: **Bo** chasing **Ada**');
  assert.equal(f['Pace'], '2,179,000 XP between 4 players so far: on pace for 4,358,000 XP by the end');
  // Nobody scored: no report.
  assert.equal(halfwayEmbed({ subject: skill, board: [{ rsn: 'Ed', gained: 0 }], history: [], startMs: START, endMs: WEEK_END, nowMs: START + 3.5 * DAY }), null);
});

test('halfway report on an item hunt has no pace, and says "no drop yet" when dry', () => {
  const e = halfwayEmbed({ subject: hunt, board: [{ rsn: 'Ada', gained: 2, kills: 900 }, { rsn: 'Bo', gained: 1, kills: 50 }], history: [], startMs: START, endMs: WEEK_END, nowMs: START + 3.5 * DAY })!;
  assert.deepEqual(Object.keys(fieldsOf(e)), ['Standings so far', 'Closest race']);
  assert.equal(fieldsOf(e)['Closest race'], '2nd is 1 drop behind 1st: **Bo** chasing **Ada**');
  const dry = halfwayEmbed({ subject: hunt, board: [{ rsn: 'Ada', gained: 0, kills: 900 }], history: [], startMs: START, endMs: WEEK_END, nowMs: START + 3.5 * DAY })!;
  assert.match(dry.description!, /Halfway there\. 1 player, 900 kills, no drop yet\./);
});

test('ending soon leads with the gaps at the top', () => {
  const e = endingSoonEmbed({ subject: skill, board });
  assert.equal(e.author?.name, 'Skill of the Week · ending soon');
  assert.equal(e.title, '⏰ SOTW: Agility');
  const lines = e.description!.split('\n');
  assert.match(lines[0], /^Ends <t:\d+:R>\.$/);
  assert.equal(lines[1], '2nd is 41,000 XP behind 1st: **Bo** chasing **Ada**');
  assert.equal(lines[2], '3rd is 559,000 XP behind 2nd: **Cy** chasing **Bo**');
  assert.deepEqual(Object.keys(fieldsOf(e)), ['Top 4']);
  // Standing in for the day's recap, it carries the movers.
  assert.equal(fieldsOf(endingSoonEmbed({ subject: skill, board, prev }))['Top movers since the last recap'], '1. **Ada** +400,000 XP\n2. **Di** +120,000 XP\n3. **Bo** +59,000 XP');
  // A tie, one runner, and an empty board all read as sentences.
  assert.match(endingSoonEmbed({ subject: skill, board: [{ rsn: 'Ada', gained: 5 }, { rsn: 'Bo', gained: 5 }] }).description!, /2nd is level with 1st/);
  assert.match(endingSoonEmbed({ subject: skill, board: [{ rsn: 'Ada', gained: 5 }] }).description!, /out in front on their own/);
  assert.match(endingSoonEmbed({ subject: skill, board: [] }).description!, /Nobody has scored yet/);
  assert.match(endingSoonEmbed({ subject: hunt, board: [{ rsn: 'Ada', gained: 0, kills: 12 }] }).description!, /1 player, 12 kills, no drop yet/);
});

test('every post stays inside Discord’s limits with a huge board and very long names', () => {
  const long = 'W'.repeat(400);
  const big: BoardLine[] = Array.from({ length: 600 }, (_, i) => ({ rsn: `${long}${i}`, gained: 1_000_000 - i }));
  const subject: PostSubject = { ...skill, title: 'T'.repeat(600) };
  const drops = [`**${long}** · ${long}`, `**${long}** · ${long}`, `**${long}** · ${long}`];
  const embeds = [
    dailyRecapEmbed({ subject, day: 2, fromDay: 1, board: big, prev: { p: {} }, bestDrops: drops })!,
    halfwayEmbed({ subject, board: big, history: [], startMs: START, endMs: WEEK_END, nowMs: START + 3.5 * DAY, bestDrops: drops })!,
    endingSoonEmbed({ subject, board: big, prev: { p: {} } }),
  ];
  for (const e of embeds) {
    assert.ok(e.title!.length <= 256, 'title');
    assert.ok(e.description!.length <= 4096, 'description');
    assert.ok((e.fields ?? []).length <= 25, 'field count');
    for (const f of e.fields ?? []) assert.ok(f.name.length <= 256 && f.value.length <= 1024, `field ${f.name.slice(0, 20)}`);
    assert.ok(sizeOf(e) <= 6000, `total ${sizeOf(e)}`);
  }
});

test('fitEmbed drops the last fields first, and only when it has to', () => {
  const f = (n: string) => ({ name: n, value: 'x'.repeat(1000), inline: false });
  const fitted = fitEmbed({ title: 't', fields: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(f) });
  assert.deepEqual(fitted.fields!.map((x) => x.name), ['a', 'b', 'c', 'd', 'e']);
  assert.equal(fitEmbed({ title: 't', fields: [f('a')] }).fields!.length, 1);
  assert.equal(fitEmbed({ fields: Array.from({ length: 40 }, (_, i) => ({ name: `${i}`, value: 'v', inline: false })) }).fields!.length, 25);
});

test('the samples build real posts', () => {
  for (const type of ['daily', 'halfway', 'endingSoon'] as const) {
    const e = sampleCompetitionEmbed(type, START);
    assert.ok(e.title && e.description && (e.fields ?? []).length >= 2, type);
    assert.ok(sizeOf(e) <= 6000);
  }
});
