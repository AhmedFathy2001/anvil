// The in-game chat relay (lib/push/relay) and event chat in the game chatbox (lib/eventChatRules chat
// tags and chatbox lines). Pure.
//
// Run: npx tsx --test tests/chat-relay.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chatTagOf, chatboxLines, cleanChatTag, deriveChatTag } from '../src/lib/eventChatRules.ts';
import { parseEventRules, validateEventRules } from '../src/lib/eventRules.ts';
import { RELAY_BURST, RelayHub, accountIcon, lineSigned, relayKey, type RelayClient } from '../src/lib/push/relay.ts';
import { signTicket, ticketKey, verifyTicket } from '../src/lib/push/ticket.ts';

const key = relayKey('secret');

function client(userId: number, name: string, clanId: number | null = null): RelayClient & { got: Record<string, unknown>[] } {
  const got: Record<string, unknown>[] = [];
  return { userId, who: { name, icon: null, clanId }, send: (m) => got.push(JSON.parse(m)), got };
}

test('public goes to the world room only, never back to the sender', () => {
  let now = 1_000;
  const hub = new RelayHub(key, () => now);
  const a = client(1, 'Alice');
  const b = client(2, 'Bob');
  const c = client(3, 'Carol');
  const a2 = client(1, 'Alice'); // Alice's second client
  for (const x of [a, b, c, a2]) hub.add(x);
  hub.receive(a, { t: 'rooms', w: 302 });
  hub.receive(b, { t: 'rooms', w: 302 });
  hub.receive(c, { t: 'rooms', w: 330 });
  hub.receive(a2, { t: 'rooms', w: 302 });
  assert.equal(hub.receive(a, { t: 'say', c: 'public', x: 'hello world' }), null);
  assert.equal(b.got.length, 1);
  assert.equal(c.got.length, 0, 'another world hears nothing');
  assert.equal(a.got.length + a2.got.length, 0, 'none of the sender’s own sockets');
  const m = b.got[0];
  assert.equal(m.t, 'relay');
  assert.equal(m.c, 'public');
  assert.equal(m.n, 'Alice');
  assert.equal(m.x, 'hello world');
  assert.ok(lineSigned(key, 1, 'public', 'hello world', m.at as number, m.k), 'signed for a report');
  assert.ok(!lineSigned(key, 1, 'public', 'something else', m.at as number, m.k), 'a changed line is not');
  // Hopping: out of the old world's room, into the new one.
  hub.receive(b, { t: 'rooms', w: 330 });
  assert.equal(hub.roomSize('world:302'), 2);
  now += 1;
  hub.receive(a, { t: 'say', c: 'public', x: 'again' });
  assert.equal(b.got.length, 1);
});

test('clan goes to the roster clan from the ticket; gim to the group the plugin reads', () => {
  const hub = new RelayHub(key, () => 5_000);
  const a = client(1, 'Alice', 7);
  const b = client(2, 'Bob', 7);
  const c = client(3, 'Carol', 8);
  for (const x of [a, b, c]) hub.add(x);
  hub.receive(a, { t: 'say', c: 'clan', x: 'clan line' });
  assert.equal(b.got.length, 1);
  assert.equal(c.got.length, 0);
  assert.equal(hub.receive(a, { t: 'say', c: 'gim', x: 'gim line' }), 'no-room', 'no group said yet');
  hub.receive(a, { t: 'rooms', g: 'Iron Bros' });
  hub.receive(c, { t: 'rooms', g: 'iron bros' });
  hub.receive(a, { t: 'say', c: 'gim', x: 'gim line' });
  assert.equal(c.got.length, 1);
  assert.equal(c.got[0].c, 'gim');
  assert.equal(hub.receive(a, { t: 'rooms', g: '<img=1>bad name that is long' }), null);
  assert.equal(hub.receive(a, { t: 'say', c: 'gim', x: 'after' }), 'no-room', 'an invalid group leaves the room');
});

