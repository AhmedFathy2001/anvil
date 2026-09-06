import test from 'node:test';
import assert from 'node:assert/strict';
import {
  completionAward,
  missionClaimCap,
  missionPlaceGp,
  missionPlacePoints,
  parseMissionReward,
  parseTileMissionRules,
  serializeTileMissionRules,
  type EventRules,
  type MissionReward,
} from '../src/lib/eventRules.ts';
import { foldBalance, countsTowardBalance } from '../src/lib/cofferMath.ts';

// The arrangement this whole feature was built for: first claim takes the gp and no points,
// everyone after banks the tile's own value, and a dry coffer pays the winner in points instead.
const FIRST_TAKES_THE_MONEY: MissionReward = {
  places: [{ points: 0, gp: 50_000_000, unfundedPoints: null }],
  restPoints: null,
  maxClaims: null,
};

const PODIUM: MissionReward = {
  places: [
    { points: 300, gp: 20_000_000, unfundedPoints: 300 },
    { points: 200, gp: 10_000_000, unfundedPoints: 200 },
    { points: 100, gp: 0, unfundedPoints: null },
  ],
  restPoints: 0,
  maxClaims: 3,
};

test('the ladder pays the place you finished in', () => {
  const args = { reward: PODIUM, funded: true, baseValue: 500 };
  assert.equal(missionPlacePoints({ ...args, place: 1 }), 300);
  assert.equal(missionPlacePoints({ ...args, place: 2 }), 200);
  assert.equal(missionPlacePoints({ ...args, place: 3 }), 100);
  // Past the last listed place, restPoints decides — here, nothing.
  assert.equal(missionPlacePoints({ ...args, place: 4 }), 0);
  assert.equal(missionPlaceGp(PODIUM, 1), 20_000_000);
  assert.equal(missionPlaceGp(PODIUM, 3), 0);
  assert.equal(missionPlaceGp(PODIUM, 9), 0);
});

test('first takes the money: no points while the coffer pays, tile value when it cannot', () => {
  const args = { reward: FIRST_TAKES_THE_MONEY, baseValue: 120 };
  assert.equal(missionPlacePoints({ ...args, place: 1, funded: true }), 0);
  // Coffer dry -> unfundedPoints is null, which means the tile's own value. "No reward for first
  // place except the points."
  assert.equal(missionPlacePoints({ ...args, place: 1, funded: false }), 120);
  // Everyone after the paid place scores normally either way.
  assert.equal(missionPlacePoints({ ...args, place: 2, funded: true }), 120);
});

test('a points-only place is never treated as unfunded', () => {
  const reward: MissionReward = {
    places: [{ points: 999, gp: 0, unfundedPoints: 1 }],
    restPoints: null,
    maxClaims: null,
  };
  assert.equal(missionPlacePoints({ reward, place: 1, funded: false, baseValue: 10 }), 999);
});

test('null points anywhere in the ladder means the tile keeps its own value', () => {
  const reward: MissionReward = {
    places: [{ points: null, gp: 5_000_000, unfundedPoints: null }],
    restPoints: null,
    maxClaims: null,
  };
  assert.equal(missionPlacePoints({ reward, place: 1, funded: true, baseValue: 250 }), 250);
  assert.equal(missionPlacePoints({ reward, place: 2, funded: true, baseValue: 250 }), 250);
});

test('no ladder at all leaves the tile exactly as it was', () => {
  assert.equal(missionPlacePoints({ reward: null, place: 1, funded: true, baseValue: 77 }), 77);
});

test('claim cap: explicit wins, lockout is the one-place special case', () => {
  assert.equal(missionClaimCap({ reward: PODIUM, lockout: false }), 3);
  assert.equal(missionClaimCap({ reward: null, lockout: true }), 1);
  assert.equal(missionClaimCap({ reward: null, lockout: false }), null);
  // An explicit cap outranks the old boolean rather than fighting it.
  assert.equal(missionClaimCap({ reward: { places: [], restPoints: null, maxClaims: 5 }, lockout: true }), 5);
});

test('completionAward: a ladder replaces the first-clear bonus rather than stacking with it', () => {
  const rules = { firstBonus: 500, decay: null, lockout: false } as unknown as EventRules;
  const award = completionAward({
    scoringMode: 'points',
    rules,
    tilePoints: 100,
    tileRevealedAt: null,
    isFirst: true,
    reward: PODIUM,
    place: 1,
    funded: true,
  });
  assert.equal(award, 300); // the place's own number, not 300 + 500
  // Without a ladder the bonus behaves exactly as it always did.
  assert.equal(
    completionAward({ scoringMode: 'points', rules, tilePoints: 100, tileRevealedAt: null, isFirst: true }),
    600,
  );
});

