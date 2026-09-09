// One human, several characters — and a fanout that counts seats.
//
// lib/weekly's enrollAllPlayers walks `clan_roster`, which is (account × clan): one row per
// character. So a person whose main is on the roster as a member and whose alt was pinged in as a
// guest is TWO entrants in the same competition, racing each other. Nothing anywhere said so, and
// the only control over any of it was one includeGuests boolean set at creation — all guests or
// none, with no way to remove anybody afterwards.
//
// Run: node --experimental-strip-types --test tests/weekly-entrants.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { doubleEntries, surplusSeats, guestSplit, type EntrantSeat } from '../src/lib/weeklyEntrants.ts';

const seat = (over: Partial<EntrantSeat> & { participantId: number; rsn: string }): EntrantSeat => ({
  playerId: null,
  kind: 'member',
  left: false,
  ...over,
});

const normalize = (rsn: string) => rsn.toLowerCase().replace(/[\s_-]+/g, ' ').trim();

test('one seat each is not a double entry', () => {
  const seats = [
    seat({ participantId: 1, rsn: 'Zezima', playerId: 10 }),
    seat({ participantId: 2, rsn: 'Woox', playerId: 11 }),
  ];
  assert.deepEqual(doubleEntries(seats), []);
  assert.deepEqual(surplusSeats(seats), []);
});

test('THE CASE THIS FILE EXISTS FOR — a member main and a guest alt are one person, twice', () => {
  const seats = [
    seat({ participantId: 1, rsn: 'Main Guy', playerId: 10, kind: 'member' }),
    seat({ participantId: 2, rsn: 'Alt Guy', playerId: 10, kind: 'guest' }),
    seat({ participantId: 3, rsn: 'Someone Else', playerId: 11 }),
  ];
  const doubles = doubleEntries(seats);
  assert.equal(doubles.length, 1);
  assert.equal(doubles[0].playerId, 10);
  assert.deepEqual(doubles[0].seats.map((s) => s.rsn), ['Main Guy', 'Alt Guy']);
});

test('the member seat is the one kept, whatever order it arrived in', () => {
  // The guest is listed first here. A person's standing in the clan decides which entry survives,
  // not the order the fanout happened to insert them.
  const seats = [
    seat({ participantId: 2, rsn: 'Alt Guy', playerId: 10, kind: 'guest' }),
    seat({ participantId: 1, rsn: 'Main Guy', playerId: 10, kind: 'member' }),
  ];
  assert.deepEqual(doubleEntries(seats)[0].seats.map((s) => s.rsn), ['Main Guy', 'Alt Guy']);
  assert.deepEqual(surplusSeats(seats), [2], 'the guest seat is the surplus one');
});

test('NEVER drops whichever character is winning', () => {
  // The tempting implementation is "keep their best score". That silently rewrites the standings —
  // "one entry per person" is a rule about entry, not a way to pick a winner. Two guest seats, and
  // the survivor is decided alphabetically rather than by anything to do with points.
  const seats = [
    seat({ participantId: 7, rsn: 'Zeta Alt', playerId: 10, kind: 'guest' }),
    seat({ participantId: 8, rsn: 'Alpha Alt', playerId: 10, kind: 'guest' }),
  ];
  assert.deepEqual(doubleEntries(seats)[0].seats.map((s) => s.rsn), ['Alpha Alt', 'Zeta Alt']);
  assert.deepEqual(surplusSeats(seats), [7]);
});

test('three characters leave two surplus, not one', () => {
  const seats = [
    seat({ participantId: 1, rsn: 'Main', playerId: 10, kind: 'member' }),
    seat({ participantId: 2, rsn: 'Alt One', playerId: 10, kind: 'guest' }),
    seat({ participantId: 3, rsn: 'Alt Two', playerId: 10, kind: 'guest' }),
  ];
  assert.deepEqual(surplusSeats(seats).sort(), [2, 3]);
});

test('unlinked seats are two unknowns, never one person', () => {
  // A seat created by typing an RSN into the add box has no account behind it until that character
  // is played with the plugin. Grouping nulls together would invent a person and then offer to
  // delete a real entrant on the strength of it.
  const seats = [
    seat({ participantId: 1, rsn: 'Typed One', playerId: null }),
    seat({ participantId: 2, rsn: 'Typed Two', playerId: null }),
    seat({ participantId: 3, rsn: 'Typed Three', playerId: null }),
  ];
  assert.deepEqual(doubleEntries(seats), []);
  assert.deepEqual(surplusSeats(seats), []);
});

test('several people entered twice are reported separately', () => {
  const seats = [
    seat({ participantId: 1, rsn: 'A Main', playerId: 10, kind: 'member' }),
    seat({ participantId: 2, rsn: 'A Alt', playerId: 10, kind: 'guest' }),
    seat({ participantId: 3, rsn: 'B Main', playerId: 11, kind: 'member' }),
    seat({ participantId: 4, rsn: 'B Alt', playerId: 11, kind: 'guest' }),
  ];
  assert.equal(doubleEntries(seats).length, 2);
  assert.deepEqual(surplusSeats(seats).sort((x, y) => x - y), [2, 4]);
});

/* --- guests ---------------------------------------------------------------- */

test('entered guests and addable guests are different questions', () => {
  const seats = [
    seat({ participantId: 1, rsn: 'A Member', playerId: 10, kind: 'member' }),
    seat({ participantId: 2, rsn: 'In Guest', playerId: 11, kind: 'guest' }),
  ];
  const split = guestSplit(seats, [{ rsn: 'In Guest' }, { rsn: 'Out Guest' }], normalize);
  assert.deepEqual(split.entered.map((s) => s.rsn), ['In Guest']);
  assert.deepEqual(split.available.map((g) => g.rsn), ['Out Guest'], 'the one who joined after the fanout ran');
});

test('a guest already in is not offered again, however their name is spaced', () => {
  // RSNs collide on underscores and spacing; the caller passes the same normalizer the enrollment
  // unique index uses, so the two answers cannot disagree.
  const seats = [seat({ participantId: 2, rsn: 'In_Guest', playerId: 11, kind: 'guest' })];
  const split = guestSplit(seats, [{ rsn: 'in guest' }], normalize);
  assert.deepEqual(split.available, []);
});

test('a guest who left the clan is not counted as currently entered', () => {
  const seats = [seat({ participantId: 2, rsn: 'Gone', playerId: 11, kind: 'guest', left: true })];
  assert.deepEqual(guestSplit(seats, [], normalize).entered, []);
});
