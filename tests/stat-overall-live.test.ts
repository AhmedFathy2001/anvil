// Total-XP tiles read live, like every single-skill tile.
//
// Run: npx tsx --test tests/stat-overall-live.test.ts
//
// The hiscores `overall` only updates on logout and the live overlay never carries it, so an
// overall tile sat at 67.7K while the same team's Herblore tile alone read 18K live and its members
// had banked well over a million XP in-session.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeGain } from '../src/lib/statTracking.ts';

const skills = (m: Record<string, number>) =>
  ({ skills: Object.fromEntries(Object.entries(m).map(([k, xp]) => [k, { xp }])) }) as never;

test('overall counts live per-skill gains the hiscores have not seen yet', () => {
  const base = skills({ overall: 10_000_000, mining: 4_000_000, herblore: 6_000_000 });
  const hiscoresNow = skills({ overall: 10_050_000, mining: 4_050_000, herblore: 6_000_000 });
  const live = { mining: 4_300_000, herblore: 6_200_000 };
  assert.equal(computeGain(base, hiscoresNow, live, ['overall'], 'skill'), 500_000);
});

test('a skill unranked at the start sits out, the hiscores overall still counts it', () => {
  const base = skills({ overall: 10_000_000, mining: 10_000_000, sailing: -1 });
  const now = skills({ overall: 10_400_000, mining: 10_100_000, sailing: 300_000 });
  assert.equal(computeGain(base, now, {}, ['overall'], 'skill'), 400_000);
});

test('no live push: same as the hiscores overall delta', () => {
  const base = skills({ overall: 5_000_000, attack: 2_000_000, magic: 3_000_000 });
  const now = skills({ overall: 5_250_000, attack: 2_100_000, magic: 3_150_000 });
  assert.equal(computeGain(base, now, {}, ['overall'], 'skill'), 250_000);
});

test('single-skill tiles are unchanged', () => {
  const base = skills({ overall: 5_000_000, mining: 2_000_000 });
  assert.equal(computeGain(base, skills({ mining: 2_000_000 }), { mining: 2_500_000 }, ['mining'], 'skill'), 500_000);
});
