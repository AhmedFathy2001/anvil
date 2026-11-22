import { test } from 'node:test';
import assert from 'node:assert/strict';

import { huntDropRules } from '../src/lib/pluginFacts/rules';
import { huntPopupsSupportedBy } from '../src/lib/tileConditionsCheck';

test('hunt targets become popup-only drop rules keyed by item, with a negative id', () => {
  const rules = huntDropRules([
    { competitionId: 12, hunt: 'Pet hunt: Any DT2 Pet', itemId: 28246, name: 'Baron', sources: [] },
    { competitionId: 13, hunt: 'Pick hunt', itemId: 11920, name: 'Dragon pickaxe', sources: ["Vet'ion"] },
  ]);
  assert.deepEqual(rules['28246'], [{ t: -12, label: 'Baron', have: 0, of: 1, hunt: 'Pet hunt: Any DT2 Pet', simple: false }]);
  assert.deepEqual(rules['11920'][0].npcs, ["Vet'ion"]);
});

test('only a plugin that knows hunt rules gets them', () => {
  assert.equal(huntPopupsSupportedBy('1.17.2'), false);
  assert.equal(huntPopupsSupportedBy('1.17.3'), true);
  assert.equal(huntPopupsSupportedBy(null), false);
});
