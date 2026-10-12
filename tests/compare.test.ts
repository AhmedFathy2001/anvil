import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  compareClans,
  comparePlayers,
  formatCompareValue,
  leaderOf,
  queryName,
} from '../src/lib/compare';
import type { PlayerCard } from '../src/lib/playerCardShape';
import type { ClanCard } from '../src/lib/clanCard';

// The /compare pages: who leads which number, and in what order the differences are told. The rule
// worth pinning above all is UNKNOWN IS NOT ZERO — a side with no data never wins or loses a row.

function player(over: Partial<PlayerCard> = {}): PlayerCard {
  return {
    rsn: 'A',
    accountType: 'main',
    clan: null,
    totalLevel: 2000,
    combatLevel: 120,
    overallXp: 100_000_000,
    ehp: 500,
    ehb: 200,
    statsAt: '2026-10-01T00:00:00.000Z',
    clog: { obtained: 500, total: 1500, groups: [] },
    latest: [],
    topBosses: [],
    skills: [],
    bosses: [],
    activities: [],
    clogPages: [],
    times: [],
    ...over,
  };
}

function clan(over: Partial<ClanCard> = {}): ClanCard {
  return {
    slug: 'x',
    name: 'X',
    logoUrl: null,
    members: 50,
    activeThisWeek: 20,
    totalEhp: 1000,
    totalEhb: 500,
    topWeek: [],
    topPlayers: [],
    clog: { average: 400, synced: 10 },
    highlights: [],
    competitions: [],
    ...over,
  };
}

test('leaderOf: higher wins, equal ties, any unknown means no leader', () => {
  assert.equal(leaderOf(2, 1), 'a');
  assert.equal(leaderOf(1, 2), 'b');
  assert.equal(leaderOf(3, 3), 'tie');
  assert.equal(leaderOf(0, 0), 'tie');
  assert.equal(leaderOf(null, 5), null);
  assert.equal(leaderOf(5, undefined), null);
  assert.equal(leaderOf(null, null), null);
});

test('headline rows name the leader of each number', () => {
  const r = comparePlayers(
    player({ totalLevel: 2100, combatLevel: 126, ehp: 500 }),
    player({ totalLevel: 2000, combatLevel: 126, ehp: 900 }),
  );
  const by = Object.fromEntries(r.headline.map((h) => [h.label, h]));
  assert.deepEqual(
    r.headline.map((h) => h.label),
    ['Total level', 'Combat', 'Total XP', 'EHP', 'EHB', 'Log slots'],
  );
  assert.equal(by['Total level'].leader, 'a');
  assert.equal(by['Combat'].leader, 'tie');
  assert.equal(by['EHP'].leader, 'b');
  assert.equal(by['Total XP'].format, 'xp');
});

test('missing data never leads: unsynced log, no hiscores, null efficiency', () => {
  const r = comparePlayers(
    player({ clog: null, totalLevel: 0, ehb: null, combatLevel: null }),
    player(),
  );
  const by = Object.fromEntries(r.headline.map((h) => [h.label, h]));
  assert.equal(by['Log slots'].a, null);
  assert.equal(by['Log slots'].leader, null);
  assert.equal(by['Total level'].a, null, 'a total of 0 is "no hiscores", not a real total');
  assert.equal(by['Total level'].leader, null);
  assert.equal(by['EHB'].leader, null);
  assert.equal(by['Combat'].leader, null);
});

test('total XP falls back to the sum of skills when the overall is missing', () => {
  const r = comparePlayers(
    player({ overallXp: null, skills: [{ key: 'attack', level: 50, xp: 100 }, { key: 'magic', level: 60, xp: 300 }] }),
    player({ overallXp: null, skills: [] }),
  );
  const xp = r.headline.find((h) => h.label === 'Total XP')!;
  assert.equal(xp.a, 400);
  assert.equal(xp.b, null);
  assert.equal(xp.leader, null);
});

