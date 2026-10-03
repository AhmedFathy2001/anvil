import test from 'node:test';
import assert from 'node:assert/strict';
import { pickActivePluginEvent } from '../src/lib/pluginEventPick.ts';

const NOW = '2026-10-03T12:00:00.000Z';

type Candidate = {
  eventId: number;
  teamId: number | null;
  startDate: string | null;
  endDate: string | null;
  forceEndedAt: string | null;
};

function event(overrides: Partial<Candidate> = {}): Candidate {
  return {
    eventId: 1,
    teamId: 10,
    startDate: '2026-10-02T12:00:00.000Z',
    endDate: '2026-10-04T12:00:00.000Z',
    forceEndedAt: null,
    ...overrides,
  };
}

test('an upcoming enrollment is not an active plugin event', () => {
  assert.equal(
    pickActivePluginEvent([event({ startDate: '2026-10-04T12:00:00.000Z' })], NOW),
    null,
  );
});

test('database space-format timestamps are compared as instants, not strings', () => {
  assert.equal(
    pickActivePluginEvent([event({ startDate: '2026-10-03 18:00:00' })], NOW),
    null,
    'a later time on the same day is still upcoming',
  );
});

test('an undated, ended, force-ended or unteamed enrollment is not active', () => {
  const rows = [
    event({ eventId: 1, startDate: null }),
    event({ eventId: 2, endDate: NOW }),
    event({ eventId: 3, forceEndedAt: '2026-10-03T11:00:00.000Z' }),
    event({ eventId: 4, teamId: null }),
  ];
  assert.equal(pickActivePluginEvent(rows, NOW), null);
});

test('the most recently started live event wins deterministically', () => {
  const pick = pickActivePluginEvent(
    [
      event({ eventId: 1, startDate: '2026-09-30T12:00:00.000Z' }),
      event({ eventId: 2, startDate: '2026-10-03T10:00:00.000Z' }),
      event({ eventId: 3, startDate: '2026-10-03T10:00:00.000Z' }),
      event({ eventId: 4, startDate: '2026-10-05T10:00:00.000Z' }),
    ],
    NOW,
  );
  assert.equal(pick?.eventId, 3, 'higher event id breaks an exact start-time tie');
});
