// A missing baseline is not a baseline of zero.
//
// Run: npx tsx --test tests/stat-baseline.test.ts
//
// Gains are current − baseline, and snapshotValue() answers 0 for a snapshot it doesn't have. That's
// right for a missing KEY — they were unranked when the event started — and catastrophic for a
// missing SNAPSHOT, because then the gain is the player's entire account.
//
// It showed up as a member completing "2m Woodcutting XP" without cutting a single log: 4.5m of
// lifetime XP, no starting stats captured, and the board read it as 4.5m gained (100%). The admin
// page was already saying "gains won't track until a baseline is captured" next to a row claiming
// 100% — the warning was right and the arithmetic disagreed with it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeGain, computeGainFromJson } from '../src/lib/statTracking.ts';

const skills = (m: Record<string, number>) =>
  ({ skills: Object.fromEntries(Object.entries(m).map(([k, xp]) => [k, { xp }])) }) as never;
const bosses = (m: Record<string, number>) =>
  ({ bosses: Object.fromEntries(Object.entries(m).map(([k, score]) => [k, { score }])) }) as never;

const NO_LIVE: Record<string, number> = {};

test('no baseline scores nothing — not the whole account', () => {
  // The reported bug: 4.5m lifetime Woodcutting, no starting stats, a 2m goal.
  const gained = computeGain(null, skills({ woodcutting: 4_580_360 }), NO_LIVE, ['woodcutting'], 'skill');
  assert.equal(gained, 0, 'an untracked player gains nothing until a baseline exists');
});

test('a baseline that exists but lacks the key still means zero — they were unranked', () => {
  // The distinction that makes this subtle. An empty snapshot IS a reading: we looked, and they had
  // no Woodcutting XP. Everything since is a genuine gain.
  const gained = computeGain(skills({ fishing: 1_000 }), skills({ woodcutting: 50_000, fishing: 1_000 }), NO_LIVE, ['woodcutting'], 'skill');
  assert.equal(gained, 50_000);
});

test('an ordinary baseline is unaffected', () => {
  const gained = computeGain(skills({ woodcutting: 4_000_000 }), skills({ woodcutting: 4_580_360 }), NO_LIVE, ['woodcutting'], 'skill');
  assert.equal(gained, 580_360);
});

test('a live plugin push cannot smuggle the account in either', () => {
  // The overlay is max(hiscores, pushed), so without this it would be the same bug by another route.
  const gained = computeGain(null, null, { zulrah: 1_204 }, ['zulrah'], 'boss');
  assert.equal(gained, 0);
});

test('the JSON path agrees with the parsed one', () => {
  // players.statsSnapshot is null before a baseline is captured, and '' on a row that was cleared.
  assert.equal(computeGainFromJson(null, JSON.stringify(bosses({ zulrah: 900 })), NO_LIVE, ['zulrah'], 'boss'), 0);
  assert.equal(computeGainFromJson('', JSON.stringify(bosses({ zulrah: 900 })), NO_LIVE, ['zulrah'], 'boss'), 0);
  // Malformed JSON parses to null, which must fail the same safe way rather than counting everything.
  assert.equal(computeGainFromJson('{not json', JSON.stringify(bosses({ zulrah: 900 })), NO_LIVE, ['zulrah'], 'boss'), 0);
});

test('composite keys are all-or-nothing on the baseline, not per key', () => {
  const keys = ['chambersOfXeric', 'chambersOfXericChallengeMode'];
  assert.equal(computeGain(null, bosses({ chambersOfXeric: 80, chambersOfXericChallengeMode: 12 }), NO_LIVE, keys, 'boss'), 0);
});

// ── The admin "Stat tile standings" page ────────────────────────────────────────────────────────
//
// That page had its own copy of the arithmetic — `Math.max(0, current - baseline)` — so fixing
// computeGain didn't reach it, and it kept showing "+4,580,360 (100%)" on a row it was itself
// flagging as having no baseline. It computed `hasBaseline` and then ignored it. These pin the
// behaviour it now shares, so the next fix to the rule reaches every surface at once.

test('the standings row for a player with no baseline gains nothing', () => {
  const gained = computeGainFromJson(null, JSON.stringify(skills({ woodcutting: 4_580_360 })), NO_LIVE, ['woodcutting'], 'skill');
  assert.equal(gained, 0);
});

test('a composite tile clamps per key, so one stat falling cannot eat another rising', () => {
  // Subtracting summed totals let a key that DROPPED (a hiscores correction, a rollback) net off
  // against one that rose. Per-key clamping is what actually scores, so the page now agrees with it.
  const keys = ['chambersOfXeric', 'chambersOfXericChallengeMode'];
  const before = JSON.stringify(bosses({ chambersOfXeric: 100, chambersOfXericChallengeMode: 50 }));
  const after = JSON.stringify(bosses({ chambersOfXeric: 110, chambersOfXericChallengeMode: 40 }));
  assert.equal(computeGainFromJson(before, after, NO_LIVE, keys, 'boss'), 10, 'the +10 stands; the −10 is not a debt');
});
