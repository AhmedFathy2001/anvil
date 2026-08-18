// Event-rules core (lib/eventRules) — parsing/clamping, validation, per-tile visibility, the
// next-reveal clock, and the frozen completion award (first bonus + decay).
//
// Run: node --experimental-strip-types --test tests/event-rules.test.ts
// (lib/eventRules imports nothing from `@/`, so Node's native TS type-stripping runs it directly.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseEventRules,
  validateEventRules,
  DEFAULT_EVENT_RULES,
  hasRevealPolicy,
  isTileRevealed,
  visibleTiles,
  isTileOpen,
  nextRevealAt,
  completionAward,
  rotationExpiries,
} from '../src/lib/eventRules.ts';

test('parseEventRules: null/malformed/garbage → defaults', () => {
  assert.deepEqual(parseEventRules(null), DEFAULT_EVENT_RULES);
  assert.deepEqual(parseEventRules(undefined), DEFAULT_EVENT_RULES);
  assert.deepEqual(parseEventRules('not json'), DEFAULT_EVENT_RULES);
  assert.deepEqual(parseEventRules('[1,2]'), DEFAULT_EVENT_RULES);
  assert.deepEqual(parseEventRules('{"revealPolicy":"nope"}').revealPolicy, 'all');
});

test('parseEventRules: clamps numeric fields and implies lockout for bounty', () => {
  const r = parseEventRules(
    JSON.stringify({ revealPolicy: 'interval', revealIntervalMinutes: 1, revealBatchSize: 999, firstBonus: -5 }),
  );
  assert.equal(r.revealIntervalMinutes, 5); // floor
  assert.equal(r.revealBatchSize, 50); // cap
  assert.equal(r.firstBonus, 0); // floor
  assert.equal(r.lockout, false);

  const b = parseEventRules(JSON.stringify({ revealPolicy: 'bounty' }));
  assert.equal(b.lockout, true, 'bounty is single-claim by definition');
});

test('validateEventRules: defaults store NULL; presets canonicalise; bad shapes error', () => {
  assert.deepEqual(validateEventRules(null), { rules: null });
  assert.deepEqual(validateEventRules({}), { rules: null });
  assert.deepEqual(validateEventRules({ revealPolicy: 'all', firstBonus: 0 }), { rules: null });

  const ok = validateEventRules({ revealPolicy: 'interval', revealIntervalMinutes: 30 });
  assert.ok('rules' in ok && ok.rules, 'non-default rules serialize');
  const parsed = parseEventRules((ok as { rules: string }).rules);
  assert.equal(parsed.revealPolicy, 'interval');
  assert.equal(parsed.revealIntervalMinutes, 30);

  assert.ok('error' in validateEventRules({ revealPolicy: 'sometimes' }));
  assert.ok('error' in validateEventRules({ revealIntervalMinutes: 2 }));
  // targetPct/floorPct > 100 is GROWTH (ladder missions), valid up to 1000 (= 10×).
  assert.ok('rules' in validateEventRules({ decay: { floorPct: 200, hours: 4 } }));
  assert.ok('error' in validateEventRules({ decay: { floorPct: 2000, hours: 4 } }));
  assert.ok('error' in validateEventRules({ lockout: 'yes' }));
  assert.ok('error' in validateEventRules('nope'));
});

test('visibility: classic events show everything; reveal events show only revealedAt tiles', () => {
  const classic = parseEventRules(null);
  const reveal = parseEventRules(JSON.stringify({ revealPolicy: 'scheduled' }));
  const tiles = [
    { id: 1, revealedAt: null, closedAt: null },
    { id: 2, revealedAt: '2026-01-01T00:00:00.000Z', closedAt: null },
    { id: 3, revealedAt: '2026-01-01T00:00:00.000Z', closedAt: '2026-01-02T00:00:00.000Z' },
  ];
  assert.equal(hasRevealPolicy(classic), false);
  assert.equal(hasRevealPolicy(reveal), true);
  assert.equal(visibleTiles(classic, tiles).length, 3);
  assert.deepEqual(visibleTiles(reveal, tiles).map((t) => t.id), [2, 3], 'closed tiles stay visible');
  assert.equal(isTileRevealed(reveal, tiles[0]), false);
  assert.equal(isTileOpen(reveal, tiles[1]), true);
  assert.equal(isTileOpen(reveal, tiles[2]), false, 'claimed tile no longer accepts completions');
});

