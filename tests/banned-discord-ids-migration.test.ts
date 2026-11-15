// Migration 0266: bans that outlive a deleted account move out of "stand-in" logins.
//
// Before 0266, deleting an account kept a ban by leaving a blank login (Discord id, ban flags,
// empty display name) on a nameless person, with the live clan bans moved to it. Account deletion
// has not shipped to production, so there should be none; the migration still converts any it
// finds and must touch NOTHING that is not exactly that shape.
//
// Stops immediately before 0266, seeds through the historical SQL shape, then applies it.
//
// Run: npx tsx --test tests/banned-discord-ids-migration.test.ts

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { dropDatabase, loadDb, migrateRest, resetDatabase, useTestDatabase } from './helpers/testDb.ts';

const DB = useTestDatabase('banned-discord-ids-migration');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];

const STAND_IN = '810000000000000001';
const PLATFORM_STAND_IN = '810000000000000002';
const REAL_BANNED = '810000000000000003';
const BLANK_NAME_UNBANNED = '810000000000000004';

let clanA: number;
let clanB: number;
const ids: Record<string, { user: number; player: number }> = {};

before(async () => {
  await resetDatabase(DB, '0265_discord_id_source');
  ({ db, pool, schema: s } = await loadDb());

  const one = async (sql: string, params: unknown[]) => Number((await pool.query(sql, params)).rows[0].id);
  clanA = await one('insert into clans (slug, name) values ($1, $2) returning id', ['alpha', 'Alpha']);
  clanB = await one('insert into clans (slug, name) values ($1, $2) returning id', ['bravo', 'Bravo']);
  const modPlayer = await one('insert into players (display_name) values ($1) returning id', ['Mod']);
  const mod = await one('insert into users (player_id, display_name) values ($1, $2) returning id', [modPlayer, 'Mod']);

  const plant = async (key: string, player: { name: string | null; banned?: boolean; bannedAt?: string }, user: Record<string, unknown>) => {
    const playerId = await one('insert into players (display_name, banned, banned_at) values ($1, $2, $3) returning id', [
      player.name,
      player.banned ?? false,
      player.bannedAt ?? null,
    ]);
    const userId = await one(
      'insert into users (player_id, display_name, discord_id, discord_username, email, banned, banned_at) values ($1, $2, $3, $4, $5, $6, $7) returning id',
      [playerId, user.displayName, user.discordId, user.discordUsername ?? null, user.email ?? null, user.banned ?? false, user.bannedAt ?? null],
    );
    ids[key] = { user: userId, player: playerId };
    return { userId, playerId };
  };

  // 1. A stand-in holding two live clan bans (reason already cleared by the old deletion) and a lifted one.
  const a = await plant('standIn', { name: null }, { displayName: '', discordId: STAND_IN });
  await pool.query('insert into clan_bans (clan_id, player_id, reason, banned_at, banned_by_user_id) values ($1, $2, null, $3, $4)', [clanA, a.playerId, '2026-04-04 04:00:00', mod]);
  await pool.query('insert into clan_bans (clan_id, player_id, reason, banned_at) values ($1, $2, null, $3)', [clanB, a.playerId, '2026-04-05 04:00:00']);
  await pool.query('insert into clan_bans (clan_id, player_id, reason, banned_at, lifted_at) values ($1, $2, $3, $4, $5)', [clanA, a.playerId, 'old', '2026-01-01 00:00:00', '2026-02-01 00:00:00']);

  // 2. A stand-in for a platform ban (set on the person).
  await plant('platformStandIn', { name: null, banned: true, bannedAt: '2026-03-03 03:00:00' }, { displayName: '', discordId: PLATFORM_STAND_IN });

  // 3. A REAL banned person: a name, a Discord username, a character. Not a stand-in; untouched.
  const real = await plant('real', { name: 'Real', banned: true, bannedAt: '2026-05-05 05:00:00' }, { displayName: 'Real', discordId: REAL_BANNED, discordUsername: 'real' });
  await pool.query('insert into accounts (player_id, rsn, rsn_normalized) values ($1, $2, $3)', [real.playerId, 'Real Main', 'real main']);
  await pool.query('insert into clan_bans (clan_id, player_id, reason) values ($1, $2, $3)', [clanA, real.playerId, 'a real ban']);

  // 4. A blank-named login with no ban at all: the shape without the ban is not a stand-in either.
  await plant('blank', { name: null }, { displayName: '', discordId: BLANK_NAME_UNBANNED });

  migrateRest(DB);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('0266 moves a stand-in’s clan bans into the table and removes the blank login and person', async () => {
  const rows = await db.select().from(s.bannedDiscordIds).where(eq(s.bannedDiscordIds.discordId, STAND_IN));
  assert.deepEqual(
    rows.map((r) => [r.scope, r.clanId, r.reason, r.bannedAt]).sort(),
    [
      ['clan', clanA, null, '2026-04-04 04:00:00'],
      ['clan', clanB, null, '2026-04-05 04:00:00'],
    ].sort(),
    'the two live bans, with the clans’ dates; the lifted one is not kept',
  );
  assert.ok(rows.find((r) => r.clanId === clanA)?.bannedByUserId, 'who set it carries over');
  assert.equal((await db.select().from(s.users).where(eq(s.users.id, ids.standIn.user))).length, 0);
  assert.equal((await db.select().from(s.players).where(eq(s.players.id, ids.standIn.player))).length, 0);
  assert.equal((await db.select().from(s.clanBans).where(eq(s.clanBans.playerId, ids.standIn.player))).length, 0);
});

test('0266 turns a platform stand-in into one platform row', async () => {
  const rows = await db.select().from(s.bannedDiscordIds).where(eq(s.bannedDiscordIds.discordId, PLATFORM_STAND_IN));
  assert.deepEqual(rows.map((r) => [r.scope, r.clanId, r.reason, r.bannedAt]), [['platform', null, null, '2026-03-03 03:00:00']]);
  assert.equal((await db.select().from(s.users).where(eq(s.users.id, ids.platformStandIn.user))).length, 0);
  assert.equal((await db.select().from(s.players).where(eq(s.players.id, ids.platformStandIn.player))).length, 0);
});

test('0266 leaves a real banned person, and a blank login with no ban, exactly as they were', async () => {
  for (const key of ['real', 'blank']) {
    assert.equal((await db.select().from(s.users).where(eq(s.users.id, ids[key].user))).length, 1, `${key} login`);
    assert.equal((await db.select().from(s.players).where(eq(s.players.id, ids[key].player))).length, 1, `${key} person`);
  }
  const [real] = await db.select().from(s.players).where(eq(s.players.id, ids.real.player));
  assert.equal(real.banned, true);
  assert.equal((await db.select().from(s.clanBans).where(eq(s.clanBans.playerId, ids.real.player))).length, 1);
  assert.equal((await db.select().from(s.bannedDiscordIds).where(eq(s.bannedDiscordIds.discordId, REAL_BANNED))).length, 0);
  assert.equal((await db.select().from(s.bannedDiscordIds).where(eq(s.bannedDiscordIds.discordId, BLANK_NAME_UNBANNED))).length, 0);
  assert.equal((await db.select().from(s.bannedDiscordIds)).length, 3, 'nothing else was written');
});

test('the table refuses a row that is neither shape, and a second row for the same ban', async () => {
  await assert.rejects(db.insert(s.bannedDiscordIds).values({ discordId: '1', scope: 'platform', clanId: clanA }));
  await assert.rejects(db.insert(s.bannedDiscordIds).values({ discordId: '1', scope: 'clan', clanId: null }));
  await assert.rejects(db.insert(s.bannedDiscordIds).values({ discordId: PLATFORM_STAND_IN, scope: 'platform' }), 'one platform row per Discord id');
  await assert.rejects(db.insert(s.bannedDiscordIds).values({ discordId: STAND_IN, scope: 'clan', clanId: clanA }), 'one row per Discord id per clan');
});
