import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  authoringModel,
  staggeredTimes,
  unfinishedFormatJob,
} from '../src/lib/tileAuthoring.ts';

// The same preset table lib/eventAxes is tested against — these seven rows are one engine with
// different answers, and the point of this module is that authoring each one is a different job.
const PRESETS = {
  classic: { format: 'bingo', scoringMode: 'tiles', rules: null },
  leagues: { format: 'bingo', scoringMode: 'points', rules: null },
  race: { format: 'tilerace', scoringMode: 'tiles', rules: null },
  showdown: { format: 'bingo', scoringMode: 'points', rules: '{"revealPolicy":"scheduled"}' },
  luckydraw: { format: 'bingo', scoringMode: 'points', rules: '{"revealPolicy":"interval"}' },
  bounty: { format: 'bingo', scoringMode: 'points', rules: '{"revealPolicy":"bounty"}' },
  ladder: { format: 'ladder', scoringMode: 'points', rules: '{"revealPolicy":"rotating"}' },
} as const;

test('the page opens on the board where the board is the format', () => {
  // A square and a track carry their meaning in their layout, so editing them as a list hides it.
  assert.equal(authoringModel(PRESETS.classic).views[0], 'board');
  assert.equal(authoringModel(PRESETS.race).views[0], 'board');
  // A pool has no geometry to show.
  assert.equal(authoringModel(PRESETS.leagues).views[0], 'cards');
  assert.equal(authoringModel(PRESETS.showdown).views[0], 'cards');
});

test('each format offers its own view, and only its own', () => {
  // Schedule belongs to the board whose host writes the plan.
  assert.ok(authoringModel(PRESETS.showdown).views.includes('schedule'));
  assert.ok(!authoringModel(PRESETS.luckydraw).views.includes('schedule'));
  assert.ok(!authoringModel(PRESETS.classic).views.includes('schedule'));

  // Rotation belongs to the boards where the ENGINE picks what opens next.
  for (const key of ['luckydraw', 'bounty', 'ladder'] as const) {
    assert.ok(authoringModel(PRESETS[key]).views.includes('rotation'), key);
  }
  assert.ok(!authoringModel(PRESETS.showdown).views.includes('rotation'));
  assert.ok(!authoringModel(PRESETS.leagues).views.includes('rotation'));
});

test('every board keeps the general-purpose views', () => {
  for (const preset of Object.values(PRESETS)) {
    const views = authoringModel(preset).views;
    assert.ok(views.includes('cards'));
    assert.ok(views.includes('grid'));
  }
});

test('reordering means something different on every shape', () => {
  assert.equal(authoringModel(PRESETS.classic).ordering, 'grid'); // decides the lines
  assert.equal(authoringModel(PRESETS.race).ordering, 'sequence'); // decides what comes next
  assert.equal(authoringModel(PRESETS.luckydraw).ordering, 'draw-order'); // decides what's drawn next
  assert.equal(authoringModel(PRESETS.leagues).ordering, 'none'); // decides nothing
  // A scheduled board's plan is the times, not the positions.
  assert.equal(authoringModel(PRESETS.showdown).ordering, 'none');
});

test('a ladder never says tile', () => {
  const ladder = authoringModel(PRESETS.ladder);
  assert.equal(ladder.noun, 'task');
  assert.equal(ladder.NounPlural, 'Tasks');
  assert.match(ladder.brief, /task/);
  assert.doesNotMatch(ladder.brief, /tile/i);

  assert.equal(authoringModel(PRESETS.classic).noun, 'tile');
});

test('every format states its own job', () => {
  const briefs = Object.values(PRESETS).map((p) => authoringModel(p).brief);
  // Seven presets, seven different sentences — none of them the classic-bingo one by default.
  assert.equal(new Set(briefs).size, briefs.length);
});

test('an unscheduled showdown tile is a broken event, and says so', () => {
  const showdown = authoringModel(PRESETS.showdown);
  const job = unfinishedFormatJob(showdown, [
    { revealAt: '2026-08-16T18:00:00.000Z' },
    { revealAt: null },
    { revealAt: null },
  ]);
  assert.equal(job?.count, 2);
  assert.equal(job?.view, 'schedule');
  assert.match(job!.message, /hidden all event/);

  // Already revealed needs no plan — it happened.
  assert.equal(
    unfinishedFormatJob(showdown, [{ revealAt: null, revealedAt: '2026-08-16T18:00:00.000Z' }]),
    null,
  );
  // Fully planned board is quiet.
  assert.equal(unfinishedFormatJob(showdown, [{ revealAt: '2026-08-16T18:00:00.000Z' }]), null);
});

test('only a scheduled board has that job to be unfinished', () => {
  for (const key of ['classic', 'leagues', 'race', 'luckydraw', 'bounty', 'ladder'] as const) {
    assert.equal(unfinishedFormatJob(authoringModel(PRESETS[key]), [{ revealAt: null }]), null, key);
  }
});

test('staggering reveals walks forward by the interval', () => {
  const times = staggeredTimes('2026-08-16T18:00:00.000Z', 90, 3);
  assert.deepEqual(times, [
    '2026-08-16T18:00:00.000Z',
    '2026-08-16T19:30:00.000Z',
    '2026-08-16T21:00:00.000Z',
  ]);
  // Degenerate inputs don't produce a board full of Invalid Date.
  assert.deepEqual(staggeredTimes('not a date', 30, 3), []);
  assert.deepEqual(staggeredTimes('2026-08-16T18:00:00.000Z', 30, 0), []);
  // A zero interval would stack every reveal on one instant; the floor keeps them distinct.
  assert.equal(staggeredTimes('2026-08-16T18:00:00.000Z', 0, 2)[1], '2026-08-16T18:01:00.000Z');
});
