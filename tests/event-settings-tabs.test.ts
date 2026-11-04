// An event's settings tabs and their search (lib/eventSettingsTabs). Pure.
//
// Run: npx tsx --test tests/event-settings-tabs.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SETTINGS_INDEX, searchSettings, staffTab, tabHref, tabsFor } from '../src/lib/eventSettingsTabs.ts';

const space = { creator: true, streams: true };
const clan = { creator: false, streams: false };
const streamingClan = { creator: false, streams: true };

test('a space and a clan get their own tab sets', () => {
  assert.deepEqual(tabsFor(space).map((t) => t.label), ['Event', 'Viewers', 'Stream', 'Board & play', 'Rules', 'More']);
  assert.deepEqual(tabsFor(clan).map((t) => t.label), ['Event', 'Board & play', 'Rules', 'Entry & co-hosts', 'Staff', 'More']);
  assert.ok(tabsFor(streamingClan).some((t) => t.key === 'stream'), 'a streaming clan gets the Stream tab');
});

test('tab links', () => {
  assert.equal(tabHref(7, 'event'), '/admin/events/7/settings');
  assert.equal(tabHref(7, 'board'), '/admin/events/7/settings/board');
  assert.equal(staffTab(space), 'stream');
  assert.equal(staffTab(clan), 'staff');
});

test('search finds a setting by its words, on the right tab, with its anchor', () => {
  const [top] = searchSettings('reveal', 7, clan);
  assert.equal(top.id, 'reveal');
  assert.equal(top.href, '/admin/events/7/settings/board#reveal');
  assert.equal(top.where, 'Board & play');
  assert.equal(searchSettings('leaderboard', 7, clan)[0].id, 'standings', 'by keyword');
  assert.equal(searchSettings('DATES', 7, clan)[0].id, 'schedule', 'case-insensitive');
});

test('search follows the host: staff lives on Stream in a space, co-hosts only in a clan', () => {
  assert.equal(searchSettings('mods', 7, space)[0].href, '/admin/events/7/settings/stream#staff');
  assert.equal(searchSettings('mods', 7, clan)[0].href, '/admin/events/7/settings/staff#staff');
  assert.ok(!searchSettings('co-host', 7, space).some((h) => h.id === 'cohosts'));
  assert.ok(searchSettings('co-host', 7, clan).some((h) => h.id === 'cohosts'));
  assert.ok(!searchSettings('overlay', 7, clan).some((h) => h.id === 'overlay'), 'no Stream tab, no overlay result');
  assert.ok(searchSettings('overlay', 7, streamingClan).some((h) => h.id === 'overlay'));
});

test('things that live elsewhere in the event are found too, after settings', () => {
  const hits = searchSettings('discord', 7, clan);
  const elsewhere = hits.find((h) => h.id === 'discord');
  assert.ok(elsewhere && elsewhere.elsewhere && elsewhere.href === '/admin/events/7/discord');
  assert.equal(searchSettings('', 7, clan).length, 0);
  assert.equal(searchSettings('zzzz', 7, clan).length, 0);
  assert.equal(searchSettings('rules discord', 7, clan)[0].id, 'rulebook', 'every word must match');
  assert.equal(searchSettings('house rules', 7, space)[0].href, '/admin/events/7/settings/rules#rulebook', 'the rules have their own tab');
});

test('every index entry has a unique id', () => {
  const ids = SETTINGS_INDEX.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});
