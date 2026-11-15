import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  boardRow,
  countRows,
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
