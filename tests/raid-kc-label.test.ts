// A raid's KC is one mode's: the drop post names which, from the count line the plugin read.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { countLabel } from '../src/lib/pluginEmbeds.ts';

test('a raid drop names the mode its KC is from', () => {
  assert.equal(countLabel('Chambers of Xeric', 'Chambers of Xeric Challenge Mode'), 'CM KC');
  assert.equal(countLabel('Tombs of Amascut', 'Tombs of Amascut: Expert Mode'), 'Expert KC');
  assert.equal(countLabel('Tombs of Amascut', 'Tombs of Amascut: Entry Mode'), 'Entry KC');
  assert.equal(countLabel('Theatre of Blood', 'Theatre of Blood: Hard Mode'), 'HM KC');
  assert.equal(countLabel('Chambers of Xeric', 'Chambers of Xeric'), 'Normal KC');
});

test('anything else keeps its plain label', () => {
  assert.equal(countLabel('Chambers of Xeric'), 'KC');
  assert.equal(countLabel("Phosani's Nightmare", "Phosani's Nightmare"), 'KC');
  assert.equal(countLabel('Zulrah', 'Vorkath'), 'KC');
  assert.equal(countLabel('Clue Scroll (elite)', 'Chambers of Xeric'), 'Caskets');
});
