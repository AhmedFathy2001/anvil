// Count-tile progress (lib/countProgress) — the Team Total vs Solo rule that decides how far a team
// is on a submission-backed tile (kill / PvP / gain / diary / CA / drop pool).
//
// Run: npx tsx --test tests/count-progress.test.ts
// (tsx, not node --experimental-strip-types: countProgress imports the '@/' path alias.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { countProgress, itemAlreadyCounted, memberProgress, submissionCreditKey } from '../src/lib/countProgress.ts';

const sub = (playerId: number | null, amount: number, creditPlayerId: number | null = null) => ({
  playerId,
  creditPlayerId,
  amount,
});

test('team mode sums every member — the historical behaviour', () => {
  const subs = [sub(1, 4), sub(2, 3), sub(3, 3)];
  const p = countProgress(subs, 'team');
  assert.equal(p.current, 10);
  assert.equal(p.teamTotal, 10);
  assert.equal(p.finisherPlayerId, null);
});

test('no tracking mode set (legacy rows / kinds without the toggle) reads as team', () => {
  const subs = [sub(1, 4), sub(2, 6)];
  assert.equal(countProgress(subs, null).current, 10);
  assert.equal(countProgress(subs, undefined).current, 10);
});

test('solo mode takes the best single member, not the team sum', () => {
  // The bug this fixes: 4 + 3 + 3 used to read 10/10 on a Solo tile needing 10.
  const subs = [sub(1, 4), sub(2, 3), sub(3, 3)];
  const p = countProgress(subs, 'individual');
  assert.equal(p.current, 4);
  assert.equal(p.finisherPlayerId, 1);
  assert.equal(p.teamTotal, 10, 'team sum still reported — the grandfather guard reads it');
});

test("'solo' is the legacy spelling of 'individual' and behaves identically", () => {
  const subs = [sub(1, 4), sub(2, 3)];
  assert.deepEqual(countProgress(subs, 'solo'), countProgress(subs, 'individual'));
});

test('solo mode accumulates a member across many submissions', () => {
  const subs = [sub(1, 3), sub(2, 5), sub(1, 4), sub(1, 3)];
  const p = countProgress(subs, 'individual');
  assert.equal(p.current, 10, "member 1's three submissions add up");
  assert.equal(p.finisherPlayerId, 1);
});

test('credit follows creditPlayerId — a captain uploading for someone else', () => {
  // Captain (player 9) uploads three kills on behalf of player 2.
  const subs = [sub(9, 3, 2), sub(9, 3, 2), sub(9, 4, 2)];
  const p = countProgress(subs, 'individual');
  assert.equal(p.current, 10);
  assert.equal(p.finisherPlayerId, 2, 'the member who did the work, not the uploader');
  assert.equal(submissionCreditKey(sub(9, 3, 2)), 2);
});

test('unattributed uploads share one bucket so a manually-credited solo tile can finish', () => {
  const subs = [sub(null, 6), sub(null, 4)];
  const p = countProgress(subs, 'individual');
  assert.equal(p.current, 10);
  assert.equal(p.finisherPlayerId, null, 'nobody to name as finisher');
});

test('an unattributed pile never masquerades as a member', () => {
  const subs = [sub(null, 9), sub(1, 2)];
  assert.equal(countProgress(subs, 'individual').current, 9);
  assert.equal(memberProgress(subs, 1), 2, "member 1 doesn't inherit the unattributed pile");
});

test('memberProgress reads one member for the over-submission guards', () => {
  const subs = [sub(1, 4), sub(2, 3), sub(9, 2, 1)];
  assert.equal(memberProgress(subs, 1), 6, 'own submissions + those credited to them');
  assert.equal(memberProgress(subs, 2), 3);
  assert.equal(memberProgress(subs, 3), 0);
  assert.equal(memberProgress(subs, 9), 0, 'the uploader kept none of it');
});

test('empty tile is zero in both modes', () => {
  assert.deepEqual(countProgress([], 'team'), { current: 0, teamTotal: 0, finisherPlayerId: null });
  assert.deepEqual(countProgress([], 'individual'), { current: 0, teamTotal: 0, finisherPlayerId: null });
});

const drop = (playerId: number, itemId: number, amount = 1) => ({ playerId, creditPlayerId: null, amount, itemId });

test("distinct pool: each item counts once for the team, whatever the stack or who got it", () => {
  const subs = [drop(1, 100, 3), drop(2, 100), drop(2, 200)];
  assert.equal(countProgress(subs, 'team').current, 5, 'total mode: repeats count');
  assert.equal(countProgress(subs, 'team', 'distinct').current, 2, 'distinct: two different items');
});

test('distinct pool: an upload with no item counts for nothing — it cannot prove it is different', () => {
  const subs = [drop(1, 100), { playerId: 1, creditPlayerId: null, amount: 1, itemId: null }, { playerId: 2, creditPlayerId: null, amount: 1 }];
  assert.equal(countProgress(subs, 'team', 'distinct').current, 1);
});

test('distinct pool on a Solo tile: a teammate already having the item does not stop yours', () => {
  const subs = [drop(1, 100), drop(1, 100), drop(2, 100), drop(2, 200)];
  const p = countProgress(subs, 'individual', 'distinct');
  assert.equal(p.current, 2);
  assert.equal(p.finisherPlayerId, 2);
  assert.equal(memberProgress(subs, 1, 'distinct'), 1);
  assert.equal(itemAlreadyCounted(subs, 100, 'individual', 2), true);
  assert.equal(itemAlreadyCounted(subs, 200, 'individual', 1), false);
  assert.equal(itemAlreadyCounted(subs, 200, 'team', 1), true);
});
