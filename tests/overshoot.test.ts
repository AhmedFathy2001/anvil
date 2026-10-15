// A team KC/XP tile's split stops at its goal, and the kills past it come off whoever's update crossed
// the line — or, when nobody can say who was first (overlapping windows), off everyone tied, in
// proportion. Pure: no database.
//
// Run: npx tsx --test tests/overshoot.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { advanceLedger, settleOvershoot, tiedWith, type Ledger } from '../src/lib/overshoot.ts';
import { buildContributionSnapshot, parseContributionSnapshot } from '../src/lib/statTracking.ts';

const H = 3_600_000;
const START = 0;

/** Run the ledger over a sequence of checks and settle at the last one, the way statTileCredit does. */
function settleAfter(goal: number, checks: { playerId: number; gained: number; freshAt: number }[][]) {
  let ledger: Ledger = {};
  let risen: number[] = [];
  for (const obs of checks) ({ next: ledger, risen } = advanceLedger(ledger, obs, START));
  const tied = tiedWith(ledger, risen);
  const rows = Object.entries(ledger).map(([id, e]) => ({
    playerId: Number(id),
    gained: e.g,
    increase: e.g - e.base,
    tied: tied.has(Number(id)),
  }));
  return Object.fromEntries(settleOvershoot(goal, rows).map((r) => [r.playerId, r.gained]));
}

test('two people who logged out with 50 each on an 80 tile tie at 40 / 40, whoever the sweep fetched first', () => {
  const a = { playerId: 1, gained: 0, freshAt: 6 * H };
  const b = { playerId: 2, gained: 0, freshAt: 6 * H };
  const split = settleAfter(80, [
    [a, b], // 06:00 — both fetched, nothing yet
    [{ ...a, gained: 50, freshAt: 10 * H }, b], // 10:00 — A fetched: 50, team below goal
    [{ ...a, gained: 50, freshAt: 10 * H }, { ...b, gained: 50, freshAt: 10 * H + 5 * 60_000 }], // 10:05 — B: 100
  ]);
  assert.deepEqual(split, { 1: 40, 2: 40 });
});

test('someone whose gain was already counted before the crossing window keeps all of it', () => {
  const a = { playerId: 1, gained: 0, freshAt: 1 * H };
  const b = { playerId: 2, gained: 0, freshAt: 20 * H };
  const split = settleAfter(80, [
    [a, b],
    [{ ...a, gained: 50, freshAt: 2 * H }, b], // A's kills, yesterday
    [{ ...a, gained: 50, freshAt: 2 * H }, { ...b, gained: 50, freshAt: 26 * H }], // B played today
  ]);
  assert.deepEqual(split, { 1: 50, 2: 30 });
});

test('the plugin push that crosses the line takes the overshoot', () => {
  const t = 30 * H;
  const split = settleAfter(500, [
    [{ playerId: 1, gained: 300, freshAt: t }, { playerId: 2, gained: 190, freshAt: t }],
    [{ playerId: 1, gained: 300, freshAt: t }, { playerId: 2, gained: 207, freshAt: t + 15_000 }],
  ]);
  // 300 + 207 = 507: player 2's own push crossed, nobody else moved in that window.
  assert.deepEqual(split, { 1: 300, 2: 200 });
});

test('a first look past the goal (a heal) has no order to go on, so it scales everyone', () => {
  const split = settleAfter(500, [[
    { playerId: 1, gained: 300, freshAt: 5 * H },
    { playerId: 2, gained: 200, freshAt: 6 * H },
    { playerId: 3, gained: 17, freshAt: 7 * H },
  ]]);
  assert.equal(split[1] + split[2] + split[3], 500);
  assert.deepEqual(split, { 1: 290, 2: 193, 3: 17 });
});

test('an overshoot bigger than the tied increases comes off everyone else in proportion', () => {
  assert.deepEqual(
    settleOvershoot(100, [
      { playerId: 1, gained: 80, increase: 0, tied: false },
      { playerId: 2, gained: 40, increase: 5, tied: true },
    ]),
    // 20 over: player 2's 5 first, then 15 split 80 : 35 across what's left.
    [{ playerId: 1, gained: 70 }, { playerId: 2, gained: 30 }],
  );
});

test('a split frozen past its goal reads at the goal with the same shares', () => {
  const snap = parseContributionSnapshot(
    JSON.stringify({ goal: 500, total: 517, split: [{ playerId: 1, gained: 300 }, { playerId: 2, gained: 217 }] }),
  )!;
  assert.equal(snap.total, 500);
  assert.deepEqual(snap.split, [{ playerId: 1, gained: 290 }, { playerId: 2, gained: 210 }]);
  assert.equal(buildContributionSnapshot(500, [{ playerId: 1, gained: 520 }]).total, 500);
});
