// The settings map (lib/eventSettingsMap): every setting with its current value and a link.
// Run: node --experimental-strip-types --test tests/event-settings-map.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { settingsMap, type MapFacts } from '../src/lib/eventSettingsMap.ts';
import { SETTINGS_INDEX, tabsFor } from '../src/lib/eventSettingsTabs.ts';

const facts: MapFacts = {
  name: 'Autumn Bingo',
  formatLabel: 'Classic bingo',
  boardSize: 5,
  startDate: '2026-11-20T18:00:00.000Z',
  endDate: null,
  tilesRevealed: false,
  tilesRevealAt: null,
  revealPolicy: 'all',
  standings: 'live',
  worldModeCount: 0,
  visibility: 'clan',
  signupsEnabled: true,
  signupFee: 2_000_000,
  teamPlacement: 'auto',
  teamCount: 4,
  fmtDate: (iso) => iso.slice(0, 10),
};
const clan = { creator: false, streams: false };
const space = { creator: true, streams: true };

test('groups follow the tab order, then the pages outside Settings', () => {
  const groups = settingsMap(7, clan, facts);
  const order = groups.map((g) => g.label);
  assert.deepEqual(order.slice(0, 3), ['Event', 'Board & play', 'Entry & co-hosts']);
  assert.equal(order[order.length - 1], 'Also for this event');
});

test('rows carry the current value', () => {
  const rows = Object.fromEntries(settingsMap(7, clan, facts).flatMap((g) => g.rows).map((r) => [r.id, r.value]));
  assert.equal(rows.look, 'Autumn Bingo');
  assert.equal(rows.format, 'Classic bingo, 5x5');
  assert.equal(rows.schedule, '2026-11-20 to no end date');
  assert.equal(rows.reveal, 'Hidden until the start');
  assert.equal(rows.access, 'Your clan');
  assert.equal(rows.signups, 'Sign-up form on, 2,000,000 gp fee');
  assert.equal(rows.teams, 'Auto-balance, 4 teams');
});

test('no dates reads as no dates, a dated reveal names the date', () => {
  const none = Object.fromEntries(settingsMap(7, clan, { ...facts, startDate: null }).flatMap((g) => g.rows).map((r) => [r.id, r.value]));
  assert.equal(none.schedule, 'No dates set');
  const dated = Object.fromEntries(settingsMap(7, clan, { ...facts, tilesRevealAt: '2026-11-19T00:00:00.000Z' }).flatMap((g) => g.rows).map((r) => [r.id, r.value]));
  assert.equal(dated.reveal, 'Hidden until 2026-11-19');
});

test('links are the same anchors the search uses; nothing is invented or dropped', () => {
  const rows = settingsMap(7, clan, facts).flatMap((g) => g.rows.filter((r) => !r.elsewhere));
  assert.ok(rows.every((r) => r.href.startsWith('/admin/events/7/settings') && r.href.includes('#')));
  assert.ok(rows.find((r) => r.id === 'reveal')!.href.endsWith('/settings/board#reveal'));
  // Every in-Settings entry the host can have appears once.
  const expected = SETTINGS_INDEX.filter((e) => !e.elsewhere && !e.clanPath && (!e.only || e.only(clan)) && tabsFor(clan).some((t) => t.key === (typeof e.tab === 'function' ? e.tab(clan) : e.tab)));
  assert.equal(rows.length, expected.length);
});

test('a creator space does not get co-host rows', () => {
  const ids = settingsMap(7, space, facts).flatMap((g) => g.rows).map((r) => r.id);
  assert.ok(!ids.includes('cohosts'));
  assert.ok(ids.includes('overlay'));
});
