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
  DEFAULT_START_RADIUS,
  startKeyword,
  normalizeKeyword,
  keywordMatches,
  drawStartLocation,
  drawnSpot,
  startDistance,
  sessionAgeMinutes,
  evaluateStartProof,
  startProofGate,
  startProofState,
  autoAcceptDecision,
} from '../src/lib/startProof.ts';
import type { StartProofConfig, StartLocation } from '../src/lib/eventRules.ts';

const CFG: StartProofConfig = { onMissing: 'flag', autoAcceptPlugin: true, locations: [], maxSessionMinutes: 0 };
const DRAWN = '2026-08-16T18:00:00.000Z';
// An hour into the event: inside the six-hour window where a starting shot is still asked for.
const DURING = Date.parse('2026-08-16T19:00:00.000Z');
// Seven hours in: the game has force-logged everyone by now, so there is no stack left to hide.
const AFTER = Date.parse('2026-08-17T01:00:00.000Z');

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
  const pool: StartLocation[] = [
    { label: 'Behind the Lumbridge cow pen', x: null, y: null, radius: null },
    { label: 'On the Draynor jail roof', x: 3120, y: 3245, radius: 10 },
  ];
  assert.deepEqual(drawStartLocation(pool, () => 1), pool[1]);
  assert.deepEqual(drawStartLocation([], () => 0), START_LOCATIONS[0]);
  assert.deepEqual(drawStartLocation(null, () => 3), START_LOCATIONS[3]);
  // Real draws stay inside the pool.
  for (let i = 0; i < 50; i++) {
    assert.ok(START_LOCATIONS.includes(drawStartLocation(undefined)));
  }
});

test('START_LOCATIONS: every built-in spot is pinned, and pinned inside the world', () => {
  // A label-only built-in would silently turn position checking off for a quarter of all draws.
  for (const loc of START_LOCATIONS) {
    assert.ok(loc.x != null && loc.y != null, `${loc.label} has no pin`);
    assert.ok(loc.x! > 1000 && loc.x! < 4000, `${loc.label} x out of the world`);
    assert.ok(loc.y! > 2500 && loc.y! < 4200, `${loc.label} y out of the world`);
  }
});

test('startDistance: Chebyshev, and null whenever there is nothing to measure', () => {
  const spot = { x: 3094, y: 3491, radius: 25 };
  assert.equal(startDistance(spot, { x: 3094, y: 3491 }), 0);
  // The long side wins — 30 east and 4 north is 30 squares, not 34 and not 30.26.
  assert.equal(startDistance(spot, { x: 3124, y: 3495 }), 30);
  assert.equal(startDistance(spot, { x: 3064, y: 3491 }), 30);
  assert.equal(startDistance(null, { x: 3094, y: 3491 }), null);
  assert.equal(startDistance(spot, { x: null, y: null }), null);
  assert.equal(startDistance(spot, null), null);
});

test('drawnSpot: coordinates only when the draw landed on a pinned entry', () => {
  assert.deepEqual(
    drawnSpot({ startProofLocation: 'Edgeville bank', startProofDrawnAt: DRAWN, startProofX: 3094, startProofY: 3491, startProofRadius: 40 }),
    { x: 3094, y: 3491, radius: 40 },
  );
  // A pinned spot with no stored radius falls back to the default rather than to zero.
  assert.deepEqual(
    drawnSpot({ startProofLocation: 'x', startProofDrawnAt: DRAWN, startProofX: 3094, startProofY: 3491, startProofRadius: null }),
    { x: 3094, y: 3491, radius: DEFAULT_START_RADIUS },
  );
  assert.equal(drawnSpot({ startProofLocation: 'x', startProofDrawnAt: DRAWN }), null);
});

test('sessionAgeMinutes: what the client claims, or null when it claims nonsense', () => {
  const at = Date.parse('2026-08-16T18:30:00.000Z');
  assert.equal(sessionAgeMinutes('2026-08-16T18:25:00.000Z', at), 5);
  assert.equal(sessionAgeMinutes('2026-08-16T18:30:00.000Z', at), 0);
  assert.equal(sessionAgeMinutes(null, at), null);
  assert.equal(sessionAgeMinutes('not a date', at), null);
  // A little skew is tolerated and reads as a brand-new session...
  assert.equal(sessionAgeMinutes('2026-08-16T18:30:30.000Z', at), 0);
  // ...a login stamp an hour in the future is a broken clock, and must not read as "0 minutes old".
  assert.equal(sessionAgeMinutes('2026-08-16T19:30:00.000Z', at), null);
});

