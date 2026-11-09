// Regressions from the 2026-11-08 audit.
//
// 1. A captain seat belongs to the team's own clan. /api/captain/claim asked "is this person an admin?"
//    of the clan the REQUEST was addressed to, and team ids are global — so the owner of any clan
//    (anyone can found one) could take the captain seat of every team on the platform.
// 2. A ban reaches the plugin. The plugin's token lookup never asked about either ban, so a banned
//    person kept submitting and posting through the plugin as if nothing had happened.
//
// 3. Nobody collects their own fee. markFeeCollected itself refuses (SelfCollectError → 403), so
//    every route that marks a fee collected enforces it, not only the team-staff one.
//
// Run: npx tsx --test tests/security-audit-1108.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('security-audit-1108');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let auth: typeof import('../src/lib/auth.ts');

let captain: number;
let hostAdmin: number;
let strangerOwner: number;
let team: number;

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  auth = await import('../src/lib/auth.ts');

  const [host] = await db.insert(s.clans).values({ slug: 'host', name: 'Host' }).returning();
  const [mine] = await db.insert(s.clans).values({ slug: 'mine', name: 'Somebody else entirely' }).returning();
  const people = await db
    .insert(s.users)
    .values([
      { displayName: 'Captain', discordId: '800000000000000001' },
      { displayName: 'Host admin', discordId: '800000000000000002' },
      { displayName: 'Owner of another clan', discordId: '800000000000000003' },
    ])
    .returning();
  [captain, hostAdmin, strangerOwner] = people.map((u) => u.id);
  await db.insert(s.clanStaff).values([
    { clanId: host.id, userId: hostAdmin, role: 'admin' },
    { clanId: mine.id, userId: strangerOwner, role: 'owner' },
  ]);
  const [ev] = await db.insert(s.events).values({ clanId: host.id, name: 'Board', boardSize: 5 }).returning();
  [{ id: team }] = await db
    .insert(s.teams)
    .values({ eventId: ev.id, name: 'Reds', color: '#f00', captainUserId: captain })
    .returning();
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('the captain seat: its captain, and admins of the clan that owns the board', async () => {
  assert.equal(await auth.captainSeatAllowed(team, captain), true);
  assert.equal(await auth.captainSeatAllowed(team, hostAdmin), true);
});

test('an owner of some OTHER clan gets no captain seat on this one', async () => {
  assert.equal(await auth.captainSeatAllowed(team, strangerOwner), false);
  assert.equal(await auth.captainSeatAllowed(999_999, hostAdmin), false, 'no such team');
});

const bearer = (token: string) => new Request('https://anvilosrs.com/api/plugin/me', { headers: { Authorization: `Bearer ${token}` } });

test('a plugin token stops working the moment its login or its person is banned', async () => {
  const token = await auth.mintDeviceToken(captain);
  assert.deepEqual(await auth.verifyPluginTokenUser(bearer(token)), { userId: captain });

  await db.update(s.users).set({ banned: true }).where(eq(s.users.id, captain));
  assert.equal(await auth.verifyPluginTokenUser(bearer(token)), null, 'login ban');
  await db.update(s.users).set({ banned: false }).where(eq(s.users.id, captain));
  assert.deepEqual(await auth.verifyPluginTokenUser(bearer(token)), { userId: captain }, 'lifted: the token is not revoked');

  const [person] = await db.insert(s.players).values({ displayName: 'Captain', banned: true }).returning();
  await db.update(s.users).set({ playerId: person.id }).where(eq(s.users.id, captain));
  assert.equal(await auth.verifyPluginTokenUser(bearer(token)), null, 'platform ban on the person');
});

test('nobody marks their own fee collected: markFeeCollected refuses it, someone else can', async () => {
  const fees = await import('../src/lib/feeConfirmations.ts');
  const ev = await db.query.events.findFirst({ columns: { id: true, clanId: true } });
  const [p] = await db.insert(s.players).values({ displayName: 'Fee payer' }).returning();
  await db.update(s.users).set({ playerId: p.id }).where(eq(s.users.id, hostAdmin));
  const [acct] = await db.insert(s.accounts).values({ playerId: p.id, rsn: 'Fee Payer', rsnNormalized: 'fee payer' }).returning();
  const [member] = await db.insert(s.clanMemberships).values({ clanId: ev!.clanId!, accountId: acct.id }).returning();
  const [signup] = await db.insert(s.eventSignups).values({ eventId: ev!.id, clanMemberId: member.id, userId: hostAdmin }).returning();
  const [fee] = await db.insert(s.signupFees).values({ signupId: signup.id, amount: 1_000_000 }).returning();

  await assert.rejects(fees.markFeeCollected(fee, hostAdmin), fees.SelfCollectError);
  const still = await db.query.signupFees.findFirst({ where: eq(s.signupFees.id, fee.id) });
  assert.equal(still!.collectedByUserId, null, 'nothing written');

  const ok = await fees.markFeeCollected(fee, captain);
  assert.equal(ok.fee.collectedByUserId, captain);
});
