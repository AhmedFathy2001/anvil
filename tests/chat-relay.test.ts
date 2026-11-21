// The in-game chat relay (lib/push/relay) and event chat in the game chatbox (lib/eventChatRules chat
// tags and chatbox lines). Pure.
//
// Run: npx tsx --test tests/chat-relay.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chatTagOf, chatboxLines, cleanChatTag, deriveChatTag } from '../src/lib/eventChatRules.ts';
import { parseEventRules, validateEventRules } from '../src/lib/eventRules.ts';
import { RELAY_BURST, RelayHub, accountIcon, fcOwner, presenceName, lineSigned, relayKey, type RelayClient } from '../src/lib/push/relay.ts';
import { signTicket, ticketKey, verifyTicket } from '../src/lib/push/ticket.ts';

const key = relayKey('secret');

/** `got`: relayed lines; `seen`: presence messages. */
function client(userId: number, name: string, clanId: number | null = null, world: number | null = null): RelayClient & { got: Record<string, unknown>[]; seen: Record<string, unknown>[] } {
  const got: Record<string, unknown>[] = [];
  const seen: Record<string, unknown>[] = [];
  return {
    userId,
    who: { name, icon: null, clanId, world },
    send: (m) => {
      const o = JSON.parse(m);
      (o.t === 'relay' ? got : seen).push(o);
    },
    got,
    seen,
  };
}

test('public goes to the ticket’s world room only, never back to the sender', () => {
  const hub = new RelayHub(key, () => 1_000);
  const a = client(1, 'Alice', null, 302);
  const b = client(2, 'Bob', null, 302);
  const c = client(3, 'Carol', null, 330);
  const a2 = client(1, 'Alice', null, 302); // Alice's second client
  for (const x of [a, b, c, a2]) hub.add(x);
  assert.equal(hub.receive(a, { t: 'say', c: 'public', x: 'a < b > c' }), null);
  assert.equal(b.got.length, 1);
  assert.equal(c.got.length, 0, 'another world hears nothing');
  assert.equal(a.got.length + a2.got.length, 0, 'none of the sender’s own sockets');
  const m = b.got[0];
  assert.equal(m.t, 'relay');
  assert.equal(m.c, 'public');
  assert.equal(m.n, 'Alice');
  assert.equal(m.x, 'a < b > c', 'public is left as the game wrote it');
  assert.equal(m.xh, 'a <lt> b <gt> c');
  assert.ok(lineSigned(key, 1, 'Alice', 'public', 'a < b > c', m.at as number, m.k), 'signed for a report');
  assert.ok(!lineSigned(key, 1, 'Mallory', 'public', 'a < b > c', m.at as number, m.k), 'not under another name');
  assert.ok(!lineSigned(key, 1, 'Alice', 'public', 'something else', m.at as number, m.k), 'a changed line is not');
  assert.equal(hub.receive(a, { t: 'rooms', w: 330 }), 'bad', 'a socket cannot name its own rooms');
  assert.equal(hub.roomSize('world:330'), 1);
});

test('a relayed line keeps its repeated letters as the game let them through', () => {
  const hub = new RelayHub(key, () => 1_000);
  const a = client(1, 'Alice', null, 302);
  const b = client(2, 'Bob', null, 302);
  hub.add(a);
  hub.add(b);
  const line = 'This is a reallyyyyyyyyyyyy longgggggggggg testtttttttt';
  assert.equal(hub.receive(a, { t: 'say', c: 'public', x: line }), null);
  assert.equal(b.got[0].x, line);
});

test('clan goes to the roster clan from the ticket; GIM is not relayed', () => {
  const hub = new RelayHub(key, () => 5_000);
  const a = client(1, 'Alice', 7);
  const b = client(2, 'Bob', 7);
  const c = client(3, 'Carol', 8);
  for (const x of [a, b, c]) hub.add(x);
  hub.receive(a, { t: 'say', c: 'clan', x: 'clan line' });
  assert.equal(b.got.length, 1);
  assert.equal(c.got.length, 0);
  assert.equal(hub.receive(a, { t: 'say', c: 'gim', x: 'gim line' }), 'bad');
  assert.equal(hub.receive(a, { t: 'say', c: 'public', x: 'no world' }), 'no-room');
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
  const a: RelayClient = { userId: 1, who: { name: 'Iron Al', icon: 2, clanId: 1, world: null }, send: () => {} };
  const b = client(2, 'Bob', 1);
  hub.add(a);
  hub.add(b);
  hub.receive(a, { t: 'say', c: 'clan', x: 'hi' });
  assert.equal(b.got[0].nm, '<img=2>Iron Al');
});

