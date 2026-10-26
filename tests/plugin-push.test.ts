// The plugin's live push: the signed ticket (lib/push/ticket) and which views get built, how often, and
// who gets them (lib/push/hub). Pure — the database and socket halves are tests/plugin-push-notify.test.ts.
//
// Run: npx tsx --test tests/plugin-push.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ViewHub, parseChange, parseViewKey, teamKey, tileKey, type PushChange } from '../src/lib/push/hub.ts';
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