test('nextRevealAt: scheduled = earliest planned; interval = anchor + step; bounty/none = null', () => {
  const now = Date.parse('2026-07-24T12:00:00.000Z');
  const scheduled = parseEventRules(JSON.stringify({ revealPolicy: 'scheduled' }));
  const evt = { startDate: '2026-07-24T10:00:00.000Z' };

  assert.equal(
    nextRevealAt(evt, scheduled, [
      { revealAt: '2026-07-24T15:00:00.000Z', revealedAt: null },
      { revealAt: '2026-07-24T13:00:00.000Z', revealedAt: null },
      { revealAt: '2026-07-24T09:00:00.000Z', revealedAt: '2026-07-24T09:00:00.000Z' },
    ], now),
    '2026-07-24T13:00:00.000Z',
  );

  const interval = parseEventRules(JSON.stringify({ revealPolicy: 'interval', revealIntervalMinutes: 60 }));
  // Last reveal 11:30 + 60m = 12:30.
  assert.equal(
    nextRevealAt(evt, interval, [
      { revealedAt: '2026-07-24T11:30:00.000Z' },
      { revealedAt: null },
    ], now),
    '2026-07-24T12:30:00.000Z',
  );
  // Nothing revealed yet → first draw fires at start; already past → clamps to now.
  assert.equal(
    nextRevealAt(evt, interval, [{ revealedAt: null }], now),
    new Date(now).toISOString(),
  );
  // Everything revealed → nothing next.
  assert.equal(nextRevealAt(evt, interval, [{ revealedAt: '2026-07-24T11:00:00.000Z' }], now), null);

  const bounty = parseEventRules(JSON.stringify({ revealPolicy: 'bounty' }));
  assert.equal(nextRevealAt(evt, bounty, [{ revealedAt: null }], now), null);
  assert.equal(nextRevealAt(evt, parseEventRules(null), [{ revealedAt: null }], now), null);
});

test('completionAward: null without modifiers or outside points mode; bonus + linear decay apply', () => {
  const plain = parseEventRules(JSON.stringify({ revealPolicy: 'interval' }));
  assert.equal(
    completionAward({ scoringMode: 'points', rules: plain, tilePoints: 10, tileRevealedAt: null, isFirst: true }),
    null,
    'no modifiers → live weight, nothing frozen',
  );

  const bonus = parseEventRules(JSON.stringify({ revealPolicy: 'interval', firstBonus: 5 }));
  assert.equal(
    completionAward({ scoringMode: 'tiles', rules: bonus, tilePoints: 10, tileRevealedAt: null, isFirst: true }),
    null,
    'tiles mode never freezes awards',
  );
  assert.equal(
    completionAward({ scoringMode: 'points', rules: bonus, tilePoints: 10, tileRevealedAt: null, isFirst: true }),
    15,
  );
  assert.equal(
    completionAward({ scoringMode: 'points', rules: bonus, tilePoints: 10, tileRevealedAt: null, isFirst: false }),
    10,
  );

  // Decay: 100 pts → floor 50% over 10h; completing 5h after reveal = 75.
  const decay = parseEventRules(JSON.stringify({ revealPolicy: 'scheduled', decay: { floorPct: 50, hours: 10 } }));
  const revealedAt = '2026-07-24T00:00:00.000Z';
  const fiveHours = Date.parse('2026-07-24T05:00:00.000Z');
  const later = Date.parse('2026-07-26T00:00:00.000Z');
  assert.equal(
    completionAward({ scoringMode: 'points', rules: decay, tilePoints: 100, tileRevealedAt: revealedAt, isFirst: false, nowMs: fiveHours }),
    75,
  );
  assert.equal(
    completionAward({ scoringMode: 'points', rules: decay, tilePoints: 100, tileRevealedAt: revealedAt, isFirst: false, nowMs: later }),
    50,
    'decay floors, never passes below floorPct',
  );
});

test('rotationExpiries: the oldest open task rotates out first, one draw apart', () => {
  const rules = parseEventRules(
    JSON.stringify({ revealPolicy: 'rotating', revealIntervalMinutes: 60, revealBatchSize: 1, revealWindowSize: 3 }),
  );
  const open = [
    { id: 3, revealedAt: '2026-08-14T10:00:00.000Z' },
    { id: 1, revealedAt: '2026-08-14T08:00:00.000Z' },
    { id: 2, revealedAt: '2026-08-14T09:00:00.000Z' },
  ];
  const exp = rotationExpiries(rules, open, '2026-08-14T11:00:00.000Z');
  assert.equal(exp.get(1), '2026-08-14T11:00:00.000Z'); // oldest goes at the next draw
  assert.equal(exp.get(2), '2026-08-14T12:00:00.000Z');
  assert.equal(exp.get(3), '2026-08-14T13:00:00.000Z');
});

test('rotationExpiries: a batch of two retires two at a time, and other policies never expire', () => {
  const batched = parseEventRules(
    JSON.stringify({ revealPolicy: 'rotating', revealIntervalMinutes: 30, revealBatchSize: 2 }),
  );
  const open = [
    { id: 1, revealedAt: '2026-08-14T08:00:00.000Z' },
    { id: 2, revealedAt: '2026-08-14T08:30:00.000Z' },
    { id: 3, revealedAt: '2026-08-14T09:00:00.000Z' },
  ];
  const exp = rotationExpiries(batched, open, '2026-08-14T09:30:00.000Z');
  assert.equal(exp.get(1), exp.get(2)); // same draw
  assert.equal(exp.get(3), '2026-08-14T10:00:00.000Z');

  const interval = parseEventRules(JSON.stringify({ revealPolicy: 'interval' }));
  assert.equal(rotationExpiries(interval, open, '2026-08-14T09:30:00.000Z').size, 0);
  assert.equal(rotationExpiries(batched, open, null).size, 0);
});

