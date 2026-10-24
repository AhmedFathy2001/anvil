// "Kills" — one authoring kind; the counting source is picked from the monsters chosen.
//
// Run: npx tsx --test tests/kill-source.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseKillSource,
  hiscoresKeyForMonster,
  killLineNameForKey,
  killMilestoneToPost,
  killPick,
  killSourceOf,
  usesKillMilestones,
} from '../src/lib/killSource';

test('all-hiscores bosses save as a hiscores boss tile, keys summed in one trackedStat', () => {
  const r = chooseKillSource(['Zulrah', 'Vorkath']);
  assert.equal(r.ok, true);
  if (!r.ok || r.source !== 'hiscores') throw new Error('expected hiscores');
  assert.equal(r.trackedStat, 'zulrah,vorkath');
});

test('keys, labels and kill-line spellings all resolve to the same hiscores key', () => {
  assert.equal(hiscoresKeyForMonster('chambersOfXericChallengeMode'), 'chambersOfXericChallengeMode');
  assert.equal(hiscoresKeyForMonster('CoX: CM'), 'chambersOfXericChallengeMode');
  assert.equal(hiscoresKeyForMonster('Chambers of Xeric Challenge Mode'), 'chambersOfXericChallengeMode');
  assert.equal(hiscoresKeyForMonster('Theatre of Blood: Hard Mode'), 'theatreOfBloodHardMode');
  assert.equal(hiscoresKeyForMonster('The Leviathan'), 'leviathan');
  assert.equal(hiscoresKeyForMonster('Leviathan'), 'leviathan');
  assert.equal(hiscoresKeyForMonster('The Nightmare'), 'nightmare');
  assert.equal(hiscoresKeyForMonster('Thermonuclear Smoke Devil'), 'thermonuclearSmokeDevil');
  assert.equal(hiscoresKeyForMonster("Kree'Arra"), 'kreeArra');
});

test('short search aliases are not monster names — a slayer Hydra is not the Alchemical Hydra', () => {
  assert.equal(hiscoresKeyForMonster('Hydra'), null);
  assert.equal(hiscoresKeyForMonster('raids'), null);
  assert.equal(hiscoresKeyForMonster('Chicken'), null);
  // Off-hiscores modes stay off.
  assert.equal(hiscoresKeyForMonster('Theatre of Blood: Entry Mode'), null);
  assert.equal(hiscoresKeyForMonster('Vardorvis (awakened)'), null);
});

test('anything off the hiscores makes it a plugin tile', () => {
  const r = chooseKillSource(['Chicken', 'Cow']);
  assert.deepEqual(r, { ok: true, source: 'plugin', targetNpcs: ['Chicken', 'Cow'], mixed: false });
});

test('a mixed selection is counted entirely by the plugin, never two sources summed', () => {
  const r = chooseKillSource(['zulrah', 'Chicken', 'chambersOfXericChallengeMode']);
  assert.equal(r.ok, true);
  if (!r.ok || r.source !== 'plugin') throw new Error('expected plugin');
  assert.equal(r.mixed, true);
  // Hiscores picks become the kill-count-line names the plugin matches (CoX CM: NO colon).
  assert.deepEqual(r.targetNpcs, ['Zulrah', 'Chicken', 'Chambers of Xeric Challenge Mode']);
});

test('free names are kept verbatim; picks dedupe', () => {
  const r = chooseKillSource([{ name: 'The Leviathan', key: 'leviathan' }, 'Cow', 'cow']);
  if (!r.ok || r.source !== 'plugin') throw new Error('expected plugin');
  assert.deepEqual(r.targetNpcs, ['The Leviathan', 'Cow']);
  const h = chooseKillSource(['Zulrah', 'zulrah']);
  if (!h.ok || h.source !== 'hiscores') throw new Error('expected hiscores');
  assert.equal(h.trackedStat, 'zulrah');
});

