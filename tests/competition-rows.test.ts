import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  boardPlaceWords,
  boardRow,
  countRows,
  personStandingWords,
  placeWords,
  sideWords,
  recordRow,
  rowWhen,
  sectionRows,
  spanText,
  weeklyRow,
  weeklyValueText,
  type BoardRowInput,
  type WeeklyRowInput,
} from '../src/lib/competitionRows';
import { START_WAITING_WORDS } from '../src/lib/eventStage';
import { runningParts } from '../src/lib/runningCount';

const NOW = Date.parse('2026-11-15T12:00:00.000Z');

const week = (over: Partial<WeeklyRowInput> = {}): WeeklyRowInput => ({
  id: 1,
  kind: 'botw',
  name: 'BOTW: Zulrah',
  metricLabel: 'Zulrah',
  iconUrl: '/z.png',
  state: 'live',
  startDate: '2026-11-12 11:31:00',
  endDate: '2026-11-19 11:31:00',
  entrants: 24,
  unit: 'KC',
  top: { rsn: 'Odd Anvil', value: 1172, tied: false },
  mode: 'solo',
  hostName: null,
  ...over,
});

const board = (over: Partial<BoardRowInput> = {}): BoardRowInput => ({
  id: 8,
  name: 'Winter Bingo 5x5',
  shape: '5×5',
  chips: ['4 teams', '20 claimed'],
  status: 'live',
  top: { name: 'Blue Wyverns', color: '#27c', score: 6, total: 25, unit: 'tiles' },
  foot: 'ends Nov 26',
  startDate: '2026-11-01T11:31:00.000Z',
  endDate: '2026-11-26T11:31:00.000Z',
  mode: 'classic',
  iconUrl: null,
  ...over,
});

test('a week says what is measured, who is in, and the leader with the figure', () => {
  const r = weeklyRow(week());
  assert.equal(r.key, 'w1');
  assert.equal(r.href, '/weekly/1');
  assert.equal(r.group, 'weeks');
  assert.deepEqual(r.meta, ['Zulrah KC', '24 entered']);
  assert.deepEqual(r.leader, { label: 'Leading', name: 'Odd Anvil', figure: '1,172 KC', color: null });
  assert.equal(r.noLeader, null);
});

test('a tie is said, and a finished week has a winner', () => {
  assert.equal(weeklyRow(week({ top: { rsn: 'A', value: 4, tied: true } })).leader?.name, 'A (tied)');
  assert.equal(weeklyRow(week({ state: 'past' })).leader?.label, 'Won by');
});

test('a week with no leader: only a running or finished one says so', () => {
  assert.equal(weeklyRow(week({ top: null })).noLeader, 'Nobody has scored yet');
  assert.equal(weeklyRow(week({ top: null, state: 'upcoming' })).noLeader, null);
  assert.equal(weeklyRow(week({ top: null, state: 'past' })).noLeader, 'No winner');
  // The loader hands a held-back board no leader; the row never invents one.
  assert.equal(weeklyRow(week({ top: null })).leader, null);
});

test('team and clan-vs-clan weeks say so once', () => {
  assert.deepEqual(weeklyRow(week({ mode: 'teams' })).meta.slice(2), ['In teams']);
  assert.deepEqual(weeklyRow(week({ mode: 'clans' })).meta.slice(2), ['Clan vs clan']);
  assert.deepEqual(weeklyRow(week({ mode: 'clans', hostName: 'Second Wind' })).meta.slice(2), ['Clan vs clan, Second Wind hosts']);
  assert.equal(weeklyRow(week()).meta.length, 2);
});

test('figures read the way each metric is read', () => {
  assert.equal(weeklyValueText('XP', 681_400), '681K XP');
  assert.equal(weeklyValueText('XP', 2_340_000), '2.3M XP');
  assert.equal(weeklyValueText('h', 12_500), '12.5h');
  assert.equal(weeklyRow(week({ unit: 'h', metricLabel: 'Hours bossed' })).meta[0], 'Hours bossed');
  assert.equal(weeklyRow(week({ unit: 'XP', metricLabel: 'Fishing' })).meta[0], 'Fishing XP');
});