test('parseEventRules: startProof is off by default and tolerant when present', () => {
  assert.equal(parseEventRules(JSON.stringify({ revealPolicy: 'all' })).startProof, null);
  assert.equal(parseEventRules(JSON.stringify({ startProof: null })).startProof, null);
  // "Just turn it on" — an empty object still gets the safe defaults.
  assert.deepEqual(parseEventRules(JSON.stringify({ startProof: {} })).startProof, {
    onMissing: 'flag',
    autoAcceptPlugin: true,
    locations: [],
    // A policy stored before the session window existed must not grow the demand on read.
    maxSessionMinutes: 0,
  });
  // Garbage inside falls back rather than throwing.
  assert.deepEqual(
    parseEventRules(JSON.stringify({ startProof: { onMissing: 'explode', autoAcceptPlugin: 'yes', locations: 'nope', maxSessionMinutes: 'soon' } }))
      .startProof,
    { onMissing: 'flag', autoAcceptPlugin: true, locations: [], maxSessionMinutes: 0 },
  );
  assert.equal(
    parseEventRules(JSON.stringify({ startProof: { autoAcceptPlugin: false } })).startProof?.autoAcceptPlugin,
    false,
  );
});

test('parseEventRules: startProof locations are trimmed, de-duped and capped', () => {
  const rules = parseEventRules(
    JSON.stringify({
      startProof: { locations: ['  Varrock fountain  ', 'varrock FOUNTAIN', '', 42, 'Edgeville bank'] },
    }),
  );
  // A bare string is still a legal entry — that's every pool stored before the map picker existed.
  assert.deepEqual(rules.startProof?.locations, [
    { label: 'Varrock fountain', x: null, y: null, radius: null },
    { label: 'Edgeville bank', x: null, y: null, radius: null },
  ]);

  const many = parseEventRules(
    JSON.stringify({ startProof: { locations: Array.from({ length: 60 }, (_, i) => `Spot ${i}`) } }),
  );
  assert.equal(many.startProof?.locations.length, 40);
});

test('parseEventRules: pinned locations keep their coordinates, junk pins drop to label-only', () => {
  const rules = parseEventRules(
    JSON.stringify({
      startProof: {
        locations: [
          { label: 'Edgeville bank', x: 3094, y: 3491, radius: 30 },
          // Half a pin is no pin — a spot can't be checked on one axis.
          { label: 'Half pinned', x: 3094 },
          // Off the map: dropped rather than drawn as a spot nobody can stand on.
          { label: 'Out of the world', x: 99999, y: 3491 },
          { label: 'Radius clamped', x: 3200, y: 3200, radius: 9000 },
        ],
      },
    }),
  );
  assert.deepEqual(rules.startProof?.locations, [
    { label: 'Edgeville bank', x: 3094, y: 3491, radius: 30 },
    { label: 'Half pinned', x: null, y: null, radius: null },
    { label: 'Out of the world', x: null, y: null, radius: null },
    { label: 'Radius clamped', x: 3200, y: 3200, radius: 200 },
  ]);
});

test('parseEventRules: the session window is minutes, 0 = off', () => {
  assert.equal(parseEventRules(JSON.stringify({ startProof: { maxSessionMinutes: 15 } })).startProof?.maxSessionMinutes, 15);
  assert.equal(parseEventRules(JSON.stringify({ startProof: { maxSessionMinutes: 0 } })).startProof?.maxSessionMinutes, 0);
  assert.equal(parseEventRules(JSON.stringify({ startProof: { maxSessionMinutes: 9999 } })).startProof?.maxSessionMinutes, 720);
  assert.equal(parseEventRules(JSON.stringify({ startProof: { maxSessionMinutes: -5 } })).startProof?.maxSessionMinutes, 0);
});

test('validateEventRules: startProof shape is enforced and round-trips', () => {
  assert.deepEqual(validateEventRules({ startProof: 'yes' }), {
    error: 'rules.startProof must be an object or null',
  });
  assert.deepEqual(validateEventRules({ startProof: { onMissing: 'ignore' } }), {
    error: "rules.startProof.onMissing must be 'flag' or 'reject'",
  });
  assert.deepEqual(validateEventRules({ startProof: { locations: 'Varrock' } }), {
    error: 'rules.startProof.locations must be an array of places',
  });
  // A fat-fingered pin is refused loudly rather than silently parsed away.
  assert.ok('error' in validateEventRules({ startProof: { locations: [{ label: 'Nowhere', x: 12, y: 3491 }] } }));
  assert.deepEqual(validateEventRules({ startProof: { maxSessionMinutes: 1000 } }), {
    error: 'rules.startProof.maxSessionMinutes must be an integer between 0 (off) and 720',
  });

  // Requiring a starting shot is on its own enough to stop being a "default" (NULL) rules column.
  const stored = validateEventRules({ startProof: { onMissing: 'reject' } });
  assert.ok('rules' in stored && stored.rules !== null);
  assert.equal(parseEventRules((stored as { rules: string }).rules).startProof?.onMissing, 'reject');
});
