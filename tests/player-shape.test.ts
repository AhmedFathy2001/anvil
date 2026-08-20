import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlayerShape, percentileFromRank, percentileOf } from '../src/lib/playerShape.ts';

test('percentileOf: a tie block reads as the middle of itself, not the top', () => {
  assert.equal(percentileOf([1, 2, 3, 4], 4), 88);
  assert.equal(percentileOf([1, 2, 3, 4], 1), 13);
  // Everyone on zero is the middle of a crowd — which is what "nobody does this" should look like.
  assert.equal(percentileOf([0, 0, 0, 0], 0), 50);
  assert.equal(percentileOf([], 5), null);
});

test('percentileFromRank: #1 is 100, last is 0, and a board of one places nobody', () => {
  assert.equal(percentileFromRank(1, 41), 100);
  assert.equal(percentileFromRank(41, 41), 0);
  assert.equal(percentileFromRank(3, 5), 50);
  // Third of three and third of three hundred are not the same standing; one entrant is no standing.
  assert.equal(percentileFromRank(1, 1), null);
  assert.equal(percentileFromRank(0, 10), null);
});

const members = [
  { id: 1, ehpMilli: 1_000, ehbMilli: 50_000, overallXp: 200_000_000 },
  { id: 2, ehpMilli: 90_000, ehbMilli: 1_000, overallXp: 400_000_000 },
  { id: 3, ehpMilli: 45_000, ehbMilli: 20_000, overallXp: 300_000_000 },
];

test('buildPlayerShape: a bossing-heavy account reads as one, not as a rank', () => {
  const shape = buildPlayerShape({ members, memberId: 1, standings: {} });
  const by = new Map(shape.axes.map((a) => [a.key, a]));
  // Top of the clan at bossing, bottom at skilling — the shape a captain is actually reading.
  assert.equal(by.get('bossing')?.pct, 83);
  assert.equal(by.get('skilling')?.pct, 17);
  assert.equal(shape.tracked, 3);
  assert.equal(shape.empty, false);
});

test('buildPlayerShape: an activity axis takes their best claim to it', () => {
  const shape = buildPlayerShape({
    members,
    memberId: 3,
    standings: {
      // Barely plays GotR, but is second of forty at Soul Wars: that's a minigame player.
      riftsClosed: { position: 38, of: 40 },
      soulWarsZeal: { position: 2, of: 40 },
      cluesAll: { position: 20, of: 40 },
    },
  });
  const by = new Map(shape.axes.map((a) => [a.key, a]));
  assert.equal(by.get('minigames')?.pct, 97);
  assert.deepEqual(by.get('minigames')?.standing, { position: 2, of: 40 });
  assert.equal(by.get('clues')?.pct, 51);
  // Nothing logged at all stays null rather than reading as a zero they earned.
  assert.equal(by.get('collection')?.pct, null);
});

test('buildPlayerShape: a member the sweep has never seen is empty, not zero', () => {
  const shape = buildPlayerShape({ members: [], memberId: 9, standings: {} });
  assert.equal(shape.empty, true);
  assert.equal(shape.tracked, 0);
});