test('a board says its format, its teams and the leading team with its tiles', () => {
  const r = boardRow(board());
  assert.equal(r.key, 'e8');
  assert.equal(r.href, '/events/8');
  assert.deepEqual(r.meta, ['5×5', '4 teams', '20 claimed']);
  assert.deepEqual(r.leader, { label: 'Leading', name: 'Blue Wyverns', figure: '6 of 25 tiles', color: '#27c' });
});

test('a board with hidden size or a finished board gives the plain figure', () => {
  assert.equal(boardRow(board({ top: { name: 'A', color: '#000', score: 6, total: 0, unit: 'tiles' } })).leader?.figure, '6 tiles');
  const done = boardRow(board({ status: 'past' }));
  assert.equal(done.leader?.label, 'Won by');
  assert.equal(done.leader?.figure, '6 tiles');
});

test('a board without teams says so, and keeps its other chips', () => {
  assert.deepEqual(boardRow(board({ chips: [], top: null, status: 'upcoming' })).meta, ['5×5', 'No teams yet']);
  assert.deepEqual(boardRow(board({ chips: ['co-hosted · second-wind'], top: null })).meta, ['5×5', 'No teams yet', 'co-hosted · second-wind']);
  assert.deepEqual(boardRow(board({ chips: ['16 players'] })).meta, ['5×5', '16 players']);
});

test('hidden standings stay hidden: no top in, no leader out', () => {
  const r = boardRow(board({ top: null, chips: ['4 teams'] }));
  assert.equal(r.leader, null);
  assert.equal(r.noLeader, 'Nobody has scored yet');
});

test('span text: two units at most, never zero', () => {
  assert.equal(spanText(5 * 86_400_000 + 18 * 3_600_000 + 59_000), '5d 18h');
  assert.equal(spanText(2 * 86_400_000), '2d');
  assert.equal(spanText(3 * 3_600_000 + 20 * 60_000), '3h 20m');
  assert.equal(spanText(3_600_000), '1h');
  assert.equal(spanText(12 * 60_000), '12m');
  assert.equal(spanText(5_000), '1m');
});

test('when: ends in, starts in, no end date, waiting on teams', () => {
  assert.deepEqual(rowWhen(weeklyRow(week()), NOW), { text: 'Ends in 3d 23h', at: '2026-11-19 11:31:00' });
  assert.deepEqual(rowWhen(boardRow(board({ endDate: null })), NOW), { text: 'No end date', at: null });
  assert.deepEqual(rowWhen(boardRow(board({ status: 'upcoming', startDate: '2026-11-20T12:00:00.000Z' })), NOW), {
    text: 'Starts in 5d',
    at: '2026-11-20T12:00:00.000Z',
  });
  assert.deepEqual(rowWhen(boardRow(board({ status: 'upcoming', startDate: null })), NOW), { text: 'Not scheduled yet', at: null });
  // Held: the start time passed and it is waiting on teams. The date is not a promise.
  const held = boardRow(board({ status: 'upcoming', startDate: '2026-11-14T12:00:00.000Z', foot: START_WAITING_WORDS }));
  assert.equal(held.startHeld, true);
  assert.deepEqual(rowWhen(held, NOW), { text: START_WAITING_WORDS, at: null });
  assert.equal(rowWhen(boardRow(board({ status: 'past' })), NOW), null);
});

test('when reads both stored timestamp formats the same', () => {
  const a = rowWhen(weeklyRow(week({ endDate: '2026-11-19 11:31:00' })), NOW);
  const b = rowWhen(weeklyRow(week({ endDate: '2026-11-19T11:31:00.000Z' })), NOW);
  assert.equal(a?.text, b?.text);
});

