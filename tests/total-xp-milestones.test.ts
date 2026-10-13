import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crossedTotalXpMillions, totalXpLabel, totalXpOf } from '../src/lib/totalXpMilestones.ts';

// Total-XP steps are stored in millions (member_milestones.threshold is int4; total XP reaches 4.6B),
// and must never fire off an unknown "before" — that would announce a whole account's history.

test('a single 50M step crossed', () => {
  assert.deepEqual(crossedTotalXpMillions(49_900_000, 50_000_000), [50]);
  assert.deepEqual(crossedTotalXpMillions(149_000_000, 151_000_000), [150]);
});

test('no step when the gain stays inside one band, or nothing moved', () => {
  assert.deepEqual(crossedTotalXpMillions(50_000_000, 99_999_999), []);
  assert.deepEqual(crossedTotalXpMillions(120_000_000, 120_000_000), []);
  assert.deepEqual(crossedTotalXpMillions(130_000_000, 120_000_000), []);
});

test('sitting exactly on a step does not re-cross it', () => {
  assert.deepEqual(crossedTotalXpMillions(100_000_000, 120_000_000), []);
});

test('several steps at once are all reported', () => {
  assert.deepEqual(crossedTotalXpMillions(40_000_000, 160_000_000), [50, 100, 150]);
});

test('past int4 range the millions still fit', () => {
  assert.deepEqual(crossedTotalXpMillions(4_190_000_000, 4_210_000_000), [4200]);
});

test('an unknown before (unranked overall reads 0) crosses nothing', () => {
  assert.deepEqual(crossedTotalXpMillions(0, 2_000_000_000), []);
});

test('totalXpOf reads overall and treats missing or -1 as unknown', () => {
  assert.equal(totalXpOf({ skills: { overall: { rank: 1, level: 2277, xp: 4_600_000_000 } }, bosses: {} }), 4_600_000_000);
  assert.equal(totalXpOf({ skills: { overall: { rank: -1, level: -1, xp: -1 } }, bosses: {} }), 0);
  assert.equal(totalXpOf({ skills: {}, bosses: {} }), 0);
  assert.equal(totalXpOf(null), 0);
});

test('labels read in M below a billion and B above', () => {
  assert.equal(totalXpLabel(50), '50M');
  assert.equal(totalXpLabel(950), '950M');
  assert.equal(totalXpLabel(1000), '1B');
  assert.equal(totalXpLabel(1050), '1.05B');
  assert.equal(totalXpLabel(4600), '4.6B');
});
