import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  eventAxes,
  supportsMissions,
  supportsRevealPolicy,
  taskNoun,
} from '../src/lib/eventAxes.ts';

// The named modes as they are actually stored, straight from lib/eventModes' presets. The point of
// the axes is that these seven rows are the SAME engine with different answers — so the test reads
// as a table of presets, and each assertion below names the axis that preset is really about.
const PRESETS = {
  classic: { format: 'bingo', scoringMode: 'tiles', rules: null },
  leagues: { format: 'bingo', scoringMode: 'points', rules: null },
  race: { format: 'tilerace', scoringMode: 'tiles', rules: null },
  showdown: { format: 'bingo', scoringMode: 'points', rules: '{"revealPolicy":"scheduled"}' },
  luckydraw: { format: 'bingo', scoringMode: 'points', rules: '{"revealPolicy":"interval"}' },
  bounty: { format: 'bingo', scoringMode: 'points', rules: '{"revealPolicy":"bounty"}' },
  ladder: { format: 'ladder', scoringMode: 'points', rules: '{"revealPolicy":"rotating"}' },
} as const;

test('board shape follows the geometry, not the mode name', () => {
  assert.equal(eventAxes(PRESETS.classic).shape, 'grid'); // a true N×N square
  assert.equal(eventAxes(PRESETS.race).shape, 'track');
  // Everything point-scored is a flat pool, ladder included — it ranks people, not tiles.
  for (const key of ['leagues', 'showdown', 'luckydraw', 'bounty', 'ladder'] as const) {
    assert.equal(eventAxes(PRESETS[key]).shape, 'list', key);
  }
});

test('only a ladder ranks individuals', () => {
  assert.equal(eventAxes(PRESETS.ladder).competitors, 'individuals');
  for (const key of ['classic', 'leagues', 'race', 'showdown', 'luckydraw', 'bounty'] as const) {
    assert.equal(eventAxes(PRESETS[key]).competitors, 'teams', key);
  }
});

test('showdown, lucky draw, bounty and ladder differ only in how tasks open', () => {
  assert.equal(eventAxes(PRESETS.showdown).opening, 'scheduled');
  assert.equal(eventAxes(PRESETS.luckydraw).opening, 'interval');
  assert.equal(eventAxes(PRESETS.bounty).opening, 'bounty');
  assert.equal(eventAxes(PRESETS.ladder).opening, 'rotating');
  // ...and are otherwise identical to each other on every remaining axis.
  const { shape, scoring } = eventAxes(PRESETS.showdown);
  for (const key of ['luckydraw', 'bounty'] as const) {
    const a = eventAxes(PRESETS[key]);
    assert.equal(a.shape, shape, key);
    assert.equal(a.scoring, scoring, key);
  }
});

test('a board is live when anything opens on a schedule rather than all at once', () => {
  assert.equal(eventAxes(PRESETS.classic).live, false);
  assert.equal(eventAxes(PRESETS.leagues).live, false);
  for (const key of ['showdown', 'luckydraw', 'bounty', 'ladder'] as const) {
    assert.equal(eventAxes(PRESETS[key]).live, true, key);
  }
});

test('run length is the end date, which is what makes a ladder long-lived', () => {
  assert.equal(eventAxes({ ...PRESETS.ladder, endDate: null }).runLength, 'rolling');
  assert.equal(eventAxes({ ...PRESETS.ladder, endDate: '2026-09-01T00:00:00.000Z' }).runLength, 'bounded');
  // Nothing about it is ladder-specific: a bingo with no end date rolls too.
  assert.equal(eventAxes({ ...PRESETS.classic, endDate: null }).runLength, 'rolling');
});

test('missions are for team boards; a ladder is already a mission pool', () => {
  assert.equal(supportsMissions(eventAxes(PRESETS.ladder)), false);
  assert.equal(supportsMissions(eventAxes(PRESETS.classic)), true);
  assert.equal(supportsMissions(eventAxes(PRESETS.leagues)), true);
});

test('reveal policies need point scoring to be worth anything', () => {
  assert.equal(supportsRevealPolicy(eventAxes(PRESETS.classic)), false); // tile-scored grid
  assert.equal(supportsRevealPolicy(eventAxes(PRESETS.race)), false);
  assert.equal(supportsRevealPolicy(eventAxes(PRESETS.leagues)), true);
  assert.equal(supportsRevealPolicy(eventAxes(PRESETS.ladder)), true);
});

test('an individual board calls its entries tasks, not tiles', () => {
  assert.equal(taskNoun(eventAxes(PRESETS.ladder)), 'task');
  assert.equal(taskNoun(eventAxes(PRESETS.classic)), 'tile');
});

test('malformed or missing rules fall back to everything-visible', () => {
  assert.equal(eventAxes({ format: 'bingo', scoringMode: 'points', rules: 'not json' }).opening, 'all');
  assert.equal(eventAxes({}).opening, 'all');
  assert.equal(eventAxes({}).shape, 'grid');
});
