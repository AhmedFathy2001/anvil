import test from 'node:test';
import assert from 'node:assert/strict';
import {
  completionAward,
  missionPlaceGp,
  parseMissionDaily,
  parseTileMissionRules,
  serializeTileMissionRules,
  validateEventRules,
  parseEventRules,
  type EventRules,
  type MissionReward,
} from '../src/lib/eventRules.ts';

const PLAIN_RULES = { firstBonus: 0, decay: null, lockout: false } as unknown as EventRules;

const LADDER: MissionReward = {
  places: [{ points: 0, gp: 50_000_000, unfundedPoints: null }],
  restPoints: null,
  maxClaims: null,
};

test('a double day doubles the tile value', () => {
  const award = completionAward({
    scoringMode: 'points',
    rules: PLAIN_RULES,
    tilePoints: 250,
    tileRevealedAt: null,
    isFirst: false,
    multiplier: 2,
  });
  assert.equal(award, 500);
});

test('without a multiplier a plain tile still scores by its live weight (null)', () => {
  const award = completionAward({
    scoringMode: 'points',
    rules: PLAIN_RULES,
    tilePoints: 250,
    tileRevealedAt: null,
    isFirst: false,
  });
  assert.equal(award, null);
});

test('the multiplier applies over the ladder, not instead of it', () => {
  // Second place on this ladder falls through to the tile's own value.
  const second = completionAward({
    scoringMode: 'points',
    rules: PLAIN_RULES,
    tilePoints: 120,
    tileRevealedAt: null,
    isFirst: false,
    reward: LADDER,
    place: 2,
    funded: true,
    multiplier: 3,
  });
  assert.equal(second, 360);
  // First place is points-zero by design, and three times nothing is still nothing — they took gp.
  const first = completionAward({
    scoringMode: 'points',
    rules: PLAIN_RULES,
    tilePoints: 120,
    tileRevealedAt: null,
    isFirst: true,
    reward: LADDER,
    place: 1,
    funded: true,
    multiplier: 3,
  });
  assert.equal(first, 0);
});

test('a boosted, decaying mission multiplies what the ramp left', () => {
  const rules = { firstBonus: 0, decay: { targetPct: 50, hours: 10 }, lockout: false } as unknown as EventRules;
  const award = completionAward({
    scoringMode: 'points',
    rules,
    tilePoints: 100,
    tileRevealedAt: '2026-09-05T00:00:00.000Z',
    isFirst: true,
    multiplier: 2,
    nowMs: Date.parse('2026-09-05T05:00:00.000Z'), // halfway down: 75
  });
  assert.equal(award, 150);
});

test('gp is multiplied only where the host opted in', () => {
  const pointsOnlyWeekend = parseTileMissionRules(
    JSON.stringify({ reward: LADDER, multiplier: 2, prizeMultiplier: 1 }),
  );
  assert.equal(missionPlaceGp(pointsOnlyWeekend, 1), 50_000_000);

  const doublePrize = parseTileMissionRules(
    JSON.stringify({ reward: LADDER, multiplier: 2, prizeMultiplier: 2 }),
  );
  assert.equal(missionPlaceGp(doublePrize, 1), 100_000_000);

  // A bare ladder (no rules object) is always face value.
  assert.equal(missionPlaceGp(LADDER, 1), 50_000_000);
});

test('multipliers survive the tile round trip, and 1x stores nothing', () => {
  const json = serializeTileMissionRules({
    lockout: false,
    firstBonus: 0,
    decay: null,
    expiryHours: null,
    reward: null,
    multiplier: 2,
    prizeMultiplier: 1,
  });
  assert.ok(json);
  assert.equal(parseTileMissionRules(json).multiplier, 2);
  assert.equal(
    serializeTileMissionRules({
      lockout: false,
      firstBonus: 0,
      decay: null,
      expiryHours: null,
      reward: null,
      multiplier: 1,
      prizeMultiplier: 1,
    }),
    null,
  );
});

test('a tile authored before multipliers existed reads as 1x', () => {
  const legacy = parseTileMissionRules('{"lockout":true,"firstBonus":250}');
  assert.equal(legacy.multiplier, 1);
  assert.equal(legacy.prizeMultiplier, 1);
});

test('multipliers clamp to halves inside a sane range', () => {
  const daily = parseMissionDaily({
    timezone: 'UTC',
    times: ['20:00'],
    perDay: [2, 1, 1, 1, 1, 1, 2],
    multiplier: [2, 1, 1, 1, 1, 1, 1.7],
    multiplyPrizes: true,
  });
  assert.equal(daily?.multiplier[0], 2);
  assert.equal(daily?.multiplier[6], 1.5); // 1.7 snaps to the nearest half
  assert.equal(daily?.multiplyPrizes, true);

  const junk = parseMissionDaily({
    timezone: 'UTC',
    times: ['20:00'],
    perDay: [1, 1, 1, 1, 1, 1, 1],
    multiplier: [0, -4, 900, 'x', null, undefined, NaN],
  });
  // Unparseable and non-positive values read as "normal" rather than as a board that pays nothing.
  // An absurd number clamps to the ceiling instead, matching every other numeric rule in this file:
  // somebody typing 900 wanted "a lot", and 10x is the most this can mean.
  assert.deepEqual(junk?.multiplier, [1, 1, 10, 1, 1, 1, 1]);
  assert.equal(junk?.multiplyPrizes, false);
});

test('a weekend-boost schedule survives the rules round trip on its own', () => {
  const result = validateEventRules({
    mission: {
      announceMode: 'daily',
      order: 'random',
      intervalMinutes: 60,
      tierRamp: [],
      daily: {
        timezone: 'Europe/London',
        times: ['20:00'],
        window: null,
        perDay: [2, 1, 1, 1, 1, 1, 2],
        multiplier: [2, 1, 1, 1, 1, 1, 2],
        multiplyPrizes: false,
      },
    },
  });
  assert.ok(!('error' in result));
  const back = parseEventRules('rules' in result ? result.rules : null);
  assert.deepEqual(back.mission?.daily?.multiplier, [2, 1, 1, 1, 1, 1, 2]);
  assert.equal(back.mission?.daily?.multiplyPrizes, false);
});
