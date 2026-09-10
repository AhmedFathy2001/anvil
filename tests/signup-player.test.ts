// A sign-up and the player row it became are two records of two different things.
//
// The sign-up is made on a SEAT and never moves — it records who applied and what they said. The
// player row is what the board follows, and an admin can re-point it at another of that person's
// characters when an RSN gets banned or they carry on on an alt.
//
// The Sign-ups tab matched them on the seat alone. So the moment a character was swapped, a drafted
// player's sign-up matched nothing: the team chip vanished and the row fell back to the dashed
// "wants LFL", reading as though they were still in the pool. Reported from production, on exactly
// that flow — "I replaced kAnal 5 with his other account from the draft, now it shows wants LFL".
//
// Run: node --experimental-strip-types --test tests/signup-player.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolvePlayers, type PlayerRow } from '../src/lib/signupPlayer.ts';

const row = (seatId: number | null, personId: number | null, value: string): PlayerRow<string> => ({
  seatId,
  personId,
  value,
});

test('the ordinary board resolves on the seat, exactly as it always did', () => {
  const r = resolvePlayers([row(10, 100, 'Red'), row(11, 101, 'Blue')]);
  assert.equal(r.forSignup({ seatId: 10, personId: 100 }), 'Red');
  assert.equal(r.forSignup({ seatId: 11, personId: 101 }), 'Blue');
});

test('THE BUG — a swapped character still finds the sign-up, by person', () => {
  // The board now follows seat 12 (their alt). The sign-up was made on seat 10 (their main). Same
  // human, so the sign-up must still show the team they were drafted onto.
  const r = resolvePlayers([row(12, 100, 'Red')]);
  assert.equal(
    r.forSignup({ seatId: 10, personId: 100 }),
    'Red',
    'the seat moved; the person did not, and the person is who is playing',
  );
});

test('somebody genuinely not on the board is still not on it', () => {
  const r = resolvePlayers([row(10, 100, 'Red')]);
  assert.equal(r.forSignup({ seatId: 99, personId: 999 }), null);
});

test('a sign-up with no person behind it falls back to nothing, not to somebody else', () => {
  // A guest sign-up made by name has no linked account until that character is played. Matching it
  // to a player row by anything other than its own seat would be inventing a person.
  const r = resolvePlayers([row(12, 100, 'Red')]);
  assert.equal(r.forSignup({ seatId: 10, personId: null }), null);
});

test('two unlinked player rows are two unknowns, never one person', () => {
  const r = resolvePlayers([row(10, null, 'Red'), row(11, null, 'Blue')]);
  assert.equal(r.forSignup({ seatId: 10, personId: null }), 'Red');
  assert.equal(r.forSignup({ seatId: 11, personId: null }), 'Blue');
  assert.equal(r.forSignup({ seatId: 12, personId: null }), null, 'no third row to borrow');
});

test('the SEAT wins over the person when the two disagree', () => {
  // One human with two characters, both genuinely on the board — which the account index is meant
  // to prevent, but if it happens the exact seat is the better answer than "one of theirs".
  const r = resolvePlayers([row(10, 100, 'Red'), row(12, 100, 'Blue')]);
  assert.equal(r.forSignup({ seatId: 12, personId: 100 }), 'Blue', 'their own seat, not the first one found');
  assert.equal(r.forSignup({ seatId: 10, personId: 100 }), 'Red');
});

test('a duplicated person resolves the same way on every page load', () => {
  // If a duplicate does exist, the FIRST is kept — so a sign-up cannot appear to change teams
  // between refreshes just because the rows came back in a different order.
  const r = resolvePlayers([row(10, 100, 'Red'), row(12, 100, 'Blue')]);
  assert.equal(r.forSignup({ seatId: 77, personId: 100 }), 'Red');
});

test('a player row whose seat has gone is still reachable by person', () => {
  // `clan_member_id` is ON DELETE SET NULL — a participant outlives the seat it came from.
  const r = resolvePlayers([row(null, 100, 'Red')]);
  assert.equal(r.forSignup({ seatId: 10, personId: 100 }), 'Red');
});

test('an empty board matches nobody', () => {
  const r = resolvePlayers<string>([]);
  assert.equal(r.forSignup({ seatId: 10, personId: 100 }), null);
});
