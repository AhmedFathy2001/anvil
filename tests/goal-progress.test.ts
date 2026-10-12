import { test } from 'node:test';
import assert from 'node:assert/strict';

import { goalLabel, goalProgress } from '../src/lib/goalProgress';

const stats = {
  skills: [{ key: 'slayer', xp: 13_034_431 }, { key: 'agility', xp: 1_210_421 }],
  bosses: [{ key: 'vorkath', kc: 812 }],
  pages: [{ name: 'Barrows Chests', obtained: 20, total: 25 }],
};
const g = (kind: string, metric: string, target: number) => ({ id: 1, kind, metric, target });

test('labels', () => {
  assert.equal(goalLabel(g('skill', 'slayer', 99)), '99 Slayer');
  assert.equal(goalLabel(g('boss', 'alchemicalHydra', 1000)), '1,000 Alchemical Hydra');
  assert.equal(goalLabel(g('clog', 'Barrows Chests', 0)), 'Barrows Chests log');
});

test('skill goals read XP against the level', () => {
  assert.equal(goalProgress(g('skill', 'slayer', 99), stats).done, true);
  const a = goalProgress(g('skill', 'agility', 99), stats);
  assert.equal(a.text, 'Lv 75 / 99');
  assert.equal(a.done, false);
  assert.equal(goalProgress(g('skill', 'agility', 99), { skills: [], bosses: [], pages: null }).current, null);
});

test('boss and log goals', () => {
  assert.equal(goalProgress(g('boss', 'vorkath', 1000), stats).text, '812 / 1,000');
  assert.equal(goalProgress(g('boss', 'zulrah', 50), stats).text, '0 / 50');
  assert.equal(goalProgress(g('clog', 'barrows chests', 0), stats).text, '20 / 25');
  assert.equal(goalProgress(g('clog', 'Zulrah', 0), stats).text, 'log not synced');
});