test('skills sort by level gap, then xp gap; leader breaks level ties on xp; counts add up', () => {
  const a = player({
    skills: [
      { key: 'attack', level: 99, xp: 20_000_000 },
      { key: 'strength', level: 80, xp: 2_000_000 },
      { key: 'defence', level: 99, xp: 13_100_000 },
      { key: 'magic', level: 70, xp: 750_000 },
      { key: 'cooking', level: 50, xp: 100_000 },
    ],
  });
  const b = player({
    skills: [
      { key: 'attack', level: 99, xp: 14_000_000 },
      { key: 'strength', level: 90, xp: 5_400_000 },
      { key: 'defence', level: 99, xp: 13_100_000 },
      { key: 'magic', level: 72, xp: 900_000 },
      { key: 'fishing', level: 40, xp: 40_000 },
    ],
  });
  const r = comparePlayers(a, b);
  assert.deepEqual(
    r.skills.map((s) => s.key),
    // strength (10 levels), magic (2), attack (0, 6m xp), defence (0, 0), then the one-sided ones.
    ['strength', 'magic', 'attack', 'defence', 'cooking', 'fishing'],
  );
  const attack = r.skills.find((s) => s.key === 'attack')!;
  assert.equal(attack.leader, 'a', 'two 99s: more xp leads');
  assert.equal(r.skills.find((s) => s.key === 'defence')!.leader, 'tie');
  const cooking = r.skills.find((s) => s.key === 'cooking')!;
  assert.equal(cooking.levelB, null);
  assert.equal(cooking.leader, null);
  assert.deepEqual(r.skillsAhead, { a: 1, b: 2, tied: 1 });
});

test('bosses are the union by key, sorted by the bigger kc; absent is 0 only when tracked', () => {
  const a = player({
    skills: [{ key: 'attack', level: 99, xp: 1 }],
    bosses: [
      { key: 'zulrah', label: 'Zulrah', kc: 500 },
      { key: 'vorkath', label: 'Vorkath', kc: 50 },
    ],
  });
  const b = player({
    skills: [{ key: 'attack', level: 99, xp: 1 }],
    bosses: [
      { key: 'vorkath', label: 'Vorkath', kc: 1200 },
      { key: 'kraken', label: 'Kraken', kc: 10 },
    ],
  });
  const r = comparePlayers(a, b);
  assert.deepEqual(r.bosses.map((x) => x.key), ['vorkath', 'zulrah', 'kraken']);
  const zul = r.bosses.find((x) => x.key === 'zulrah')!;
  assert.equal(zul.kcB, 0);
  assert.equal(zul.leader, 'a');
  assert.equal(r.bosses.find((x) => x.key === 'kraken')!.label, 'Kraken');

  // A side the sweep has never seen: its kcs are unknown, not zero.
  const untracked = player({ totalLevel: 0, skills: [], bosses: [] });
  const r2 = comparePlayers(untracked, b);
  assert.ok(r2.bosses.every((x) => x.kcA === null && x.leader === null));
});

test('log pages: only differing ones, biggest gap first, and only when both logs are synced', () => {
  const page = (name: string, obtained: number) => ({ name, group: 'Bosses' as const, obtained, total: 10, iconItemId: 1 });
  const a = player({ clogPages: [page('Zulrah', 3), page('Vorkath', 5), page('Kraken', 2)] });
  const b = player({ clogPages: [page('Zulrah', 3), page('Vorkath', 1), page('Giant Mole', 1)] });
  const r = comparePlayers(a, b);
  assert.deepEqual(
    r.logPages.map((p) => [p.name, p.a, p.b, p.leader]),
    [
      ['Vorkath', 5, 1, 'a'],
      ['Kraken', 2, 0, 'a'],
      ['Giant Mole', 0, 1, 'b'],
    ],
  );
  assert.deepEqual(comparePlayers(player({ clog: null }), b).logPages, []);
});

test('clans: headline rows with leaders; no synced logs means no average and no leader', () => {
  const r = compareClans(clan({ members: 80, totalEhb: 500 }), clan({ members: 50, totalEhb: 500, clog: null }));
  const by = Object.fromEntries(r.headline.map((h) => [h.label, h]));
  assert.deepEqual(
    r.headline.map((h) => h.label),
    ['Members', 'Active this week', 'Total EHP', 'Total EHB', 'Average log'],
  );
  assert.equal(by['Members'].leader, 'a');
  assert.equal(by['Active this week'].leader, 'tie');
  assert.equal(by['Total EHB'].leader, 'tie');
  assert.equal(by['Average log'].b, null);
  assert.equal(by['Average log'].leader, null);
});

test('formatting and query-name parsing', () => {
  assert.equal(formatCompareValue(null, 'int'), '—');
  assert.equal(formatCompareValue(2277, 'int'), '2,277');
  assert.equal(formatCompareValue(512_300_000, 'xp'), '512.3M');
  assert.equal(formatCompareValue(12.34, 'hours'), '12.3');
  assert.equal(queryName('  Zezima '), 'Zezima');
  assert.equal(queryName(['first', 'second']), 'first');
  assert.equal(queryName(''), null);
  assert.equal(queryName(undefined), null);
  assert.equal(queryName('thirteen char'), null);
});
