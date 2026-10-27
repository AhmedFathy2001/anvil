// An event's auto-enroll takes its OWN clan's plugin users, and nobody else's.
//
// listEligiblePluginMembers read the roster with no clan in the query, under a "a seat belongs to
// one clan" suppression that was true and beside the point. The Uprising's ladder auto-enroll put
// 101 players on its board — plugin users from every clan on the platform, each made a team.
//
// Run: npx tsx --test tests/event-auto-enroll-scope.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('event-auto-enroll-scope');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let enroll: typeof import('../src/lib/enroll.ts');

let hostClan: number;
let eventId: number;

before(async () => {
  await resetDatabase(DB);
  const loaded = await loadDb();
  db = loaded.db;
  pool = loaded.pool;
  s = loaded.schema;
  enroll = await import('../src/lib/enroll.ts');

  const [host, other] = await db
    .insert(s.clans)
    .values([
      { slug: 'host', name: 'Host Clan' },
      { slug: 'other', name: 'Other Clan' },
    ])
    .returning({ id: s.clans.id });
  hostClan = host!.id;

  // Two plugin users in the host clan, two in a clan with nothing to do with the event.
  const names = ['Host One', 'Host Two', 'Other One', 'Other Two'];
  const people = await db
    .insert(s.players)
    .values(names.map((rsn) => ({ displayName: rsn })))
    .returning({ id: s.players.id });
  const accounts = await db
    .insert(s.accounts)
    .values(names.map((rsn, i) => ({ playerId: people[i]!.id, rsn, rsnNormalized: rsn.toLowerCase(), accountHash: `h${i}` })))
    .returning({ id: s.accounts.id, rsn: s.accounts.rsn });
  await db.insert(s.clanMemberships).values(
    accounts.map((a, i) => ({
      clanId: i < 2 ? hostClan : other!.id,
      accountId: a.id,
      rsn: a.rsn,
      rsnNormalized: a.rsn.toLowerCase(),
      status: 'active',
      kind: 'member',
    })),
  );

  const [event] = await db
    .insert(s.events)
    .values({ clanId: hostClan, name: 'Ladder', boardSize: 5 })
    .returning({ id: s.events.id });
  eventId = event!.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('the preview counts the host clan only', async () => {
  const eligible = await enroll.listEligiblePluginMembers(eventId);
  assert.deepEqual(eligible.map((m) => m.rsn).sort(), ['Host One', 'Host Two']);
});

test('one team each enrols the host clan only', async () => {
  const result = await enroll.autoEnrollActivePluginMembers(eventId, 'individual');
  assert.equal(result.eligible, 2);
  assert.equal(result.teamsCreated, 2);

  const seats = await db
    .select({ clanId: s.clanRoster.clanId })
    .from(s.eventParticipants)
    .innerJoin(s.clanRoster, eq(s.eventParticipants.clanMemberId, s.clanRoster.id))
    .where(eq(s.eventParticipants.eventId, eventId));
  assert.equal(seats.length, 2);
  assert.ok(seats.every((r) => r.clanId === hostClan), 'no other clan may land on this board');

  const signups = await db
    .select({ clanId: s.clanRoster.clanId })
    .from(s.eventSignups)
    .innerJoin(s.clanRoster, eq(s.eventSignups.clanMemberId, s.clanRoster.id))
    .where(eq(s.eventSignups.eventId, eventId));
  assert.ok(signups.every((r) => r.clanId === hostClan), 'nor into its sign-ups');
});
