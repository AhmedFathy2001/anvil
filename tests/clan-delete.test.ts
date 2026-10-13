// lib/clanDelete against a real database: one DELETE takes the clan and everything under it, leaves
// characters and other clans alone, and a blocked delete leaves nothing half-gone.
//
// Run: npx tsx --test tests/clan-delete.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('clan-delete');

type Loaded = Awaited<ReturnType<typeof loadDb>>;
let db: Loaded['db'];
let s: Loaded['schema'];
let pool: Loaded['pool'];
let mod: typeof import('../src/lib/clanDelete.ts');

before(async () => {
  await resetDatabase(DB);
  ({ db, schema: s, pool } = await loadDb());
  mod = await import('../src/lib/clanDelete.ts');
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

let n = 0;
/** A clan with a person on it, an event they signed up to and scored on, staff, a setting, a weekly. */
async function seedClan(slug: string) {
  n++;
  const [clan] = await db.insert(s.clans).values({ slug, name: `Clan ${slug}` }).returning();
  const [player] = await db.insert(s.players).values({ displayName: `Person ${n}` }).returning();
  const [user] = await db.insert(s.users).values({ displayName: `Login ${n}`, playerId: player.id }).returning();
  const [account] = await db
    .insert(s.accounts)
    .values({ playerId: player.id, rsn: `Rsn ${n}`, rsnNormalized: `rsn ${n}` })
    .returning();
  const [seat] = await db.insert(s.clanMemberships).values({ clanId: clan.id, accountId: account.id }).returning();
  await db.insert(s.clanStaff).values({ clanId: clan.id, userId: user.id, role: 'admin' });
  await db.insert(s.settings).values({ clanId: clan.id, key: 'discord_widget_enabled', value: 'true' });
  const [event] = await db.insert(s.events).values({ clanId: clan.id, name: `Bingo ${slug}`, boardSize: 5 }).returning();
  const [team] = await db.insert(s.teams).values({ eventId: event.id, name: 'Red', color: '#f00' }).returning();
  const [tile] = await db.insert(s.tiles).values({ eventId: event.id, position: 0, label: 'Kill a chicken' }).returning();
  await db.insert(s.completions).values({ teamId: team.id, tileId: tile.id });
  await db.insert(s.eventParticipants).values({ eventId: event.id, name: `Rsn ${n}`, teamId: team.id, clanMemberId: seat.id });
  await db.insert(s.eventSignups).values({ eventId: event.id, userId: user.id, clanMemberId: seat.id });
  await db.insert(s.weeklyCompetitions).values({
    clanId: clan.id,
    type: 'skill',
    metric: 'attack',
    title: 'Attack week',
    startDate: '2026-10-01',
    endDate: '2026-10-08',
  });
  return { clan, player, user, account, seat, event };
}

const count = async (table: string, where = 'true') =>
  Number(((await pool.query(`select count(*)::int as n from ${table} where ${where}`)).rows[0] as { n: number }).n);

test('deletes the clan and everything under it, and nothing else', async () => {
  const gone = await seedClan('gone');
  const kept = await seedClan('kept');

  const result = await mod.deleteClan(gone.clan.id, kept.user.id, 'test cleanup');
  assert.ok(result);
  assert.deepEqual(result.counts, { seats: 1, events: 1, weeklies: 1 });

  assert.equal(await count('clans', `id = ${gone.clan.id}`), 0);
  for (const t of ['clan_memberships', 'clan_staff', 'settings', 'events', 'weekly_competitions']) {
    assert.equal(await count(t, `clan_id = ${gone.clan.id}`), 0, t);
  }
  for (const t of ['teams', 'tiles', 'event_participants', 'event_signups']) {
    assert.equal(await count(t, `event_id = ${gone.event.id}`), 0, t);
  }
  // Characters are not the clan's.
  assert.equal(await count('accounts', `id = ${gone.account.id}`), 1);
  assert.equal(await count('players', `id = ${gone.player.id}`), 1);
  assert.equal(await count('users', `id = ${gone.user.id}`), 1);
  // The other clan is untouched.
  assert.equal(await count('events', `clan_id = ${kept.clan.id}`), 1);
  assert.equal(await count('clan_memberships', `clan_id = ${kept.clan.id}`), 1);

  // Recorded in the platform log, which outlives the clan's own.
  const logRow = (
    await pool.query(`select clan_id, actor_user_id, old_value, notes from clan_audit_log where event_type = 'platform_clan_deleted'`)
  ).rows[0] as { clan_id: number | null; actor_user_id: number; old_value: string; notes: string };
  assert.equal(logRow.clan_id, null);
  assert.equal(logRow.actor_user_id, kept.user.id);
  assert.equal(JSON.parse(logRow.old_value).slug, 'gone');
  assert.equal(logRow.notes, 'test cleanup');

  assert.equal(await mod.deleteClan(gone.clan.id, null, 'again'), null);
});

test("a seat signed up to another clan's event blocks the delete, and nothing is half-gone", async () => {
  const visitor = await seedClan('visitor');
  const host = await seedClan('host');
  await db.insert(s.eventSignups).values({ eventId: host.event.id, userId: visitor.user.id, clanMemberId: visitor.seat.id });

  await assert.rejects(mod.deleteClan(visitor.clan.id, null, 'x'), mod.ClanDeleteBlocked);
  assert.equal(await count('clans', `id = ${visitor.clan.id}`), 1);
  assert.equal(await count('events', `clan_id = ${visitor.clan.id}`), 1);
  assert.equal(await count('clan_audit_log', `event_type = 'platform_clan_deleted' and old_value like '%visitor%'`), 0);
});
