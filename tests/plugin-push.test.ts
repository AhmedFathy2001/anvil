// The plugin's live push: the signed ticket (lib/push/ticket) and who hears which change, how often
// (lib/push/hub). Pure — the database and socket halves are tests/plugin-push-notify.test.ts.
//
// Run: npx tsx --test tests/plugin-push.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PushHub, parseChange, type PushChange } from '../src/lib/push/hub.ts';
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

/** A hub on a hand-driven clock, recording what each client was sent. */
function harness(minGapMs = 5_000) {
  let now = 0;
  const timers: { at: number; fn: () => void }[] = [];
  const hub = new PushHub({
    minGapMs,
    now: () => now,
    later: (fn, ms) => {
      const t = { at: now + ms, fn };
      timers.push(t);
      return () => timers.splice(timers.indexOf(t), 1);
    },
  });
  const client = (eventIds: number[], teamId: number | null) => {
    const got: unknown[] = [];
    const remove = hub.add({ scope: { userId: 1, eventIds, teamId }, send: (m) => got.push(JSON.parse(m)) });
    return { got, remove };
  };
  const advance = (ms: number) => {
    now += ms;
    for (const t of timers.filter((x) => x.at <= now)) {
      timers.splice(timers.indexOf(t), 1);
      t.fn();
    }
  };
  return { hub, client, advance };
}

const change = (over: Partial<PushChange>): PushChange => ({ k: 'submissions', e: 1, t: null, i: null, ...over });

test("a teammate's drop refetches my config; another team's only moves the board", () => {
  const { hub, client } = harness();
  const mine = client([1], 10);
  const theirs = client([1], 20);
  hub.dispatch(change({ t: 10, i: 5 }));
  assert.deepEqual(mine.got, [{ t: 'changed', config: true, board: true, tiles: [5] }]);
  assert.deepEqual(theirs.got, [{ t: 'changed', board: true, tiles: [5] }]);
});

test('an event-wide change reaches everyone on that board, and nobody on another', () => {
  const { hub, client } = harness();
  const a = client([1], 10);
  const viewer = client([1], null);
  const elsewhere = client([2], 30);
  hub.dispatch(change({ k: 'events' }));
  assert.equal(a.got.length, 1);
  assert.deepEqual(viewer.got, [{ t: 'changed', config: true, board: true }]);
  assert.equal(elsewhere.got.length, 0);
});

test('a burst goes out at once, then folds into one message per gap', () => {
  const { hub, client, advance } = harness(5_000);
  const me = client([1], 10);
  hub.dispatch(change({ t: 10, i: 1 }));
  hub.dispatch(change({ t: 20, i: 2 }));
  hub.dispatch(change({ t: 10, i: 3 }));
  assert.equal(me.got.length, 1, 'the first change is not held back');
  advance(4_999);
  assert.equal(me.got.length, 1);
  advance(1);
  assert.deepEqual(me.got[1], { t: 'changed', config: true, board: true, tiles: [2, 3] });
  advance(60_000);
  assert.equal(me.got.length, 2, 'nothing pending, nothing sent');
});

test('a closed client hears nothing more and leaves no timer behind', () => {
  const { hub, client, advance } = harness();
  const me = client([1], 10);
  hub.dispatch(change({}));
  hub.dispatch(change({}));
  me.remove();
  advance(10_000);
  assert.equal(me.got.length, 1);
  assert.equal(hub.size, 0);
});

test('after the database listener comes back, everyone refetches', () => {
  const { hub, client } = harness();
  const a = client([1], 10);
  const b = client([2], null);
  hub.refreshAll();
  assert.deepEqual(a.got, [{ t: 'changed', config: true, board: true }]);
  assert.deepEqual(b.got, [{ t: 'changed', config: true, board: true }]);
});

test('NOTIFY payloads parse, and junk is ignored', () => {
  assert.deepEqual(parseChange('{"k":"completions","e":4,"t":9,"i":2}'), { k: 'completions', e: 4, t: 9, i: 2 });
  assert.deepEqual(parseChange('{"k":"events","e":4,"t":null,"i":null}'), { k: 'events', e: 4, t: null, i: null });
  assert.equal(parseChange('{"k":"x"}'), null);
  assert.equal(parseChange('not json'), null);
});
