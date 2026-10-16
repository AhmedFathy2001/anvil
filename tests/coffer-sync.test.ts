import assert from 'node:assert/strict';
import test from 'node:test';

import { decideCofferSync } from '../src/lib/cofferSyncDecision.ts';

test('the first snapshot is a baseline, never a donation', () => {
  assert.deepEqual(
    decideCofferSync(null, {
      kind: 'snapshot', beforeBalance: 12_000_000, afterBalance: 12_000_000, actorConfirmed: false,
    }),
    { outcome: 'baseline', ledgerAmount: 0, attributeActor: false, nextBalance: 12_000_000 },
  );
});

test('a continuous confirmed deposit is credited to its actor', () => {
  assert.deepEqual(
    decideCofferSync(12_000_000, {
      kind: 'deposit', beforeBalance: 12_000_000, afterBalance: 17_000_000, actorConfirmed: true,
    }),
    { outcome: 'movement', ledgerAmount: 5_000_000, attributeActor: true, nextBalance: 17_000_000 },
  );
});

test('another observer reporting the same final balance is a no-op', () => {
  assert.deepEqual(
    decideCofferSync(17_000_000, {
      kind: 'deposit', beforeBalance: 12_000_000, afterBalance: 17_000_000, actorConfirmed: true,
    }),
    { outcome: 'duplicate', ledgerAmount: 0, attributeActor: false, nextBalance: 17_000_000 },
  );
});

test('a gap reconciles only the difference from server truth and never names the observer', () => {
  assert.deepEqual(
    decideCofferSync(10_000_000, {
      kind: 'withdrawal', beforeBalance: 8_000_000, afterBalance: 5_000_000, actorConfirmed: true,
    }),
    { outcome: 'reconciled', ledgerAmount: -5_000_000, attributeActor: false, nextBalance: 5_000_000 },
  );
});

test('a mismatched chat direction cannot attribute the movement', () => {
  const decision = decideCofferSync(10, {
    kind: 'deposit', beforeBalance: 10, afterBalance: 5, actorConfirmed: true,
  });
  assert.equal(decision.outcome, 'movement');
  assert.equal(decision.ledgerAmount, -5);
  assert.equal(decision.attributeActor, false);
});


import { confirmReading } from '../src/lib/cofferSyncDecision.ts';

test('confirming a lone reading books exactly its own movement, actor kept', () => {
  assert.deepEqual(
    confirmReading(12_000_000, 17_000_000, { kind: 'donation', amount: 5_000_000, attributed: true }, 0),
    { amount: 5_000_000, kind: 'donation', keepAttribution: true },
  );
});

test('a forged reading cannot poison the next real one', () => {
  // Trusted 10m. A forger posts 10m -> 2,010m (pending). The real client then sees 12m and its
  // reading reconciles against the forged balance: -1,998m. Confirming it must book +2m from the
  // trusted 10m, as an unattributed adjustment, not -1,998m.
  assert.deepEqual(
    confirmReading(10_000_000, 12_000_000, { kind: 'adjustment', amount: -1_998_000_000, attributed: false }, 1),
    { amount: 2_000_000, kind: 'adjustment', keepAttribution: false },
  );
});

test('folding in another unconfirmed reading drops the actor', () => {
  assert.deepEqual(
    confirmReading(10_000_000, 15_000_000, { kind: 'donation', amount: 3_000_000, attributed: true }, 1),
    { amount: 5_000_000, kind: 'adjustment', keepAttribution: false },
  );
});
