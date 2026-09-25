// Historical cleanup for roster placeholders left empty by older claim paths.
//
// Stop immediately before 0093, seed one truly empty person plus a person referenced by each table
// that mergePeople knows about, then apply the migration. The cleanup must remove the directory husk
// without deleting identity history that still needs an explicit merge target.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { eq, inArray } from 'drizzle-orm';

import { dropDatabase, loadDb, migrateRest, resetDatabase, useTestDatabase } from './helpers/testDb.ts';

const DB = useTestDatabase('identity-husks-migration');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let ids: Record<'empty' | 'account' | 'login' | 'ban' | 'request' | 'invite', number>;

before(async () => {
  await resetDatabase(DB, '0092_signup_questions');
  ({ db, pool, schema: s } = await loadDb());

  const [clan] = await db.insert(s.clans).values({ slug: 'cleanup', name: 'Cleanup' }).returning();
  const [event] = await db
    .insert(s.events)
    .values({ clanId: clan.id, name: 'Cleanup Event', boardSize: 25 })
    .returning();
  const people = await db
    .insert(s.players)
    .values([
      { displayName: 'empty' },
      { displayName: 'has account' },
      { displayName: 'has login' },
      { displayName: 'has ban' },
      { displayName: 'has request' },
      { displayName: 'has invite' },
    ])
    .returning();
  ids = Object.fromEntries(people.map((p) => [p.displayName!.replace('has ', ''), p.id])) as typeof ids;

  const [account] = await db
    .insert(s.accounts)
    .values({ playerId: ids.account, rsn: 'Cleanup Main', rsnNormalized: 'cleanup main' })
    .returning();
  await db.insert(s.users).values({ playerId: ids.login, displayName: 'login' });
  await db.insert(s.clanBans).values({ clanId: clan.id, playerId: ids.ban, reason: 'keep history' });
  await db
    .insert(s.clanJoinRequests)
    .values({ clanId: clan.id, accountId: account.id, playerId: ids.request });
  await db.insert(s.eventInvites).values({ eventId: event.id, playerId: ids.invite });

  migrateRest(DB);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('0093 removes only unreferenced person husks', async () => {
  const rows = await db
    .select({ id: s.players.id })
    .from(s.players)
    .where(inArray(s.players.id, Object.values(ids)));
  const survivors = new Set(rows.map((r) => r.id));

  assert.equal(survivors.has(ids.empty), false, 'the historical empty placeholder is removed');
  for (const kind of ['account', 'login', 'ban', 'request', 'invite'] as const) {
    assert.equal(survivors.has(ids[kind]), true, `${kind}-referenced person is preserved`);
  }
  assert.equal(await db.query.players.findFirst({ where: eq(s.players.id, ids.empty) }), undefined);
});
