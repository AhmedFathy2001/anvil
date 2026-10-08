// One-time adoption of the already-posted AFK Spot vs LFL rules messages.
//
// Run: npx tsx --test tests/event-rules-post-migration.test.ts

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { dropDatabase, loadDb, migrateRest, resetDatabase, useTestDatabase } from './helpers/testDb.ts';

const DB = useTestDatabase('event_rules_post_migration');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let eventId: number;
let hostId: number;
let cohostId: number;

before(async () => {
  await resetDatabase(DB, '0111_event_participant_names');
  ({ db, pool, schema: s } = await loadDb());
  hostId = (await db.insert(s.clans).values({ slug: 'afk', name: 'The AFK Spot' }).returning())[0].id;
  cohostId = (await db.insert(s.clans).values({ slug: 'lfl', name: 'LFL' }).returning())[0].id;
  // The schema module describes 0112, while this database is intentionally stopped at 0111; use
  // the old table shape to seed the row that the migration must upgrade.
  eventId = Number((await pool.query(
    'insert into events (clan_id, name, board_size, start_date) values ($1, $2, $3, $4) returning id',
    [hostId, 'The AFK Spot VS LFL', 5, '2099-01-01T00:00:00.000Z'],
  )).rows[0].id);
  await db.insert(s.eventCohosts).values({ eventId, clanId: cohostId, status: 'accepted' });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('migration adopts the supplied host and co-host Discord message ids', async () => {
  migrateRest(DB);
  const row = await db.query.events.findFirst({ where: eq(s.events.id, eventId) });
  assert.deepEqual(row?.rulesMessageIds, {
    [String(hostId)]: '1557472003844350024',
    [String(cohostId)]: '1557472003823501347',
  });
});
