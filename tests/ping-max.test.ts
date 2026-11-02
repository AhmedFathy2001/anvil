// Image-less ping ceilings (lib/pingMax): which tiles opt in, and what a ping above the ceiling does.
// Pure.
//
// Run: npx tsx --test tests/ping-max.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  actionMax,
  decidePing,
  tilePingMax,
  BIG_PING_FLAG,
  DEFAULT_PING_MAX,
  OVER_ACTION_MAX_FLAG,
} from '../src/lib/pingMax.ts';
import { GAME_COUNTERS, gameCounterActionMax } from '../src/lib/gameCounters.ts';
import { COUNTER_TARGETS } from '../src/lib/constants.ts';

test('per-action maxima: NPCs and per-line counters step by one', () => {
  assert.equal(actionMax('Zulrah'), 1);
  assert.equal(actionMax('Guardians of the Rift searches'), 1);
  assert.equal(actionMax('Vale research points'), 5);
  assert.equal(actionMax('GOTR elemental energy'), 10);
  assert.equal(actionMax('gotr TOTAL energy'), 14); // case-insensitive
});

test('game-value counters reuse maxDelta', () => {
  assert.equal(actionMax("Giants' Foundry reputation"), 200);
  assert.equal(actionMax('Tithe Farm points'), 40);
  assert.equal(actionMax('Wintertodt rewards earned'), 30);
  assert.equal(actionMax('Slayer tasks: any master'), 1); // `changes`: one per tick
  for (const c of GAME_COUNTERS) {
    const chip = COUNTER_TARGETS.find((t) => t.name === c.name);
    assert.equal(chip?.actionMax, gameCounterActionMax(c), c.name);
  }
});

test('tilePingMax: only tiles with a target stepping by more than 10 opt in', () => {
  assert.equal(tilePingMax(['Zulrah', 'Vorkath']), null);
  assert.equal(tilePingMax([]), null);
  assert.equal(tilePingMax(null), null);
  assert.equal(tilePingMax(['GOTR elemental energy']), null); // ≤ 10 a game: the flat ceiling covers it
  assert.equal(tilePingMax(['GOTR total energy']), 14);
  assert.equal(tilePingMax(['Tithe Farm points', "Giants' Foundry reputation"]), 200); // the largest
  assert.equal(tilePingMax(['Zulrah', 'Wintertodt rewards earned']), 30);
});

test('decidePing: tiles that do not opt in keep the flat clamp', () => {
  assert.deepEqual(decidePing(1, null), { amount: 1, flag: null });
  assert.deepEqual(decidePing(DEFAULT_PING_MAX, null), { amount: 10, flag: null });
  assert.deepEqual(decidePing(11, null), { amount: 10, flag: BIG_PING_FLAG });
  assert.deepEqual(decidePing(9999, null), { amount: 10, flag: BIG_PING_FLAG });
});

test('decidePing: opted-in tiles take up to their ceiling, and count-but-flag above it', () => {
  assert.deepEqual(decidePing(150, 200), { amount: 150, flag: null });
  assert.deepEqual(decidePing(200, 200), { amount: 200, flag: null });
  assert.deepEqual(decidePing(201, 200), { amount: 201, flag: OVER_ACTION_MAX_FLAG });
  assert.deepEqual(decidePing(14, 14), { amount: 14, flag: null });
  assert.deepEqual(decidePing(15, 14), { amount: 15, flag: OVER_ACTION_MAX_FLAG });
});
