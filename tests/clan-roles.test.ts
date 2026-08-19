// Authority is per clan, and cannot be climbed.
//
// Two separate things are pinned here.
//
// ISOLATION — the reason clan_staff exists. Before it, `role` lived on the user, so with many clans
// on one deployment an admin of any clan was an admin of every clan. That is not a subtle bug; it is
// the reason a shared deployment was unsafe. A grant is a ROW: no row, no authority, whatever the
// person holds elsewhere.
//
// ESCALATION — the guards that stop partial staff access becoming full access. A moderator who can
// edit staff rows is one request away from being an admin, so "you cannot grant at or above your own
// rank" and "you cannot modify someone at or above your grade" have to hold in the library, not the
// UI.
//
// Run: npm run test:roles

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('clan-roles');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let roles: typeof import('../src/lib/clanRoles.ts') & typeof import('../src/lib/clanGrants.ts');
let clanA: number;
let clanB: number;
let adminOfA: number;
let outsider: number;

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  // The comparators and the lookups live in two files now — one pure, one with a database.
  roles = { ...(await import('../src/lib/clanRoles.ts')), ...(await import('../src/lib/clanGrants.ts')) };

  const [a] = await db.insert(s.clans).values({ slug: 'a', name: 'Clan A' }).returning({ id: s.clans.id });
  const [b] = await db.insert(s.clans).values({ slug: 'b', name: 'Clan B' }).returning({ id: s.clans.id });
  clanA = a!.id;
  clanB = b!.id;

  const [u1] = await db.insert(s.users).values({ displayName: 'Admin of A' }).returning({ id: s.users.id });
  const [u2] = await db.insert(s.users).values({ displayName: 'Nobody' }).returning({ id: s.users.id });
  adminOfA = u1!.id;
  outsider = u2!.id;

  await db.insert(s.clanStaff).values({ clanId: clanA, userId: adminOfA, role: 'admin' });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

// ── Isolation ─────────────────────────────────────────────────────────────────────────────────
test('an admin of one clan holds nothing in another', async () => {
  assert.equal(await roles.hasClanRole(clanA, adminOfA, 'admin'), true);
  assert.equal(await roles.hasClanRole(clanB, adminOfA, 'admin'), false, 'admin of A is a stranger to B');
  assert.equal(await roles.hasClanRole(clanB, adminOfA, 'moderator'), false);
  assert.equal(await roles.hasClanRole(clanB, adminOfA, 'member'), false, 'not even a member without a row');
  assert.equal(await roles.clanGrant(clanB, adminOfA), null);
});

test('someone with no grant anywhere holds nothing', async () => {
  assert.equal(await roles.hasClanRole(clanA, outsider, 'member'), false);
  assert.equal(await roles.clanGrant(clanA, outsider), null);
});

test('the same person can hold different roles in different clans', async () => {
  const { db, schema: s } = await loadDb();
  // Admin in A, only a moderator in B — the shape a clan-wide role column could not express.
  await db.insert(s.clanStaff).values({ clanId: clanB, userId: adminOfA, role: 'moderator' });

  assert.equal((await roles.clanGrant(clanA, adminOfA))?.role, 'admin');
  assert.equal((await roles.clanGrant(clanB, adminOfA))?.role, 'moderator');
  assert.equal(await roles.hasClanRole(clanB, adminOfA, 'admin'), false, 'their A role must not leak into B');
});

// ── Ranking ───────────────────────────────────────────────────────────────────────────────────
test('roles rank as owner > admin > {treasurer, moderator} > member', () => {
  assert.ok(roles.rankOf('owner') > roles.rankOf('admin'));
  assert.ok(roles.rankOf('admin') > roles.rankOf('treasurer'));
  assert.equal(roles.rankOf('treasurer'), roles.rankOf('moderator'), 'same tier, different capability');
  assert.ok(roles.rankOf('moderator') > roles.rankOf('member'));
  // Unknown or missing input must fall to the bottom, never the top.
  assert.equal(roles.rankOf(undefined), roles.rankOf('member'));
  assert.equal(roles.rankOf('sysadmin'), roles.rankOf('member'));
});

test('admins are tile editors implicitly', async () => {
  assert.equal((await roles.clanGrant(clanA, adminOfA))?.canEditTiles, true);
});

// ── Escalation ────────────────────────────────────────────────────────────────────────────────
test('nobody can grant a role at or above their own', () => {
  assert.equal(roles.canGrantRole('admin', 'moderator'), true);
  assert.equal(roles.canGrantRole('admin', 'treasurer'), true);
  assert.equal(roles.canGrantRole('admin', 'admin'), false, 'peers cannot mint peers');
  assert.equal(roles.canGrantRole('moderator', 'admin'), false, 'the whole point');
  assert.equal(roles.canGrantRole('moderator', 'moderator'), false);
  assert.equal(roles.canGrantRole('member', 'member'), false);
  // Owner never comes from a grant — it moves by explicit transfer only.
  assert.equal(roles.canGrantRole('owner', 'owner'), false);
  assert.equal(roles.canGrantRole('admin', 'owner'), false);
});

test('nobody can modify someone at or above their grade', () => {
  assert.equal(roles.canModify('admin', 'moderator'), true);
  assert.equal(roles.canModify('admin', 'admin'), false, 'no demoting a peer');
  assert.equal(roles.canModify('moderator', 'admin'), false);
  assert.equal(roles.canModify('admin', 'owner'), false, 'the owner is above every admin');
  assert.equal(roles.canModify('owner', 'admin'), true);
});

// ── Platform authority is a different axis ────────────────────────────────────────────────────
test('a clan role grants no platform capability, and vice versa', async () => {
  // The clan admin from above has no platform role at all.
  assert.equal(await roles.platformRoleOf(adminOfA), 'none');
  assert.equal(roles.hasPlatformRole('none', 'support'), false);

  const { db, schema: s } = await loadDb();
  const [op] = await db
    .insert(s.users)
    .values({ displayName: 'Operator', platformRole: 'staff' })
    .returning({ id: s.users.id });

  assert.equal(await roles.platformRoleOf(op!.id), 'staff');
  assert.equal(roles.hasPlatformRole('staff', 'support'), true);
  assert.equal(roles.hasPlatformRole('staff', 'root'), false);
  // Platform staff hold NO clan authority implicitly — that is the invariant, stated directly.
  assert.equal(await roles.hasClanRole(clanA, op!.id, 'member'), false);
  assert.equal(await roles.clanGrant(clanA, op!.id), null);
});