test('evaluateStartProof: position and session verdicts, with null for "cannot tell"', () => {
  const spot = { x: 3094, y: 3491, radius: 25 };
  const at = Date.parse('2026-08-16T18:30:00.000Z');
  const cfg: StartProofConfig = { ...CFG, maxSessionMinutes: 15 };

  const good = evaluateStartProof({
    cfg, spot, keywordOk: true,
    claim: { x: 3100, y: 3489, loginAt: '2026-08-16T18:22:00.000Z' }, atMs: at,
  });
  assert.equal(good.positionOk, true);
  assert.equal(good.distance, 6);
  assert.equal(good.sessionOk, true);
  assert.equal(good.sessionMinutes, 8);

  const bad = evaluateStartProof({
    cfg, spot, keywordOk: true,
    claim: { x: 2400, y: 3489, loginAt: '2026-08-16T14:00:00.000Z' }, atMs: at,
  });
  assert.equal(bad.positionOk, false);
  assert.equal(bad.distance, 694);
  assert.equal(bad.sessionOk, false);
  assert.equal(bad.sessionMinutes, 270);

  // Nothing reported (a web upload, or a plugin too old to say) — checks stay null, not false.
  const quiet = evaluateStartProof({ cfg, spot, keywordOk: true, claim: {}, atMs: at });
  assert.equal(quiet.positionOk, null);
  assert.equal(quiet.sessionOk, null);

  // Rule switched off / spot never pinned — the same "cannot tell", from the other direction.
  const unchecked = evaluateStartProof({
    cfg: CFG, spot: null, keywordOk: true,
    claim: { x: 2400, y: 3489, loginAt: '2026-08-16T14:00:00.000Z' }, atMs: at,
  });
  assert.equal(unchecked.positionOk, null);
  assert.equal(unchecked.distance, null);
  assert.equal(unchecked.sessionOk, null);
  // The age is still recorded even when nobody asked for a window — staff can see it.
  assert.equal(unchecked.sessionMinutes, 270);
});

test('startProofGate: nothing to prove when it is not required or not drawn', () => {
  const drawn = { startProofLocation: 'Varrock fountain', startProofDrawnAt: DRAWN };
  assert.equal(startProofGate(null, drawn, null), 'ok');
  assert.equal(startProofGate(CFG, { startProofLocation: null, startProofDrawnAt: null }, null), 'ok');
});

test('startProofGate: a shot on file passes, even while it waits for review', () => {
  const drawn = { startProofLocation: 'Varrock fountain', startProofDrawnAt: DRAWN };
  assert.equal(startProofGate(CFG, drawn, { status: 'pending' }, DURING), 'ok');
  assert.equal(startProofGate(CFG, drawn, { status: 'accepted' }, DURING), 'ok');
  // Rejected is the same as never having filed one — they were told to re-take it.
  assert.equal(startProofGate(CFG, drawn, { status: 'rejected' }, DURING), 'flag');
});

test('startProofGate: the host picks how hard the belt is', () => {
  const drawn = { startProofLocation: 'Varrock fountain', startProofDrawnAt: DRAWN };
  assert.equal(startProofGate(CFG, drawn, null, DURING), 'flag');
  assert.equal(startProofGate({ ...CFG, onMissing: 'reject' }, drawn, null, DURING), 'reject');
});

test('startProofGate: the requirement lapses six hours after the start', () => {
  const drawn = { startProofLocation: 'Varrock fountain', startProofDrawnAt: DRAWN };
  // Right up to the boundary it still holds...
  assert.equal(startProofGate(CFG, drawn, null, Date.parse('2026-08-16T23:59:59.000Z')), 'flag');
  // ...and then stops, for the flag setting and the refuse setting alike. OSRS has force-logged
  // everyone by now, so a missing shot no longer says anything about stacked content.
  assert.equal(startProofGate(CFG, drawn, null, AFTER), 'ok');
  assert.equal(startProofGate({ ...CFG, onMissing: 'reject' }, drawn, null, AFTER), 'ok');
  assert.equal(startProofGate(CFG, drawn, { status: 'rejected' }, AFTER), 'ok');
});

