// The Anvil Discord's supporter roles, the pure half: which roles a member gains and loses.
//
// Run: npx tsx --test tests/anvil-discord-roles.test.ts (no database).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { anvilRoleColor, botStanding, isRealDiscordId, planAnvilRoles } from '../src/lib/anvilDiscordRoles.ts';

const IDS = { supporter: 'r-sup', champion: 'r-champ', patron: 'r-pat', subscriber: 'r-sub' };

test('a tier in force gets its tier role and the subscriber role', () => {
  assert.deepEqual(planAnvilRoles('champion', ['other'], IDS), { add: ['r-champ', 'r-sub'], remove: [] });
});

test('changing tier swaps the tier role and keeps the subscriber role', () => {
  assert.deepEqual(planAnvilRoles('patron', ['r-champ', 'r-sub', 'other'], IDS), { add: ['r-pat'], remove: ['r-champ'] });
});

test('nothing in force takes every Anvil role off, and only those', () => {
  assert.deepEqual(planAnvilRoles(null, ['r-sup', 'r-sub', 'mod', 'other'], IDS), { add: [], remove: ['r-sup', 'r-sub'] });
});

test('already right means nothing to do', () => {
  assert.deepEqual(planAnvilRoles('supporter', ['r-sup', 'r-sub'], IDS), { add: [], remove: [] });
});

test('without a subscriber role only the tier role is managed', () => {
  const ids = { ...IDS, subscriber: null };
  assert.deepEqual(planAnvilRoles('supporter', ['r-sub'], ids), { add: ['r-sup'], remove: [] }, 'an unmanaged role is left alone');
});

test('a tier with no role made yet still gets the subscriber role', () => {
  assert.deepEqual(planAnvilRoles('patron', [], { supporter: 'r-sup', subscriber: 'r-sub' }), { add: ['r-sub'], remove: [] });
});

test('lab dummies and placeholders are not Discord ids', () => {
  assert.equal(isRealDiscordId('123456789012345678'), true);
  assert.equal(isRealDiscordId('lab-dummy-3'), false);
  assert.equal(isRealDiscordId('d-1-ref'), false);
  assert.equal(isRealDiscordId(null), false);
});

test('role colours come from the tier ink; the shared role has none', () => {
  assert.equal(anvilRoleColor('supporter'), 0xffd35c);
  assert.equal(anvilRoleColor('subscriber'), 0);
});

test('the bot can manage roles through any of its roles, and its top position is its highest', () => {
  const roles = [
    { id: 'g', name: '@everyone', position: 0, permissions: '0' },
    { id: 'bot', name: 'Anvil', position: 5, permissions: String(1 << 28) },
    { id: 'x', name: 'X', position: 9, permissions: '0' },
  ];
  assert.deepEqual(botStanding(['bot'], roles, 'g'), { canManageRoles: true, topPosition: 5 });
  assert.deepEqual(botStanding([], roles, 'g'), { canManageRoles: false, topPosition: 0 });
});
