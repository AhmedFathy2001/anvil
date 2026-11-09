// "Only my team's chat": event staff who play on a team can hide the other teams' channels.
// Pure: the rules (lib/eventChatRules) and the plugin chat pane (lib/pluginUi/feedUi).
//
// Run: npx tsx --test tests/own-team-chat.test.ts

import assert from 'node:assert/strict';
import test from 'node:test';

import { canChooseOwnTeamChat, canPostChannel, canReadChannel, ownTeamChatLabel } from '../src/lib/eventChatRules.ts';
import { feedTabUi } from '../src/lib/pluginUi/feedUi.ts';

const staffOnRuby = { member: true, staff: true, rank: 2, teamId: 4 };

test('staff read every team’s channel; with ownTeamOnly only their own, like a player', () => {
  assert.equal(canReadChannel(staffOnRuby, 'team:7'), true);
  assert.equal(canReadChannel({ ...staffOnRuby, ownTeamOnly: true }, 'team:7'), false);
  assert.equal(canReadChannel({ ...staffOnRuby, ownTeamOnly: true }, 'team:4'), true);
  assert.equal(canReadChannel({ ...staffOnRuby, ownTeamOnly: true }, 'all'), true);
  assert.equal(canReadChannel({ ...staffOnRuby, ownTeamOnly: true }, 'announce'), true);
  const player = { member: true, staff: false, rank: 0, teamId: 4 };
  assert.equal(canReadChannel(player, 'team:7'), false);
  assert.equal(canReadChannel({ ...player, ownTeamOnly: true }, 'team:4'), true);
});

test('posting follows reading; announcements stay with staff rank', () => {
  const narrowed = { ...staffOnRuby, ownTeamOnly: true };
  assert.equal(canPostChannel(narrowed, 'team:7'), false);
  assert.equal(canPostChannel(narrowed, 'team:4'), true);
  assert.equal(canPostChannel(narrowed, 'announce'), true);
  assert.equal(canPostChannel(narrowed, 'all'), true);
  assert.equal(canPostChannel(staffOnRuby, 'team:7'), true);
});

test('offered only to event staff seated on a team', () => {
  assert.equal(canChooseOwnTeamChat({ staffKind: 'event', teamId: 4 }), true);
  assert.equal(canChooseOwnTeamChat({ staffKind: 'event', teamId: null }), false, 'staff without a team');
  assert.equal(canChooseOwnTeamChat({ staffKind: 'platform', teamId: 4 }), false, 'Anvil staff');
  assert.equal(canChooseOwnTeamChat({ staffKind: null, teamId: 4 }), false, 'a player');
  assert.equal(canChooseOwnTeamChat({ staffKind: 'event', teamId: 4, solo: true }), false, 'a solo board has no team channels');
});

test('the switch says what pressing it does', () => {
  assert.deepEqual(ownTeamChatLabel(false), { label: 'Only my team’s chat', tip: 'Hide other teams’ chats while you play' });
  assert.equal(ownTeamChatLabel(true).label, 'See every team’s chat');
});

const board = { kind: 'event' as const, id: 9, name: 'Winter Bingo' };
const base = {
  scopes: [board],
  current: board,
  pane: 'chat' as const,
  chatAvailable: true,
  filter: 'team:4',
  teamId: 4,
  rows: [],
  chans: [{ label: 'My team', on: true, act: { a: 'load' as const, v: 'feed' }, feed: 'chat:9:team:4' }],
};
const flip = (on: boolean) => ({ a: 'post' as const, act: 'chat-own-team', args: { e: '9', on: on ? '0' : '1', s: 'event:9', f: 'team' } });
const picks = [
  { label: 'Ruby', on: true, act: { a: 'load' as const, v: 'feed' } },
  { label: 'Jade', on: false, act: { a: 'load' as const, v: 'feed' } },
];

test('chat pane: staff reading every team see the chips and the "Only my team’s chat" link', () => {
  const ui = JSON.stringify(feedTabUi({ ...base, teamPicks: picks, ownTeam: { on: false, act: flip(false) }, staff: true }));
  assert.match(ui, /"s":"Jade"/);
  assert.match(ui, /"s":"Only my team’s chat"[^}]*"on":\{"a":"post","act":"chat-own-team","args":\{"e":"9","on":"1"/);
  assert.match(ui, /"tip":"Hide other teams’ chats while you play"/);
});

test('chat pane: with ownTeamOnly on, no team chips and the link reads "See every team’s chat"', () => {
  // chatPane (lib/pluginUi/feedView) sends no teamPicks while ownTeamOnly is on.
  const ui = JSON.stringify(feedTabUi({ ...base, teamPicks: null, ownTeam: { on: true, act: flip(true) }, staff: true }));
  assert.doesNotMatch(ui, /"s":"Jade"/);
  assert.match(ui, /"s":"See every team’s chat"[^}]*"act":"chat-own-team","args":\{"e":"9","on":"0"/);
  assert.match(ui, /"act":"chat-pause"/, 'pause stays');
});

test('chat pane: no switch for a player, or on the feed pane', () => {
  assert.doesNotMatch(JSON.stringify(feedTabUi({ ...base })), /chat-own-team/);
  assert.doesNotMatch(JSON.stringify(feedTabUi({ ...base, pane: 'feed', filter: 'all', ownTeam: { on: false, act: flip(false) } })), /chat-own-team/);
});
