import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HCW_PROBE_EVERY_MS, MODE_READ_EVERY_MS, modeReadWanted, planModeRead, type WeeklyModeRow } from '../src/lib/weeklyModePlan.ts';
import type { HiscoresSnapshot } from '../src/lib/hiscores.ts';

const snap = { skills: {}, bosses: {} } as unknown as HiscoresSnapshot;
const row = (over: Partial<WeeklyModeRow> = {}): WeeklyModeRow => ({
  participantId: 1,
  competitionId: 9,
  countsOn: 'main+hardcore',
  type: 'skill',
  metric: 'woodcutting',
  startDate: '2026-11-23T00:00:00.000Z',
  rsn: 'Anvil Plugin',
  hiscoresTable: null,
  baselineValue: null,
  currentValue: null,
  lastUpdated: null,
  ...over,
});
const K = 'anvil plugin';

test('mixed: an entrant the main read never found is pinned to Hardcore Worlds when it is there', () => {
  const reads = new Map([[`${K}|hardcore_mains`, { at: 'x', snapshot: snap }]]);
  assert.deepEqual(planModeRead(row(), reads, K), { action: 'apply', table: 'hardcore_mains', snapshot: snap, pin: true });
  assert.deepEqual(planModeRead(row({ baselineValue: 5 }), reads, K), { action: 'none' }, 'a main-game player keeps the main table');
  assert.deepEqual(planModeRead(row(), new Map([[`${K}|hardcore_mains`, { at: 'x', snapshot: null }]]), K), { action: 'none' }, 'not on Hardcore Worlds either');
});

test('pinned: read from its table; gone from Hardcore Worlds after a start is a death', () => {
  const pinned = row({ hiscoresTable: 'hardcore_mains', baselineValue: 100 });
  assert.deepEqual(planModeRead(pinned, new Map([[`${K}|hardcore_mains`, { at: 'x', snapshot: snap }]]), K), { action: 'apply', table: 'hardcore_mains', snapshot: snap, pin: false });
  assert.deepEqual(planModeRead(pinned, new Map([[`${K}|hardcore_mains`, { at: 'x', snapshot: null }]]), K), { action: 'stop' });
  assert.deepEqual(planModeRead(row({ hiscoresTable: 'hardcore_mains' }), new Map([[`${K}|hardcore_mains`, { at: 'x', snapshot: null }]]), K), { action: 'none' }, 'no start yet: nothing to stop');
});

test('a mode on its own reads every entrant from that table, and never stops on a miss', () => {
  const leagues = row({ countsOn: 'leagues' });
  assert.deepEqual(planModeRead(leagues, new Map([[`${K}|seasonal`, { at: 'x', snapshot: snap }]]), K), { action: 'apply', table: 'seasonal', snapshot: snap, pin: true });
  assert.deepEqual(planModeRead(row({ countsOn: 'leagues', baselineValue: 3 }), new Map([[`${K}|seasonal`, { at: 'x', snapshot: null }]]), K), { action: 'none' });
});

test('what gets queued', () => {
  const now = Date.parse('2026-11-24T12:00:00Z');
  assert.deepEqual(modeReadWanted(row({ countsOn: 'leagues' }), now, null), { table: 'seasonal', priority: 0 }, 'the start straight away');
  const read = new Date(now - MODE_READ_EVERY_MS + 1000).toISOString();
  assert.equal(modeReadWanted(row({ countsOn: 'leagues', baselineValue: 1, lastUpdated: read }), now, null), null, 'read under an hour ago');
  assert.deepEqual(modeReadWanted(row({ countsOn: 'leagues', baselineValue: 1, lastUpdated: '2026-11-24T10:00:00.000Z' }), now, null), { table: 'seasonal', priority: 1 });
  assert.deepEqual(modeReadWanted(row(), now, null), { table: 'hardcore_mains', priority: 0 }, 'a mixed entrant with no start is looked for');
  assert.equal(modeReadWanted(row(), now, now - HCW_PROBE_EVERY_MS + 1000), null, 'not again within six hours');
  assert.equal(modeReadWanted(row({ baselineValue: 4 }), now, null), null, 'a main-game player needs nothing from here');
});
