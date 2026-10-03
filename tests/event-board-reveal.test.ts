import test from 'node:test';
import assert from 'node:assert/strict';
import { boardRevealIsDue } from '../src/lib/eventBoardReveal.ts';

const NOW = Date.parse('2026-10-03T12:00:00.000Z');

function event(overrides: Partial<Parameters<typeof boardRevealIsDue>[0]> = {}) {
  return {
    tilesRevealed: 0,
    tilesRevealAt: '2026-10-03T11:00:00.000Z',
    endDate: '2026-10-10T12:00:00.000Z',
    forceEndedAt: null,
    ...overrides,
  };
}

test('a hidden board reveals when its optional reveal time arrives', () => {
  assert.equal(boardRevealIsDue(event(), NOW), true);
  assert.equal(boardRevealIsDue(event({ tilesRevealAt: new Date(NOW).toISOString() }), NOW), true);
});

test('no optional time leaves reveal-at-start as the fallback', () => {
  assert.equal(boardRevealIsDue(event({ tilesRevealAt: null }), NOW), false);
});

test('future, visible, ended and force-ended boards do not auto-reveal', () => {
  assert.equal(boardRevealIsDue(event({ tilesRevealAt: '2026-10-03T13:00:00.000Z' }), NOW), false);
  assert.equal(boardRevealIsDue(event({ tilesRevealed: 1 }), NOW), false);
  assert.equal(boardRevealIsDue(event({ endDate: '2026-10-03T12:00:00.000Z' }), NOW), false);
  assert.equal(boardRevealIsDue(event({ forceEndedAt: '2026-10-03T11:30:00.000Z' }), NOW), false);
});
