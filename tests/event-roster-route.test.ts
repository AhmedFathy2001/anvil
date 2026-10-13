// GET /api/plugin/event/[id]/roster against a real database: clan scoping, the visibility gate, and
// the three paged reads (lib/eventRoster holds the ranking rules; tests/event-roster.test.ts).
//
// Run: npx tsx --test tests/event-roster-route.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('event-roster-route');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let GET: typeof import('../src/app/api/plugin/event/[id]/roster/route.ts')['GET'];
let openEvent: number;
let privateEvent: number;
let redTeam: number;

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  ({ GET } = await import('../src/app/api/plugin/event/[id]/roster/route.ts'));

  const [open] = await db.insert(s.clans).values({ slug: 'open', name: 'Open Clan' }).returning();
  const [closed] = await db.insert(s.clans).values({ slug: 'closed', name: 'Closed Clan', visibility: 'private' }).returning();
  const [ev] = await db.insert(s.events).values({ clanId: open.id, name: 'Open Bingo', boardSize: 5 }).returning();
  const [pv] = await db.insert(s.events).values({ clanId: closed.id, name: 'Secret Bingo', boardSize: 5 }).returning();
  openEvent = ev.id;
  privateEvent = pv.id;

  const [red, blue] = await db
    .insert(s.teams)
    .values([
      { eventId: openEvent, name: 'Red', color: '#f00' },
      { eventId: openEvent, name: 'Blue', color: '#00f' },
    ])
    .returning();
  redTeam = red.id;
  await db.insert(s.eventParticipants).values([
    ...Array.from({ length: 30 }, (_, i) => ({ eventId: openEvent, name: `Red ${String(i).padStart(2, '0')}`, teamId: red.id })),
    { eventId: openEvent, name: 'Blue One', teamId: blue.id },
    { eventId: openEvent, name: 'Blue Two', teamId: blue.id },
  ]);
  await db.insert(s.teams).values({ eventId: privateEvent, name: 'Hidden', color: '#000' });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const call = async (slug: string, eventId: number, qs = '') => {
  const res = await GET(
    new Request(`https://example.test/api/plugin/event/${eventId}/roster${qs}`, { headers: { 'x-anvil-clan-slug': slug } }),
    { params: Promise.resolve({ id: String(eventId) }) },
  );
  return { status: res.status, body: res.status === 200 ? await res.json() : null, etag: res.headers.get('etag') };
};

test('the overview lists teams with member counts, a page at a time', async () => {
  const { status, body } = await call('open', openEvent, '?size=1');
  assert.equal(status, 200);
  assert.equal(body.mode, 'teams');
  assert.deepEqual([body.total, body.pages, body.teams.length], [2, 2, 1]);
  const both = (await call('open', openEvent)).body;
  assert.deepEqual(
    both.teams.map((t: { name: string; members: number }) => [t.name, t.members]),
    [['Blue', 2], ['Red', 30]],
  );
});

test("a team's members page, and search across teams", async () => {
  const page2 = (await call('open', openEvent, `?team=${redTeam}&page=2&size=25`)).body;
  assert.deepEqual([page2.mode, page2.total, page2.players.length], ['members', 30, 5]);
  assert.equal(page2.players[0].name, 'Red 25');
  const hits = (await call('open', openEvent, '?q=blue')).body;
  assert.deepEqual(hits.players.map((p: { name: string }) => p.name), ['Blue One', 'Blue Two']);
  assert.equal((await call('open', openEvent, '?team=abc')).status, 404);
});

test('an unchanged roster answers 304', async () => {
  const first = await call('open', openEvent);
  const res = await GET(
    new Request(`https://example.test/api/plugin/event/${openEvent}/roster`, {
      headers: { 'x-anvil-clan-slug': 'open', 'if-none-match': first.etag! },
    }),
    { params: Promise.resolve({ id: String(openEvent) }) },
  );
  assert.equal(res.status, 304);
});

test("another clan's address, and a private clan's event to a stranger, are both not found", async () => {
  assert.equal((await call('closed', openEvent)).status, 404);
  assert.equal((await call('closed', privateEvent)).status, 404);
});
