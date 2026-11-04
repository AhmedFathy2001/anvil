// One line per character on the profile: member of which clan (and how fresh its in-game list is),
// guest where, or nowhere yet (lib/characterStanding).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standingLine, syncAgo, type StandingSeat } from '../src/lib/characterStanding.ts';

const NOW = Date.parse('2026-11-02T12:00:00Z');
const seat = (over: Partial<StandingSeat>): StandingSeat => ({
  seatId: 1,
  accountId: 1,
  kind: 'guest',
  clanId: 1,
  clanName: 'Iron Foundry',
  clanSlug: 'ironfoundry',
  ...over,
});

test('no seats says so plainly', () => {
  assert.equal(standingLine([], new Map(), NOW), 'Not on any clan’s member list yet');
});

test('a member seat names the clan and how long ago its list synced', () => {
  const line = standingLine([seat({ kind: 'member' })], new Map([[1, '2026-11-02 09:00:00']]), NOW);
  assert.equal(line, 'Member of Iron Foundry · list synced 3h ago');
});

test('a member clan that never synced says that instead of a time', () => {
  assert.equal(
    standingLine([seat({ kind: 'member' })], new Map(), NOW),
    'Member of Iron Foundry · list not synced yet',
  );
});

test('guest seats follow, listed together', () => {
  const line = standingLine(
    [seat({ kind: 'member' }), seat({ clanId: 2, clanName: 'Blue Moon' }), seat({ clanId: 3, clanName: 'Zenyte' })],
    new Map([[1, '2026-11-02T11:58:00.000Z']]),
    NOW,
  );
  assert.equal(line, 'Member of Iron Foundry · list synced 2m ago · Guest in Blue Moon, Zenyte');
  assert.equal(standingLine([seat({})], new Map(), NOW), 'Guest in Iron Foundry');
});

test('syncAgo reads both timestamp formats and rounds to a readable unit', () => {
  assert.equal(syncAgo('2026-11-02 12:00:00', NOW), 'just now');
  assert.equal(syncAgo('2026-10-29T12:00:00Z', NOW), '4d ago');
  assert.equal(syncAgo(null, NOW), null);
  assert.equal(syncAgo('garbage', NOW), null);
});

test('a creator space seat reads "Plays in", never "Guest in"', () => {
  const line = standingLine([seat({ clanName: 'Streamer Space', creator: true }), seat({ clanId: 2, clanName: 'Iron Foundry' })], new Map(), NOW);
  assert.equal(line, 'Guest in Iron Foundry · Plays in Streamer Space');
});

test('a creator space is never "Member of": any seat there reads "Plays in", after the clans', () => {
  const line = standingLine(
    [seat({ kind: 'member', clanName: 'Streamer Space', creator: true }), seat({ clanId: 2, kind: 'member', clanName: 'Iron Foundry' })],
    new Map([[2, '2026-11-02 11:00:00']]),
    NOW,
  );
  assert.equal(line, 'Member of Iron Foundry · list synced 1h ago · Plays in Streamer Space');
});
