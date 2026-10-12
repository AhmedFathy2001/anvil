import { test } from 'node:test';
import assert from 'node:assert/strict';

import { milestoneLabel, shapePlayerCard, type PlayerCardInput } from '../src/lib/playerCardShape';

const base: PlayerCardInput = {
  rsn: 'Drenvox mdps',
  accountType: 'main',
  clan: { slug: 'theafkspot', name: 'The AFK Spot' },
  totalLevel: 2277,
  combatLevel: 126,
  overallXp: 512_000_000,
  ehp: 1210,
  ehb: 830,
  statsAt: '2026-10-12T09:00:00.000Z',
  bosses: [],
  clogHeader: null,
  clogPages: [],
  recentItems: [],
  milestones: [],
};

test('top bosses: highest KC first, zero KC and unknown keys left out, capped at six', () => {
  const card = shapePlayerCard({
    ...base,
    bosses: [
      { key: 'zulrah', kc: 812 },
      { key: 'vorkath', kc: 1240 },
      { key: 'barrows', kc: 0 },
      { key: 'notABoss', kc: 9999 },
      { key: 'abyssalSire', kc: 1 },
      { key: 'alchemicalHydra', kc: 2 },
      { key: 'araxxor', kc: 3 },
      { key: 'artio', kc: 4 },
      { key: 'bryophyta', kc: 5 },
    ],
  });
  assert.deepEqual(
    card.topBosses.map((b) => [b.label, b.kc]),
    [['Vorkath', 1240], ['Zulrah', 812], ['Bryophyta', 5], ['Artio', 4], ['Araxxor', 3], ['Alchemical Hydra', 2]],
  );
});

test('no clog header means no clog block, not a zeroed one', () => {
  assert.equal(shapePlayerCard(base).clog, null);
});

test('clog pages roll up into groups in a fixed order, empty groups dropped', () => {
  const card = shapePlayerCard({
    ...base,
    clogHeader: { obtained: 30, total: 100 },
    clogPages: [
      { name: 'Chambers of Xeric', obtained: 2, total: 20 },
      { name: 'Vorkath', obtained: 3, total: 5 },
      { name: 'Zulrah', obtained: 4, total: 6 },
      { name: 'Theatre of Blood', obtained: 1, total: 10 },
    ],
  });
  assert.equal(card.clog?.obtained, 30);
  assert.deepEqual(card.clog?.groups, [
    { name: 'Bosses', obtained: 7, total: 11 },
    { name: 'Raids', obtained: 3, total: 30 },
  ]);
});

test('latest mixes items and milestones newest first, across both timestamp formats', () => {
  const card = shapePlayerCard({
    ...base,
    recentItems: [
      { itemId: 20997, name: 'Twisted bow', at: '2026-10-01T12:00:00.000Z' },
      { itemId: 13262, name: 'Abyssal orphan', at: '2026-09-01T12:00:00.000Z' },
    ],
    milestones: [
      { kind: 'level', metric: 'slayer', threshold: 99, noticedAt: '2026-10-05 08:00:00' },
      { kind: 'kc', metric: 'vorkath', threshold: 1000, noticedAt: '2026-08-01 08:00:00' },
    ],
  });
  assert.deepEqual(card.latest.map((l) => l.label), ['99 Slayer', 'Twisted bow', 'Abyssal orphan']);
  assert.equal(card.latest[1].itemId, 20997);
  assert.equal(card.latest[0].itemId, null);
});

test('milestone wording', () => {
  assert.equal(milestoneLabel({ kind: 'level', metric: 'slayer', threshold: 99 }), '99 Slayer');
  assert.equal(milestoneLabel({ kind: 'xp', metric: 'slayer', threshold: 50_000_000 }), '50m Slayer XP');
  assert.equal(milestoneLabel({ kind: 'kc', metric: 'vorkath', threshold: 1000 }), '1,000 Vorkath KC');
  assert.equal(milestoneLabel({ kind: 'total', metric: null, threshold: 2000 }), '2,000 total');
  assert.equal(milestoneLabel({ kind: 'mystery', metric: null, threshold: 1 }), null);
});
