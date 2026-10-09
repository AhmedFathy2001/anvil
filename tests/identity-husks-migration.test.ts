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

  // This database deliberately stops at 0092 while the imported Drizzle schema describes HEAD.
  // Seed through the historical SQL shape: a later column on any of these tables must not make a
  // test of migration 0093 fail before 0093 is even applied.
  const clanId = Number((await pool.query(
    'insert into clans (slug, name) values ($1, $2) returning id',
    ['cleanup', 'Cleanup'],
  )).rows[0].id);
  const eventId = Number((await pool.query(
    'insert into events (clan_id, name, board_size) values ($1, $2, $3) returning id',
    [clanId, 'Cleanup Event', 25],
  )).rows[0].id);
  const people = (await pool.query(
    `insert into players (display_name) values
      ('empty'), ('has account'), ('has login'), ('has ban'), ('has request'), ('has invite')
     returning id, display_name`,
  )).rows as { id: number; display_name: string }[];
  ids = Object.fromEntries(people.map((p) => [p.display_name.replace('has ', ''), Number(p.id)])) as typeof ids;

  const accountId = Number((await pool.query(
    'insert into accounts (player_id, rsn, rsn_normalized) values ($1, $2, $3) returning id',
    [ids.account, 'Cleanup Main', 'cleanup main'],
  )).rows[0].id);
  await pool.query('insert into users (player_id, display_name) values ($1, $2)', [ids.login, 'login']);
  await pool.query(
    'insert into clan_bans (clan_id, player_id, reason) values ($1, $2, $3)',
    [clanId, ids.ban, 'keep history'],
  );
  await pool.query(
    'insert into clan_join_requests (clan_id, account_id, player_id) values ($1, $2, $3)',
    [clanId, accountId, ids.request],
  );
  await pool.query('insert into event_invites (event_id, player_id) values ($1, $2)', [eventId, ids.invite]);

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
