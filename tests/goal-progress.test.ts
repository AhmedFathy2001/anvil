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

test('deadlines: days left, overdue, and pace from recent play', () => {
  const now = new Date('2026-10-12T12:00:00Z');
  const rates = { skills: { agility: 100_000 }, bosses: { vorkath: 2 } };
  // 99 Agility: 13,034,431 − 1,210,421 ≈ 11.8M XP left in 50 days ≈ 236K/day; doing 100K → behind.
  const a = goalProgress({ ...g('skill', 'agility', 99), dueOn: '2026-12-01' }, stats, { rates, now });
  assert.equal(a.due?.text, 'by 1 Dec · 50 days left');
  assert.equal(a.due?.tone, 'behind');
  assert.equal(a.due?.pace, 'needs 236K XP/day · doing 100K');
  // 1,000 Vorkath: 188 left in 50 days ≈ 3.8/day; doing 2 → behind. 900 is on pace.
  assert.equal(goalProgress({ ...g('boss', 'vorkath', 1000), dueOn: '2026-12-01' }, stats, { rates, now }).due?.tone, 'behind');
  assert.equal(goalProgress({ ...g('boss', 'vorkath', 900), dueOn: '2026-12-01' }, stats, { rates, now }).due?.pace, 'on pace');
  // Past the date and not done.
  assert.equal(goalProgress({ ...g('boss', 'vorkath', 1000), dueOn: '2026-10-09' }, stats, { now }).due?.text, 'overdue by 3 days');
  // Done goals and goals without a date have no deadline line.
  assert.equal(goalProgress({ ...g('skill', 'slayer', 99), dueOn: '2026-12-01' }, stats, { now }).due, null);
  assert.equal(goalProgress(g('boss', 'vorkath', 1000), stats, { now }).due, null);
});
