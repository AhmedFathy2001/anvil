import { test } from 'node:test';
import assert from 'node:assert/strict';
import { milestoneState, computeGain, isMilestoneBasis } from '../src/lib/statTracking.ts';

// Milestone tiles ("get your first Quiver", "your first Inferno cape") ask a different question from
// every other stat tile: not how far you moved during the event, but whether you CROSSED a lifetime
// threshold while it was running.
//
// The difference is one gate, and the gate is the whole feature. Without it, `TzKal-Zuk >= 1`
// completes instantly for anyone who ever finished the Inferno — the exact opposite of "first". So
// most of what's pinned here is the veteran staying locked out.

const snap = (bosses: Record<string, number>) =>
  ({ bosses: Object.fromEntries(Object.entries(bosses).map(([k, score]) => [k, { score }])) }) as never;

const NO_LIVE: Record<string, number> = {};

test('a first-timer completes it: baseline below the goal, lifetime now at it', () => {
  const s = milestoneState(snap({ solHeredit: 0 }), snap({ solHeredit: 1 }), NO_LIVE, ['solHeredit'], 'boss', 1);
  assert.deepEqual(s, { lifetime: 1, eligible: true, reached: true });
});

test('a veteran never completes it, however many more they do', () => {
  // Woox already had 7 Colosseum completions when the event started.
  const before = snap({ solHeredit: 7 });
  const s = milestoneState(before, snap({ solHeredit: 8 }), NO_LIVE, ['solHeredit'], 'boss', 1);
  assert.equal(s.eligible, false, 'baseline was already at/above the goal');
  assert.equal(s.reached, false, 'so the tile can never credit for them');
  // …and it stays false no matter how far they go. This is the case a plain `current >= goal`
  // check gets wrong, and it is the reason milestoneState exists.
  const later = milestoneState(before, snap({ solHeredit: 200 }), NO_LIVE, ['solHeredit'], 'boss', 1);
  assert.equal(later.reached, false);
});

test('exactly at the goal already counts as "had it" — not "one away"', () => {
  // baseline === goal is the boundary. Someone with exactly one Quiver has one; they can't get a
  // first one again.
  const s = milestoneState(snap({ solHeredit: 1 }), snap({ solHeredit: 2 }), NO_LIVE, ['solHeredit'], 'boss', 1);
  assert.equal(s.eligible, false);
});

test('unranked hiscores (−1) floors to 0, so a genuine first-timer qualifies', () => {
  // A player who has never killed it isn't 0 on the hiscores — they're absent, which parses as −1.
  // If that leaked through as a negative baseline the gate would still pass, but `lifetime` would be
  // wrong; and a −1 CURRENT must never read as "has it".
  const s = milestoneState(snap({ tzKalZuk: -1 }), snap({ tzKalZuk: 1 }), NO_LIVE, ['tzKalZuk'], 'boss', 1);
  assert.deepEqual(s, { lifetime: 1, eligible: true, reached: true });

  const notYet = milestoneState(snap({ tzKalZuk: -1 }), snap({ tzKalZuk: -1 }), NO_LIVE, ['tzKalZuk'], 'boss', 1);
  assert.equal(notYet.lifetime, 0);
  assert.equal(notYet.reached, false);
});

test('a live plugin push counts before the hiscores catch up', () => {
  // The KC chat line carries the absolute count and is pushed immediately; hiscores only flush on
  // logout and refresh hourly. The tile must credit off the push, not wait an hour.
  const s = milestoneState(snap({ solHeredit: 0 }), snap({ solHeredit: 0 }), { solHeredit: 1 }, ['solHeredit'], 'boss', 1);
  assert.equal(s.reached, true);
});

test('composite keys sum on both sides', () => {
  // A CoX + CoX:CM tile counts a member's lifetime across both, and gates on their combined baseline.
  const keys = ['chambersOfXeric', 'chambersOfXericChallengeMode'];
  const fresh = milestoneState(
    snap({ chambersOfXeric: 0, chambersOfXericChallengeMode: 0 }),
    snap({ chambersOfXeric: 3, chambersOfXericChallengeMode: 2 }),
    NO_LIVE, keys, 'boss', 5,
  );
  assert.deepEqual(fresh, { lifetime: 5, eligible: true, reached: true });

  // Someone already past the combined goal is locked out even if one half is untouched.
  const veteran = milestoneState(
    snap({ chambersOfXeric: 6, chambersOfXericChallengeMode: 0 }),
    snap({ chambersOfXeric: 9, chambersOfXericChallengeMode: 0 }),
    NO_LIVE, keys, 'boss', 5,
  );
  assert.equal(veteran.eligible, false);
});

test('career milestones behave the same as a goal of 1', () => {
  // "Reach 500 Zulrah" — completes for someone who goes 480 → 500 during the event…
  const crossing = milestoneState(snap({ zulrah: 480 }), snap({ zulrah: 500 }), NO_LIVE, ['zulrah'], 'boss', 500);
  assert.equal(crossing.reached, true);
  // …and not for someone who was already past it.
  const past = milestoneState(snap({ zulrah: 600 }), snap({ zulrah: 620 }), NO_LIVE, ['zulrah'], 'boss', 500);
  assert.equal(past.reached, false);
  // Below the goal and still climbing: eligible, not yet reached.
  const climbing = milestoneState(snap({ zulrah: 480 }), snap({ zulrah: 499 }), NO_LIVE, ['zulrah'], 'boss', 500);
  assert.deepEqual(climbing, { lifetime: 499, eligible: true, reached: false });
});

test('this is genuinely different from the gain the same numbers produce', () => {
  // The veteran GAINED one Colosseum during the event, so a gain tile would credit them. A milestone
  // tile must not. Same snapshots, opposite answers — that's the whole distinction.
  const before = snap({ solHeredit: 7 });
  const after = snap({ solHeredit: 8 });
  assert.equal(computeGain(before, after, NO_LIVE, ['solHeredit'], 'boss'), 1, 'gain tile: credited');
  assert.equal(milestoneState(before, after, NO_LIVE, ['solHeredit'], 'boss', 1).reached, false, 'milestone: not');
});

test('skills work too — first 99, or a total-XP milestone', () => {
  const snapSkill = (skills: Record<string, number>) =>
    ({ skills: Object.fromEntries(Object.entries(skills).map(([k, xp]) => [k, { xp }])) }) as never;
  const s = milestoneState(snapSkill({ slayer: 12_000_000 }), snapSkill({ slayer: 13_100_000 }), NO_LIVE, ['slayer'], 'skill', 13_034_431);
  assert.equal(s.reached, true, 'crossed 99 Slayer during the event');
  const already = milestoneState(snapSkill({ slayer: 14_000_000 }), snapSkill({ slayer: 15_000_000 }), NO_LIVE, ['slayer'], 'skill', 13_034_431);
  assert.equal(already.reached, false, 'already had 99 before it started');
});

test('missing snapshots are treated as zero, not as a crash', () => {
  const s = milestoneState(null, null, NO_LIVE, ['solHeredit'], 'boss', 1);
  assert.deepEqual(s, { lifetime: 0, eligible: true, reached: false });
});

test('isMilestoneBasis: only the explicit value opts in', () => {
  assert.equal(isMilestoneBasis('milestone'), true);
  assert.equal(isMilestoneBasis('gain'), false);
  // Everything that isn't the opt-in — including a tile written before the column existed — stays
  // on gains, so nothing already running changes behaviour.
  assert.equal(isMilestoneBasis(null), false);
  assert.equal(isMilestoneBasis(undefined), false);
  assert.equal(isMilestoneBasis(''), false);
});
