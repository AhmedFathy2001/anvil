import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eligibleSinceReveal, gainSinceReveal, parseRevealStats } from '../src/lib/revealStats';

// The 9pm "1 TFA KC" mission: a player who banked 3 KC at noon must not finish it on the announce.
const stats = parseRevealStats(JSON.stringify({ 7: { g: 3, l: 3 }, 8: { g: 0, l: 0 } }));

test('only what is done after the announce counts', () => {
  assert.equal(gainSinceReveal(3, stats, 7), 0);
  assert.equal(gainSinceReveal(4, stats, 7), 1);
  assert.equal(gainSinceReveal(1, stats, 8), 1);
});

test('a player with no capture counts from their own baseline', () => {
  assert.equal(gainSinceReveal(2, stats, 99), 2);
  assert.equal(gainSinceReveal(5, null, 7), 5);
});

test('never negative when a reading lags behind the captured one', () => {
  assert.equal(gainSinceReveal(1, stats, 7), 0);
});

test('a milestone mission is out of reach for anyone already past it at the announce', () => {
  assert.equal(eligibleSinceReveal(stats, 7, 1), false);
  assert.equal(eligibleSinceReveal(stats, 8, 1), true);
  assert.equal(eligibleSinceReveal(stats, 99, 1), true);
});

test('unparseable capture reads as none', () => {
  assert.equal(parseRevealStats('nope'), null);
  assert.equal(parseRevealStats(null), null);
});
