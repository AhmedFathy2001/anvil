// Starting shot (lib/startProof) — keyword derivation + matching, the location draw, the submission
// gate, and the auto-accept rule.
//
// Run: npx tsx --test tests/start-proof.test.ts
// (tsx, not native type-stripping: lib/startProof reads the keyword secret through lib/env's `@/` path.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  START_LOCATIONS,
  KEYWORD_WORDS,
  startKeyword,
  normalizeKeyword,
  keywordMatches,
  drawStartLocation,
  startProofGate,
  startProofState,
  autoAcceptDecision,
} from '../src/lib/startProof.ts';
import type { StartProofConfig } from '../src/lib/eventRules.ts';

const CFG: StartProofConfig = { onMissing: 'flag', autoAcceptPlugin: true, locations: [] };
const DRAWN = '2026-08-16T18:00:00.000Z';

test('startKeyword: deterministic, and shaped WORD-WORD-NN', () => {
  const a = startKeyword(7, 42, DRAWN);
  assert.equal(a, startKeyword(7, 42, DRAWN));
  const parts = a.split('-');
  assert.equal(parts.length, 3);
  assert.ok(KEYWORD_WORDS.includes(parts[0]));
  assert.ok(KEYWORD_WORDS.includes(parts[1]));
  // Never the same word twice — "RUNE-RUNE-12" reads like a bug and invites a typo.
  assert.notEqual(parts[0], parts[1]);
  assert.match(parts[2], /^\d{2}$/);
});

test('startKeyword: every input axis changes the answer', () => {
  const base = startKeyword(7, 42, DRAWN);
  assert.notEqual(base, startKeyword(8, 42, DRAWN));
  assert.notEqual(base, startKeyword(7, 43, DRAWN));
  // The draw stamp is the whole security story: no stamp existed before start, so no keyword did.
  assert.notEqual(base, startKeyword(7, 42, '2026-08-16T18:00:01.000Z'));
});

test('startKeyword: distinct across a roster (no collapse onto a few words)', () => {
  const seen = new Set(Array.from({ length: 200 }, (_, i) => startKeyword(1, i + 1, DRAWN)));
  assert.ok(seen.size > 190, `expected near-unique keywords, got ${seen.size}/200`);
});

test('normalizeKeyword / keywordMatches: retyped by hand off a screenshot', () => {
  const expected = 'ANVIL-GRAPE-07';
  assert.ok(keywordMatches('anvil-grape-07', expected));
  assert.ok(keywordMatches('ANVIL GRAPE 07', expected));
  assert.ok(keywordMatches('anvilgrape07', expected));
  assert.ok(keywordMatches('  ANVIL-GRAPE-07  ', expected));
  assert.ok(!keywordMatches('ANVIL-GRAPE-08', expected));
  // An empty/absent claim is never a match — a web upload with no keyword must stay pending.
  assert.ok(!keywordMatches('', expected));
  assert.ok(!keywordMatches(null, expected));
  assert.ok(!keywordMatches(undefined, expected));
  assert.equal(normalizeKeyword('An-vil 07'), 'ANVIL07');
});

test('drawStartLocation: host pool wins, built-ins are the fallback', () => {
  const pool = ['Behind the Lumbridge cow pen', 'On the Draynor jail roof'];
  assert.equal(drawStartLocation(pool, () => 1), pool[1]);
  assert.equal(drawStartLocation([], () => 0), START_LOCATIONS[0]);
  assert.equal(drawStartLocation(null, () => 3), START_LOCATIONS[3]);
  // Real draws stay inside the pool.
  for (let i = 0; i < 50; i++) {
    assert.ok(START_LOCATIONS.includes(drawStartLocation(undefined)));
  }
});

test('startProofGate: nothing to prove when it is not required or not drawn', () => {
  const drawn = { startProofLocation: 'Varrock fountain', startProofDrawnAt: DRAWN };
  assert.equal(startProofGate(null, drawn, null), 'ok');
  assert.equal(startProofGate(CFG, { startProofLocation: null, startProofDrawnAt: null }, null), 'ok');
});

test('startProofGate: a shot on file passes, even while it waits for review', () => {
  const drawn = { startProofLocation: 'Varrock fountain', startProofDrawnAt: DRAWN };
  assert.equal(startProofGate(CFG, drawn, { status: 'pending' }), 'ok');
  assert.equal(startProofGate(CFG, drawn, { status: 'accepted' }), 'ok');
  // Rejected is the same as never having filed one — they were told to re-take it.
  assert.equal(startProofGate(CFG, drawn, { status: 'rejected' }), 'flag');
});

test('startProofGate: the host picks how hard the belt is', () => {
  const drawn = { startProofLocation: 'Varrock fountain', startProofDrawnAt: DRAWN };
  assert.equal(startProofGate(CFG, drawn, null), 'flag');
  assert.equal(startProofGate({ ...CFG, onMissing: 'reject' }, drawn, null), 'reject');
});

test('autoAcceptDecision: only an authenticated plugin capture with a verified keyword', () => {
  assert.equal(autoAcceptDecision(CFG, 'plugin', true), 'accepted');
  // A hand-typed match proves the player read the site, not that the screenshot shows the word.
  assert.equal(autoAcceptDecision(CFG, 'web', true), 'pending');
  assert.equal(autoAcceptDecision(CFG, 'plugin', false), 'pending');
  assert.equal(autoAcceptDecision({ ...CFG, autoAcceptPlugin: false }, 'plugin', true), 'pending');
  assert.equal(autoAcceptDecision(null, 'plugin', true), 'pending');
});

test('startProofState: nothing leaks before the draw', () => {
  const before = startProofState({
    cfg: CFG,
    event: { id: 3, startProofLocation: null, startProofDrawnAt: null },
    playerId: 9,
  });
  assert.deepEqual(before, {
    required: true,
    drawn: false,
    location: null,
    keyword: null,
    needsUpload: false,
    status: null,
    imageUrl: null,
  });
});

test('startProofState: after the draw, the player owes a shot until one is on file', () => {
  const event = { id: 3, startProofLocation: 'Edgeville bank', startProofDrawnAt: DRAWN };
  const owed = startProofState({ cfg: CFG, event, playerId: 9 });
  assert.equal(owed.drawn, true);
  assert.equal(owed.location, 'Edgeville bank');
  assert.equal(owed.keyword, startKeyword(3, 9, DRAWN));
  assert.equal(owed.needsUpload, true);

  const filed = startProofState({
    cfg: CFG,
    event,
    playerId: 9,
    proof: { status: 'pending', imageUrl: 'https://media.example/shot.webp' },
  });
  assert.equal(filed.needsUpload, false);
  assert.equal(filed.status, 'pending');
  assert.equal(filed.imageUrl, 'https://media.example/shot.webp');

  // Rejected sends them back to the start of the queue.
  assert.equal(startProofState({ cfg: CFG, event, playerId: 9, proof: { status: 'rejected' } }).needsUpload, true);
});

test('startProofState: an event without the rule asks for nothing', () => {
  const state = startProofState({
    cfg: null,
    event: { id: 3, startProofLocation: null, startProofDrawnAt: null },
    playerId: 9,
  });
  assert.equal(state.required, false);
  assert.equal(state.needsUpload, false);
  assert.equal(state.keyword, null);
});
