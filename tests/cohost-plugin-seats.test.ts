// A co-host's members are enrolled on a seat in the HOST clan, but their plugin connects through their
// own clan. Every plugin route that looks up "my active event row" must still find it — counters,
// stats credit and moment scopes used the connected seat alone, so a co-host's whole side reported
// no loot, play time, deaths or rares.
//
// Run: npx tsx --test tests/cohost-plugin-seats.test.ts

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { dropDatabase, loadDb, resetDatabase, useTestDatabase } from './helpers/testDb.ts';

const DB = useTestDatabase('cohost-plugin-seats');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let pluginParticipantScope: typeof import('../src/lib/auth.ts')['pluginParticipantScope'];
let activeScopesFor: typeof import('../src/lib/momentsStore.ts')['activeScopesFor'];

let hostClanId: number;
let cohostClanId: number;
let otherClanId: number;
let homeSeatId: number;
let accountId: number;
let altAccountId: number;
let eventId: number;
let teamId: number;
let participantId: number;

const past = new Date(Date.now() - 3_600_000).toISOString();

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ({ pluginParticipantScope } = await import('../src/lib/auth.ts'));
  ({ activeScopesFor } = await import('../src/lib/momentsStore.ts'));

  const [host] = await db.insert(s.clans).values({ slug: 'host', name: 'Host' }).returning();
  const [cohost] = await db.insert(s.clans).values({ slug: 'cohost', name: 'Cohost' }).returning();
  const [other] = await db.insert(s.clans).values({ slug: 'other', name: 'Other' }).returning();
  hostClanId = host.id;
  cohostClanId = cohost.id;
  otherClanId = other.id;

  const [person] = await db.insert(s.players).values({ displayName: 'Visitor' }).returning();
  const [account] = await db
    .insert(s.accounts)
    .values({ playerId: person.id, rsn: 'Visitor', rsnNormalized: 'visitor' })
    .returning();
  accountId = account.id;
  const [alt] = await db
    .insert(s.accounts)
    .values({ playerId: person.id, rsn: 'Visitor Alt', rsnNormalized: 'visitor alt' })
    .returning();
  altAccountId = alt.id;

  // Their own clan's seat (what the plugin connects through) and the guest seat the host enrolled.
  const [home] = await db
    .insert(s.clanMemberships)
    .values({ clanId: cohostClanId, accountId, kind: 'member', source: 'roster' })
    .returning();
  homeSeatId = home.id;
  const [hostSeat] = await db
    .insert(s.clanMemberships)
    .values({ clanId: hostClanId, accountId, kind: 'guest', source: 'roster' })
    .returning();

  const [event] = await db
    .insert(s.events)
    .values({ clanId: hostClanId, name: 'Clan vs clan', boardSize: 1, startDate: past })
    .returning();
  eventId = event.id;
  await db.insert(s.eventCohosts).values({ eventId, clanId: cohostClanId, status: 'accepted' });
  const [team] = await db.insert(s.teams).values({ eventId, name: 'Cohost side', color: '#0f0' }).returning();
  teamId = team.id;
  const [participant] = await db
    .insert(s.eventParticipants)
    .values({ eventId, clanMemberId: hostSeat.id, accountId, name: 'Visitor', teamId })
    .returning();
  participantId = participant.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

async function rowsFor(member: { clanMemberId: number; accountId: number; clanId: number }) {
  return db
    .select({ id: s.eventParticipants.id })
    .from(s.eventParticipants)
    .innerJoin(s.events, eq(s.eventParticipants.eventId, s.events.id))
    .where(await pluginParticipantScope(member));
}

test('a co-host member connected through their own clan finds their host-seat enrolment', async () => {
  const rows = await rowsFor({ clanMemberId: homeSeatId, accountId, clanId: cohostClanId });
  assert.deepEqual(rows.map((r) => r.id), [participantId]);
});

test('a clan that neither hosts nor co-hosts the board does not reach it', async () => {
  const rows = await rowsFor({ clanMemberId: homeSeatId, accountId, clanId: otherClanId });
  assert.equal(rows.length, 0);
});

test("the same person's alt does not resolve to the main's enrolment", async () => {
  const rows = await rowsFor({ clanMemberId: homeSeatId, accountId: altAccountId, clanId: cohostClanId });
  assert.equal(rows.length, 0);
});

test('moment scopes find the co-hosted board through the plugin scope', async () => {
  const member = { clanMemberId: homeSeatId, accountId, clanId: cohostClanId };
  const seatOnly = await activeScopesFor(homeSeatId, cohostClanId);
  assert.equal(seatOnly.event, null); // the old lookup: nothing on the connected seat
  const scoped = await activeScopesFor(homeSeatId, cohostClanId, new Date(), await pluginParticipantScope(member));
  assert.equal(scoped.event?.id, eventId);
  assert.equal(scoped.event?.teamId, teamId);
});
