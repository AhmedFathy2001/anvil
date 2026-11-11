// How Settings → Supporter reads a person's character name looks off the stored rows. Pure, no database.
//
// Run: npx tsx --test tests/character-name-looks.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  characterDefaultStyle,
  characterLookPlan,
  isDefaultSupporterStyle,
  supporterStyleKey,
  wornCharacterStyle,
} from '../src/lib/characterNameLooks.ts';
import type { SupporterStyle } from '../src/lib/supporterStyle.ts';

const ember: SupporterStyle = { preset: 'ember' };
const ocean: SupporterStyle = { preset: 'ocean' };
const red: SupporterStyle = { stops: ['#ff0000'] };

test('no stored looks: same as the Anvil name, nobody customized', () => {
  const plan = characterLookPlan([
    { accountId: 1, style: null },
    { accountId: 2, style: null },
  ]);
  assert.equal(plan.mode, 'same');
  assert.equal(plan.shared, null);
  assert.equal(plan.customized.size, 0);
  assert.equal(characterDefaultStyle(plan), null);
});

test('one stored look among inheriting characters is a per-character customization', () => {
  const plan = characterLookPlan([
    { accountId: 1, style: null },
    { accountId: 2, style: ember },
    { accountId: 3, style: null },
  ]);
  assert.equal(plan.mode, 'same');
  assert.deepEqual([...plan.customized], [2]);
});

test('"Save for all characters" (every row the same look) reads as a separate look', () => {
  const plan = characterLookPlan([
    { accountId: 1, style: ember },
    { accountId: 2, style: { preset: 'ember', dark: undefined } },
  ]);
  assert.equal(plan.mode, 'separate');
  assert.equal(supporterStyleKey(plan.shared), supporterStyleKey(ember));
  assert.equal(plan.customized.size, 0);
  assert.equal(supporterStyleKey(characterDefaultStyle(plan)), supporterStyleKey(ember));
});

test('the most common stored look is the shared one; the rest are customized', () => {
  const plan = characterLookPlan([
    { accountId: 1, style: ocean },
    { accountId: 2, style: ember },
    { accountId: 3, style: ember },
    { accountId: 4, style: null },
  ]);
  assert.equal(plan.mode, 'separate');
  assert.equal(supporterStyleKey(plan.shared), supporterStyleKey(ember));
  assert.deepEqual([...plan.customized].sort(), [1, 4]);
});

test('a tie between inheriting and a stored look stays same unless that look was the shared one', () => {
  const rows = [
    { accountId: 1, style: null },
    { accountId: 2, style: red },
  ];
  assert.equal(characterLookPlan(rows).mode, 'same');
  const kept = characterLookPlan(rows, supporterStyleKey(red));
  assert.equal(kept.mode, 'separate');
  assert.deepEqual([...kept.customized], [1]);
});

test('customizing one of two characters keeps the earlier shared look', () => {
  // Was: both ember (shared ember). The primary is now ocean: a 1–1 tie.
  const rows = [
    { accountId: 1, style: ocean },
    { accountId: 2, style: ember },
  ];
  assert.equal(supporterStyleKey(characterLookPlan(rows).shared), supporterStyleKey(ocean)); // order breaks a cold tie
  const plan = characterLookPlan(rows, supporterStyleKey(ember));
  assert.equal(supporterStyleKey(plan.shared), supporterStyleKey(ember));
  assert.deepEqual([...plan.customized], [1]);
});

test('a character wears its own row, else the Anvil name', () => {
  assert.equal(wornCharacterStyle({ accountId: 1, style: null }, ember), ember);
  assert.equal(wornCharacterStyle({ accountId: 1, style: ocean }, ember), ocean);
  assert.ok(isDefaultSupporterStyle(null));
  assert.ok(isDefaultSupporterStyle({}));
  assert.ok(!isDefaultSupporterStyle(ember));
});
