// The lab's Feed & chat bench against a real database (lib/labFeedChat): speaking as a session's test
// players goes through the real chat rules, and filed drops land on the session's board.
//
// Run: npx tsx --test tests/lab-feed-chat-db.test.ts   (needs the test Postgres, see tests/helpers/testDb)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('lab-feed-chat');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let db: Awaited<ReturnType<typeof loadDb>>['db'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let L: typeof import('../src/lib/labFeedChat.ts');
let C: typeof import('../src/lib/eventChat.ts');

let eventId: number;
const parts: Record<string, number> = {};

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  L = await import('../src/lib/labFeedChat.ts');
  C = await import('../src/lib/eventChat.ts');
  const [clan] = await db.insert(s.clans).values({ slug: 'anvil-lab', name: 'Anvil lab' }).returning();
  const [ev] = await db.insert(s.events).values({ clanId: clan.id, name: 'Lab session', boardSize: 5, startDate: '2020-01-01T00:00:00.000Z' }).returning();
  eventId = ev.id;
  const [team] = await db.insert(s.teams).values({ eventId, name: 'Lab side', color: '#3ecf62' }).returning();
  for (const [i, name] of ['Lab~Alpha', 'Lab~Bravo'].entries()) {
    const [pl] = await db.insert(s.players).values({ displayName: name }).returning();
    const [a] = await db.insert(s.accounts).values({ playerId: pl.id, rsn: name, rsnNormalized: name.toLowerCase() }).returning();
    await db.insert(s.users).values({ playerId: pl.id, displayName: name, discordId: `lab-dummy-${i}` });
    await db.insert(s.clanMemberships).values({ clanId: clan.id, accountId: a.id, kind: 'member', source: 'lab' });
    const [p] = await db.insert(s.eventParticipants).values({ eventId, accountId: a.id, name, teamId: team.id }).returning();
    parts[name] = p.id;
  }
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('the cast is the session’s players with a login', async () => {
  const cast = await L.labSessionCast(eventId);
  assert.deepEqual(cast.map((c) => c.name), ['Lab~Alpha', 'Lab~Bravo']);
});

test('saying something needs chat on, and then goes through the real rules', async () => {
  const off = await L.labSay(eventId, parts['Lab~Alpha'], 'hello', false);
  assert.equal(off.ok, false, 'platform and session both off');

  await C.setPlatformChat(true);
  await L.labChatOn(eventId, true);
  assert.deepEqual(await L.labSay(eventId, parts['Lab~Alpha'], 'anyone need a duo?', false), { ok: true });
  assert.deepEqual(await L.labSay(eventId, parts['Lab~Bravo'], 'side only', true), { ok: true });
  assert.equal((await L.labSay(eventId, parts['Lab~Bravo'], 'cheap gp at goldshop.com', false)).ok, false, 'the filters apply');
  assert.equal((await L.labSay(eventId, 999_999, 'hi', false)).ok, false, 'only the session’s players');

  const lines = await db.select().from(s.eventChatMessages).where(eq(s.eventChatMessages.eventId, eventId));
  assert.deepEqual(lines.map((l) => [l.rsn, l.teamOnly]), [['Lab~Alpha', false], ['Lab~Bravo', true]]);
});

test('drops land on the board, from its players, at a spread of values', async () => {
  const r = await L.labDrops(eventId, 7);
  assert.equal(r.ok, true);
  const rows = await db.select().from(s.moments).where(eq(s.moments.eventId, eventId));
  assert.equal(rows.length, 7);
  assert.ok(rows.every((m) => m.teamId != null && ['Lab~Alpha', 'Lab~Bravo'].includes(m.rsn)));
  const values = rows.map((m) => m.valueGp ?? 0);
  assert.ok(values.some((v) => v >= 10_000_000) && values.some((v) => v > 0 && v < 1_000_000), 'some clear any floor, some none');
  assert.ok(rows.some((m) => m.kind === 'pet'));
});
