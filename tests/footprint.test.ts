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
