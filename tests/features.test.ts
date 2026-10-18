// Admin → Features: the switches' storage format and defaults.
//
// Run: npm run test:features

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  FEATURES,
  defaultFeaturesOffForNewClan,
  featureFlags,
  parseFeaturesOff,
  serializeFeaturesOff,
} from '../src/lib/features.ts';

test('absent or garbage storage means everything on, so existing clans lose nothing', () => {
  for (const raw of [null, undefined, '', 'not json', '{"a":1}']) {
    const flags = featureFlags(parseFeaturesOff(raw));
    for (const f of FEATURES) assert.equal(flags.on(f.key), true, `${f.key} with ${String(raw)}`);
  }
});

test('unknown keys are dropped, known ones round-trip', () => {
  const off = parseFeaturesOff('["coffer","noSuchThing","missions"]');
  assert.deepEqual([...off].sort(), ['coffer', 'missions']);
  assert.deepEqual(parseFeaturesOff(serializeFeaturesOff(off)), off);
});

test('a new clan starts with exactly the extras off and the core on', () => {
  const flags = featureFlags(parseFeaturesOff(defaultFeaturesOffForNewClan()));
  for (const f of FEATURES) assert.equal(flags.on(f.key), !f.offForNewClans, f.key);
  // The core a first-time admin needs is never off by default.
  for (const k of ['weekly', 'fees', 'announce'] as const) assert.equal(flags.on(k), true, k);
});
