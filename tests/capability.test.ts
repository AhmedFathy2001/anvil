import test from 'node:test';
import assert from 'node:assert/strict';

import {
  abilityTable,
  claimedWeeklyHours,
  hoursFactor,
  knowhowFor,
  meansFor,
  suggestSignup,
  type AccountEvidence,
} from '../src/lib/capability.ts';
import { activitySpecs, bossKeyForName, parseCaDuration } from '../src/lib/capabilityData.ts';

const specs = activitySpecs();
const spec = (key: string) => {
  const s = specs.find((x) => x.key === key);
  assert.ok(s, `spec ${key}`);
  return s!;
};

const MAXED = Object.fromEntries(
  ['attack', 'strength', 'defence', 'ranged', 'magic', 'prayer', 'hitpoints', 'slayer'].map((s) => [s, 99]),
);

function account(over: Partial<AccountEvidence> = {}): AccountEvidence {
  return {
    accountId: 1,
    personKey: 'u1',
    accountType: 'normal',
    levels: MAXED,
    xp: {},
    kc: {},
    recentKc: null,
    recentXp: null,
    pbSeconds: {},
    caTier: null,
    caDone: null,
    clogItems: null,
    ...over,
  };
}

test('every boss has a spec, and the CA speed targets parse', () => {
  assert.ok(specs.length >= 70);
  assert.equal(parseCaDuration('Complete the Inferno in less than 65 minutes.'), 65 * 60);
  assert.equal(parseCaDuration('Kill Vorkath in less than 1 minute and 15 seconds.'), 75);
  assert.equal(parseCaDuration('Kill Vorkath in less than 54 seconds.'), 54);
  assert.equal(parseCaDuration('Complete the Colosseum with a total time of 28:00 or less.'), 28 * 60);
  assert.equal(parseCaDuration('Kill the Mad Angel 5 times within 10 minutes of entering her arena.'), null);
  assert.equal(spec('tzKalZuk').speedTargetSeconds, 65 * 60);
  assert.equal(bossKeyForName('Corrupted Hunllef'), 'corruptedGauntlet');
  assert.equal(bossKeyForName('Fortis Colosseum'), 'solHeredit');
});

test('a pure (1 ranged, 1 defence) cannot do the Inferno, unless the pure itself has the KC', () => {
  const pure = account({ levels: { ...MAXED, ranged: 1, defence: 1 } });
  assert.equal(meansFor(pure, spec('tzKalZuk')), 0);
  const capedPure = account({ levels: { ...MAXED, defence: 1 }, kc: { tzKalZuk: 1 } });
  assert.equal(meansFor(capedPure, spec('tzKalZuk')), 1);
});

test("know-how carries from the main to the pure, but the pure's means still gate it", () => {
  const main = account({ accountId: 1, kc: { tzKalZuk: 10 } });
  const pure = account({ accountId: 2, levels: { ...MAXED, ranged: 1, defence: 1 } });
  const onPure = abilityTable(pure, [main, pure], specs, null).get('tzKalZuk')!;
  assert.ok(onPure.knowhow > 0.8, 'knows the Inferno');
  assert.equal(onPure.ability, 0, 'but not on this account');
  const onMain = abilityTable(main, [main, pure], specs, null).get('tzKalZuk')!;
  assert.ok(onMain.ability > 0.8);
});

test('an iron at the stats but without the gear in its log is held back', () => {
  const iron = account({ accountType: 'ironman', clogItems: new Set(['dragon defender']) });
  const geared = account({ accountType: 'ironman', clogItems: new Set(['twisted bow', 'tanzanite fang']) });
  assert.ok(meansFor(iron, spec('tzKalZuk')) < 0.3);
  assert.equal(meansFor(geared, spec('tzKalZuk')), 1);
  // A normal account is assumed able to buy what it needs.
  assert.equal(meansFor(account(), spec('tzKalZuk')), 1);
});

test('2k ToB KC with no CAs is top for ToB; missing CAs never pull it down', () => {
  const vet = knowhowFor([account({ kc: { theatreOfBlood: 2000 } })], spec('theatreOfBlood'));
  assert.ok(vet.knowhow >= 0.99, `got ${vet.knowhow}`);
});

