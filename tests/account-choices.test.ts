// A seat is not a character.
//
// `clan_roster` is (account × clan), and the "tracked account" dropdown listed seats. So somebody
// who plays three characters and belongs to three clans saw their main three times and their alt
// twice, one of each pair marked "current", with nothing on screen to say why there were several.
// The real screenshot that found it read:
//
//   Drenvox mdps — current / Denoverse / Denoverse / Drenvox mdps / Drenvox mdps / GIM Drenvox
//
// The count per name was exactly the number of clans that character is in — a fact about clan
// membership, with nothing to say about which character a board should follow.
//
// Run: node --experimental-strip-types --test tests/account-choices.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { accountChoices, type Seat } from '../src/lib/accountChoices.ts';

const HOST = 1;
const LFL = 2;
const THIRD = 3;

const seat = (over: Partial<Seat> & { id: number; rsn: string; accountId: number | null }): Seat => ({
  clanId: HOST,
  status: 'active',
  ...over,
});

test('THE SCREENSHOT — one row per character, not one per clan they are in', () => {
  // Main in three clans, alt in two, a GIM in one. Six seats, three characters.
  const main = 100, alt = 101, gim = 102;
  const seats = [
    seat({ id: 1, rsn: 'Drenvox mdps', accountId: main, clanId: HOST }),
    seat({ id: 2, rsn: 'Drenvox mdps', accountId: main, clanId: LFL }),
    seat({ id: 3, rsn: 'Drenvox mdps', accountId: main, clanId: THIRD }),
    seat({ id: 4, rsn: 'Denoverse', accountId: alt, clanId: HOST }),
    seat({ id: 5, rsn: 'Denoverse', accountId: alt, clanId: LFL }),
    seat({ id: 6, rsn: 'GIM Drenvox', accountId: gim, clanId: HOST }),
  ];
  const out = accountChoices(seats, { currentSeatId: 1, eventClanId: HOST });
  assert.deepEqual(out.map((a) => a.rsn), ['Drenvox mdps', 'Denoverse', 'GIM Drenvox']);
  assert.equal(out.length, 3, 'three characters, however many clans each is seated in');
});

test('the character being tracked is first, and is the only one marked current', () => {
  const seats = [
    seat({ id: 1, rsn: 'Zebra', accountId: 100 }),
    seat({ id: 2, rsn: 'Aardvark', accountId: 101 }),
  ];
  const out = accountChoices(seats, { currentSeatId: 1, eventClanId: HOST });
  assert.equal(out[0].rsn, 'Zebra');
  assert.deepEqual(out.map((a) => a.isCurrent), [true, false]);
});

test('the rest are alphabetical, so the list does not reshuffle between opens', () => {
  const seats = [
    seat({ id: 1, rsn: 'Current One', accountId: 100 }),
    seat({ id: 2, rsn: 'Zed', accountId: 101 }),
    seat({ id: 3, rsn: 'Alpha', accountId: 102 }),
    seat({ id: 4, rsn: 'Mid', accountId: 103 }),
  ];
  const out = accountChoices(seats, { currentSeatId: 1, eventClanId: HOST });
  assert.deepEqual(out.map((a) => a.rsn), ['Current One', 'Alpha', 'Mid', 'Zed']);
});

test('THE SEAT THAT SURVIVES the fold is the one already in use', () => {
  // Not cosmetic: the returned id is what the swap writes to clan_member_id. Folding onto a
  // different clan's seat for the character somebody is ALREADY tracked as would quietly re-seat
  // the participant into another clan while looking like it changed nothing.
  const seats = [
    seat({ id: 9, rsn: 'Main', accountId: 100, clanId: LFL }),
    seat({ id: 4, rsn: 'Main', accountId: 100, clanId: HOST }),
  ];
  const out = accountChoices(seats, { currentSeatId: 9, eventClanId: HOST });
  assert.equal(out.length, 1);
  assert.equal(out[0].clanMemberId, 9, 'the seat in use wins even though the other is the host clan');
  assert.equal(out[0].isCurrent, true);
});

test('failing that, the host clan’s own seat represents the character', () => {
  const seats = [
    seat({ id: 9, rsn: 'Alt', accountId: 101, clanId: LFL }),
    seat({ id: 4, rsn: 'Alt', accountId: 101, clanId: HOST }),
  ];
  // Tracking a different character entirely, so neither of these is "current".
  const out = accountChoices(seats, { currentSeatId: 1, eventClanId: HOST });
  assert.equal(out.length, 1);
  assert.equal(out[0].clanMemberId, 4, 'the board’s own clan is where a swap should land');
});

test('two seats in neither the host clan nor in use still fold to one', () => {
  const seats = [
    seat({ id: 8, rsn: 'Alt', accountId: 101, clanId: LFL }),
    seat({ id: 9, rsn: 'Alt', accountId: 101, clanId: THIRD }),
  ];
  const out = accountChoices(seats, { currentSeatId: 1, eventClanId: HOST });
  assert.equal(out.length, 1);
  assert.equal(out[0].clanMemberId, 8, 'first seen, deterministically');
});

test('a seat with no account behind it is kept, and never folded with another', () => {
  // Nothing to fold on. Dropping these would leave a ghost participant with no option at all —
  // which is exactly the row an admin most needs to repoint.
  const seats = [
    seat({ id: 1, rsn: 'Ghost One', accountId: null }),
    seat({ id: 2, rsn: 'Ghost Two', accountId: null }),
    seat({ id: 3, rsn: 'Real', accountId: 100 }),
  ];
  const out = accountChoices(seats, { currentSeatId: 3, eventClanId: HOST });
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((a) => a.rsn), ['Real', 'Ghost One', 'Ghost Two']);
});

test('one seat is the ordinary case and passes straight through', () => {
  const seats = [seat({ id: 1, rsn: 'Only', accountId: 100 })];
  const out = accountChoices(seats, { currentSeatId: 1, eventClanId: HOST });
  assert.deepEqual(out, [{ clanMemberId: 1, rsn: 'Only', status: 'active', isCurrent: true }]);
});

test('no seats is an empty list, not a crash', () => {
  assert.deepEqual(accountChoices([], { currentSeatId: null, eventClanId: HOST }), []);
});

test('a participant tracking nothing yet still gets the full choice', () => {
  const seats = [
    seat({ id: 1, rsn: 'Main', accountId: 100 }),
    seat({ id: 2, rsn: 'Main', accountId: 100, clanId: LFL }),
  ];
  const out = accountChoices(seats, { currentSeatId: null, eventClanId: HOST });
  assert.equal(out.length, 1);
  assert.equal(out[0].isCurrent, false);
});