test('a relay ticket round-trips; an old one has none', () => {
  const k = ticketKey('s');
  const { ticket } = signTicket({ userId: 4, eventIds: [], teamId: null, rows: true, relay: { name: 'Alice', icon: 3, clanId: 9, world: 420 } }, k, 0);
  assert.deepEqual(verifyTicket(ticket, k, 1)?.relay, { name: 'Alice', icon: 3, clanId: 9, world: 420 });
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
  assert.equal(team.cb, '<col=57c785>[Winter · Team]</col> Bob: A <lt> b');
  assert.equal(team.cb1, '<col=57c785>[Team]</col> Bob: A <lt> b');
  const ann = chatboxLines('Winter', 'announce', 'Host', 'Starts now');
  assert.equal(ann.cb, '<col=ffb54d>[Winter · Announcements]</col> Host: <col=ffb54d>Starts now</col>');
  assert.equal(chatboxLines('W', 'all', 'X', 'y').cb1, '<col=7fc8ff>[All]</col> X: Y', 'first letter capitalised like the game');
});

test('a person’s other character hears their line; the same character’s sockets do not', () => {
  const hub = new RelayHub(key, () => 1_000);
  const dead = client(1, 'dead person', 7, 310);
  const deadAgain = client(1, 'dead person', 7, 310); // the same character on a second socket
  const gim = client(1, 'GIM Drenvox', 7, 308); // the same person's other character
  for (const x of [dead, deadAgain, gim]) hub.add(x);
  assert.equal(hub.receive(dead, { t: 'say', c: 'clan', x: 'test' }), null);
  assert.equal(gim.got.length, 1, 'their other character is another player in game');
  assert.equal(deadAgain.got.length, 0, 'never back to the sending character');
});

test('friends chat room from the ticket; first letter capitalised; repeats ignore case', () => {
  let now = 1;
  const hub = new RelayHub(key, () => now);
  const a = { ...client(1, 'Alice'), who: { name: 'Alice', icon: null, clanId: null, world: null, fc: 'Raid Host' } };
  const b = { ...client(2, 'Bob'), who: { name: 'Bob', icon: null, clanId: null, world: null, fc: 'raid\u00a0host' } };
  const c = { ...client(3, 'Carol'), who: { name: 'Carol', icon: null, clanId: null, world: null, fc: 'other' } };
  const got: string[] = [];
  b.send = (m: string) => JSON.parse(m).t === 'relay' && got.push(m);
  c.send = (m: string) => JSON.parse(m).t === 'relay' && assert.fail('another friends chat');
  for (const x of [a, b, c]) hub.add(x);
  assert.equal(hub.receive(a, { t: 'say', c: 'fc', x: 'need a scythe' }), null);
  assert.equal(JSON.parse(got[0]).x, 'need a scythe', 'friends chat is the game’s to capitalise');
  now += 1;
  assert.equal(hub.receive(a, { t: 'say', c: 'fc', x: 'Need a scythe' }), 'repeat', 'case-blind');
  assert.equal(fcOwner('<img=1>x'), null);
  assert.equal(fcOwner('Raid Host'), 'raid host');
});

test('presence: who else has the relay on in my rooms, and joins/leaves after', () => {
  const hub = new RelayHub(key, () => 1);
  const a = client(1, 'Alice', 7);
  const b = client(2, 'Bob_Two', 7);
  const c = client(3, 'Carol', 8);
  hub.add(a);
  hub.add(c);
  assert.equal(a.seen.length, 0, 'alone in the clan room');
  const stop = hub.add(b);
  assert.deepEqual(b.seen[0], { t: 'here', n: ['alice'] });
  assert.deepEqual(a.seen[0], { t: 'here', n: ['bob two'] });
  assert.equal(c.seen.length, 0, 'another clan hears nothing');
  // A re-ticket: the new socket first, then the old one closes — no "gone" for a character still here.
  const b2 = client(2, 'Bob_Two', 7);
  hub.add(b2);
  stop();
  assert.ok(!a.seen.some((m) => m.t === 'gone'));
  assert.equal(presenceName('GIM\u00a0Drenvox'), 'gim drenvox');
});

test('clan lines get the capital the game gives everyone else', () => {
  const hub = new RelayHub(key, () => 1);
  const a = client(1, 'Alice', 7);
  const b = client(2, 'Bob', 7);
  hub.add(a);
  hub.add(b);
  hub.receive(a, { t: 'say', c: 'clan', x: 'test' });
  assert.equal(b.got[0].x, 'Test');
});

