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
  assert.ok('error' in validateEventRules({ decay: { floorPct: 200, hours: 4 } }));
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
