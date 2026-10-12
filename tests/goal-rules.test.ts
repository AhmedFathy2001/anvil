import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkDueOn, checkGoal } from '../src/lib/goalRules';

test('skills: a real skill, a level 2–99, stored lowercase', () => {
  assert.deepEqual(checkGoal({ kind: 'skill', metric: 'Slayer', target: 99 }), { ok: true, kind: 'skill', metric: 'slayer', target: 99, dueOn: null });
  assert.equal(checkGoal({ kind: 'skill', metric: 'overall', target: 99 }).ok, false);
  assert.equal(checkGoal({ kind: 'skill', metric: 'slayer', target: 120 }).ok, false);
  assert.equal(checkGoal({ kind: 'skill', metric: 'cheese', target: 50 }).ok, false);
});

test('bosses: by key or by label, stored as the key', () => {
  assert.deepEqual(checkGoal({ kind: 'boss', metric: 'Alchemical Hydra', target: 500 }), { ok: true, kind: 'boss', metric: 'alchemicalHydra', target: 500, dueOn: null });
  assert.deepEqual(checkGoal({ kind: 'boss', metric: 'vorkath', target: 1 }), { ok: true, kind: 'boss', metric: 'vorkath', target: 1, dueOn: null });
  assert.equal(checkGoal({ kind: 'boss', metric: 'vorkath', target: 0 }).ok, false);
  // RuneLite's names: folded, and the longest prefix for the ones that say more than ours.
  assert.deepEqual(checkGoal({ kind: 'boss', metric: 'Barrows Chests', target: 50 }), { ok: true, kind: 'boss', metric: 'barrows', target: 50, dueOn: null });
  assert.equal(checkGoal({ kind: 'boss', metric: 'Chambers of Xeric: Challenge Mode', target: 5 }).ok, true);
  assert.equal(checkGoal({ kind: 'boss', metric: 'Nonsense Beast', target: 5 }).ok, false);
});

test('log pages: a real page, target ignored', () => {
  const r = checkGoal({ kind: 'clog', metric: 'zulrah', target: 999 });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.metric, 'Zulrah');
    assert.equal(r.target, 0);
  }
  assert.equal(checkGoal({ kind: 'clog', metric: 'Not a page', target: 0 }).ok, false);
});

test('anything else is refused', () => {
  assert.equal(checkGoal({ kind: 'quest', metric: 'x', target: 1 }).ok, false);
  assert.equal(checkGoal({ kind: 'skill', metric: '', target: 50 }).ok, false);
});

test('deadlines: optional, a real day, not passed, within ten years', () => {
  const now = new Date('2026-10-12T12:00:00Z');
  assert.deepEqual(checkDueOn(undefined, now), { ok: true, dueOn: null });
  assert.deepEqual(checkDueOn('', now), { ok: true, dueOn: null });
  assert.deepEqual(checkDueOn('2026-12-01', now), { ok: true, dueOn: '2026-12-01' });
  assert.equal(checkDueOn('2026-10-11', now).ok, true); // yesterday, for the timezone a day behind
  assert.equal(checkDueOn('2026-10-01', now).ok, false);
  assert.equal(checkDueOn('2026-02-30', now).ok, false);
  assert.equal(checkDueOn('01/12/2026', now).ok, false);
  assert.equal(checkDueOn('2040-01-01', now).ok, false);
  const g = checkGoal({ kind: 'skill', metric: 'slayer', target: 99, dueOn: '2026-12-01' }, now);
  assert.equal(g.ok && g.dueOn, '2026-12-01');
});