test('kill-line names for raid modes and article bosses', () => {
  assert.equal(killLineNameForKey('chambersOfXericChallengeMode'), 'Chambers of Xeric Challenge Mode');
  assert.equal(killLineNameForKey('tombsOfAmascutExpertMode'), 'Tombs of Amascut: Expert Mode');
  assert.equal(killLineNameForKey('whisperer'), 'Whisperer');
  assert.equal(killLineNameForKey('zulrah'), 'Zulrah');
  assert.equal(killLineNameForKey('riftsClosed'), null);
  assert.deepEqual(killPick('vorkath'), { name: 'Vorkath', key: 'vorkath' });
});

test('hiscores-only counters (clues, GOTR) cannot ride on a plugin tile', () => {
  assert.equal(chooseKillSource(['riftsClosed']).ok, true);
  const r = chooseKillSource(['riftsClosed', 'Chicken']);
  assert.equal(r.ok, false);
});

test('a frozen source never converts', () => {
  // Started hiscores tile: an off-hiscores monster is refused rather than flipping it to the plugin.
  const h = chooseKillSource(['Zulrah', 'Chicken'], 'hiscores');
  assert.equal(h.ok, false);
  // Started plugin tile: an all-hiscores selection STAYS a plugin tile.
  const p = chooseKillSource(['Zulrah'], 'plugin');
  assert.deepEqual(p, { ok: true, source: 'plugin', targetNpcs: ['Zulrah'], mixed: false });
  assert.equal(chooseKillSource([]).ok, false);
});

test('killSourceOf reads the two stored shapes', () => {
  assert.equal(killSourceOf({ tileType: 'kill' }), 'plugin');
  assert.equal(killSourceOf({ tileType: 'standard', statType: 'boss' }), 'hiscores');
  assert.equal(killSourceOf({ tileType: 'standard', statType: 'skill' }), null);
  assert.equal(killSourceOf({ tileType: 'drop' }), null);
});

test('milestone posts: 25/50/75 crossed, completion is not a milestone', () => {
  assert.equal(killMilestoneToPost(0, 1, 100), null);
  assert.equal(killMilestoneToPost(24, 25, 100), 25);
  assert.equal(killMilestoneToPost(25, 26, 100), null);
  assert.equal(killMilestoneToPost(49, 50, 100), 50);
  assert.equal(killMilestoneToPost(74, 80, 100), 75);
  // One big jump crossing several reports the highest once.
  assert.equal(killMilestoneToPost(10, 80, 100), 75);
  assert.equal(killMilestoneToPost(80, 100, 100), null);
  // Odd goals round the threshold up: 25% of 10 is reached at 3.
  assert.equal(killMilestoneToPost(2, 3, 10), 25);
  assert.equal(killMilestoneToPost(1, 2, 10), null);
});

test('small goals only post the completion', () => {
  for (let goal = 1; goal <= 4; goal++) {
    for (let n = 1; n <= goal; n++) assert.equal(killMilestoneToPost(n - 1, n, goal), null);
  }
  assert.equal(killMilestoneToPost(1, 2, 5), 25);
  assert.equal(killMilestoneToPost(null, 2, 5), null);
});

test('only marked plugin kill tiles use milestones — legacy (NULL) tiles keep per-kill posts', () => {
  assert.equal(usesKillMilestones({ tileType: 'kill', killPosts: 'milestones' }), true);
  assert.equal(usesKillMilestones({ tileType: 'kill', killPosts: null }), false);
  assert.equal(usesKillMilestones({ tileType: 'drop', killPosts: 'milestones' }), false);
});

test('a raid on the hiscores can be counted by the plugin when the host asks (shared raids)', () => {
  const hiscores = chooseKillSource(['chambersOfXeric']);
  assert.equal(hiscores.ok && hiscores.source, 'hiscores');
  const plugin = chooseKillSource(['chambersOfXeric'], null, true);
  assert.ok(plugin.ok && plugin.source === 'plugin');
  assert.deepEqual(plugin.ok && plugin.source === 'plugin' ? plugin.targetNpcs : null, ['Chambers of Xeric']);
  // A started event's frozen source wins over the preference.
  const frozen = chooseKillSource(['chambersOfXeric'], 'hiscores', true);
  assert.equal(frozen.ok && frozen.source, 'hiscores');
});
