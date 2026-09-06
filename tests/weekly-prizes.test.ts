// Coffer prizes for a Skill or Boss of the Week.
//
// Run: npm run test:weeklyprizes

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseWeeklyPrizes,
  serializeWeeklyPrizes,
  totalPrizeGp,
  winnersFor,
  NO_WEEKLY_PRIZES,
} from '../src/lib/weeklyPrizes.ts';

const board = (...rows: [string, number][]) =>
  rows.map(([rsn, gained], i) => ({ rsn, gained, clanMemberId: i + 1 }));

test('a competition with no ladder pays nobody', () => {
  assert.deepEqual(parseWeeklyPrizes(null), NO_WEEKLY_PRIZES);
  assert.deepEqual(parseWeeklyPrizes('not json'), NO_WEEKLY_PRIZES);
  assert.deepEqual(winnersFor(NO_WEEKLY_PRIZES, board(['a', 100])), []);
});

test('top one is a ladder of one — the smallest thing anyone will ask for', () => {
  const prizes = parseWeeklyPrizes(JSON.stringify({ places: [{ gp: 5_000_000 }] }));
  const won = winnersFor(prizes, board(['first', 90], ['second', 80]));
  assert.equal(won.length, 1);
  assert.deepEqual([won[0].place, won[0].gp, won[0].rsn], [1, 5_000_000, 'first']);
});

test('places pay in board order', () => {
  const prizes = parseWeeklyPrizes(
    JSON.stringify({ places: [{ gp: 3 }, { gp: 2 }, { gp: 1 }] }),
  );
  const won = winnersFor(prizes, board(['a', 30], ['b', 20], ['c', 10]));
  assert.deepEqual(won.map((w) => [w.place, w.rsn, w.gp]), [
    [1, 'a', 3],
    [2, 'b', 2],
    [3, 'c', 1],
  ]);
});

test('a place nobody stands on is not won, and nobody is promoted into it', () => {
  // Three places, two entrants. Sliding the runner-up into third would be inventing a result.
  const prizes = parseWeeklyPrizes(JSON.stringify({ places: [{ gp: 3 }, { gp: 2 }, { gp: 1 }] }));
  const won = winnersFor(prizes, board(['a', 30], ['b', 20]));
  assert.equal(won.length, 2);
  assert.deepEqual(won.map((w) => w.place), [1, 2]);
});

test('turning up is not a placing', () => {
  // A quiet week: three entrants, two of them on zero. Paying gp for that is not what anybody
  // meant by "top three".
  const prizes = parseWeeklyPrizes(JSON.stringify({ places: [{ gp: 3 }, { gp: 2 }, { gp: 1 }] }));
  assert.deepEqual(winnersFor(prizes, board(['a', 30], ['b', 0], ['c', 0])).map((w) => w.rsn), ['a']);
});

test('...unless the clan says otherwise', () => {
  const prizes = parseWeeklyPrizes(
    JSON.stringify({ places: [{ gp: 3 }, { gp: 2 }], payZeroGain: true }),
  );
  assert.equal(winnersFor(prizes, board(['a', 30], ['b', 0])).length, 2);
});

test('trailing empty places are not places', () => {
  const prizes = parseWeeklyPrizes(JSON.stringify({ places: [{ gp: 1000 }, { gp: 0 }, { gp: 0 }] }));
  assert.equal(prizes.places.length, 1);
  assert.equal(totalPrizeGp(prizes), 1000);
});

test('a nonsense ladder does not stop the competition, it just pays nothing', () => {
  const prizes = parseWeeklyPrizes(JSON.stringify({ places: [{ gp: -5 }, { gp: 'lots' }] }));
  assert.deepEqual(prizes.places, []);
  assert.equal(serializeWeeklyPrizes(prizes), null);
});

test('a ladder survives a round trip', () => {
  const raw = serializeWeeklyPrizes({ places: [{ gp: 10 }, { gp: 5 }], payZeroGain: true, splitTies: true });
  assert.ok(raw);
  const back = parseWeeklyPrizes(raw);
  assert.deepEqual(back.places, [{ gp: 10 }, { gp: 5 }]);
  assert.equal(back.payZeroGain, true);
  assert.equal(back.splitTies, true);
});

// ── Ties ────────────────────────────────────────────────────────────────────────────────────────
//
// The case a per-place ladder cannot express on its own: people finishing DEAD LEVEL. Off, the
// board's order is paid unchanged. On, the tied set pools the places it occupies and splits it.

const splitLadder = (...gp: number[]) =>
  parseWeeklyPrizes(JSON.stringify({ places: gp.map((g) => ({ gp: g })), splitTies: true }));

