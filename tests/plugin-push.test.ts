// The plugin's live push: the signed ticket (lib/push/ticket) and which views get built, how often, and
// who gets them (lib/push/hub). Pure — the database and socket halves are tests/plugin-push-notify.test.ts.
//
// Run: npx tsx --test tests/plugin-push.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { NUDGE, ViewHub, parseChange, parseFeed, parseRows, parseViewKey, teamDelta, teamKey, tileKey, type PushChange } from '../src/lib/push/hub.ts';
import { signTicket, ticketKey, verifyTicket, TICKET_TTL_MS } from '../src/lib/push/ticket.ts';

const key = ticketKey('secret');

test('a ticket round-trips its scope until it expires', () => {
  const { ticket, expiresAt } = signTicket({ userId: 7, eventIds: [3], teamId: 12 }, key, 1_000);
  assert.equal(expiresAt, 1_000 + TICKET_TTL_MS);
  assert.deepEqual(verifyTicket(ticket, key, 2_000), { userId: 7, eventIds: [3], teamId: 12 });
  assert.equal(verifyTicket(ticket, key, expiresAt), null, 'expired');
});

test('a ticket signed with another key, or edited, is refused', () => {
  const { ticket } = signTicket({ userId: 7, eventIds: [3], teamId: null }, key, 0);
  assert.equal(verifyTicket(ticket, ticketKey('other'), 1), null);
  const [body, sig] = ticket.split('.');
  const forged = Buffer.from(JSON.stringify({ u: 7, e: [3, 4], t: null, x: TICKET_TTL_MS })).toString('base64url');
  assert.equal(verifyTicket(`${forged}.${sig}`, key, 1), null);
  assert.equal(verifyTicket(body, key, 1), null);
  assert.equal(verifyTicket('', key, 1), null);
});

/**
 * A hub on a hand-driven clock with a fake site: every build is recorded and answers `views[key]`
 * (stamped with how many builds there have been, unless frozen).
 */
function harness(opts: { gatherMs?: number; minGapMs?: number } = {}) {
  let now = 0;
  const timers: { at: number; fn: () => void }[] = [];
  const built: string[] = [];
  const views = new Map<string, string>();
  const hub = new ViewHub({
    gatherMs: opts.gatherMs ?? 100,
    minGapMs: opts.minGapMs ?? 1_000,
    now: () => now,
    later: (fn, ms) => {
      const t = { at: now + ms, fn };
      timers.push(t);
      return () => {
        const i = timers.indexOf(t);
        if (i >= 0) timers.splice(i, 1);
      };
    },
    fetchView: async (key) => {
      built.push(key);
      return views.get(key) ?? null;
    },
  });
  const client = (eventIds: number[], teamId: number | null) => {
    const got: string[] = [];
    const remove = hub.add({ scope: { userId: 1, eventIds, teamId }, send: (m) => got.push(m) });
    return { got, remove };
  };
  const advance = async (ms: number) => {
    now += ms;
    for (const t of timers.filter((x) => x.at <= now)) {
      timers.splice(timers.indexOf(t), 1);
      t.fn();
    }
    await new Promise((r) => setImmediate(r));
  };
  return { hub, client, advance, built, views };
}

const change = (over: Partial<PushChange>): PushChange => ({ k: 'submissions', e: 1, t: null, i: null, ...over });

test('a new client gets its team view; teammates share one build of it', async () => {
  const { client, advance, built, views } = harness();
  views.set(teamKey(1, 10), 'red-v1');
  const a = client([1], 10);
  const b = client([1], 10);
  await advance(100);
  assert.deepEqual(built, ['team:1:10'], 'one build for both');
  assert.deepEqual(a.got, ['red-v1']);
  assert.deepEqual(b.got, ['red-v1']);
  const c = client([1], 10);
  assert.deepEqual(c.got, ['red-v1'], 'a later teammate gets the cached view at once');
  assert.equal(built.length, 1);
});

