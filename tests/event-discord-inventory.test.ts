import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  channelStatusFromHttp,
  missingCount,
  playerRoleStatus,
  roleStatus,
  staleTeamColumns,
  storedCount,
  type InventoryItem,
  type TeamInventory,
} from '../src/lib/eventDiscordInventory.ts';

const item = (id: string | null, status: InventoryItem['status']): InventoryItem => ({ id, name: null, status });
const team = (role: InventoryItem, text: InventoryItem, voice: InventoryItem): TeamInventory => ({
  teamId: 1,
  name: 'Red',
  color: null,
  players: 3,
  role,
  text,
  voice,
});

test('a channel read maps to exists / missing / no-access / unknown', () => {
  assert.equal(channelStatusFromHttp(200), 'exists');
  assert.equal(channelStatusFromHttp(404), 'missing');
  assert.equal(channelStatusFromHttp(403), 'no-access');
  assert.equal(channelStatusFromHttp(500), 'unknown');
  assert.equal(channelStatusFromHttp(429), 'unknown');
});

test('a stored role is checked against the guild list; an unreadable list is unknown, not missing', () => {
  const roles = new Set(['1', '2']);
  assert.equal(roleStatus(null, roles), 'none');
  assert.equal(roleStatus('1', roles), 'exists');
  assert.equal(roleStatus('9', roles), 'missing');
  assert.equal(roleStatus('1', null), 'unknown');
});

test('the player role is unsafe when it carries powers automation refuses', () => {
  const roles = new Set(['p', 'admin']);
  const safe = new Set(['p']);
  assert.equal(playerRoleStatus(null, roles, safe), 'not-set');
  assert.equal(playerRoleStatus('p', roles, safe), 'exists');
  assert.equal(playerRoleStatus('admin', roles, safe), 'unsafe');
  assert.equal(playerRoleStatus('gone', roles, safe), 'missing');
  assert.equal(playerRoleStatus('p', null, null), 'unknown');
});

test('only ids Discord confirmed gone are forgotten — never hidden or unchecked ones', () => {
  assert.deepEqual(staleTeamColumns(team(item('r', 'missing'), item('t', 'exists'), item('v', 'missing'))), [
    'discordRoleId',
    'discordVoiceChannelId',
  ]);
  assert.deepEqual(staleTeamColumns(team(item('r', 'unknown'), item('t', 'no-access'), item(null, 'none'))), []);
});

test('missing count covers not-made and deleted things, and respects the event settings', () => {
  const teams = [team(item('r', 'exists'), item(null, 'none'), item('v', 'missing'))];
  const playerRole = { id: null, name: null, status: 'not-set' as const };
  assert.equal(missingCount({ teams, teamChannels: true, playerRole, playerRoleTiming: 'draft' }), 3);
  // Team channels off: nothing team-shaped is "missing".
  assert.equal(missingCount({ teams, teamChannels: false, playerRole, playerRoleTiming: 'draft' }), 1);
  // An event that hands out no player role does not want one made.
  assert.equal(missingCount({ teams, teamChannels: false, playerRole, playerRoleTiming: 'never' }), 0);
});

test('stored count is everything with an id, including the category', () => {
  const teams = [team(item('r', 'exists'), item(null, 'none'), item('v', 'missing'))];
  assert.equal(storedCount({ teams, category: item('c', 'exists') }), 3);
  assert.equal(storedCount({ teams: [], category: item(null, 'none') }), 0);
});
