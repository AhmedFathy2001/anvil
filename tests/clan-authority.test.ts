// Authority is held per clan and grants nothing anywhere else.
//
// `users.role` was global, which with one deployment serving many clans made every admin an admin of
// EVERY clan. The fix is that authority comes from a clan_staff ROW: no row, no authority, whatever
// someone holds next door.
//
// The escalation guards are here too, because they are the other half of the same problem. Partial
// staff access is only safe while it cannot be used to acquire more — a moderator who can edit staff
// rows is one request away from being an admin, so the check cannot live in the UI.
//
// Run: npm run test:authority

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';
// Pure comparators — no database, so no dynamic import dance.
import { canGrantRole, canModify } from '../src/lib/clanRoles.ts';

const DB = useTestDatabase('clan-authority');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let clanGrant: typeof import('../src/lib/clanGrants.ts')['clanGrant'];
let hasClanRole: typeof import('../src/lib/clanGrants.ts')['hasClanRole'];
let platformRoleOf: typeof import('../src/lib/clanGrants.ts')['platformRoleOf'];

let alpha: number;
let bravo: number;
/** Admin of alpha, and nothing at all in bravo. */
let boss: number;
/** Moderator of bravo only. */
let mod: number;
/** Platform staff, with no grant in either clan. */
let operator: number;

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  ({ clanGrant, hasClanRole, platformRoleOf } = await import('../src/lib/clanGrants.ts'));

  const clans = await db
    .insert(s.clans)
    .values([
      { slug: 'alpha', name: 'Alpha Clan' },
      { slug: 'bravo', name: 'Bravo Clan' },
    ])
    .returning();
  alpha = clans.find((c) => c.slug === 'alpha')!.id;
  bravo = clans.find((c) => c.slug === 'bravo')!.id;

  const people = await db
    .insert(s.users)
    .values([
      { displayName: 'Boss', discordId: '1' },
      { displayName: 'Mod', discordId: '2' },
      { displayName: 'Operator', discordId: '3', platformRole: 'staff' },
    ])
    .returning();
  boss = people.find((u) => u.displayName === 'Boss')!.id;
  mod = people.find((u) => u.displayName === 'Mod')!.id;
  operator = people.find((u) => u.displayName === 'Operator')!.id;

  await db.insert(s.clanStaff).values([
    { clanId: alpha, userId: boss, role: 'admin' },
    { clanId: bravo, userId: mod, role: 'moderator' },
  ]);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

// ── A role is held somewhere, not everywhere ──────────────────────────────────────────────────

test('an admin of one clan is an admin of that clan', async () => {
  assert.equal(await hasClanRole(alpha, boss, 'admin'), true);
});

test('and holds nothing whatsoever in another', async () => {
  assert.equal(await clanGrant(bravo, boss), null, 'no grant, not a demoted one');
  assert.equal(await hasClanRole(bravo, boss, 'moderator'), false);
  assert.equal(await hasClanRole(bravo, boss, 'member'), false, 'not even the floor');
});

test('a grant in one clan says nothing about the other, in either direction', async () => {
  assert.equal(await hasClanRole(bravo, mod, 'moderator'), true);
  assert.equal(await hasClanRole(alpha, mod, 'moderator'), false);
});

test('the same person can hold different roles in different clans', async () => {
  const { db, schema: s } = await loadDb();
  await db.insert(s.clanStaff).values({ clanId: alpha, userId: mod, role: 'member' });

  assert.equal((await clanGrant(bravo, mod))?.role, 'moderator');
  assert.equal((await clanGrant(alpha, mod))?.role, 'member');
  // Which is the point: being staff next door is not a reason to be staff here, and being a plain
  // member here is not a reason to lose anything there.
  assert.equal(await hasClanRole(alpha, mod, 'moderator'), false);
});

// ── Escalation ────────────────────────────────────────────────────────────────────────────────

test('nobody may grant a role at or above their own', () => {
  assert.equal(canGrantRole('moderator', 'admin'), false, 'the first thing a moderator would do');
  assert.equal(canGrantRole('moderator', 'moderator'), false, 'nor a peer');
  assert.equal(canGrantRole('admin', 'moderator'), true);
  assert.equal(canGrantRole('admin', 'admin'), false, 'not even an admin makes another admin');
});

test('owner is never granted, only transferred', () => {
  assert.equal(canGrantRole('owner', 'owner'), false);
  assert.equal(canGrantRole('admin', 'owner'), false);
});

test('nobody may modify a peer or a superior', () => {
  assert.equal(canModify('admin', 'admin'), false, 'two admins cannot demote each other');
  assert.equal(canModify('admin', 'owner'), false);
  assert.equal(canModify('moderator', 'admin'), false);
  assert.equal(canModify('admin', 'moderator'), true);
});

test('treasurer and moderator are one tier, so neither outranks the other', () => {
  assert.equal(canModify('treasurer', 'moderator'), false);
  assert.equal(canModify('moderator', 'treasurer'), false);
  assert.equal(canGrantRole('treasurer', 'moderator'), false);
});

// ── The two axes never mix ────────────────────────────────────────────────────────────────────

test('platform staff get no clan authority by being platform staff', async () => {
  assert.equal(await platformRoleOf(operator), 'staff');
  assert.equal(await clanGrant(alpha, operator), null);
  assert.equal(await clanGrant(bravo, operator), null);
  // Writing into a clan's data has to stay an explicit, logged act rather than something the
  // operator silently always had.
  assert.equal(await hasClanRole(alpha, operator, 'moderator'), false);
});

test('a clan role confers no platform capability', async () => {
  // Boss runs a clan. That is all it makes them.
  assert.equal(await platformRoleOf(boss), 'none');
});


// ── The escape hatch ──────────────────────────────────────────────────────────────────────────
// Authority is read from clan_staff and nowhere else, so a deployment whose bootstrap admin never
// got a row would be unadministrable — including by the person who would have to fix it. The
// ADMIN_DISCORD_ID login grants that row, and the FIRST grant in a clan is its owner.

test('the first bootstrap grant in a clan is its owner, the next is an admin', async () => {
  const { db, schema: s } = await loadDb();
  const { seedClanAdminForTest } = await import('../src/lib/discord-login.ts');

  const [clan] = await db.insert(s.clans).values({ slug: 'fresh', name: 'Fresh Clan' }).returning();
  const people = await db
    .insert(s.users)
    .values([
      { displayName: 'First', discordId: '10' },
      { displayName: 'Second', discordId: '11' },
    ])
    .returning();

  await seedClanAdminForTest(clan.id, people[0].id);
  assert.equal((await clanGrant(clan.id, people[0].id))?.role, 'owner', 'a clan gets exactly one');

  await seedClanAdminForTest(clan.id, people[1].id);
  assert.equal((await clanGrant(clan.id, people[1].id))?.role, 'admin', 'and never a second');
});

test('the bootstrap grant never demotes someone who already holds more', async () => {
  const { db, schema: s } = await loadDb();
  const { seedClanAdminForTest } = await import('../src/lib/discord-login.ts');

  const [clan] = await db.insert(s.clans).values({ slug: 'held', name: 'Held Clan' }).returning();
  const [person] = await db.insert(s.users).values({ displayName: 'Held', discordId: '12' }).returning();
  await db.insert(s.clanStaff).values({ clanId: clan.id, userId: person.id, role: 'owner' });

  // Signing in again must not take the owner's seat away from them.
  await seedClanAdminForTest(clan.id, person.id);
  assert.equal((await clanGrant(clan.id, person.id))?.role, 'owner');
});