test("a teammate's drop rebuilds my team and the tile, not the other team", async () => {
  const { hub, client, advance, built, views } = harness();
  views.set(teamKey(1, 10), 'red-v1');
  views.set(teamKey(1, 20), 'blue-v1');
  const red = client([1], 10);
  const blue = client([1], 20);
  await advance(100);
  built.length = 0;
  views.set(teamKey(1, 10), 'red-v2');
  views.set(tileKey(1, 5), 'tile5-v1');
  hub.dispatch(change({ t: 10, i: 5 }));
  await advance(1_000);
  assert.deepEqual(built.sort(), ['team:1:10', 'tile:1:5']);
  assert.deepEqual(red.got, ['red-v1', 'red-v2', 'tile5-v1']);
  assert.deepEqual(blue.got, ['blue-v1', 'tile5-v1'], 'the tracker is everyone\'s');
});

test('an event-wide change rebuilds every team on that board and nobody elsewhere', async () => {
  const { hub, client, advance, built, views } = harness();
  for (const [k, v] of [[teamKey(1, 10), 'a'], [teamKey(1, 20), 'b'], [teamKey(1, 0), 'board'], [teamKey(2, 30), 'c']]) views.set(k, v);
  client([1], 10);
  client([1], 20);
  client([1], null);
  client([2], 30);
  await advance(100);
  built.length = 0;
  hub.dispatch(change({ k: 'tiles' }));
  await advance(1_000);
  assert.deepEqual(built.sort(), ['team:1:0', 'team:1:10', 'team:1:20']);
});

test('a rebuild that changes nothing is not sent', async () => {
  const { hub, client, advance, views } = harness();
  views.set(teamKey(1, 10), 'same');
  const me = client([1], 10);
  await advance(100);
  hub.dispatch(change({ t: 10 }));
  await advance(1_000);
  assert.deepEqual(me.got, ['same']);
});

test('a burst is gathered into one build, then at most one per gap', async () => {
  const { hub, client, advance, built, views } = harness({ gatherMs: 100, minGapMs: 1_000 });
  views.set(teamKey(1, 10), 'v');
  client([1], 10);
  await advance(100);
  built.length = 0;
  for (let n = 0; n < 5; n++) hub.dispatch(change({ t: 10 }));
  await advance(1_000);
  assert.equal(built.length, 1, 'five drops, one build');
  hub.dispatch(change({ t: 10 }));
  await advance(500);
  assert.equal(built.length, 1, 'held until the gap is up');
  await advance(500);
  assert.equal(built.length, 2);
});

test('the last client leaving drops the view, and a late build goes nowhere', async () => {
  const { hub, client, advance, built, views } = harness();
  views.set(teamKey(1, 10), 'v');
  const me = client([1], 10);
  me.remove();
  await advance(1_000);
  assert.equal(hub.size, 0);
  assert.deepEqual(me.got, []);
  assert.ok(built.length <= 1);
});

test('after the database listener comes back, every view is rebuilt', async () => {
  const { hub, client, advance, built, views } = harness();
  views.set(teamKey(1, 10), 'a');
  views.set(teamKey(2, 0), 'b');
  client([1], 10);
  client([2], null);
  await advance(100);
  built.length = 0;
  hub.refreshAll();
  await advance(1_000);
  assert.deepEqual(built.sort(), ['team:1:10', 'team:2:0']);
});

test('somebody leaving a team re-tickets that team only', async () => {
  const { hub, advance, views } = harness();
  for (const k of [teamKey(1, 10), teamKey(1, 20), teamKey(1, 0), teamKey(2, 10)]) views.set(k, 'v');
  const dropped: string[] = [];
  const listen = (name: string, eventId: number, teamId: number | null) =>
    hub.add({ scope: { userId: 1, eventIds: [eventId], teamId }, send: () => {}, rescope: () => dropped.push(name) });
  listen('red', 1, 10);
  listen('blue', 1, 20);
  listen('viewer', 1, null);
  listen('red elsewhere', 2, 10);
  await advance(100);
  hub.dispatch(change({ k: 'event_participants' }));
  assert.deepEqual(dropped, [], 'a stats refresh is not a roster change');
  hub.dispatch(change({ k: 'event_participants', x: 10 }));
  assert.deepEqual(dropped, ['red']);
});

