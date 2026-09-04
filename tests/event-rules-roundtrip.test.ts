import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEventRules, parseEventRules } from '../src/lib/eventRules.ts';

// validateEventRules stores NULL when every field is at its default, so anything that is genuinely a
// SETTING has to be part of that check — otherwise turning it on, alone, saves nothing at all and
// the UI reports success. One test per rule that can stand by itself.

function roundTrip(input: unknown) {
  const result = validateEventRules(input);
  assert.ok(!('error' in result), `rejected: ${'error' in result ? result.error : ''}`);
  return parseEventRules(result.rules);
}

test('month-end config survives on its own', () => {
  const back = roundTrip({ monthlyAward: { announce: true, roleId: '123' } });
  assert.equal(back.monthlyAward?.roleId, '123');
  assert.equal(back.monthlyAward?.announce, true);
});

test('a daily mission schedule survives on its own', () => {
  const back = roundTrip({
    mission: {
      announceMode: 'daily',
      order: 'random',
      intervalMinutes: 60,
      tierRamp: [],
      daily: { timezone: 'Europe/London', times: ['20:00'], window: null, perDay: [2, 1, 1, 1, 1, 1, 2] },
    },
  });
  assert.equal(back.mission?.announceMode, 'daily');
  assert.equal(back.mission?.daily?.timezone, 'Europe/London');
  assert.deepEqual(back.mission?.daily?.perDay, [2, 1, 1, 1, 1, 1, 2]);
});

test('a window schedule keeps its range', () => {
  const back = roundTrip({
    mission: {
      announceMode: 'daily',
      order: 'random',
      intervalMinutes: 60,
      tierRamp: [],
      daily: { timezone: 'UTC', times: [], window: { from: '18:00', to: '23:00' }, perDay: [1, 1, 1, 1, 1, 1, 1] },
    },
  });
  assert.deepEqual(back.mission?.daily?.window, { from: '18:00', to: '23:00' });
});

test('a daily schedule that could never fire is refused rather than stored', () => {
  const noTimes = validateEventRules({
    mission: { announceMode: 'daily', order: 'random', intervalMinutes: 60, tierRamp: [], daily: {} },
  });
  assert.ok('error' in noTimes);

  const noDays = validateEventRules({
    mission: {
      announceMode: 'daily',
      order: 'random',
      intervalMinutes: 60,
      tierRamp: [],
      daily: { timezone: 'UTC', times: ['20:00'], window: null, perDay: [0, 0, 0, 0, 0, 0, 0] },
    },
  });
  assert.ok('error' in noDays);
});

test('an empty rules object still stores nothing', () => {
  const result = validateEventRules({});
  assert.ok(!('error' in result));
  assert.equal(result.rules, null);
});