test('guest clan room like friends chat, capitalised like clan; a PM reaches only its recipient', () => {
  const hub = new RelayHub(key, () => 1);
  const a = { ...client(1, 'Alice'), who: { name: 'Alice', icon: null, clanId: null, world: 301, guest: 'Our Worst' } };
  const b = client(2, 'Bob_Two', null, 301);
  const g = { ...client(3, 'Gus'), who: { name: 'Gus', icon: null, clanId: null, world: null, guest: 'our worst' } };
  const got: Record<string, Record<string, unknown>[]> = { a: [], b: [], g: [] };
  a.send = (m: string) => JSON.parse(m).t === 'relay' && got.a.push(JSON.parse(m));
  b.send = (m: string) => JSON.parse(m).t === 'relay' && got.b.push(JSON.parse(m));
  g.send = (m: string) => JSON.parse(m).t === 'relay' && got.g.push(JSON.parse(m));
  for (const x of [a, b, g]) hub.add(x);
  assert.equal(hub.receive(a, { t: 'say', c: 'guest', x: 'hi guests' }), null);
  assert.equal(got.g[0].x, 'Hi guests');
  assert.equal(got.b.length, 0);
  assert.equal(hub.receive(a, { t: 'say', c: 'pm', to: 'bob two', x: 'psst' }), null);
  assert.equal(got.b[0].c, 'pm');
  assert.equal(got.b[0].x, 'psst', 'the game capitalises PMs itself');
  assert.equal(got.g.length, 1, 'nobody else hears a PM');
  assert.equal(hub.receive(a, { t: 'say', c: 'pm', to: 'Nobody Here', x: 'hello?' }), 'no-room');
  assert.equal(hub.receive(a, { t: 'say', c: 'pm', x: 'no one' }), 'no-room');
});

test('a clan on Anvil: its guests and its members hear each other, each in their own channel', () => {
  const hub = new RelayHub(key);
  const member = client(1, 'Mem', 7);
  const guest = { ...client(2, 'Gus'), who: { name: 'Gus', icon: null, clanId: 9, world: null, guest: 'the afk spot', guestClanId: 7 } };
  const otherGuest = { ...client(3, 'Gia'), who: { name: 'Gia', icon: null, clanId: null, world: null, guest: 'the afk spot', guestClanId: 7 } };
  const stranger = client(4, 'Str', 9);
  for (const c of [member, guest, otherGuest, stranger]) hub.add(c);
  assert.equal(hub.receive(member, { t: 'say', c: 'clan', x: 'hello all' }), null);
  assert.deepEqual([guest.got[0].c, guest.got[0].x, otherGuest.got[0].c], ['guest', 'Hello all', 'guest']);
  assert.equal(hub.receive(guest, { t: 'say', c: 'guest', x: 'hi from a guest' }), null);
  assert.deepEqual([member.got[0].c, member.got[0].x], ['clan', 'Hi from a guest']);
  assert.equal(otherGuest.got[1].c, 'guest');
  // Signed as the channel it arrives in, so a report of it checks out.
  const l = member.got[0] as { c: string; n: string; x: string; at: number; k: string; u: number };
  assert.equal(lineSigned(key, l.u, l.n, l.c, l.x, l.at, l.k), true);
  // The guest's OWN clan line goes to its own clan only.
  assert.equal(hub.receive(guest, { t: 'say', c: 'clan', x: 'own clan' }), null);
  assert.equal(stranger.got.length, 1);
  assert.equal(member.got.length, 1);
  // Presence crosses too.
  assert.ok(member.seen.some((s) => (s.n as string[] | string).includes('gus')));
});

test('the guest clan id rides the ticket', () => {
  const k = ticketKey('s');
  const { ticket } = signTicket({ userId: 1, eventIds: [], teamId: null, relay: { name: 'Gus', icon: null, clanId: null, world: 301, fc: null, guest: 'the afk spot', guestClanId: 7 } }, k, 0);
  assert.equal(verifyTicket(ticket, k, 1)?.relay?.guestClanId, 7);
});