test('sections: mine first, then the rest running, then up next; every row once', () => {
  const rows = [
    boardRow(board({ id: 1, endDate: null })),
    boardRow(board({ id: 2, endDate: '2026-11-25T00:00:00.000Z' })),
    boardRow(board({ id: 3, status: 'upcoming', startDate: '2026-11-29T00:00:00.000Z' })),
    boardRow(board({ id: 4, status: 'upcoming', startDate: '2026-11-20 00:00:00' })),
    weeklyRow(week({ id: 5, endDate: '2026-11-19 11:31:00' })),
    weeklyRow(week({ id: 6, endDate: '2026-11-21 11:31:00' })),
    weeklyRow(week({ id: 7, state: 'upcoming', startDate: '2026-11-22 11:31:00' })),
    weeklyRow(week({ id: 8, state: 'past' })),
  ];
  const s = sectionRows(rows, new Set(['w6', 'w7']));
  assert.deepEqual(s.mine.map((r) => r.key), ['w6', 'w7'], 'running before scheduled');
  assert.deepEqual(s.running.map((r) => r.key), ['w5', 'e2', 'e1'], 'soonest to end first, no end date last');
  assert.deepEqual(s.upNext.map((r) => r.key), ['e4', 'e3'], 'soonest to start first, across both formats');
  const all = [...s.mine, ...s.running, ...s.upNext].map((r) => r.key).sort();
  assert.deepEqual(all, ['e1', 'e2', 'e3', 'e4', 'w5', 'w6', 'w7'], 'nothing dropped, nothing twice, finished left out');
});

test('sections for a signed-out viewer, only weeks, only boards, nothing', () => {
  const weeks = [weeklyRow(week({ id: 1 })), weeklyRow(week({ id: 2 }))];
  const boards = [boardRow(board({ id: 1 }))];
  assert.equal(sectionRows(weeks, new Set()).mine.length, 0);
  assert.equal(runningParts(countRows(sectionRows(weeks, new Set()).running)), '2 competitions');
  assert.equal(runningParts(countRows(sectionRows(boards, new Set()).running)), '1 event');
  assert.equal(runningParts(countRows(sectionRows([...boards, ...weeks], new Set()).running)), '1 event and 2 competitions');
  assert.deepEqual(sectionRows([], new Set()), { mine: [], running: [], upNext: [] });
});

test('a line of the record is the same row', () => {
  const r = recordRow({
    key: 'e9',
    kind: 'classic',
    group: 'boards',
    name: 'Summer Bingo',
    href: '/events/9',
    startDate: '2026-10-01',
    endDate: '2026-10-15',
    state: 'past',
    entrants: 3,
    entrantLabel: 'teams',
    top: { name: 'Team Kebab', text: '14 tiles', color: '#f80' },
  });
  assert.deepEqual(r.meta, ['3 teams']);
  assert.deepEqual(r.leader, { label: 'Won by', name: 'Team Kebab', figure: '14 tiles', color: '#f80' });
  const lone = recordRow({ ...r, name: r.title, entrants: 1, entrantLabel: 'teams', top: null });
  assert.deepEqual(lone.meta, ['1 team']);
  assert.equal(lone.noLeader, 'No winner');
  assert.deepEqual(recordRow({ ...r, name: r.title, entrants: 0, entrantLabel: 'entered', top: null }).meta, []);
});

test('the viewer\'s own board: their team by name, never a place', () => {
  const mine = boardRow(board(), { teamNames: ['Red Dragons'], signedUp: false });
  assert.equal(mine.yours, 'Your team: Red Dragons');
  // The leader line is exactly what it is for everyone else.
  assert.deepEqual(mine.leader, boardRow(board()).leader);
  assert.equal(boardRow(board(), { teamNames: ['A', 'B'], signedUp: false }).yours, 'Your teams: A, B');
  assert.equal(boardRow(board({ chips: ['16 players'] }), { teamNames: ['Lcl Member'], signedUp: false }).yours, 'Playing as Lcl Member');
  assert.equal(boardRow(board({ status: 'upcoming', top: null }), { teamNames: [], signedUp: true }).yours, 'You are signed up');
  assert.equal(boardRow(board(), { teamNames: [], signedUp: false }).yours, null);
  assert.equal(boardRow(board()).yours, null);
  assert.equal(weeklyRow(week()).yours, null);
});

test('hidden standings stay hidden on the viewer\'s own board', () => {
  const r = boardRow(board({ top: null, chips: ['4 teams'] }), { teamNames: ['Red Dragons'], signedUp: false });
  assert.equal(r.leader, null);
  assert.equal(r.yours, 'Your team: Red Dragons');
  assert.ok(!r.meta.some((m) => /claimed/.test(m)));
});