test('completionAward: a decaying mission is what feeds the ladder its base value', () => {
  const revealedAt = '2026-09-01T00:00:00.000Z';
  const rules = { firstBonus: 0, decay: { targetPct: 50, hours: 10 }, lockout: false } as unknown as EventRules;
  const reward: MissionReward = { places: [{ points: null, gp: 1, unfundedPoints: null }], restPoints: null, maxClaims: null };
  const award = completionAward({
    scoringMode: 'points',
    rules,
    tilePoints: 100,
    tileRevealedAt: revealedAt,
    isFirst: true,
    reward,
    place: 1,
    funded: true,
    nowMs: Date.parse('2026-09-01T05:00:00.000Z'), // halfway down the ramp
  });
  assert.equal(award, 75);
});

test('parse: junk is dropped, and a ladder that changes nothing is stored as nothing', () => {
  assert.equal(parseMissionReward(null), null);
  assert.equal(parseMissionReward({ places: [] }), null);
  assert.equal(parseMissionReward('nonsense'), null);
  const parsed = parseMissionReward({
    places: [{ points: '30', gp: -5, unfundedPoints: undefined }, {}],
    restPoints: 7,
    maxClaims: 0,
  });
  assert.equal(parsed?.places.length, 2);
  assert.equal(parsed?.places[0].gp, 0); // negatives clamp to nothing owed
  assert.equal(parsed?.places[1].points, null);
  assert.equal(parsed?.restPoints, 7);
  assert.equal(parsed?.maxClaims, 1); // a cap of zero places would close the mission on announce
});

test('round-trip: a tile carrying only a ladder still serializes, and an empty one stays NULL', () => {
  const json = serializeTileMissionRules({ lockout: false, firstBonus: 0, decay: null, expiryHours: null, reward: PODIUM });
  assert.ok(json);
  const back = parseTileMissionRules(json);
  assert.equal(back.reward?.places[0].gp, 20_000_000);
  assert.equal(back.reward?.maxClaims, 3);
  assert.equal(serializeTileMissionRules({ lockout: false, firstBonus: 0, decay: null, expiryHours: null, reward: null }), null);
});

test('a mission tile authored before ladders existed reads as no ladder', () => {
  const legacy = parseTileMissionRules('{"lockout":true,"firstBonus":250,"expiryHours":6}');
  assert.equal(legacy.reward, null);
  assert.equal(legacy.lockout, true);
  assert.equal(missionClaimCap(legacy), 1);
});

// ---- The coffer ---------------------------------------------------------------------------------

test('balance: only approved donations count, and reserved gp is already spoken for', () => {
  const b = foldBalance([
    { kind: 'donation', status: 'approved', total: 500_000_000 },
    { kind: 'donation', status: 'pending', total: 100_000_000 },
    { kind: 'donation', status: 'rejected', total: 900_000_000 },
    { kind: 'adjustment', status: 'approved', total: -50_000_000 },
    { kind: 'award', status: 'reserved', total: -20_000_000 },
    { kind: 'award', status: 'paid', total: -30_000_000 },
    { kind: 'award', status: 'unfunded', total: -70_000_000 },
    { kind: 'award', status: 'cancelled', total: -10_000_000 },
  ]);
  assert.equal(b.confirmed, 450_000_000);
  assert.equal(b.reserved, 50_000_000);
  assert.equal(b.available, 400_000_000);
  assert.equal(b.pending, 100_000_000);
});

test('balance: available never reads as negative, however the ledger got there', () => {
  const b = foldBalance([
    { kind: 'donation', status: 'approved', total: 1_000_000 },
    { kind: 'award', status: 'reserved', total: -5_000_000 },
  ]);
  assert.equal(b.available, 0);
  assert.equal(b.reserved, 5_000_000);
});

test('an unfunded award holds no money', () => {
  assert.equal(countsTowardBalance({ kind: 'award', status: 'unfunded' }), false);
  assert.equal(countsTowardBalance({ kind: 'award', status: 'reserved' }), true);
  assert.equal(countsTowardBalance({ kind: 'donation', status: 'pending' }), false);
  assert.equal(countsTowardBalance({ kind: 'refund', status: 'approved' }), true);
});