test('presence past shared rooms follows the named player\'s own private chat setting', () => {
  const hub = new RelayHub(key, () => 1);
  const a = client(1, 'Dead Person', null, 310);
  const b = client(2, 'Anvil Plugin', null, 308);
  const said: Record<string, Record<string, unknown>[]> = { a: [], b: [] };
  a.send = (m: string) => said.a.push(JSON.parse(m));
  b.send = (m: string) => said.b.push(JSON.parse(m));
  hub.add(a);
  const closeB = hub.add(b);
  assert.equal(said.a.length + said.b.length, 0, 'no shared room: nobody is named on joining');
  // Not said yet (an older plugin): asked about, nothing is told.
  hub.receive(a, { t: 'who', n: ['Anvil_Plugin'] });
  assert.equal(said.a.length + said.b.length, 0);
  // Off: never answered, and a PM to them goes nowhere.
  hub.receive(b, { t: 'pm', m: 'off' });
  hub.receive(a, { t: 'who', n: ['Anvil Plugin'] });
  assert.equal(said.a.length, 0);
  assert.equal(hub.receive(a, { t: 'say', c: 'pm', to: 'Anvil Plugin', x: 'hello?' }), 'no-room');
  // Friends: their client is asked, and only its answer tells the asker.
  hub.receive(b, { t: 'pm', m: 'friends' });
  hub.receive(a, { t: 'who', n: ['Anvil Plugin'] });
  assert.deepEqual(said.b.at(-1), { t: 'ask', n: 'dead person' });
  assert.equal(said.a.length, 0);
  assert.equal(hub.receive(b, { t: 'ok', n: 'Someone Else' }), null);
  assert.equal(said.a.length, 0, 'an answer nobody asked for tells nobody');
  hub.receive(b, { t: 'ok', n: 'dead person' });
  assert.deepEqual(said.a.at(-1), { t: 'here', n: ['anvil plugin'] });
  // Tightened to Off: the asker hears they're gone.
  hub.receive(b, { t: 'pm', m: 'off' });
  assert.deepEqual(said.a.at(-1), { t: 'gone', n: 'anvil plugin' });
  // On: answered straight away; a PM goes through and the recipient can reply.
  hub.receive(b, { t: 'pm', m: 'on' });
  hub.receive(a, { t: 'who', n: ['Anvil Plugin'] });
  assert.deepEqual(said.a.at(-1), { t: 'here', n: ['anvil plugin'] });
  assert.equal(hub.receive(a, { t: 'say', c: 'pm', to: 'Anvil Plugin', x: 'Test2' }), null);
  assert.equal(said.b.at(-2)?.t, 'relay');
  assert.deepEqual(said.b.at(-1), { t: 'here', n: ['dead person'] });
  closeB();
  assert.deepEqual(said.a.at(-1), { t: 'gone', n: 'anvil plugin' }, 'who was told hears them go');
});

test('asking about names is limited', () => {
  const hub = new RelayHub(key, () => 1);
  const a = client(1, 'Asker');
  hub.add(a);
  const names = Array.from({ length: 50 }, (_, i) => `name ${i}`);
  assert.equal(hub.receive(a, { t: 'who', n: names }), 'rate');
});

test('a world names nobody; a clan does; someone hiding is only shown where the game would show them', () => {
  const hub = new RelayHub(key, () => 1);
  const a = client(1, 'Looker', null, 301);
  const b = client(2, 'Hider', null, 301);
  const c = client(3, 'Clanmate', 5, 999);
  const d = client(4, 'Clanmate Two', 5, 998);
  const said: Record<string, Record<string, unknown>[]> = { a: [], b: [], c: [] };
  a.send = (m: string) => said.a.push(JSON.parse(m));
  b.send = (m: string) => said.b.push(JSON.parse(m));
  c.send = (m: string) => said.c.push(JSON.parse(m));
  hub.add(a);
  hub.add(b);
  hub.add(c);
  hub.add(d);
  assert.equal(said.a.length, 0, 'same world: not named');
  assert.deepEqual(said.c.at(-1), { t: 'here', n: ['clanmate two'] }, 'same clan: named');
  // Public lines still reach the world (each client shows them only from someone on its screen).
  assert.equal(hub.receive(b, { t: 'say', c: 'public', x: 'hi' }), null);
  assert.equal(said.a.at(-1)?.t, 'relay');
  // Private Off: asked about, their own client decides (it says yes only if the asker is on its screen).
  hub.receive(b, { t: 'pm', m: 'off' });
  hub.receive(a, { t: 'who', n: ['Hider'] });
  assert.deepEqual(said.b.at(-1), { t: 'ask', n: 'looker' });
  assert.equal(said.a.at(-1)?.t, 'relay', 'nothing told yet');
  hub.receive(b, { t: 'ok', n: 'looker' });
  assert.deepEqual(said.a.at(-1), { t: 'here', n: ['hider'] });
  // A clanmate asked about is simply here.
  hub.receive(c, { t: 'who', n: ['Clanmate Two'] });
  assert.deepEqual(said.c.at(-1), { t: 'here', n: ['clanmate two'] });
});
