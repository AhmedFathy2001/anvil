// KC / XP from a game-mode world on a board that counts that mode (lib/modeStats): the readings a
// push leaves on the board row, and the gain they add — from the mode's own first reading, never the
// main game's hiscores baseline, and never summed on top of the main game's gain.
//
// Run: npx tsx --test tests/mode-stats.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { countedModes, mergeModePush, milestoneWithModes, parseModeStats, statGainWithModes } from '../src/lib/modeStats.ts';

const snap = (zulrah: number, attackXp = 0) =>
  JSON.stringify({ skills: { overall: { rank: 1, xp: attackXp }, attack: { rank: 1, xp: attackXp } }, bosses: { zulrah: { rank: 1, score: zulrah } }, clues: {} });

test('a push sets each key’s first reading once and only ever raises the current one', () => {
  let json = mergeModePush(null, 'hardcore', { zulrah: 3 });
  assert.deepEqual(parseModeStats(json), { hardcore: { first: { zulrah: 3 }, cur: { zulrah: 3 } } });
  json = mergeModePush(json, 'hardcore', { zulrah: 7, attack: 500 });
  assert.deepEqual(parseModeStats(json).hardcore, { first: { zulrah: 3, attack: 500 }, cur: { zulrah: 7, attack: 500 } });
  assert.equal(mergeModePush(json, 'hardcore', { zulrah: 5 }), null, 'a lower reading changes nothing');
  json = mergeModePush(json, 'leagues', { zulrah: 40 });
  assert.equal(parseModeStats(json).hardcore.cur.zulrah, 7, 'modes are kept apart');
  assert.equal(parseModeStats(json).leagues.first.zulrah, 40);
});

test('garbage reads as no readings', () => {
  assert.deepEqual(parseModeStats('nope'), {});
  assert.deepEqual(parseModeStats('[1]'), {});
  assert.deepEqual(parseModeStats(JSON.stringify({ hardcore: { first: { zulrah: -1, x: 'a' }, cur: null } })), { hardcore: { first: {}, cur: {} } });
});

test('a kill count counts from its first reading, that first kill included', () => {
  const modes = mergeModePush(mergeModePush(null, 'hardcore', { zulrah: 1 }), 'hardcore', { zulrah: 5 });
  // Main baseline says 0 Zulrah and main hiscores haven't moved: the mode's 5 kills are the gain.
  assert.equal(statGainWithModes(snap(0), snap(0), {}, ['zulrah'], 'boss', modes, ['hardcore']), 5);
});

test('XP counts from its first reading with nothing added (the login push carries no gain)', () => {
  const modes = mergeModePush(mergeModePush(null, 'hardcore', { attack: 1000 }), 'hardcore', { attack: 4000 });
  assert.equal(statGainWithModes(snap(0, 0), snap(0, 0), {}, ['attack'], 'skill', modes, ['hardcore']), 3000);
  assert.equal(statGainWithModes(snap(0, 0), snap(0, 0), {}, ['overall'], 'skill', modes, ['hardcore']), 3000, 'total XP sums the mode’s skills');
});

test('a mode save’s numbers are never measured against the main game’s baseline', () => {
  // A Leagues save of a main with 500 Zulrah KC: the main baseline is 500, the Leagues save is at 20.
  const modes = mergeModePush(mergeModePush(null, 'leagues', { zulrah: 20 }), 'leagues', { zulrah: 30 });
  assert.equal(statGainWithModes(snap(500), snap(500), {}, ['zulrah'], 'boss', modes, ['leagues']), 11);
  // And progress the save had before the board started is not counted: first reading 400, now 402.
  const late = mergeModePush(mergeModePush(null, 'leagues', { zulrah: 400 }), 'leagues', { zulrah: 402 });
  assert.equal(statGainWithModes(snap(0), snap(0), {}, ['zulrah'], 'boss', late, ['leagues']), 3);
});

test('main and mode progress combine as the larger per key, never the sum', () => {
  const modes = mergeModePush(mergeModePush(null, 'hardcore', { zulrah: 1 }), 'hardcore', { zulrah: 4 });
  // Main hiscores show +10, the mode +4: 10, not 14.
  assert.equal(statGainWithModes(snap(0), snap(10), {}, ['zulrah'], 'boss', modes, ['hardcore']), 10);
  // The mode ahead: 4 over the main's 2.
  assert.equal(statGainWithModes(snap(0), snap(2), {}, ['zulrah'], 'boss', modes, ['hardcore']), 4);
});

test('a mode the board does not count adds nothing, and no modes is exactly the main-game gain', () => {
  const modes = mergeModePush(mergeModePush(null, 'hardcore', { zulrah: 1 }), 'hardcore', { zulrah: 50 });
  assert.equal(statGainWithModes(snap(0), snap(2), {}, ['zulrah'], 'boss', modes, []), 2);
  assert.equal(statGainWithModes(snap(0), snap(2), {}, ['zulrah'], 'boss', modes, ['leagues']), 2);
  assert.equal(statGainWithModes(snap(0), snap(2), { zulrah: 6 }, ['zulrah'], 'boss', null, ['hardcore']), 6);
});

test('the mode gain needs no hiscores baseline (a fresh character is not on the hiscores)', () => {
  const modes = mergeModePush(mergeModePush(null, 'hardcore', { zulrah: 1 }), 'hardcore', { zulrah: 3 });
  assert.equal(statGainWithModes(null, null, {}, ['zulrah'], 'boss', modes, ['hardcore']), 3);
});

test('a milestone on a mode save: eligible only when its first reading was under the goal', () => {
  const none = { lifetime: 0, eligible: false, reached: false };
  const crossed = mergeModePush(mergeModePush(null, 'hardcore', { zulrah: 90 }), 'hardcore', { zulrah: 100 });
  assert.deepEqual(milestoneWithModes(none, crossed, ['hardcore'], ['zulrah'], 'boss', 100), { lifetime: 100, eligible: true, reached: true });
  const already = mergeModePush(mergeModePush(null, 'hardcore', { zulrah: 101 }), 'hardcore', { zulrah: 120 });
  assert.deepEqual(milestoneWithModes(none, already, ['hardcore'], ['zulrah'], 'boss', 100), none);
  assert.deepEqual(milestoneWithModes(none, crossed, [], ['zulrah'], 'boss', 100), none, 'not counted, not considered');
});

test('countedModes reads the board’s rules', () => {
  assert.deepEqual(countedModes({ worldModes: ['hardcore'] }), ['hardcore']);
  assert.deepEqual(countedModes(null), []);
});