test('view keys and NOTIFY payloads parse, and junk is ignored', () => {
  assert.deepEqual(parseViewKey('team:4:0'), { kind: 'team', eventId: 4, id: 0 });
  assert.deepEqual(parseViewKey('tile:4:9'), { kind: 'tile', eventId: 4, id: 9 });
  assert.equal(parseViewKey('team:4'), null);
  assert.equal(parseViewKey('admin:1:1'), null);
  assert.deepEqual(parseChange('{"k":"completions","e":4,"t":9,"i":2}'), { k: 'completions', e: 4, t: 9, i: 2 });
  assert.deepEqual(parseChange('{"k":"events","e":4,"t":null,"i":null,"x":null}'), { k: 'events', e: 4, t: null, i: null });
  assert.deepEqual(parseChange('{"k":"event_participants","e":4,"t":null,"i":null,"x":12}'), { k: 'event_participants', e: 4, t: null, i: null, x: 12 });
  assert.equal(parseChange('{"k":"x"}'), null);
  assert.equal(parseChange('not json'), null);
});

const teamView = (drops: [number, number][], members: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    t: 'team', eventId: 1, teamId: 10,
    config: { completedTiles: [], trackedDrops: drops.map(([tileId, currentAmount]) => ({ tileId, currentAmount, itemIds: [4151] })), ...extra },
    members, at: String(Math.random()),
  });

test('a team view goes out as only what moved: counts, a bare "moved", or whole when anything else changed', () => {
  const v1 = teamView([[5, 1], [6, 0]], { 7: { c: { 9: 2 } } });
  const counts = JSON.parse(teamDelta('team:1:10', v1, teamView([[5, 3], [6, 0]], { 7: { c: { 9: 4 } } })));
  assert.deepEqual(counts, { t: 'counts', eventId: 1, teamId: 10, c: { 5: 3 }, m: { 7: { c: { 9: 4 } } } });
  assert.deepEqual(JSON.parse(teamDelta('team:1:10', v1, teamView([[5, 1], [6, 0]], { 7: { c: { 9: 2 } } }))), { t: 'moved', eventId: 1, teamId: 10 }, 'only the stamp: a rival\'s tile or a claim');
  const done = teamView([[5, 1], [6, 0]], {}, { completedTiles: [6] });
  assert.equal(teamDelta('team:1:10', v1, done), done, 'a completion sends the whole view');
  assert.equal(teamDelta('tile:1:5', '{"a":1}', '{"a":2}'), '{"a":2}', 'tile views always go whole');
});

test('listeners holding the last view get the delta; a newcomer gets the view whole', async () => {
  const { hub, client, advance, views } = harness();
  views.set(teamKey(1, 10), teamView([[5, 1]]));
  const a = client([1], 10);
  await advance(100);
  views.set(teamKey(1, 10), teamView([[5, 2]]));
  hub.dispatch(change({ t: 10 }));
  await advance(1_000);
  assert.equal(JSON.parse(a.got[1]).t, 'counts');
  const b = client([1], 10);
  assert.equal(JSON.parse(b.got[0]).t, 'team', 'whole, with the latest counts');
  assert.equal(JSON.parse(b.got[0]).config.trackedDrops[0].currentAmount, 2);
});

test('a feed ticket carries its flag; a plain one does not', () => {
  const { ticket } = signTicket({ userId: 7, eventIds: [], teamId: null, feed: true }, key, 0);
  assert.deepEqual(verifyTicket(ticket, key, 1), { userId: 7, eventIds: [], teamId: null, feed: true });
});

test('feed lines go to that user’s feed clients only', () => {
  const hub = new ViewHub({ fetchView: async () => null, later: () => () => {} });
  const got: Record<string, string[]> = { a: [], b: [], c: [] };
  hub.add({ scope: { userId: 1, eventIds: [], teamId: null, feed: true }, send: (m) => got.a.push(m) });
  hub.add({ scope: { userId: 2, eventIds: [], teamId: null, feed: true }, send: (m) => got.b.push(m) });
  const remove = hub.add({ scope: { userId: 1, eventIds: [5], teamId: null }, send: (m) => got.c.push(m) });
  const notice = parseFeed(JSON.stringify({ k: 'feed', u: [1, 'x', 9], m: { t: 'feed', text: 'hi' } }));
  assert.deepEqual(notice?.u, [1, 9]);
  hub.deliver(notice!);
  assert.deepEqual(got.a, ['{"t":"feed","text":"hi"}']);
  assert.deepEqual(got.b, []);
  assert.deepEqual(got.c, [], 'no feed flag, no feed lines');
  remove();
  assert.equal(parseFeed(JSON.stringify({ k: 'stats', e: 1 })), null);
  assert.equal(parseChange(JSON.stringify({ k: 'feed', u: [1], m: {} })), null, 'old servers ignore feed notices');
});

