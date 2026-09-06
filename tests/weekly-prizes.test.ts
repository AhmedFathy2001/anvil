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
  const raw = serializeWeeklyPrizes({ places: [{ gp: 10 }, { gp: 5 }], payZeroGain: true });
  assert.ok(raw);
  const back = parseWeeklyPrizes(raw);
  assert.deepEqual(back.places, [{ gp: 10 }, { gp: 5 }]);
  assert.equal(back.payZeroGain, true);
});
