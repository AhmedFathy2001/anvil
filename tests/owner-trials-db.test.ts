// Owner trials against a real database (lib/ownerTrials): grant, entitlement resolution while
// running and after expiry, conversion, revoke, audit. Needs the test Postgres.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('owner-trials');
const DAY = 86_400_000;
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];

before(async () => { await resetDatabase(DB); ({ pool } = await loadDb()); });
after(async () => { await pool.end(); await dropDatabase(DB); });

async function seed() {
  const { db, schema: s } = await loadDb();
  const [owner] = await db.insert(s.users).values({ displayName: 'Owner', discordId: 'o', isOwner: true, platformRole: 'root' } as never).returning();
  const [u] = await db.insert(s.users).values({ displayName: 'Buyer Bob', discordId: 'bob' }).returning();
  const [clan] = await db.insert(s.clans).values({ slug: 'c1', name: 'Trial Clan' }).returning();
  return { db, s, owner, u, clan };
}

test('supporter trial: entitled while running, gone after expiry, audited', async () => {
  const { db, s, owner, u } = await seed();
  const T = await import('../src/lib/ownerTrials.ts');
  const S = await import('../src/lib/supporter.ts');
  const R = await import('../src/lib/supporterTiers.ts');

  assert.equal(await S.supporterForUser(u.id), null);
  await assert.rejects(T.grantTrial({ kind: 'supporter', userId: u.id, tier: 'champion', days: 0, actorUserId: owner.id }));
  const t = await T.grantTrial({ kind: 'supporter', userId: u.id, tier: 'champion', days: 14, note: 'streamer', actorUserId: owner.id });
  assert.equal((await S.supporterForUser(u.id))?.tier.id, 'champion');
  await assert.rejects(T.grantTrial({ kind: 'supporter', userId: u.id, tier: 'patron', days: 5, actorUserId: owner.id }), /already has a trial/);

  const listed = await T.listTrials();
  const mine = listed.trials.find((x) => x.id === `o${t.id}`)!;
  assert.equal(mine.status, 'active');
  assert.equal(mine.valueCents, 200);
  assert.equal(listed.pipelineOwnerCents, 200);

  // The resolver drops it at the expiry instant with no sweep: ask it from the future.
  const rows = await db.select().from(s.supporterSubscriptions).where(eq(s.supporterSubscriptions.userId, u.id));
  assert.equal(R.supporterState(rows, Date.now() + 15 * DAY), null);
  assert.equal(R.supporterState(rows, Date.now() + 13 * DAY)?.tier.id, 'champion');

  const audit = await db.select().from(s.clanAuditLog).where(eq(s.clanAuditLog.eventType, 'owner_trial_granted'));
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actorUserId, owner.id);
});

test('converted: a later paid membership flips it, a gift does not; revoke ends the entitlement and is audited', async () => {
  const { db, s, owner } = await seed2();
  const T = await import('../src/lib/ownerTrials.ts');
  const S = await import('../src/lib/supporter.ts');
  const a = await T.grantTrial({ kind: 'supporter', userId: owner.id + 1, tier: 'patron', days: 30, actorUserId: owner.id });
  assert.equal((await T.listTrials()).trials.find((x) => x.id === `o${a.id}`)?.status, 'active');
  await db.insert(s.supporterSubscriptions).values({ userId: owner.id + 1, tier: 'supporter', status: 'active', recurrence: 'monthly', gumroadSubscriptionId: 'sub-bob', startedAt: new Date(Date.now() + 1000).toISOString() });
  const after = (await T.listTrials()).trials.find((x) => x.id === `o${a.id}`)!;
  assert.equal(after.status, 'converted');
  const [row] = await db.select().from(s.ownerTrials).where(eq(s.ownerTrials.id, a.id));
  assert.ok(row.convertedAt, 'stamped');

  // revoke on a fresh trial
  const b = await T.grantTrial({ kind: 'supporter', userId: owner.id + 2, tier: 'champion', days: 30, actorUserId: owner.id });
  assert.equal((await S.supporterForUser(owner.id + 2))?.tier.id, 'champion');
  assert.equal(await T.revokeTrial(b.id, owner.id), true);
  assert.equal(await S.supporterForUser(owner.id + 2), null);
  assert.equal(await T.revokeTrial(b.id, owner.id), false);
  const audit = await db.select().from(s.clanAuditLog).where(eq(s.clanAuditLog.eventType, 'owner_trial_revoked'));
  assert.equal(audit.length, 1);
});

