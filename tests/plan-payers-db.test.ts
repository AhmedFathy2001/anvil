// Delegated plan payer (lib/planPayers), against a real database: the owner lets staff pay, the sale
// records who started the membership, and stopping the payer tells them once while it still runs.
//
// Run: npx tsx --test tests/plan-payers-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('plan-payers');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let payers: typeof import('../src/lib/planPayers.ts');
let sale: typeof import('../src/lib/clanSale.ts');
let gumroad: typeof import('../src/lib/gumroad.ts');

let clanId: number;
const ids = {} as Record<'owner' | 'admin' | 'mod' | 'member', number>;
const dms: number[] = [];

async function person(name: string, role: string | null) {
  const [player] = await db.insert(s.players).values({ displayName: name }).returning();
  const [user] = await db.insert(s.users).values({ displayName: name, playerId: player.id, supporterRef: `ref-${name}` }).returning();
  if (role) await db.insert(s.clanStaff).values({ clanId, userId: user.id, role });
  return user.id;
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  payers = await import('../src/lib/planPayers.ts');
  sale = await import('../src/lib/clanSale.ts');
  gumroad = await import('../src/lib/gumroad.ts');
  payers.payerDeps.dm = async (userId) => {
    dms.push(userId);
    return true;
  };
  clanId = (await db.insert(s.clans).values({ slug: 'payclan', name: 'Pay Clan', gumroadRef: 'clanref' }).returning())[0].id;
  ids.owner = await person('Owner', 'owner');
  ids.admin = await person('Kaiser', 'admin');
  ids.mod = await person('Mod', 'moderator');
  ids.member = await person('Member', 'member');
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

test('only admins, treasurers and mods can be let pay; the owner always can', async () => {
  assert.equal(await payers.canPayForPlan(clanId, ids.owner), true);
  assert.equal(await payers.canPayForPlan(clanId, ids.admin), false);
  const refused = await payers.setPlanPayer(clanId, ids.owner, ids.member, true);
  assert.equal(refused.ok, false);
  assert.deepEqual(await payers.setPlanPayer(clanId, ids.owner, ids.admin, true), { ok: true });
  assert.equal(await payers.canPayForPlan(clanId, ids.admin), true);
  const list = await payers.payerCandidates(clanId);
  assert.deepEqual(list.map((c) => [c.name, c.canPay]), [['Kaiser', true], ['Mod', false]]);
});

test('a sale records who paid, only when they may', async () => {
  assert.equal(await payers.payerForSale(clanId, 'ref-Member'), null);
  assert.equal(await payers.payerForSale(clanId, 'nope'), null);
  const [clan] = await db.select().from(s.clans).where(eq(s.clans.id, clanId));
  const ev = gumroad.parseWebhook(
    new URLSearchParams({ sale_id: 's1', subscription_id: 'sub1', price: '999', recurrence: 'monthly', 'url_params[ref]': 'clanref', 'url_params[payer]': 'ref-Kaiser' }).toString(),
  );
  await sale.applyClanSale(clan, ev);
  const [after] = await db.select().from(s.clans).where(eq(s.clans.id, clanId));
  assert.notEqual(after.plan, 'free');
  assert.equal(after.planPaidByUserId, ids.admin);
  const view = await payers.planPayerView(after);
  assert.deepEqual(view, { payer: { userId: ids.admin, name: 'Kaiser' }, payerStopped: false });
});

test('taking it from the payer tells them once, and the plan stays', async () => {
  await payers.setPlanPayer(clanId, ids.owner, ids.admin, false);
  const notes = await db.select().from(s.userNotices).where(and(eq(s.userNotices.userId, ids.admin), eq(s.userNotices.kind, 'plan_payer_stopped')));
  assert.equal(notes.length, 1);
  assert.match(notes[0].title, /no longer pay for Pay Clan's plan/);
  assert.deepEqual(dms, [ids.admin]);
  const [clan] = await db.select().from(s.clans).where(eq(s.clans.id, clanId));
  assert.notEqual(clan.plan, 'free');
  assert.equal((await payers.planPayerView(clan)).payerStopped, true);
  // The daily check finds the same membership already told.
  assert.deepEqual(await payers.sweepPlanPayers(), { told: 0 });
});

test('a payer who lost their role is told by the daily check', async () => {
  await payers.setPlanPayer(clanId, ids.owner, ids.mod, true);
  await db.update(s.clans).set({ planPaidByUserId: ids.mod, gumroadSubscriptionId: 'sub2' }).where(eq(s.clans.id, clanId));
  await db.update(s.clanStaff).set({ role: 'member' }).where(and(eq(s.clanStaff.clanId, clanId), eq(s.clanStaff.userId, ids.mod)));
  assert.deepEqual(await payers.sweepPlanPayers(), { told: 1 });
  assert.deepEqual(await payers.sweepPlanPayers(), { told: 0 });
});
