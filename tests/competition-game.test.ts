import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  checkCountsOn,
  countsHardcore,
  countsOnLabel,
  countsWorld,
  fallbackTable,
  firstTable,
  parseCountsOn,
  prizeCurrencyFor,
  tableTag,
} from '../src/lib/competitionGame.ts';

test('anything unknown or missing is the main game', () => {
  assert.equal(parseCountsOn(undefined), 'main');
  assert.equal(parseCountsOn(''), 'main');
  assert.equal(parseCountsOn('Main Game!'), 'main');
  assert.equal(parseCountsOn('main+hardcore'), 'main+hardcore');
  assert.equal(parseCountsOn('leagues'), 'leagues');
});

test('which worlds count', () => {
  assert.ok(countsWorld('main', null));
  assert.ok(!countsWorld('main', 'hardcore'));
  assert.ok(countsWorld('main+hardcore', null));
  assert.ok(countsWorld('main+hardcore', 'hardcore'));
  assert.ok(!countsWorld('main+hardcore', 'leagues'), 'Leagues never mixes in');
  assert.ok(countsWorld('leagues', 'leagues'));
  assert.ok(!countsWorld('leagues', null), 'a mode on its own: the main game does not count');
  assert.ok(!countsWorld('hardcore', null));
  assert.ok(countsHardcore('hardcore') && countsHardcore('main+hardcore') && !countsHardcore('main') && !countsHardcore('deadman'));
});

test('the hiscores table a character is read from', () => {
  assert.equal(firstTable('main'), null);
  assert.equal(firstTable('main+hardcore'), null, 'mixed starts on the main table');
  assert.equal(fallbackTable('main+hardcore', null), 'hardcore_mains', 'then Hardcore Worlds for one not on it');
  assert.equal(fallbackTable('main+hardcore', 'hardcore_mains'), null);
  assert.equal(fallbackTable('main', null), null);
  assert.equal(firstTable('hardcore'), 'hardcore_mains');
  assert.equal(firstTable('leagues'), 'seasonal');
  assert.equal(firstTable('deadman'), 'deadman');
  assert.equal(tableTag('hardcore_mains'), 'HCW');
  assert.equal(tableTag(null), null);
});

test('a skill or boss competition needs a mode with hiscores; a hunt does not', () => {
  assert.deepEqual(checkCountsOn('leagues', 'skill'), { ok: true, value: 'leagues' });
  assert.equal(checkCountsOn('beta', 'boss').ok, false);
  assert.deepEqual(checkCountsOn('beta', 'hunt'), { ok: true, value: 'beta' });
  assert.equal(checkCountsOn('<script>', 'hunt').ok, false);
  assert.deepEqual(checkCountsOn(undefined, 'skill'), { ok: true, value: 'main' });
});

test('labels', () => {
  assert.equal(countsOnLabel('main'), 'Main game');
  assert.equal(countsOnLabel('main+hardcore'), 'Main game + Hardcore Worlds');
  assert.equal(countsOnLabel('hardcore'), 'Hardcore Worlds only');
  assert.equal(countsOnLabel('leagues'), 'Leagues only');
});

test('prizes are HCW gp only with a Hardcore Worlds coffer and Hardcore Worlds counting', () => {
  assert.equal(prizeCurrencyFor('hcw', 'main', true), 'gp', 'main game only');
  assert.equal(prizeCurrencyFor('hcw', 'main+hardcore', false), 'gp', 'no HCW coffer: the main coffer pays');
  assert.equal(prizeCurrencyFor('hcw', 'main+hardcore', true), 'hcw');
  assert.equal(prizeCurrencyFor(undefined, 'main+hardcore', true), 'gp', 'mixed defaults to main game gp');
  assert.equal(prizeCurrencyFor(undefined, 'hardcore', true), 'hcw', 'Hardcore Worlds only starts on HCW gp');
  assert.equal(prizeCurrencyFor('gp', 'hardcore', true), 'gp');
});
