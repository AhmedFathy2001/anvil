// Non-boss hiscores counters (lib/hiscoresActivities) — the entries that live outside the `bosses`
// map and so were previously unreadable as tile stats.
//
// Run: node --experimental-strip-types --test tests/hiscores-activities.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CLUE_TIER_KEYS,
  HISCORES_ACTIVITIES,
  activityFor,
  isActivityKey,
  parseActivityBlob,
  readActivityRank,
  readActivityScore,
  readAllActivities,
} from '../src/lib/hiscoresActivities.ts';

// Shaped exactly like a stored snapshot — these values came off a real row in production.
const SNAPSHOT = {
  skills: { mining: { rank: 1, level: 99, xp: 13_034_431 } },
  bosses: { zulrah: { rank: 5000, score: 1204 } },
  clues: {
    all: { rank: 100, score: 412 },
    beginner: { rank: -1, score: -1 },
    hard: { rank: 414073, score: 59 },
    master: { rank: 9000, score: 12 },
  },
  bountyHunter: {
    hunterV2: { rank: 50, score: 7 },
    rogueV2: { rank: -1, score: -1 },
    hunter: { rank: -1, score: -1 },
    rogue: { rank: -1, score: -1 },
  },
  lastManStanding: { rank: -1, score: 0 },
  soulWarsZeal: { rank: -1, score: 0 },
  riftsClosed: { rank: 12, score: 340 },
  colosseumGlory: { rank: -1, score: 0 },
  collectionsLogged: { rank: -1, score: 274 },
};

test('GOTR, clue tiers and Bounty Hunter all read from their own paths', () => {
  assert.equal(readActivityScore(SNAPSHOT, 'riftsClosed'), 340);
  assert.equal(readActivityScore(SNAPSHOT, 'cluesHard'), 59);
  assert.equal(readActivityScore(SNAPSHOT, 'cluesAll'), 412);
  assert.equal(readActivityScore(SNAPSHOT, 'cluesMaster'), 12);
  assert.equal(readActivityScore(SNAPSHOT, 'bhHunter'), 7);
  assert.equal(readActivityScore(SNAPSHOT, 'collectionsLogged'), 274);
});

test('a clue tier is its own counter, never the total', () => {
  // "50 hard clues" must mean hard, not 50 of anything — the bug a single clue counter would cause.
  assert.notEqual(readActivityScore(SNAPSHOT, 'cluesHard'), readActivityScore(SNAPSHOT, 'cluesAll'));
});

test('unranked (-1) floors to zero rather than going negative', () => {
  // A member who has never touched these would otherwise score -1, throwing off every gain sum.
  assert.equal(readActivityScore(SNAPSHOT, 'cluesBeginner'), 0);
  assert.equal(readActivityScore(SNAPSHOT, 'bhRogue'), 0);
  assert.equal(readActivityScore(SNAPSHOT, 'soulWarsZeal'), 0);
});

test('missing sections and junk snapshots read as zero, never throw', () => {
  assert.equal(readActivityScore({}, 'riftsClosed'), 0);
  assert.equal(readActivityScore({ clues: null }, 'cluesHard'), 0);
  assert.equal(readActivityScore({ clues: { hard: 'nope' } }, 'cluesHard'), 0);
  assert.equal(readActivityScore(null, 'riftsClosed'), 0);
  assert.equal(readActivityScore(undefined, 'cluesEasy'), 0);
  assert.equal(readActivityScore(SNAPSHOT, 'notAThing'), 0);
  assert.equal(readActivityScore(SNAPSHOT, null), 0);
});

test('boss and skill keys are NOT activities, so the boss path still handles them', () => {
  // A collision here would silently reroute an existing tile's reads.
  assert.equal(isActivityKey('zulrah'), false);
  assert.equal(isActivityKey('mining'), false);
  assert.equal(readActivityScore(SNAPSHOT, 'zulrah'), 0);
});

test('every activity key is unique and points somewhere real', () => {
  const keys = new Set<string>();
  for (const a of HISCORES_ACTIVITIES) {
    assert.ok(!keys.has(a.key), `duplicate activity key: ${a.key}`);
    keys.add(a.key);
    assert.ok(a.label.length > 0, `${a.key} needs a label`);
    assert.ok(a.path.length >= 1 && a.path.length <= 2, `${a.key} has an odd path`);
    assert.equal(activityFor(a.key)?.key, a.key);
  }
});

