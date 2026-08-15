// When a paid fee settles, and who may settle it (lib/feeRules).
//
// Run: node --experimental-strip-types --test tests/fee-rules.test.ts
// (lib/feeRules imports nothing from `@/`, so Node's native TS type-stripping runs it directly.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  clampRequiredConfirmations,
  decideConfirmation,
  settlesOnCollect,
  type FeeState,
} from '../src/lib/feeRules.ts';

const NOW = '2026-08-15T12:00:00.000Z';
const OWNER = 2;
const OTHER_ADMIN = 7;

const collected = (over: Partial<FeeState> = {}): FeeState => ({
  status: 'collected',
  collectedByUserId: OWNER,
  confirmations: [],
  ...over,
});

/* ── the setting ────────────────────────────────────────────────────────── */

test('an unset or blank setting keeps the safe default', () => {
  for (const raw of [null, undefined, '', '   ']) {
    assert.equal(clampRequiredConfirmations(raw), 1, `expected default for ${JSON.stringify(raw)}`);
  }
});

test('a typo falls back to the default rather than switching the control off', () => {
  // "off" must be said deliberately with a 0, never reached by fat-fingering the field.
  for (const raw of ['abc', 'two', '!!']) {
    assert.equal(clampRequiredConfirmations(raw), 1);
  }
});

test('zero is a real answer and survives the clamp', () => {
  assert.equal(clampRequiredConfirmations('0'), 0);
  assert.equal(settlesOnCollect(0), true);
  assert.equal(settlesOnCollect(1), false);
});

test('the count is clamped to a sane ceiling and never negative', () => {
  assert.equal(clampRequiredConfirmations('3'), 3);
  assert.equal(clampRequiredConfirmations('99'), 5);
  assert.equal(clampRequiredConfirmations('-4'), 0);
});

/* ── separation of duties, when it applies ──────────────────────────────── */

test('by default the collector cannot sign off on their own collection', () => {
  const d = decideConfirmation(collected(), OWNER, 1, NOW);
  assert.equal(d.outcome, 'own-collection');
  assert.equal(d.settled, false);
});

test('a different admin settles it at the default of one', () => {
  const d = decideConfirmation(collected(), OTHER_ADMIN, 1, NOW);
  assert.equal(d.outcome, 'confirmed');
  assert.equal(d.settled, true);
  assert.deepEqual(d.confirmations, [{ userId: OTHER_ADMIN, at: NOW }]);
});

test('with none required, the collector settles their own — the whole point', () => {
  // The reported problem: the owner takes the fee in-game, marks it paid, and there is no second
  // person in the clan to confirm it, so it sits at "waiting on a second signature" forever.
  const d = decideConfirmation(collected(), OWNER, 0, NOW);
  assert.equal(d.outcome, 'confirmed');
  assert.equal(d.settled, true);
});

test('with none required, no confirmation vote is recorded at all', () => {
  // There was no second step, so inventing a vote would put a name against a decision nobody made.
  const d = decideConfirmation(collected(), OWNER, 0, NOW);
  assert.deepEqual(d.confirmations, []);
});

test('two required means one vote is not enough', () => {
  const first = decideConfirmation(collected(), OTHER_ADMIN, 2, NOW);
  assert.equal(first.outcome, 'recorded');
  assert.equal(first.settled, false);

  const second = decideConfirmation(
    collected({ confirmations: first.confirmations }),
    9,
    2,
    NOW,
  );
  assert.equal(second.outcome, 'confirmed');
  assert.equal(second.confirmations.length, 2);
});

test('the same admin cannot vote twice to reach the threshold alone', () => {
  const first = decideConfirmation(collected(), OTHER_ADMIN, 2, NOW);
  const again = decideConfirmation(collected({ confirmations: first.confirmations }), OTHER_ADMIN, 2, NOW);
  assert.equal(again.outcome, 'noop');
  assert.equal(again.settled, false);
});

/* ── states that cannot be confirmed ────────────────────────────────────── */

test('a fee nobody has collected cannot be signed off, whatever the setting', () => {
  for (const required of [0, 1, 3]) {
    const d = decideConfirmation(
      collected({ status: 'pending', collectedByUserId: null }),
      OWNER,
      required,
      NOW,
    );
    assert.equal(d.outcome, 'not-collected', `required=${required}`);
    assert.equal(d.settled, false);
  }
});

test('an already settled fee is a no-op', () => {
  const d = decideConfirmation(collected({ status: 'confirmed' }), OTHER_ADMIN, 1, NOW);
  assert.equal(d.outcome, 'noop');
  assert.equal(d.settled, false);
});

test('a disputed fee can still be settled by someone who did not collect it', () => {
  // A dispute is about WHO took the money, and resolving it is exactly an admin decision.
  const d = decideConfirmation(collected({ status: 'disputed' }), OTHER_ADMIN, 1, NOW);
  assert.equal(d.outcome, 'confirmed');
});

/* ── the auto path ──────────────────────────────────────────────────────── */

test('the end-of-event auto-close settles without a human and records no vote', () => {
  const d = decideConfirmation(collected(), 0, 2, NOW, { auto: true });
  assert.equal(d.outcome, 'confirmed');
  assert.equal(d.settled, true);
  assert.deepEqual(d.confirmations, []);
});

test('auto-close still refuses money nobody collected', () => {
  const d = decideConfirmation(collected({ collectedByUserId: null }), 0, 1, NOW, { auto: true });
  assert.equal(d.outcome, 'not-collected');
});

/* ── the proof screenshot ───────────────────────────────────────────────── */

test('proof is dropped once a reviewer has used it', () => {
  assert.equal(decideConfirmation(collected(), OTHER_ADMIN, 1, NOW).dropProof, true);
});

test('proof is kept when nobody ever reviewed it', () => {
  // At 0 required the fee settles the instant it is marked paid. Deleting the screenshot seconds
  // after upload would throw away the only record that the money moved.
  assert.equal(decideConfirmation(collected(), OWNER, 0, NOW).dropProof, false);
});

test('proof survives a vote that did not settle the fee', () => {
  assert.equal(decideConfirmation(collected(), OTHER_ADMIN, 2, NOW).dropProof, false);
});
