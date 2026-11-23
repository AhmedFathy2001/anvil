// OSRS shorthand in the tile creator (lib/taskMatch SHORTHANDS, lib/constants SKILL_ALIASES): the
// names clans type for skills and bosses, read with no clan context, as `matchTasks` sees a bare line.
//
// Run: npx tsx --test tests/shorthand-match.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyMatches, matchTasks } from '../src/lib/taskMatch.ts';

const top = (q: string) => matchTasks(q)[0];

test('skill shorthand lands on the skill, never Total XP', () => {
  const cases: [string, string][] = [
    ['1m agi xp', 'agility'], ['1m thieve xp', 'thieving'], ['1m mine xp', 'mining'], ['1m mage xp', 'magic'],
    ['1m att xp', 'attack'], ['1m rcing xp', 'runecraft'], ['1m wcing xp', 'woodcutting'], ['1m fming xp', 'firemaking'],
    ['1m rune crafting xp', 'runecraft'],
    // Already right, kept that way.
    ['1m rc xp', 'runecraft'], ['1m wc xp', 'woodcutting'], ['1m fm xp', 'firemaking'], ['1m mining xp', 'mining'],
    ['1m fishing xp', 'fishing'], ['1m str xp', 'strength'], ['1m def xp', 'defence'], ['1m hp xp', 'hitpoints'],
    ['1m con xp', 'construction'], ['1m hunt xp', 'hunter'], ['1m crafting xp', 'crafting'],
  ];
  for (const [q, stat] of cases) {
    const c = top(q);
    assert.equal(c?.config.trackedStat, stat, q);
    assert.equal(classifyMatches(matchTasks(q)).status, 'ready', q);
  }
});

test('an unknown skill word is a question, not a Total XP tile', () => {
  assert.notEqual(classifyMatches(matchTasks('1m foo xp')).status, 'ready');
});

test('boss shorthand', () => {
  const cases: [string, string][] = [
    ['50 gg kc', 'grotesqueGuardians'],
    ['50 verzik kc', 'theatreOfBlood,theatreOfBloodHardMode'],
    ['50 sote kc', 'theatreOfBlood,theatreOfBloodHardMode'],
    ['50 warden kc', 'tombsOfAmascut,tombsOfAmascutExpertMode'],
    ['50 wardens kc', 'tombsOfAmascut,tombsOfAmascutExpertMode'],
    ['50 cm kc', 'chambersOfXericChallengeMode'],
    ['50 brother kc', 'barrows'],
    ['50 dk kc', 'dagannothPrime,dagannothRex,dagannothSupreme'],
    ['50 cgs', 'corruptedGauntlet'],
    // Already right, kept that way.
    ['50 olm kc', 'chambersOfXeric,chambersOfXericChallengeMode'],
    ['50 cox cm', 'chambersOfXericChallengeMode'],
    ['50 toa kc', 'tombsOfAmascut,tombsOfAmascutExpertMode'],
    ['50 toa expert', 'tombsOfAmascutExpertMode'],
    ['50 hmt kc', 'theatreOfBloodHardMode'],
    ['50 cg kc', 'corruptedGauntlet'],
    ['50 colo', 'solHeredit'],
    ['50 arax kc', 'araxxor'],
    ['50 huey kc', 'hueycoatl'],
    ['50 dks kc', 'dagannothPrime,dagannothRex,dagannothSupreme'],
    ['50 zily kc', 'commanderZilyana'],
    ['50 sara kc', 'commanderZilyana'],
    ['50 bando kc', 'generalGraardor'],
    ['50 corp kc', 'corporealBeast'],
    ['50 kq kc', 'kalphiteQueen'],
    ['50 jad kc', 'tzTokJad'],
    ['50 zuk kc', 'tzKalZuk'],
    ['50 moons', 'lunarChests'],
    ['50 tempo', 'tempoross'],
    ['50 pnm kc', 'phosanisNightmare'],
    ['50 dt2 kc', 'dukeSucellus,leviathan,vardorvis,whisperer'],
  ];
  for (const [q, stat] of cases) assert.equal(top(q)?.config.trackedStat, stat, q);
  // Bosses the hiscores don't key: still the boss, by kill tile.
  assert.match(top('50 vard kc')!.title, /Vardorvis/);
  assert.match(top('50 levi kc')!.title, /Leviathan/);
  assert.match(top('50 gotr')!.title, /Guardians of the Rift/);
});
