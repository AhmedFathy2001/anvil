import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { HiscoresSnapshot } from '../src/lib/hiscores';
import {
  maxGain,
  checkCount,
  kcLineClaims,
  checkKcLine,
  lapXpFloor,
  checkLaps,
  firstServiceKills,
  longHours,
} from '../src/lib/footprint';

function snap(bosses: Record<string, number>, agility = 0, extra: Partial<HiscoresSnapshot> = {}): HiscoresSnapshot {
  return {
    skills: { agility: { rank: 1, level: 1, xp: agility } },
    bosses: Object.fromEntries(Object.entries(bosses).map(([k, v]) => [k, { rank: v < 0 ? -1 : 1, score: v }])),
    ...extra,
  };
}

test('kill counts: unranked start reads as 0, unranked now / partial start are uncheckable', () => {
  assert.equal(maxGain(snap({ zulrah: 100 }), snap({ zulrah: 112 }), 'zulrah'), 12);
  assert.equal(maxGain(snap({ zulrah: -1 }), snap({ zulrah: 7 }), 'zulrah'), 7);
  assert.equal(maxGain(snap({}), snap({ zulrah: -1 }), 'zulrah'), null);
  assert.equal(maxGain(snap({}, 0, { partial: true }), snap({ zulrah: 7 }), 'zulrah'), null);
  assert.equal(checkCount(12, 12), 'ok');
  assert.equal(checkCount(13, 12), 'short');
  assert.equal(checkCount(3, null), 'unchecked');
});

test('KC lines on a proof: tracked names only, commas and "completed" phrasing', () => {
  assert.deepEqual(
    kcLineClaims([
      { text: 'Your Zulrah kill count is: 1,512.' },
      { text: 'Your completed Chambers of Xeric count is: 41.' },
      { text: 'Your Chicken kill count is: 5.' },
      { text: 'Valuable drop: Tanzanite fang (1 coins)' },
    ]),
    [{ key: 'zulrah', kc: 1512 }, { key: 'chambersOfXeric', kc: 41 }],
  );
});

test('a printed KC must be one the hiscores reached, and past the starting line', () => {
  const base = snap({ zulrah: 500 });
  const now = snap({ zulrah: 520 });
  assert.equal(checkKcLine({ key: 'zulrah', kc: 512 }, base, now), 'ok');
  assert.equal(checkKcLine({ key: 'zulrah', kc: 530 }, base, now), 'short'); // never reached
  assert.equal(checkKcLine({ key: 'zulrah', kc: 498 }, base, now), 'short'); // from before the start
  assert.equal(checkKcLine({ key: 'zulrah', kc: 3 }, snap({}), snap({ zulrah: -1 })), 'unchecked');
});

test('laps: only a gross Agility XP shortfall flags', () => {
  const floor = lapXpFloor(['Ardougne Rooftop']);
  assert.equal(floor, 700);
  assert.equal(lapXpFloor(['Ardougne Rooftop', 'Werewolf Skullball']), null);
  assert.equal(lapXpFloor(['Hallowed Sepulchre Floor 5', 'Hallowed Sepulchre']), 450);
  // 100 laps need ≥ 35k XP (half of 100 × 700).
  assert.equal(checkLaps(100, floor, snap({}, 1_000_000), snap({}, 1_036_000)), 'ok');
  assert.equal(checkLaps(100, floor, snap({}, 1_000_000), snap({}, 1_020_000)), 'short');
});

test('first service kill: unranked before, ranked now; a partial start says nothing', () => {
  assert.deepEqual(firstServiceKills(snap({ tzKalZuk: -1, zulrah: 50 }), snap({ tzKalZuk: 1, zulrah: 60 })), ['tzKalZuk']);
  assert.deepEqual(firstServiceKills(snap({ tzKalZuk: 3 }), snap({ tzKalZuk: 4 })), []);
  assert.deepEqual(firstServiceKills(snap({}, 0, { partial: true }), snap({ tzKalZuk: 1 })), []);
});

test('long hours: a day holding more efficient hours than one person plays', () => {
  const from = snap({ zulrah: 0 });
  // Zulrah's EHB rate is a few dozen kills an hour, so 3000 kills is far more than 24h of play.
  assert.ok(longHours(from, snap({ zulrah: 3000 }), 24)! > 18);
  assert.equal(longHours(from, snap({ zulrah: 30 }), 24), null);
  assert.equal(longHours(from, snap({ zulrah: 3000 }), 10), null); // window too short to judge
});

