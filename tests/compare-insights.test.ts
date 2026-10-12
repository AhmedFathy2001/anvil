import { test } from 'node:test';
import assert from 'node:assert/strict';

import { comparePlayers } from '../src/lib/compare';
import { compareInsights, type Insight } from '../src/lib/compareInsights';
import type { PlayerCard } from '../src/lib/playerCardShape';

function card(over: Partial<PlayerCard>): PlayerCard {
  return {
    rsn: 'X', accountType: null, clan: null, totalLevel: 2000, combatLevel: 120, overallXp: 300_000_000,
    ehp: 500, ehb: 100, statsAt: null, clog: null, latest: [], topBosses: [], skills: [], bosses: [],
    activities: [], clogPages: [], times: [], ...over,
  };
}
const text = (i: Insight, a = 'A', b = 'B') => i.parts.map((p) => (typeof p === 'string' ? p : p.side === 'a' ? a : b)).join('');

test('playstyle, time, gap, close race, signature boss, log, week', () => {
  const a = card({
    rsn: 'A', ehp: 553, ehb: 400,
    skills: [
      { key: 'hunter', level: 77, xp: 1_500_000 },
      { key: 'agility', level: 85, xp: 3_280_000 },
    ],
    bosses: [{ key: 'tombsOfAmascutExpertMode', label: 'ToA: Expert', kc: 443 }],
    clog: { obtained: 471, total: 1922, groups: [{ name: 'Bosses', obtained: 88, total: 247 }, { name: 'Minigames', obtained: 46, total: 276 }] },
  });
  const b = card({
    rsn: 'B', ehp: 638, ehb: 116,
    skills: [
      { key: 'hunter', level: 92, xp: 6_600_000 },
      { key: 'agility', level: 87, xp: 4_000_000 },
    ],
    bosses: [{ key: 'tombsOfAmascutExpertMode', label: 'ToA: Expert', kc: 5 }],
    clog: { obtained: 741, total: 1922, groups: [{ name: 'Bosses', obtained: 120, total: 247 }, { name: 'Minigames', obtained: 200, total: 276 }] },
  });
  const ins = compareInsights(a, b, comparePlayers(a, b), { a: 12.3, b: 4.1 });
  const by = Object.fromEntries(ins.map((i) => [i.key, text(i)]));
  assert.match(by.style, /A is an all-rounder \(42% of their hours are kills\); B is a skiller at 15%/);
  assert.match(by.time, /A has put in 953h of efficient play — 26% more than B \(754h\)/);
  assert.match(by.gap, /Biggest gap: Hunter — B is 15 levels ahead \(77 vs 92\), about 5\.1M XP to close/);
  assert.match(by.close, /Closest race: Agility, 85 vs 87 — A is/);
  assert.match(by['boss-a'], /A's signature: ToA: Expert — 443 kills to 5/);
  assert.match(by.log, /B leads the collection log by 270 slots — 154 of them in Minigames/);
  assert.equal(by.week, 'This week: A gained 12.3h, B 4.1h.');
});

test('nothing to say means no sentence, not a zero', () => {
  const ins = compareInsights(card({ ehp: null, ehb: null }), card({ ehp: null, ehb: null }), comparePlayers(card({}), card({})));
  assert.equal(ins.find((i) => i.key === 'style'), undefined);
  assert.equal(ins.find((i) => i.key === 'log'), undefined);
});