test('panel rows go to a board, one team on it, or named people — once each', () => {
  const hub = new ViewHub({ fetchView: async () => null, later: () => () => {} });
  const got: Record<string, string[]> = { a: [], b: [], c: [], d: [] };
  hub.add({ scope: { userId: 1, eventIds: [5], teamId: 10, rows: true }, send: (m) => got.a.push(m) });
  hub.add({ scope: { userId: 2, eventIds: [5], teamId: 11, rows: true }, send: (m) => got.b.push(m) });
  hub.add({ scope: { userId: 3, eventIds: [6], teamId: null, rows: true }, send: (m) => got.c.push(m) });
  hub.add({ scope: { userId: 4, eventIds: [], teamId: null, rows: true }, send: (m) => got.d.push(m) });
  const old: string[] = [];
  hub.add({ scope: { userId: 1, eventIds: [5], teamId: 10 }, send: (m) => old.push(m) });
  const clear = () => Object.values(got).forEach((g) => g.splice(0));
  clear();

  hub.deliverRows(parseRows(JSON.stringify({ k: 'rows', e: 5, m: { t: 'rows', n: 1 } }))!);
  assert.deepEqual([got.a.length, got.b.length, got.c.length, got.d.length], [1, 1, 0, 0], 'the whole board');
  clear();

  hub.deliverRows(parseRows(JSON.stringify({ k: 'rows', e: 5, t: 11, m: { t: 'rows' } }))!);
  assert.deepEqual([got.a.length, got.b.length], [0, 1], 'one team only');
  clear();

  hub.deliverRows(parseRows(JSON.stringify({ k: 'rows', e: 5, u: [1, 4], m: { t: 'rows' } }))!);
  assert.deepEqual([got.a.length, got.b.length, got.c.length, got.d.length], [1, 1, 0, 1], 'board plus people, nobody twice');

  assert.deepEqual(old, [], 'a plugin that never said it reads rows is sent none (older plugins log each one)');
  assert.equal(parseRows(JSON.stringify({ k: 'rows', m: {} })), null, 'nobody to send to');
  assert.equal(parseRows(JSON.stringify({ k: 'feed', u: [1], m: {} })), null);
  assert.equal(parseFeed(JSON.stringify({ k: 'rows', u: [1], m: {} })), null, 'feed parser ignores rows');
});

test('a rows ticket carries its flag', () => {
  const { ticket } = signTicket({ userId: 7, eventIds: [3], teamId: 2, feed: true, rows: true }, key, 0);
  assert.deepEqual(verifyTicket(ticket, key, 1), { userId: 7, eventIds: [3], teamId: 2, feed: true, rows: true });
});

test('a team change rescopes the board\'s extra-board listeners too, not just the team room', () => {
  const hub = new ViewHub({ fetchView: async () => null, later: () => () => {} });
  let teamRoom = 0;
  let extra = 0;
  let other = 0;
  hub.add({ scope: { userId: 1, eventIds: [5], teamId: 10, rows: true }, send: () => {}, rescope: () => teamRoom++ });
  hub.add({ scope: { userId: 2, eventIds: [7, 5], teamId: 3, rows: true }, send: () => {}, rescope: () => extra++ });
  hub.add({ scope: { userId: 3, eventIds: [5], teamId: 11, rows: true }, send: () => {}, rescope: () => other++ });
  hub.dispatch({ k: 'event_participants', e: 5, t: null, i: null, x: 10 });
  assert.equal(teamRoom, 1, 'the left team re-tickets');
  assert.equal(extra, 1, 'an extra-board listener re-tickets');
  assert.equal(other, 0, 'another team on its own board stays');
});

test('seating someone re-tickets every client of theirs, even one not on that board yet', () => {
  const hub = new ViewHub({ fetchView: async () => null, later: () => () => {} });
  const dropped: string[] = [];
  // Denoverse's client: listening for rows with no board yet (its ticket predates the seat).
  hub.add({ scope: { userId: 4, eventIds: [], teamId: null, rows: true }, send: () => {}, rescope: () => dropped.push('fresh') });
  // The same person's other character, already on another board.
  hub.add({ scope: { userId: 4, eventIds: [9], teamId: 2, rows: true }, send: () => {}, rescope: () => dropped.push('alt') });
  hub.add({ scope: { userId: 5, eventIds: [5], teamId: 10, rows: true }, send: () => {}, rescope: () => dropped.push('bystander') });
  hub.dispatch({ k: 'event_participants', e: 5, t: null, i: null, p: [4] });
  assert.deepEqual(dropped.sort(), ['alt', 'fresh'], 'the seated person re-tickets; nobody else on the board does');
  assert.deepEqual(parseChange('{"k":"event_participants","e":5,"t":null,"i":null,"x":null,"p":[4,"x",6]}'), {
    k: 'event_participants', e: 5, t: null, i: null, p: [4, 6],
  });
  assert.deepEqual(parseChange('{"k":"event_participants","e":5,"t":null,"i":null,"x":null,"p":null}'), { k: 'event_participants', e: 5, t: null, i: null });
});