test('KC line phrasings: chest counts and words before the name', () => {
  assert.deepEqual(
    kcLineClaims([{ text: 'Your Barrows chest count is: 88.' }, { text: 'Your subdued Wintertodt count is: 12.' }]).map((c) => c.key),
    ['barrows', 'wintertodt'],
  );
  // No baseline floor given (a late joiner's): only the "reached" half applies.
  assert.equal(checkKcLine({ key: 'zulrah', kc: 498 }, null, snap({ zulrah: 520 })), 'ok');
});

test('clue tallies, collection log and combat tasks read off proof lines', async () => {
  const { newClogItems, caTaskKeys, kcOf } = await import('../src/lib/footprint');
  assert.deepEqual(kcLineClaims([{ text: 'You have completed 41 elite Treasure Trails.' }]), [{ key: 'cluesElite', kc: 41 }]);
  assert.deepEqual(newClogItems([{ text: 'New item added to your collection log: Tanzanite fang' }]), ['tanzanite fang']);
  assert.deepEqual(caTaskKeys([{ text: "Congratulations, you've completed an easy combat task: Barrows Novice (1 point)." }]), ['barrows']);
  // Activities are read by their path; unranked is unknown.
  const s = { skills: {}, bosses: {}, clues: { elite: { rank: 5, score: 41 } }, collectionsLogged: { rank: -1, score: -1 } } as unknown as HiscoresSnapshot;
  assert.equal(kcOf(s, 'cluesElite'), 41);
  assert.equal(kcOf(s, 'collectionsLogged'), null);
});

test('mob kills, gathering gains and "did it move at all"', async () => {
  const { killHpFloor, checkMobKills, gainXpFloor, checkGain, checkMoved, countKeyFor } = await import('../src/lib/footprint');
  const hp = (xp: number) => ({ skills: { hitpoints: { rank: 1, level: 1, xp } }, bosses: {} }) as HiscoresSnapshot;
  assert.equal(killHpFloor(['Hill Giant']), 35);
  assert.equal(killHpFloor(['Hill Giant', 'Made-up thing']), null);
  // 100 hill giants: ≥ half of 100 × 35 × 1.33 ≈ 2328 HP XP.
  assert.equal(checkMobKills(100, 35, hp(10_000), hp(13_000)), 'ok');
  assert.equal(checkMobKills(100, 35, hp(10_000), hp(10_500)), 'short');
  const fish = (xp: number) => ({ skills: { fishing: { rank: 1, level: 1, xp } }, bosses: {} }) as HiscoresSnapshot;
  const floors = gainXpFloor([{ itemId: 3142, amount: 1000 }], [3142]);
  assert.deepEqual(floors, { fishing: 45_000 });
  assert.equal(checkGain(floors, fish(0), fish(40_000)), 'ok');
  assert.equal(checkGain(floors, fish(0), fish(10_000)), 'short');
  assert.equal(gainXpFloor([{ itemId: 4151, amount: 1 }], [4151]), null); // a whip is not gathered
  assert.equal(checkMoved(['zulrah'], snap({ zulrah: 50 }), snap({ zulrah: 50 })), 'short');
  assert.equal(checkMoved(['zulrah'], snap({ zulrah: 50 }), snap({ zulrah: 51 })), 'ok');
  assert.equal(countKeyFor('Inferno'), 'tzKalZuk');
});

test('PB jump, schedule shift, two countries', async () => {
  const { pbJumps, pbKey, scheduleShift, twoCountries } = await import('../src/lib/footprint');
  const before = { [pbKey('tzKalZuk', 0)]: 3600 * 100, [pbKey('theatreOfBlood', 4)]: 1500 * 100 };
  assert.deepEqual(
    pbJumps(before, [
      { key: 'tzKalZuk', partySize: null, seconds: 1800 }, // half the old best
      { key: 'theatreOfBlood', partySize: 4, seconds: 1400 }, // a normal improvement
      { key: 'zulrah', partySize: null, seconds: 30 }, // no pre-event best
    ]),
    [{ key: 'tzKalZuk', pbSeconds: 3600, runSeconds: 1800 }],
  );
  const evenings = Array.from({ length: 40 }, (_, i) => 18 + (i % 4)); // 18–21 UTC
  assert.equal(scheduleShift(evenings, Array.from({ length: 20 }, () => 19)), null);
  assert.equal(scheduleShift(evenings, Array.from({ length: 20 }, () => 6)), 1);
  assert.equal(scheduleShift(evenings.slice(0, 5), Array.from({ length: 20 }, () => 6)), null); // too little history
  const h = 3_600_000;
  assert.deepEqual(twoCountries([{ country: 'EG', first: 0, last: 2 * h }, { country: 'PH', first: 3 * h, last: 4 * h }]), ['EG', 'PH']);
  assert.equal(twoCountries([{ country: 'EG', first: 0, last: h }, { country: 'DE', first: 10 * h, last: 11 * h }]), null);
});