test('filter, repeats, rate limit and the off switch', () => {
  let now = 10_000;
  const hub = new RelayHub(key, () => now);
  const a = client(1, 'Alice', 7);
  const b = client(2, 'Bob', 7);
  hub.add(a);
  hub.add(b);
  assert.equal(hub.receive(a, { t: 'say', c: 'clan', x: 'buy cheap gp at goldshop.com' }), 'filtered');
  assert.equal(hub.receive(a, { t: 'say', c: 'clan', x: 'ab '.repeat(30) }), 'filtered');
  assert.equal(hub.receive(a, { t: 'say', c: 'clan', x: 'same' }), null);
  assert.equal(hub.receive(a, { t: 'say', c: 'clan', x: 'same' }), 'repeat');
  for (let i = 1; i < RELAY_BURST; i++) assert.equal(hub.receive(a, { t: 'say', c: 'clan', x: `line ${i}` }), null);
  assert.equal(hub.receive(a, { t: 'say', c: 'clan', x: 'one too many' }), 'rate');
  now += 11_000;
  assert.equal(hub.receive(a, { t: 'say', c: 'clan', x: 'same' }), null, 'a while later the same line goes again');
  hub.enabled = false;
  assert.equal(hub.receive(a, { t: 'say', c: 'clan', x: 'off now' }), 'off');
  assert.equal(hub.receive(a, { t: 'say', c: 'trade', x: 'nope' }), 'off');
  hub.enabled = true;
  assert.equal(hub.receive(a, { t: 'say', c: 'trade', x: 'nope' }), 'bad');
});

test('account-type icon is in the name the game draws', () => {
  assert.equal(accountIcon('ironman'), 2);
  assert.equal(accountIcon('group'), 41);
  assert.equal(accountIcon('normal'), null);
  const hub = new RelayHub(key, () => 1);
  const a: RelayClient = { userId: 1, who: { name: 'Iron Al', icon: 2, clanId: 1 }, send: () => {} };
  const b = client(2, 'Bob', 1);
  hub.add(a);
  hub.add(b);
  hub.receive(a, { t: 'say', c: 'clan', x: 'hi' });
  assert.equal(b.got[0].nm, '<img=2>Iron Al');
});

test('a relay ticket round-trips; an old one has none', () => {
  const k = ticketKey('s');
  const { ticket } = signTicket({ userId: 4, eventIds: [], teamId: null, rows: true, relay: { name: 'Alice', icon: 3, clanId: 9 } }, k, 0);
  assert.deepEqual(verifyTicket(ticket, k, 1)?.relay, { name: 'Alice', icon: 3, clanId: 9 });
  const plain = signTicket({ userId: 4, eventIds: [], teamId: null }, k, 0).ticket;
  assert.equal(verifyTicket(plain, k, 1)?.relay, undefined);
});

test('chat tags: drop "The" and the clan, keep whole words, else initials', () => {
  assert.equal(deriveChatTag('The AFK Spot Winter Bingo', 'The AFK Spot'), 'Winter Bingo');
  assert.equal(deriveChatTag('Winter Bingo 2026'), 'Winter Bingo');
  assert.equal(deriveChatTag('Grandmasterclass Throwdown'), 'GT');
  assert.equal(deriveChatTag('The Big One'), 'Big One');
  assert.equal(deriveChatTag("Iron Bros' spring race", 'Iron Bros'), 'spring race');
  assert.equal(chatTagOf('  Mine  ', 'Winter Bingo'), 'Mine');
  assert.equal(chatTagOf(null, 'Winter Bingo'), 'Winter Bingo');
  assert.equal(cleanChatTag('[x] much too long a tag'), 'x much too l');
  assert.equal(cleanChatTag('   '), null);
});

test('the chat tag survives other rules edits and defaults to nothing stored', () => {
  assert.equal(parseEventRules(null).chatTag, null);
  assert.deepEqual(validateEventRules({ chatTag: null }), { rules: null });
  const stored = validateEventRules({ chatTag: 'Bingo' });
  assert.ok('rules' in stored && stored.rules);
  assert.equal(parseEventRules((stored as { rules: string }).rules).chatTag, 'Bingo');
});

test('chatbox lines: tag and channel, escaped, Announcements gold', () => {
  const team = chatboxLines('Winter', 'team:4', 'Bob', 'a < b');
  assert.equal(team.cb, '<col=57c785>[Winter · Team]</col> Bob: a <lt> b');
  assert.equal(team.cb1, '<col=57c785>[Team]</col> Bob: a <lt> b');
  const ann = chatboxLines('Winter', 'announce', 'Host', 'Starts now');
  assert.equal(ann.cb, '<col=ffb54d>[Winter · Announcements]</col> Host: <col=ffb54d>Starts now</col>');
  assert.equal(chatboxLines('W', 'all', 'X', 'y').cb1, '<col=7fc8ff>[All]</col> X: y');
});