// ── Stream overlays (watchers) ──────────────────────────────────────────────────────────────────

test('an overlay gets a bare nudge when its event moves — never a view, and nothing is built for it', async () => {
  const { hub, advance, built } = harness();
  const got: string[] = [];
  hub.watch(1, { send: (m) => got.push(m) });
  const other: string[] = [];
  hub.watch(2, { send: (m) => other.push(m) });
  hub.dispatch(change({ t: 10, i: 5 }));
  await advance(100);
  assert.deepEqual(got, [NUDGE]);
  assert.deepEqual(other, [], 'another board is not nudged');
  assert.deepEqual(built, [], 'no plugin is listening, so no view is built');
  assert.equal(hub.watching, 2);
});

test('a burst of changes is one nudge, then at most one per gap', async () => {
  const { hub, advance } = harness({ gatherMs: 100, minGapMs: 1_000 });
  const got: string[] = [];
  hub.watch(1, { send: (m) => got.push(m) });
  for (let n = 0; n < 5; n++) hub.dispatch(change({ t: n }));
  await advance(100);
  assert.equal(got.length, 1);
  hub.dispatch(change({}));
  await advance(100);
  assert.equal(got.length, 1, 'still inside the gap');
  await advance(900);
  assert.equal(got.length, 2);
});

test('board feed rows and a listener reconnect nudge overlays too; stopping ends it', async () => {
  const { hub, advance } = harness();
  const got: string[] = [];
  const stop = hub.watch(1, { send: (m) => got.push(m) });
  hub.deliverRows({ e: 1, m: { t: 'row' } });
  await advance(100);
  assert.equal(got.length, 1);
  await advance(1_000);
  hub.refreshAll();
  await advance(100);
  assert.equal(got.length, 2);
  stop();
  assert.equal(hub.watching, 0);
  hub.dispatch(change({}));
  await advance(2_000);
  assert.equal(got.length, 2);
});

test('a board row\'s reaction chips go to its players; a clanmate only watching it gets the row bare', () => {
  const hub = new ViewHub({ fetchView: async () => null, later: () => () => {} });
  const got: Record<string, string[]> = { player: [], extra: [], watcher: [], staff: [] };
  hub.add({ scope: { userId: 1, eventIds: [5], teamId: 10, rows: true }, send: (m) => got.player.push(m) });
  // Seated on 5 as an extra board: the first one is the seat's elsewhere.
  hub.add({ scope: { userId: 2, eventIds: [9, 5], teamId: 3, rows: true }, send: (m) => got.extra.push(m) });
  // Board 5 is only this clanmate's home board: no seat, no team.
  hub.add({ scope: { userId: 3, eventIds: [5], teamId: null, rows: true }, send: (m) => got.watcher.push(m) });
  // A mod watching it the same way, but named (lib/panelRows boardUserIds names the clan's staff).
  hub.add({ scope: { userId: 4, eventIds: [5], teamId: null, rows: true }, send: (m) => got.staff.push(m) });
  const row = { id: 'm7', title: 'Tanzanite fang', gz: { n: 0, mine: false, on: { a: 'post', act: 'react-row' } } };
  hub.deliverRows(parseRows(JSON.stringify({ k: 'rows', e: 5, u: [1, 4], rx: 1, m: { t: 'rows', feeds: ['moments:event:5'], rows: [row] } }))!);
  const rows = (s: string[]) => s.map((m) => JSON.parse(m).rows[0]);
  assert.deepEqual(rows(got.player).map((r) => !!r.gz), [true]);
  assert.deepEqual(rows(got.extra).map((r) => !!r.gz), [true]);
  assert.deepEqual(rows(got.staff).map((r) => !!r.gz), [true], 'named staff get the chip, once');
  assert.deepEqual(rows(got.watcher), [{ id: 'm7', title: 'Tanzanite fang' }]);

  // Without rx (a chat line, a finished tile) everyone gets the same text.
  for (const g of Object.values(got)) g.splice(0);
  hub.deliverRows(parseRows(JSON.stringify({ k: 'rows', e: 5, m: { t: 'rows', rows: [row] } }))!);
  assert.equal(rows(got.watcher)[0].gz.n, 0);
  assert.equal(parseRows(JSON.stringify({ k: 'rows', u: [1], rx: 1, m: {} }))!.rx, undefined, 'rx means nothing without a board');
});