test('a viewer on some boards and in some weeklies: theirs first, both kinds, counted apart', () => {
  const rows = [
    boardRow(board({ id: 1, endDate: '2026-11-25T00:00:00.000Z' }), { teamNames: ['Red Dragons'], signedUp: false }),
    boardRow(board({ id: 2, endDate: '2026-11-20T00:00:00.000Z' })),
    boardRow(board({ id: 3, status: 'upcoming', startDate: '2026-11-29T00:00:00.000Z', top: null }), { teamNames: [], signedUp: true }),
    boardRow(board({ id: 4, status: 'upcoming', startDate: '2026-11-20 00:00:00', top: null })),
    weeklyRow(week({ id: 5, endDate: '2026-11-19 11:31:00' })),
    weeklyRow(week({ id: 6, endDate: '2026-11-21 11:31:00' })),
    weeklyRow(week({ id: 7, state: 'upcoming', startDate: '2026-11-22 11:31:00' })),
  ];
  const s = sectionRows(rows, new Set(['e1', 'e3', 'w5', 'w7']));
  assert.deepEqual(s.mine.map((r) => r.key), ['w5', 'e1', 'w7', 'e3'], 'running (soonest end first) before scheduled (soonest start first)');
  assert.deepEqual(s.running.map((r) => r.key), ['e2', 'w6']);
  assert.deepEqual(s.upNext.map((r) => r.key), ['e4']);
  assert.equal(runningParts(countRows(s.mine)), '2 events and 2 competitions');
  assert.equal(runningParts(countRows(s.running)), '1 event and 1 competition');
  // Signed out, or in nothing: no section of their own, and nothing goes missing.
  const none = sectionRows(rows, new Set());
  assert.equal(none.mine.length, 0);
  assert.equal(none.running.length + none.upNext.length, rows.length);
});

test('a finished board the viewer played in names their team; a week or a bare sign-up does not', () => {
  const item = {
    key: 'e9', kind: 'classic', group: 'boards' as const, name: 'Summer Bingo', href: '/events/9',
    startDate: '2026-10-01', endDate: '2026-10-15', state: 'past' as const, entrants: 3, entrantLabel: 'teams',
    top: { name: 'Team Kebab', text: '14 tiles' },
  };
  assert.equal(recordRow(item, { teamNames: ['Team Kebab'], signedUp: false }).yours, 'Your team: Team Kebab');
  assert.equal(recordRow({ ...item, entrantLabel: 'players' }, { teamNames: ['Lcl Member'], signedUp: false }).yours, 'Playing as Lcl Member');
  assert.equal(recordRow(item, { teamNames: [], signedUp: true }).yours, null);
  assert.equal(recordRow({ ...item, group: 'weeks' as const }, { teamNames: ['X'], signedUp: false }).yours, null);
  assert.equal(recordRow(item).yours, null);
  // The winner line does not change with who is looking.
  assert.deepEqual(recordRow(item, { teamNames: ['Other'], signedUp: false }).leader, recordRow(item).leader);
});

// ---- where the viewer stands --------------------------------------------------------------------

const person = (over: Partial<import('../src/lib/competitionRows').PersonStanding> = {}) => ({
  rank: 6,
  total: 24,
  scored: true,
  behind: 5,
  lead: null,
  ...over,
});

test('a week says the place, the field and the gap in the row\u2019s own unit', () => {
  assert.equal(personStandingWords('KC', person()), 'You: #6 of 24 \u00b7 5 KC behind #5');
  assert.equal(personStandingWords('XP', person({ behind: 12_400 })), 'You: #6 of 24 \u00b7 12K XP behind #5');
  assert.equal(personStandingWords('h', person({ behind: 1500 })), 'You: #6 of 24 \u00b7 1.5h behind #5');
});

test('first place says how far ahead; a tie at the top or with the place above has no gap to say', () => {
  assert.equal(personStandingWords('KC', person({ rank: 1, behind: null, lead: 12 })), 'You\u2019re leading by 12 KC');
  assert.equal(personStandingWords('KC', person({ rank: 1, behind: null, lead: null })), 'You\u2019re leading');
  assert.equal(personStandingWords('KC', person({ rank: 1, behind: null, lead: 0 })), 'You: #1 of 24');
  assert.equal(personStandingWords('KC', person({ behind: 0 })), 'You: #6 of 24');
  assert.equal(personStandingWords('KC', person({ behind: null })), 'You: #6 of 24');
});

