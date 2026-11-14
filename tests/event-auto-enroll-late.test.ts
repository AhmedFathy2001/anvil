// "Keep adding new plugin members" stopped at the event's start, whatever the host wanted: a clan-wide
// event that was already running never picked up the people who installed the plugin later. The host's
// switch (events.auto_enroll_late) keeps the cron adding until the END; off, the start still stops it.
//
// Run: npx tsx --test tests/event-auto-enroll-late.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('event-auto-enroll-late');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let enroll: typeof import('../src/lib/enroll.ts');
let eventId: number;

const NOW = new Date('2026-11-14T12:00:00Z');

before(async () => {
  await resetDatabase(DB);
  const loaded = await loadDb();
  db = loaded.db;
  pool = loaded.pool;
  s = loaded.schema;
  enroll = await import('../src/lib/enroll.ts');

  const [clan] = await db.insert(s.clans).values({ slug: 'host', name: 'Host Clan' }).returning({ id: s.clans.id });
  const [person] = await db.insert(s.players).values({ displayName: 'Late One' }).returning({ id: s.players.id });
  const [account] = await db
    .insert(s.accounts)
    .values({ playerId: person!.id, rsn: 'Late One', rsnNormalized: 'late one', accountHash: 'h1' })
    .returning({ id: s.accounts.id });
  await db.insert(s.clanMemberships).values({ clanId: clan!.id, accountId: account!.id, kind: 'member' });
  const [event] = await db
    .insert(s.events)
    // Running: started a day ago, ends in a week.
    .values({ clanId: clan!.id, name: 'Open', boardSize: 5, autoEnroll: 'individual', startDate: '2026-11-13T12:00:00.000Z', endDate: '2026-11-21T12:00:00.000Z' })
    .returning({ id: s.events.id });
  eventId = event!.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const onBoard = async () => (await db.select({ id: s.eventParticipants.id }).from(s.eventParticipants).where(eq(s.eventParticipants.eventId, eventId))).length;

test('a running event adds nobody while the switch is off', async () => {
  assert.equal(await enroll.autoEnrollTick(NOW), 0);
  assert.equal(await onBoard(), 0);
});

test('nor after its end, switch on', async () => {
  await db.update(s.events).set({ autoEnrollLate: true }).where(eq(s.events.id, eventId));
  assert.equal(await enroll.autoEnrollTick(new Date('2026-11-22T00:00:00Z')), 0);
  assert.equal(await onBoard(), 0);
});

test('with the switch on, a running event takes the late joiner', async () => {
  assert.equal(await enroll.autoEnrollTick(NOW), 1);
  assert.equal(await onBoard(), 1);
});