test('a reaction update goes to the board\'s players, never to a clanmate only watching it, and nudges no overlay', () => {
  const sent: (() => void)[] = [];
  const hub = new ViewHub({ fetchView: async () => null, later: (fn) => (sent.push(fn), () => {}) });
  const got: Record<string, string[]> = { player: [], watcher: [] };
  hub.add({ scope: { userId: 1, eventIds: [5], teamId: 10, rows: true }, send: (m) => got.player.push(m) });
  hub.add({ scope: { userId: 3, eventIds: [5], teamId: null, rows: true }, send: (m) => got.watcher.push(m) });
  const overlay: string[] = [];
  hub.watch(5, { send: (m) => overlay.push(m) });
  const before = sent.length; // the team views scheduled on add
  hub.deliverRows(parseRows(JSON.stringify({ k: 'rows', e: 5, rx: 1, m: { t: 'rowsreact', feeds: ['moments:event:5'], id: 'm7', gz: 2, gold: 0, sad: 0, sit: 0 } }))!);
  assert.equal(got.player.length, 1);
  assert.equal(JSON.parse(got.player[0]).gz, 2);
  assert.deepEqual(got.watcher, []);
  assert.equal(sent.length, before, 'no overlay nudge scheduled for a count');
});

// ── The website's Feed & chat page: web tickets (rows only) and staff's every-team rooms ─────────

test('a plugin ticket is byte for byte what it was; a web ticket carries its teams and runs shorter', async () => {
  const { WEB_TICKET_TTL_MS } = await import('../src/lib/push/ticket.ts');
  const plain = signTicket({ userId: 7, eventIds: [3], teamId: 2, rows: true }, key, 0).ticket;
  assert.deepEqual(JSON.parse(Buffer.from(plain.split('.')[0], 'base64url').toString()), { u: 7, e: [3], t: 2, r: 1, x: TICKET_TTL_MS });
  const web = signTicket({ userId: 7, eventIds: [3], teamId: 2, rows: true, web: true, teamIds: [2, 4, 5] }, key, 0, WEB_TICKET_TTL_MS);
  assert.equal(web.expiresAt, WEB_TICKET_TTL_MS);
  assert.deepEqual(verifyTicket(web.ticket, key, 1), { userId: 7, eventIds: [3], teamId: 2, rows: true, teamIds: [4, 5], web: true });
  // A ttl can shorten a ticket, never stretch it.
  assert.equal(signTicket({ userId: 7, eventIds: [3], teamId: 2 }, key, 0, 10 * TICKET_TTL_MS).expiresAt, TICKET_TTL_MS);
});

