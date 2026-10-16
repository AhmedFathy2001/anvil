// "What are you running?" — every format is reachable and opens the right form.
//
// Run: npm run test:formats

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { EVENT_MODES } from '../src/lib/eventModes.ts';
import { FORMAT_CARDS, findFormat } from '../src/lib/formatCatalog.ts';

test('every board mode has exactly one card', () => {
  for (const m of EVENT_MODES) {
    assert.equal(FORMAT_CARDS.filter((c) => c.choice.mode === m.key).length, 1, m.key);
  }
});

test('every weekly kind has a card, and keys are unique', () => {
  for (const w of ['skill', 'boss', 'efficiency']) {
    assert.equal(FORMAT_CARDS.filter((c) => c.choice.weekly === w).length, 1, w);
  }
  assert.equal(new Set(FORMAT_CARDS.map((c) => c.key)).size, FORMAT_CARDS.length);
});

test('unknown or missing format falls back to the picker', () => {
  assert.equal(findFormat(undefined), null);
  assert.equal(findFormat('nope'), null);
  assert.equal(findFormat('classic')?.name, 'Classic bingo');
});