test('with splitting off, a tie is paid in board order — the order everyone watched', () => {
  const prizes = parseWeeklyPrizes(JSON.stringify({ places: [{ gp: 100 }, { gp: 50 }] }));
  const won = winnersFor(prizes, board(['a', 40], ['b', 40]));
  assert.deepEqual(won.map((w) => [w.rsn, w.gp]), [
    ['a', 100],
    ['b', 50],
  ]);
});

test('two tied for first split first and second', () => {
  const won = winnersFor(splitLadder(100, 50), board(['a', 40], ['b', 40]));
  assert.deepEqual(won.map((w) => [w.rsn, w.gp, w.rank, w.sharedWith]), [
    ['a', 75, 1, 2],
    ['b', 75, 1, 2],
  ]);
});

test('a split pays every winner its own ledger slot, so the settle pass stays idempotent', () => {
  // The coffer keys a weekly award on (competition, place). Two winners on rank 1 must not collide.
  const won = winnersFor(splitLadder(100, 50), board(['a', 40], ['b', 40]));
  assert.deepEqual(
    won.map((w) => w.place),
    [1, 2],
  );
  assert.deepEqual(
    won.map((w) => w.rank),
    [1, 1],
  );
});

test('more tied people than places — they still split what those places were worth', () => {
  // Six level at the top of a three-place ladder. A per-place payout has nothing to say here.
  const won = winnersFor(splitLadder(90, 60, 30), board(...(['a', 'b', 'c', 'd', 'e', 'f'] as const).map((r) => [r, 7] as [string, number])));
  assert.equal(won.length, 6);
  assert.deepEqual(new Set(won.map((w) => w.gp)), new Set([30]));
  assert.deepEqual(won.map((w) => w.place), [1, 2, 3, 4, 5, 6]);
  assert.equal(won.reduce((sum, w) => sum + w.gp, 0), 180);
});

test('an uneven split adds up to the pool exactly, a gp at a time from the top', () => {
  const won = winnersFor(splitLadder(100), board(['a', 5], ['b', 5], ['c', 5]));
  assert.deepEqual(won.map((w) => w.gp), [34, 33, 33]);
  assert.equal(won.reduce((sum, w) => sum + w.gp, 0), 100);
});

test('a tie below the ladder is worth nothing, and does not reach up for it', () => {
  const won = winnersFor(splitLadder(100), board(['a', 50], ['b', 10], ['c', 10]));
  assert.deepEqual(won.map((w) => [w.rsn, w.gp]), [['a', 100]]);
});

test('an outright winner above a tie keeps their own place whole', () => {
  const won = winnersFor(splitLadder(100, 60, 20), board(['a', 90], ['b', 40], ['c', 40]));
  assert.deepEqual(won.map((w) => [w.rsn, w.gp, w.rank]), [
    ['a', 100, 1],
    ['b', 40, 2],
    ['c', 40, 2],
  ]);
});

test('a tie group straddling the end of the ladder splits only what it reaches', () => {
  // Two places, three people tied for second: they pool second (60) plus two positions worth
  // nothing, so 20 each rather than 30 each.
  const won = winnersFor(splitLadder(100, 60), board(['a', 90], ['b', 40], ['c', 40], ['d', 40]));
  assert.deepEqual(won.map((w) => [w.rsn, w.gp]), [
    ['a', 100],
    ['b', 20],
    ['c', 20],
    ['d', 20],
  ]);
});

test('a zero-gain finisher in a tie occupies the position without being paid for it', () => {
  // Nobody trained. Their share is dropped, NOT handed to the others — the alternative pays a
  // winner more for the company they kept.
  const won = winnersFor(splitLadder(100, 50), board(['a', 0], ['b', 0]));
  assert.deepEqual(won, []);
});

test('...unless the clan pays for turning up', () => {
  const prizes = parseWeeklyPrizes(
    JSON.stringify({ places: [{ gp: 100 }, { gp: 50 }], splitTies: true, payZeroGain: true }),
  );
  const won = winnersFor(prizes, board(['a', 0], ['b', 0]));
  assert.deepEqual(won.map((w) => w.gp), [75, 75]);
});

test('splitting changes nothing when nobody ties', () => {
  const plain = parseWeeklyPrizes(JSON.stringify({ places: [{ gp: 3 }, { gp: 2 }, { gp: 1 }] }));
  const rows = board(['a', 30], ['b', 20], ['c', 10]);
  assert.deepEqual(
    winnersFor(splitLadder(3, 2, 1), rows).map((w) => [w.place, w.rsn, w.gp]),
    winnersFor(plain, rows).map((w) => [w.place, w.rsn, w.gp]),
  );
});
