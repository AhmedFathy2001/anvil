// A competition counted over several bosses (a pet hunt whose pet drops at two) takes each boss's
// freshest count: the plugin's live number where it has one, the hiscores where it has not
// (lib/weeklyMetric effectiveMetricValue). Pure.
//
// Run: npx tsx --test tests/weekly-sum-live.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { effectiveMetricValue, liveMetricValue } from '../src/lib/weeklyMetric.ts';

const hiscores = {
  skills: { overall: { rank: 1, level: 2000, xp: 1 } },
  bosses: { chaosElemental: { rank: 1, score: 121 }, chaosFanatic: { rank: 1, score: 25 }, zulrah: { rank: 1, score: 10 } },
};
const METRIC = 'chaosElemental,chaosFanatic';

test('the hiscores lag behind a session: the live count wins for the boss the plugin saw, the hiscores stand for the other', () => {
  // The plugin has pushed Chaos Elemental (130) and never Chaos Fanatic.
  const live = { chaosElemental: 130 };
  assert.equal(liveMetricValue('boss', METRIC, live), null, 'the overlay alone is not whole');
  const eff = effectiveMetricValue(hiscores, 'boss', METRIC, live);
  assert.deepEqual(eff.kind === 'value' ? eff.value : null, 155, '130 live + 25 from the hiscores, not the stale 146');
});

test('no live numbers at all is the hiscores sum; both pushed is the live sum; a lower live number never wins', () => {
  const none = effectiveMetricValue(hiscores, 'boss', METRIC, {});
  assert.equal(none.kind === 'value' ? none.value : null, 146);
  const both = effectiveMetricValue(hiscores, 'boss', METRIC, { chaosElemental: 130, chaosFanatic: 27 });
  assert.equal(both.kind === 'value' ? both.value : null, 157);
  assert.equal(liveMetricValue('boss', METRIC, { chaosElemental: 130, chaosFanatic: 27 }), 157);
  const stale = effectiveMetricValue(hiscores, 'boss', METRIC, { chaosElemental: 100 });
  assert.equal(stale.kind === 'value' ? stale.value : null, 146);
});

test('one boss still reads as before', () => {
  const one = effectiveMetricValue(hiscores, 'boss', 'zulrah', { zulrah: 12 });
  assert.equal(one.kind === 'value' ? one.value : null, 12);
});