test('lookup tolerates whitespace, since keys arrive from CSV cells', () => {
  assert.equal(activityFor(' riftsClosed ')?.key, 'riftsClosed');
});

// ── Display metadata + snapshot extraction (the member directory reads) ─────────────────────────

test('every activity declares a group and a scale', () => {
  for (const a of HISCORES_ACTIVITIES) {
    assert.ok(
      a.group === 'clues' || a.group === 'minigames' || a.group === 'collection',
      `${a.key} has no display group`,
    );
    assert.ok(a.scale === 'count' || a.scale === 'rank', `${a.key} has no scale`);
  }
});

test('rank-scaled entries are the ones with no countable score', () => {
  // The distinction the directory sorts on: a count is "more is better", a rank is a hiscores
  // position where 1 is the best in the game. Getting these backwards puts the best PKer last.
  assert.equal(activityFor('lastManStanding')?.scale, 'rank');
  assert.equal(activityFor('pvpArena')?.scale, 'rank');
  assert.equal(activityFor('bhHunter')?.scale, 'rank');
  assert.equal(activityFor('cluesElite')?.scale, 'count');
  assert.equal(activityFor('collectionsLogged')?.scale, 'count');
  assert.equal(activityFor('riftsClosed')?.scale, 'count');
});

test('CLUE_TIER_KEYS is the six real tiers, hardest last, and excludes the total', () => {
  assert.equal(CLUE_TIER_KEYS.length, 6);
  assert.ok(!CLUE_TIER_KEYS.includes('cluesAll' as (typeof CLUE_TIER_KEYS)[number]));
  assert.equal(CLUE_TIER_KEYS[0], 'cluesBeginner');
  assert.equal(CLUE_TIER_KEYS[CLUE_TIER_KEYS.length - 1], 'cluesMaster');
  for (const key of CLUE_TIER_KEYS) assert.equal(activityFor(key)?.group, 'clues');
});

test('a rank reads through when ranked, and is null when it is not', () => {
  assert.equal(readActivityRank(SNAPSHOT, 'riftsClosed'), 12);
  assert.equal(readActivityRank(SNAPSHOT, 'cluesHard'), 414073);
  // -1 is hiscores for "unranked", which must not become rank #-1 or rank #0.
  assert.equal(readActivityRank(SNAPSHOT, 'soulWarsZeal'), null);
  assert.equal(readActivityRank(SNAPSHOT, 'cluesBeginner'), null);
  assert.equal(readActivityRank(SNAPSHOT, 'notAnActivity'), null);
  assert.equal(readActivityRank(null, 'riftsClosed'), null);
});

test('the derived blob keeps what the account has and drops what it does not', () => {
  const blob = readAllActivities(SNAPSHOT);

  assert.deepEqual(blob.riftsClosed, { score: 340, rank: 12 });
  assert.deepEqual(blob.cluesHard, { score: 59, rank: 414073 });
  // Ranked but scoreless is a real state for a rank-scaled entry, so it survives.
  assert.deepEqual(blob.bhHunter, { score: 7, rank: 50 });
  // Scoreless AND unranked is nothing at all — omitted, which is what keeps the blob small.
  assert.equal(blob.cluesBeginner, undefined);
  assert.equal(blob.soulWarsZeal, undefined);
  assert.equal(blob.pvpArena, undefined);
  // A collection log with slots but no rank still counts.
  assert.deepEqual(blob.collectionsLogged, { score: 274, rank: null });
});

test('the blob stays small enough to read for a whole roster', () => {
  // The entire reason this column exists rather than parsing statsLastSnapshot per member.
  const json = JSON.stringify(readAllActivities(SNAPSHOT));
  assert.ok(json.length < 1_000, `activity blob was ${json.length} bytes`);
});

test('a malformed blob reads as empty rather than throwing', () => {
  assert.deepEqual(parseActivityBlob(null), {});
  assert.deepEqual(parseActivityBlob(''), {});
  assert.deepEqual(parseActivityBlob('{'), {});
  assert.deepEqual(parseActivityBlob('[1,2]'), {}); // valid JSON, wrong shape
  assert.deepEqual(parseActivityBlob('{"cluesAll":{"score":5,"rank":null}}'), {
    cluesAll: { score: 5, rank: null },
  });
});

test('a stored blob round-trips', () => {
  const blob = readAllActivities(SNAPSHOT);
  assert.deepEqual(parseActivityBlob(JSON.stringify(blob)), blob);
});
