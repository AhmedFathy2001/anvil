// What a server set for Anvil's commands in Discord, in words (lib/discordCommandPermissions). Pure.
//
// Run: npx tsx --test tests/discord-command-permissions.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { allChannelsId, describeCommandPermissions, describePermissions } from '../src/lib/discordCommandPermissions.ts';

const GUILD = '1000000000000000000';
const ALL = '999999999999999999';
const names = {
  guildId: GUILD,
  roles: new Map([['11', 'Officers'], ['12', 'Members'], ['13', 'Muted'], ['14', 'Staff']]),
  channels: new Map([['21', 'bot-commands'], ['22', 'general']]),
};
const role = (id: string, permission: boolean) => ({ id, type: 1, permission });
const user = (id: string, permission: boolean) => ({ id, type: 2, permission });
const chan = (id: string, permission: boolean) => ({ id, type: 3, permission });

test('"every channel" is the server id minus one', () => {
  assert.equal(allChannelsId(GUILD), ALL);
  assert.equal(allChannelsId('not a number'), null);
});

test('nothing changed reads as nothing', () => {
  assert.equal(describePermissions(undefined, names), null);
  assert.equal(describePermissions([], names), null);
  // Explicitly on for everyone, everywhere: still the default.
  assert.equal(describePermissions([role(GUILD, true), chan(ALL, true)], names), null);
});

test('who may use it', () => {
  assert.equal(describePermissions([role(GUILD, false)], names), 'Hidden from everyone.');
  assert.equal(describePermissions([role(GUILD, false), role('11', true)], names), 'Only @Officers can use it.');
  assert.equal(describePermissions([role(GUILD, false), role('11', true), role('14', true), user('5', true)], names), 'Only @Officers, @Staff and 1 person can use it.');
  assert.equal(describePermissions([role('13', false)], names), 'Off for @Muted.');
  assert.equal(describePermissions([role('99', false)], names), 'Off for @a role.', 'a role the bot could not name');
});

test('where it may be used, and both together', () => {
  assert.equal(describePermissions([chan(ALL, false), chan('21', true)], names), 'Only in #bot-commands.');
  assert.equal(describePermissions([chan(ALL, false)], names), 'Off in every channel.');
  assert.equal(describePermissions([chan('22', false)], names), 'Not in #general.');
  assert.equal(describePermissions([role(GUILD, false), role('11', true), chan(ALL, false), chan('21', true)], names), 'Only @Officers can use it. Only in #bot-commands.');
});

test('a long list is cut after three', () => {
  const many = [role(GUILD, false), role('11', true), role('12', true), role('13', true), role('14', true)];
  assert.equal(describePermissions(many, names), 'Only @Officers, @Members, @Muted and 1 more can use it.');
});

test('the whole response: the integration-wide setting, and commands with their own', () => {
  const APP = '7000';
  const out = describeCommandPermissions(
    [
      { id: APP, permissions: [role(GUILD, false), role('12', true)] },
      { id: '8001', permissions: [role(GUILD, false), role('11', true)] },
      { id: '8002', permissions: [chan(ALL, true)] },
      { id: '8003', permissions: [chan('22', false)] },
      { id: '9999', permissions: [role(GUILD, false)] },
    ],
    APP,
    new Map([['8001', 'coffer'], ['8002', 'stats'], ['8003', 'bingo']]),
    names,
  );
  assert.equal(out.all, 'Only @Members can use it.');
  assert.deepEqual(out.byCommand, { coffer: 'Only @Officers can use it.', bingo: 'Not in #general.' });
  assert.deepEqual(describeCommandPermissions([], APP, new Map(), names), { all: null, byCommand: {} });
});