test('a web client hears rows in its board and every granted team room, never a view, never another team', async () => {
  const { hub, advance, built, views } = harness();
  views.set(teamKey(5, 10), 'red-view');
  const got = { host: [] as string[], narrowed: [] as string[], plugin: [] as string[] };
  // An every-team host (no seat), a narrowed host on team 10, and a plugin on team 10.
  hub.add({ scope: { userId: 1, eventIds: [5], teamId: null, rows: true, web: true, teamIds: [10, 11] }, send: (m) => got.host.push(m) });
  hub.add({ scope: { userId: 2, eventIds: [5], teamId: 10, rows: true, web: true }, send: (m) => got.narrowed.push(m) });
  hub.add({ scope: { userId: 3, eventIds: [5], teamId: 10, rows: true }, send: (m) => got.plugin.push(m) });
  await advance(100);
  assert.deepEqual(built, [teamKey(5, 10)], 'only the plugin asked for a view');
  assert.deepEqual(got.host, []);
  assert.deepEqual(got.narrowed, []);
  assert.deepEqual(got.plugin, ['red-view']);

  hub.deliverRows(parseRows(JSON.stringify({ k: 'rows', e: 5, m: { t: 'rows', n: 'board' } }))!);
  hub.deliverRows(parseRows(JSON.stringify({ k: 'rows', e: 5, t: 11, m: { t: 'rows', n: 'blue' } }))!);
  hub.deliverRows(parseRows(JSON.stringify({ k: 'rows', e: 5, t: 10, m: { t: 'rows', n: 'red' } }))!);
  hub.deliverRows(parseRows(JSON.stringify({ k: 'rows', e: 5, t: 12, m: { t: 'rows', n: 'green' } }))!);
  const ns = (list: string[]) => list.map((m) => JSON.parse(m).n);
  assert.deepEqual(ns(got.host), ['board', 'blue', 'red'], 'both granted teams, not green');
  assert.deepEqual(ns(got.narrowed), ['board', 'red'], 'their own team only');
  assert.deepEqual(ns(got.plugin.slice(1)), ['board', 'red'], 'the plugin exactly as before');

  // A board change rebuilds views for plugins; a web client is sent nothing for it.
  views.set(teamKey(5, 10), 'red-view-2');
  hub.dispatch(change({ e: 5, t: 10 }));
  await advance(1_000);
  assert.equal(got.host.length, 3);
  assert.equal(got.narrowed.length, 2);
});

test('rows-only team rooms re-ticket when somebody leaves that team, and unsubscribe cleanly', () => {
  const { hub } = harness();
  let blue = 0;
  let red = 0;
  const got: string[] = [];
  const off = hub.add({ scope: { userId: 1, eventIds: [5], teamId: null, rows: true, web: true, teamIds: [11] }, send: (m) => got.push(m), rescope: () => blue++ });
  hub.add({ scope: { userId: 2, eventIds: [5], teamId: 10, rows: true, web: true }, send: () => {}, rescope: () => red++ });
  hub.dispatch(change({ e: 5, x: 11 }));
  assert.deepEqual([blue, red], [1, 0]);
  hub.dispatch(change({ e: 5, x: 10 }));
  assert.deepEqual([blue, red], [1, 1]);
  off();
  hub.deliverRows(parseRows(JSON.stringify({ k: 'rows', e: 5, t: 11, m: { t: 'rows' } }))!);
  hub.deliverRows(parseRows(JSON.stringify({ k: 'rows', e: 5, m: { t: 'rows' } }))!);
  assert.deepEqual(got, []);
  // After the database listener comes back, web pages are told to check once.
  const again: string[] = [];
  hub.add({ scope: { userId: 4, eventIds: [5], teamId: null, rows: true, web: true }, send: (m) => again.push(m) });
  hub.refreshAll();
  assert.deepEqual(again, [NUDGE]);
});

test('the live page’s ticket: a player their team, an every-team host all teams, a narrowed host theirs, an outsider nothing', async () => {
  const { liveTicketScope } = await import('../src/lib/liveTicket.ts');
  const board = { teamIds: [10, 11, 12], hidden: false };
  const base = { eventId: 5, member: true, staff: false, ownTeamOnly: false, solo: false, teamId: 10 as number | null };
  assert.deepEqual(liveTicketScope(base, 1, board), { userId: 1, eventIds: [5], teamId: 10, rows: true, web: true });
  assert.deepEqual(liveTicketScope({ ...base, staff: true, teamId: null }, 2, board), { userId: 2, eventIds: [5], teamId: null, rows: true, web: true, teamIds: [10, 11, 12] });
  assert.deepEqual(liveTicketScope({ ...base, staff: true }, 3, board)?.teamIds, [11, 12], 'a host on a team: the others beside their own');
  assert.equal(liveTicketScope({ ...base, staff: true, ownTeamOnly: true }, 3, board)?.teamIds, undefined);
  // Behind the curtain the page's Feed shows staff their own team only, so the socket hears no other.
  assert.equal(liveTicketScope({ ...base, staff: true }, 3, { ...board, hidden: true })?.teamIds, undefined);
  assert.equal(liveTicketScope({ ...base, staff: true, solo: true }, 3, board)?.teamIds, undefined, 'a solo board has no team chat');
  assert.equal(liveTicketScope({ ...base, member: false }, 4, board), null);
  assert.equal(liveTicketScope(null, 4, board), null);
});