test('autoAcceptDecision: only an authenticated plugin capture with a verified keyword', () => {
  assert.equal(autoAcceptDecision(CFG, 'plugin', { keywordOk: true }), 'accepted');
  // A hand-typed match proves the player read the site, not that the screenshot shows the word.
  assert.equal(autoAcceptDecision(CFG, 'web', { keywordOk: true }), 'pending');
  assert.equal(autoAcceptDecision(CFG, 'plugin', { keywordOk: false }), 'pending');
  assert.equal(autoAcceptDecision({ ...CFG, autoAcceptPlugin: false }, 'plugin', { keywordOk: true }), 'pending');
  assert.equal(autoAcceptDecision(null, 'plugin', { keywordOk: true }), 'pending');
});

test('autoAcceptDecision: a failed check sends it to a human, an absent one never does', () => {
  assert.equal(autoAcceptDecision(CFG, 'plugin', { keywordOk: true, positionOk: false }), 'pending');
  assert.equal(autoAcceptDecision(CFG, 'plugin', { keywordOk: true, sessionOk: false }), 'pending');
  assert.equal(autoAcceptDecision(CFG, 'plugin', { keywordOk: true, positionOk: true, sessionOk: true }), 'accepted');
  // null = the check didn't run (unpinned spot, window off, older plugin) — not a strike.
  assert.equal(autoAcceptDecision(CFG, 'plugin', { keywordOk: true, positionOk: null, sessionOk: null }), 'accepted');
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
    spot: null,
    keyword: null,
    needsUpload: false,
    windowOpen: false,
    windowEndsAt: null,
    status: null,
    imageUrl: null,
    maxSessionMinutes: 0,
  });
});

test('startProofState: after the draw, the player owes a shot until one is on file', () => {
  const event = {
    id: 3, startProofLocation: 'Edgeville bank', startProofDrawnAt: DRAWN,
    startProofX: 3094, startProofY: 3491, startProofRadius: null,
  };
  const owed = startProofState({ cfg: CFG, event, playerId: 9, nowMs: DURING });
  assert.equal(owed.drawn, true);
  assert.equal(owed.location, 'Edgeville bank');
  assert.deepEqual(owed.spot, { x: 3094, y: 3491, radius: DEFAULT_START_RADIUS });
  assert.equal(owed.keyword, startKeyword(3, 9, DRAWN));
  assert.equal(owed.needsUpload, true);

  const filed = startProofState({
    cfg: CFG,
    event,
    playerId: 9,
    proof: { status: 'pending', imageUrl: 'https://media.example/shot.webp' },
    nowMs: DURING,
  });
  assert.equal(filed.needsUpload, false);
  assert.equal(filed.status, 'pending');
  assert.equal(filed.imageUrl, 'https://media.example/shot.webp');

  // Rejected sends them back to the start of the queue.
  assert.equal(
    startProofState({ cfg: CFG, event, playerId: 9, proof: { status: 'rejected' }, nowMs: DURING }).needsUpload,
    true,
  );
});

test('startProofState: nobody owes a shot once the window has shut', () => {
  const event = {
    id: 3, startProofLocation: 'Edgeville bank', startProofDrawnAt: DRAWN,
    startProofX: 3094, startProofY: 3491, startProofRadius: null,
  };
  const late = startProofState({ cfg: CFG, event, playerId: 9, nowMs: AFTER });
  // The card, the plugin banner and the chat nudge all read needsUpload, so they go quiet together.
  assert.equal(late.needsUpload, false);
  assert.equal(late.windowOpen, false);
  assert.equal(late.windowEndsAt, '2026-08-17T00:00:00.000Z');
  // The instructions stay on the view — an admin row still wants to say what was asked for.
  assert.equal(late.location, 'Edgeville bank');
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
