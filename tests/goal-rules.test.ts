import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkGoal } from '../src/lib/goalRules';

test('skills: a real skill, a level 2–99, stored lowercase', () => {
  assert.deepEqual(checkGoal({ kind: 'skill', metric: 'Slayer', target: 99 }), { ok: true, kind: 'skill', metric: 'slayer', target: 99 });
  assert.equal(checkGoal({ kind: 'skill', metric: 'overall', target: 99 }).ok, false);
  assert.equal(checkGoal({ kind: 'skill', metric: 'slayer', target: 120 }).ok, false);
  assert.equal(checkGoal({ kind: 'skill', metric: 'cheese', target: 50 }).ok, false);
});

test('bosses: by key or by label, stored as the key', () => {
  assert.deepEqual(checkGoal({ kind: 'boss', metric: 'Alchemical Hydra', target: 500 }), { ok: true, kind: 'boss', metric: 'alchemicalHydra', target: 500 });
  assert.deepEqual(checkGoal({ kind: 'boss', metric: 'vorkath', target: 1 }), { ok: true, kind: 'boss', metric: 'vorkath', target: 1 });
  assert.equal(checkGoal({ kind: 'boss', metric: 'vorkath', target: 0 }).ok, false);
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
