// The live reaction update for the plugin panel's Feed (lib/reactionPushWire). Pure: no database.
//
// Run: node --import tsx --test tests/reaction-push.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { reactPushMessage } from '../src/lib/reactionPushWire.ts';

// momentReactions' NO_REACTIONS, spelled out: that module reads the database.
const NO_REACTIONS = { gz: 0, gold: 0, mineGz: false, mineGold: false, sad: 0, sit: 0, mineSad: false, mineSit: false };
const summary = { ...NO_REACTIONS, gz: 3, mineGz: true, gold: 1 };

test('everyone gets counts only: no mine flags, no tooltips unless names are given', () => {
  const m = reactPushMessage({ feeds: ['moments:clan:3', 'moments:clan:3:drops'], momentId: 42, momentKind: 'pet', summary });
  assert.deepEqual(m, { t: 'rowsreact', feeds: ['moments:clan:3', 'moments:clan:3:drops'], id: 'm42', gz: 3, gold: 1, sad: 0, sit: 0 });
  assert.ok(JSON.stringify(m).length < 120, 'tiny');
});

test('the reactor\'s own copy carries their highlight for every kind', () => {
  const m = reactPushMessage({ feeds: ['moments:event:5'], momentId: 42, momentKind: 'pet', summary, mine: true });
  assert.equal(m.mineGz, true);
  assert.equal(m.mineGold, false);
  assert.equal(m.mineSad, false);
  assert.equal(m.mineSit, false);
});

test('tooltips are the row\'s own chips: a drop\'s GZ, a death\'s Sad and Sit (empty when nobody)', () => {
  const drop = reactPushMessage({ feeds: [], momentId: 1, momentKind: 'unique', summary, who: { gz: ['Mossy', 'Rikkert', null], sad: ['X'] } });
  assert.deepEqual(drop.who, { gz: 'GZ · Mossy, Rikkert and 1 other' });
  const death = reactPushMessage({ feeds: [], momentId: 2, momentKind: 'death', summary: { ...NO_REACTIONS, sad: 1 }, who: { sad: ['Drenvox'] } });
  assert.deepEqual(death.who, { sad: 'Sad · Drenvox', sit: '' });
});

test('a reaction taken back to nothing still says so (absolute zeros)', () => {
  const m = reactPushMessage({ feeds: ['moments:clan:3'], momentId: 9, momentKind: 'pet', summary: NO_REACTIONS, mine: true, who: {} });
  assert.equal(m.gz, 0);
  assert.equal(m.mineGz, false);
  assert.deepEqual(m.who, { gz: '' });
});