test('no score yet, no place: the row keeps its plain \u201cYou\u2019re in\u201d', () => {
  assert.equal(personStandingWords('KC', person({ scored: false })), null);
  const row = weeklyRow(week(), { person: person({ scored: false }), side: null });
  assert.equal(row.standing, null);
  assert.equal(row.yours, null);
});

test('a team or clan week names the side, with its place once it has scored', () => {
  const side = { kind: 'team' as const, name: 'Grim Kebab', rank: 2, of: 3, scored: true, clearLead: false };
  assert.equal(sideWords(side), 'Your team: Grim Kebab \u00b7 2nd of 3');
  assert.equal(sideWords({ ...side, kind: 'clan', name: 'Iron Forge', rank: 1, clearLead: true }), 'Your clan: Iron Forge \u00b7 leading');
  // Tied for first shares the place rather than claiming the lead.
  assert.equal(sideWords({ ...side, rank: 1, clearLead: false }), 'Your team: Grim Kebab \u00b7 1st of 3');
  assert.equal(sideWords({ ...side, scored: false }), 'Your team: Grim Kebab');
  assert.equal(weeklyRow(week(), { person: null, side }).yours, 'Your team: Grim Kebab \u00b7 2nd of 3');
});

test('places read as ordinals, and a clear first is \u201cleading\u201d', () => {
  assert.equal(placeWords(1, 4, true), 'leading');
  assert.equal(placeWords(1, 4, false), '1st of 4');
  assert.equal(placeWords(11, 12, false), '11th of 12');
  assert.equal(placeWords(22, 30, false), '22nd of 30');
});

test('a board names the team\u2019s place when it has one', () => {
  const ranking = { teams: 4, scores: [{ teamId: 9, value: 12 }, { teamId: 3, value: 8 }, { teamId: 5, value: 8 }] };
  const mine = (teamId: number, name = 'Red Dragons') => ({ teamNames: [name], teamIds: [teamId], signedUp: false });
  assert.equal(boardPlaceWords(mine(9), ranking), 'leading');
  // Tied for second shares the place.
  assert.equal(boardPlaceWords(mine(3), ranking), '2nd of 4');
  assert.equal(boardPlaceWords(mine(5), ranking), '2nd of 4');
  const row = boardRow({ ...board(), ranking }, mine(3));
  assert.equal(row.yours, 'Your team: Red Dragons \u00b7 2nd of 4');
});

test('a board gives no place without a score, with several teams, or when standings are held back', () => {
  const ranking = { teams: 4, scores: [{ teamId: 9, value: 12 }] };
  assert.equal(boardPlaceWords({ teamNames: ['A'], teamIds: [2], signedUp: false }, ranking), null, 'no score of their own');
  assert.equal(boardPlaceWords({ teamNames: ['A', 'B'], teamIds: [9, 2], signedUp: false }, ranking), null, 'two teams');
  assert.equal(boardPlaceWords({ teamNames: ['A'], teamIds: [9], signedUp: false }, { teams: 4, scores: [] }), null, 'hidden: no scores handed over');
  assert.equal(boardRow(board(), { teamNames: ['Red Dragons'], teamIds: [9], signedUp: false }).yours, 'Your team: Red Dragons');
  // A players board keeps its wording and adds the place.
  const players = boardRow({ ...board(), chips: ['40 players'], ranking: { teams: 40, scores: [{ teamId: 1, value: 5 }, { teamId: 2, value: 3 }] } }, { teamNames: ['Max'], teamIds: [2], signedUp: false });
  assert.equal(players.yours, 'Playing as Max \u00b7 2nd of 40');
});

import { youreInNote } from '../src/lib/competitionRows.ts';

test('the clan home counts what the viewer is in the way the events page does, and says what is shown above', () => {
  // Home lists 7 events + 4 competitions (the other 1 + 1 are the featured cards); events page: 8 + 5.
  assert.equal(youreInNote({ events: 7, competitions: 4 }, { events: 1, competitions: 1 }), '8 events and 5 competitions · 1 event and 1 competition shown above');
  assert.equal(youreInNote({ events: 2, competitions: 0 }, { events: 0, competitions: 0 }), '2 events');
  assert.equal(youreInNote({ events: 0, competitions: 1 }, { events: 1, competitions: 0 }), '1 event and 1 competition · 1 event shown above');
});