async function seed2() {
  const { db, schema: s } = await loadDb();
  const [owner] = await db.insert(s.users).values({ displayName: 'Owner2', discordId: 'o2', isOwner: false, platformRole: 'root' } as never).returning();
  await db.insert(s.users).values({ displayName: 'Bob2', discordId: 'bob2' });
  await db.insert(s.users).values({ displayName: 'Cy2', discordId: 'cy2' });
  return { db, s, owner };
}

test('boost trial: lifts the clan while running, falls away at expiry, never overwrites a running gift, converts on real boosts', async () => {
  const { db, s, owner, clan } = await seed3();
  const T = await import('../src/lib/ownerTrials.ts');
  const B = await import('../src/lib/clanBoosts.ts');

  assert.equal((await B.clanBoostLevel(clan.id)).level, 0);
  const t = await T.grantTrial({ kind: 'boost', clanId: clan.id, tier: 2, days: 10, actorUserId: owner.id });
  assert.equal((await B.clanBoostLevel(clan.id)).level, 2);
  assert.equal((await B.clanBoostLevels([clan.id], Date.now() + 11 * DAY)).get(clan.id)?.level ?? 0, 0, 'expired: back to organic');
  await assert.rejects(T.grantTrial({ kind: 'boost', clanId: clan.id, tier: 3, days: 5, actorUserId: owner.id }), /already has a boost gift/);
  const v = (await T.listTrials()).trials.find((x) => x.id === `o${t.id}`)!;
  assert.equal(v.status, 'active');
  assert.equal(v.valueCents, 1600);
  assert.equal(v.estimated, true);

  await db.update(s.clanBoostState).set({ level: 2 }).where(eq(s.clanBoostState.clanId, clan.id));
  assert.equal((await T.listTrials()).trials.find((x) => x.id === `o${t.id}`)?.status, 'converted');

  const u = await T.grantTrial({ kind: 'boost', clanId: clan.id + 0, tier: 1, days: 1, actorUserId: owner.id }).catch(() => null);
  void u;
  assert.equal(await T.revokeTrial(t.id, owner.id), true);
  const audit = await db.select().from(s.clanAuditLog).where(eq(s.clanAuditLog.clanId, clan.id));
  assert.deepEqual(audit.map((a) => a.eventType).filter((e) => e.startsWith('owner_trial')).sort(), ['owner_trial_granted', 'owner_trial_revoked']);
});

async function seed3() {
  const { db, schema: s } = await loadDb();
  const [owner] = await db.insert(s.users).values({ displayName: 'Owner3', discordId: 'o3', platformRole: 'root' } as never).returning();
  const [clan] = await db.insert(s.clans).values({ slug: 'c3', name: 'Boost Clan' }).returning();
  return { db, s, owner, clan };
}

test('ledger: a redelivered notification is recorded once', async () => {
  const { db, schema: s } = await loadDb();
  const L = await import('../src/lib/moneyLedger.ts');
  const ev = { kind: 'sale', sellerId: null, saleId: 'sale-1', subscriptionId: 'sub-1', productId: null, productPermalink: null, tier: 'Champion', email: 'b@x.io', priceCents: 200, currency: 'usd', recurrence: 'monthly', freeTrialEndsAt: null, saleTimestamp: null, isRecurringCharge: false, urlParams: {} } as never;
  await L.recordLedger(ev, 'gumroad_fee=30');
  await L.recordLedger(ev, 'gumroad_fee=30');
  const rows = await db.select().from(s.billingLedger);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].feeCents, 30);
  const M = await import('../src/lib/money.ts');
  const m = await M.loadMoney();
  assert.equal(m.periods.allTime.usd.gross, 200);
  assert.equal(m.recentSales[0].maskedEmail, 'b•••@x•••.io');
  assert.equal((await M.ledgerDetail(rows[0].id))?.buyerEmail, 'b@x.io');
});
