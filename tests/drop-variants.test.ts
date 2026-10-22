// Drop tiles on the wrong variant of an item: the charged Tumeken's shadow, when the chest gives it
// uncharged. The plugin credits by id, so the tile looks configured and can never complete.
// lib/dropVariants finds the variant that drops; these pin it against the shipped drop dataset with
// a small hand-built mapping, so no network fetch is involved.
//
// Run: npx tsx --test tests/drop-variants.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dropVariantIn } from '../src/lib/dropVariants';

const mapping = [
  { id: 27275, name: "Tumeken's shadow" },
  { id: 27277, name: "Tumeken's shadow (uncharged)" },
  { id: 27278, name: "Tumeken's shadow (uncharged)" }, // noted copy
  { id: 28547, name: "Corrupted tumeken's shadow" },
  { id: 28549, name: "Corrupted tumeken's shadow (uncharged)" },
  { id: 31113, name: 'Eye of Ayak' },
  { id: 31115, name: 'Eye of Ayak (uncharged)' },
  { id: 22325, name: 'Scythe of Vitur' },
  { id: 22486, name: 'Scythe of Vitur (uncharged)' },
  { id: 11907, name: 'Trident of the Seas' },
  { id: 11905, name: 'Trident of the Seas (full)' },
  { id: 22288, name: 'Trident of the Seas (e)' },
  { id: 26384, name: 'Torva platebody' },
  { id: 26386, name: 'Torva platebody (damaged)' },
  { id: 4151, name: 'Abyssal whip' },
  { id: 19836, name: 'Reward casket (master)' },
  { id: 20543, name: 'Reward casket (elite)' },
];
const item = (id: number) => mapping.find((m) => m.id === id)!;
const variant = (id: number) => dropVariantIn(mapping, item(id))?.id ?? null;

test('charged weapons point at the uncharged drop', () => {
  assert.equal(variant(27275), 27277);
  assert.equal(variant(31113), 31115);
  assert.equal(variant(22325), 22486);
});

test('other states: full trident, damaged Torva', () => {
  assert.equal(variant(11907), 11905);
  assert.equal(variant(26384), 26386);
});

test('the drop itself, and items that drop, get no suggestion', () => {
  assert.equal(variant(27277), null);
  assert.equal(variant(4151), null);
});

test('a different item sharing a stem is not a variant', () => {
  // Corrupted shadow is its own item; an (e) trident is not the Kraken's (full) one; a master
  // casket is not an elite one.
  assert.equal(variant(28547), 28549);
  assert.notEqual(variant(27275), 28549);
  assert.equal(variant(22288), null);
  assert.equal(variant(19836), null);
});
