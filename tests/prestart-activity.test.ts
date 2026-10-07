// A revealed board is a preview, not a running event. Pin both halves of that contract:
// ingest cannot scope activity to it, and the lifecycle can repair rows created by an older build.
//
// Run: npx tsx --test tests/prestart-activity.test.ts

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { dropDatabase, loadDb, resetDatabase, useTestDatabase } from './helpers/testDb.ts';

const DB = useTestDatabase('prestart-activity');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let activeScopesFor: typeof import('../src/lib/momentsStore.ts')['activeScopesFor'];
let clearPreStartEventActivity: typeof import('../src/lib/preStartActivity.ts')['clearPreStartEventActivity'];

let clanId: number;
let seatId: number;
let eventId: number;
let teamId: number;
let tileId: number;
let participantId: number;

const future = new Date(Date.now() + 86_400_000).toISOString();

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  ({ activeScopesFor } = await import('../src/lib/momentsStore.ts'));
  ({ clearPreStartEventActivity } = await import('../src/lib/preStartActivity.ts'));

  const [clan] = await db.insert(s.clans).values({ slug: 'preview', name: 'Preview Clan' }).returning();
  clanId = clan.id;
  const [person] = await db.insert(s.players).values({ displayName: 'Player' }).returning();
  const [account] = await db
    .insert(s.accounts)
    .values({ playerId: person.id, rsn: 'Previewer', rsnNormalized: 'previewer' })
    .returning();
  const [seat] = await db
    .insert(s.clanMemberships)
    .values({ clanId, accountId: account.id, kind: 'member', source: 'roster' })
    .returning();
  seatId = seat.id;
  const [event] = await db
    .insert(s.events)
    .values({ clanId, name: 'Revealed Preview', boardSize: 1, startDate: future, tilesRevealed: 1 })
    .returning();
  eventId = event.id;
  const [team] = await db.insert(s.teams).values({ eventId, name: 'Red', color: '#f00' }).returning();
  teamId = team.id;
  const [tile] = await db
    .insert(s.tiles)
    .values({ eventId, position: 0, label: 'Do not score yet', tileType: 'kill', requiredAmount: 1 })
    .returning();
  tileId = tile.id;
  const [participant] = await db
    .insert(s.eventParticipants)
    .values({ eventId, clanMemberId: seatId, accountId: account.id, name: 'Previewer', teamId })
    .returning();
  participantId = participant.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('revealing a future board does not make it an active moments scope', async () => {
  const scopes = await activeScopesFor(seatId, clanId);
  assert.equal(scopes.event, null);
});

test('pre-start repair clears scoring, feed, proof progress and recap counters', async () => {
  await db.insert(s.submissions).values({ tileId, teamId, playerId: participantId, amount: 1 });
  await db.insert(s.completions).values({ tileId, teamId });
  await db.insert(s.moments).values({
    clanMemberId: seatId,
    rsn: 'Previewer',
    kind: 'death',
    eventId,
    teamId,
    occurredAt: new Date().toISOString(),
    dedupKey: 'pre-start:e1',
  });
  await db
    .update(s.eventParticipants)
    .set({ deaths: 2, lootGpGained: 1000, pvpKills: 1, biggestHit: 50, minutesPlayed: 10, caTasks: 1 })
    .where(eq(s.eventParticipants.id, participantId));

  const cleared = await clearPreStartEventActivity(eventId);
  assert.deepEqual(cleared, { completions: 1, submissions: 1, moments: 1, participantCounters: 1 });
  assert.equal((await db.select().from(s.completions)).length, 0);
  assert.equal((await db.select().from(s.submissions)).length, 0);
  assert.equal((await db.select().from(s.moments)).length, 0);
  const participant = await db.query.eventParticipants.findFirst({ where: eq(s.eventParticipants.id, participantId) });
  assert.deepEqual(
    {
      deaths: participant?.deaths,
      lootGpGained: participant?.lootGpGained,
      pvpKills: participant?.pvpKills,
      biggestHit: participant?.biggestHit,
      minutesPlayed: participant?.minutesPlayed,
      caTasks: participant?.caTasks,
    },
    { deaths: 0, lootGpGained: 0, pvpKills: 0, biggestHit: 0, minutesPlayed: 0, caTasks: 0 },
  );
});