test('a Grandmaster with 5 Inferno KC rates well above a low-tier player with 5 KC', () => {
  const gm = knowhowFor([account({ kc: { tzKalZuk: 5 }, caTier: 6 })], spec('tzKalZuk')).knowhow;
  const low = knowhowFor([account({ kc: { tzKalZuk: 5 }, caTier: 2 })], spec('tzKalZuk')).knowhow;
  assert.ok(gm > low);
  // A CA tier never invents know-how for content never touched.
  assert.equal(knowhowFor([account({ caTier: 6 })], spec('tzKalZuk')).knowhow, 0);
});

test('hard per-boss CAs (Perfect Theatre) lift know-how even at low KC; KC-count tasks barely do', () => {
  const perfect = knowhowFor(
    [account({ kc: { theatreOfBlood: 3 }, caDone: [{ activity: 'theatreOfBlood', tier: 'Grandmaster', type: 'Perfection' }] })],
    spec('theatreOfBlood'),
  );
  const kcOnly = knowhowFor(
    [account({ kc: { theatreOfBlood: 3 }, caDone: [{ activity: 'theatreOfBlood', tier: 'Grandmaster', type: 'Kill Count' }] })],
    spec('theatreOfBlood'),
  );
  assert.ok(perfect.ca > kcOnly.ca * 5);
  assert.ok(perfect.knowhow > kcOnly.knowhow);
});

test('a fast PB against the CA target counts as know-how without the task claimed', () => {
  const fast = knowhowFor([account({ pbSeconds: { tzKalZuk: 64 * 60 } })], spec('tzKalZuk'));
  const slow = knowhowFor([account({ pbSeconds: { tzKalZuk: 150 * 60 } })], spec('tzKalZuk'));
  assert.equal(fast.pb, 1);
  assert.ok(slow.pb < fast.pb && slow.pb >= 0.4);
});

test('likely: ticked on the form, or recent kills above the bar; one stray kill is not interest', () => {
  const s = spec('vorkath');
  const stray = account({ kc: { vorkath: 300 }, recentKc: { vorkath: 1 } });
  const farming = account({ kc: { vorkath: 300 }, recentKc: { vorkath: s.recentKills } });
  const signup = { answered: true, bosses: new Set<string>(), skills: new Set<string>() };
  assert.ok(abilityTable(stray, [stray], specs, signup).get('vorkath')!.likely < 0.3);
  assert.ok(abilityTable(farming, [farming], specs, signup).get('vorkath')!.likely >= 0.8);
  const ticked = { ...signup, bosses: new Set(['vorkath']) };
  assert.ok(abilityTable(stray, [stray], specs, ticked).get('vorkath')!.likely >= 0.9);
});

test('hours: a wild claim is clamped and only partly believed; history outweighs the claim', () => {
  const pool = { medianClaimed: 20, medianAttendance: 0.6 };
  const liar = hoursFactor({ claimedWeekly: 160, pastAttendance: [] }, pool);
  assert.ok(liar <= Math.sqrt(0.4 * 3 + 0.6) + 1e-9, 'claim clamped to 3× and 40% weight');
  const provenNoShow = hoursFactor({ claimedWeekly: 60, pastAttendance: [0.1, 0.15] }, pool);
  assert.ok(provenNoShow < 1, 'past bingos say they barely turn up');
  assert.equal(hoursFactor({ claimedWeekly: null, pastAttendance: [] }, pool), 1);
  assert.equal(claimedWeeklyHours({ activeWeeklyHours: { min: 10, max: 20 }, afkWeeklyHours: { min: 10, max: 10 } }), 20);
});

test('form suggestions: bosses done recently, non-combat skills well past 99 or above the passive bar', () => {
  const a = account({
    xp: { strength: 80_000_000, fishing: 30_000_000, agility: 13_100_000, thieving: 2_000_000 },
    recentKc: { vorkath: 40, zulrah: 1 },
    recentXp: { agility: 120_000, thieving: 600_000, construction: 350_000 },
  });
  const out = suggestSignup([a], specs, ['Strength', 'Fishing', 'Agility', 'Thieving', 'Construction']);
  assert.deepEqual(out.bosses, ['vorkath']);
  assert.deepEqual(out.skills, ['Fishing', 'Thieving', 'Construction']);
});
