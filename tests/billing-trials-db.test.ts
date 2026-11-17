// Trials, upgrades and staff gifts, against a real database and the real webhook handler.
//
// Gumroad is never called: its API is a stub (withGumroad) and every event is a recorded-shape
// notification posted to the handler, the way tests/billing-webhook.test.ts does it.
//
// What is pinned here:
//   - ONE TRIAL. A new clan starts Anvil's own trial of the top tier with no card; the plan in force
//     is read from it and clans.plan is never written; it ends by itself; a sale carrying a Gumroad
//     trial on a clan (or person) that has had a trial or a membership is held to its first charge.
//   - With no trial reported, a purchase applies at once, also as an upgrade over a live membership,
//     when the older membership becomes an open "to cancel" item until Gumroad reports it closed.
//   - A "-now" (pay-now) product is the same tier as its original.
//   - Staff gifts: lift, add time (stacking, and stored for a payer until their paid period ends).
//
// Run: npx tsx --test tests/billing-trials-db.test.ts (needs the test Postgres, see helpers/testDb).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('billing-trials');
const DAY = 86_400_000;
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];

before(async () => {
  await resetDatabase(DB);
  ({ pool } = await loadDb());
  process.env.GUMROAD_WEBHOOK_SECRET = 'test-webhook-secret';
  process.env.GUMROAD_SELLER_ID = 'seller-123';
  process.env.GUMROAD_PRODUCT_SUPPORTER = 'prod-supporter';
  process.env.GUMROAD_PRODUCT_SUPPORTER_NOW = 'prod-supporter-now';
  delete process.env.GUMROAD_ACCESS_TOKEN;
  delete process.env.ANVIL_PLAN_TRIAL_DAYS;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

async function post(fields: Record<string, string>): Promise<Response> {
  const { NextRequest } = await import('next/server');
  const { POST } = await import('../src/app/api/webhooks/gumroad/route.ts');
  return POST(
    new NextRequest('https://anvilosrs.com/api/webhooks/gumroad?key=test-webhook-secret', {
      method: 'POST',
      body: new URLSearchParams({ seller_id: 'seller-123', ...fields }).toString(),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    }),
  );
}

/** Gumroad's API, answering for the subscribers given and confirming every sale. Nothing leaves the process. */
async function withGumroad<T>(subs: Record<string, { status?: string; free_trial_ends_at?: string | null }>, run: () => Promise<T>): Promise<T> {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL) => {
    const u = String(url);
    const sub = /\/subscribers\/([^/?]+)/.exec(u)?.[1];
    if (sub) {
      const id = decodeURIComponent(sub);
      return subs[id] ? Response.json({ success: true, subscriber: { id, status: 'alive', ...subs[id] } }) : new Response('{}', { status: 404 });
    }
    const sale = /\/sales\/([^/?]+)/.exec(u)?.[1];
    if (sale) return Response.json({ success: true, sale: { id: decodeURIComponent(sale) } });
    return new Response('not mocked', { status: 500 });
  }) as typeof fetch;
  process.env.GUMROAD_ACCESS_TOKEN = 'test-token';
  try {
    return await run();
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.GUMROAD_ACCESS_TOKEN;
  }
}

async function withEnv<T>(vars: Record<string, string | undefined>, run: () => Promise<T>): Promise<T> {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await run();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

let n = 0;
async function user(name = 'Person', extra: Record<string, unknown> = {}) {
  const { db, schema: s } = await loadDb();
  n += 1;
  const [u] = await db.insert(s.users).values({ displayName: `${name} ${n}`, discordId: `d-${n}`, ...extra } as never).returning();
  return u;
}

async function clanRow(values: Record<string, unknown>) {
  const { db, schema: s } = await loadDb();
  n += 1;
  const [c] = await db.insert(s.clans).values({ slug: `c${n}`, name: `Clan ${n}`, status: 'active', gumroadRef: `ref-${n}`, ...values } as never).returning();
  return c;
}

async function reload(id: number) {
  const { db, schema: s } = await loadDb();
  return (await db.query.clans.findFirst({ where: eq(s.clans.id, id) }))!;
}

async function extrasOf(clanId: number) {
  const { db, schema: s } = await loadDb();
  return db.select().from(s.clanExtraMemberships).where(eq(s.clanExtraMemberships.clanId, clanId)).orderBy(s.clanExtraMemberships.id);
}

const trialEnd = () => new Date(Date.now() + 30 * DAY).toISOString();

// ── The automatic trial ─────────────────────────────────────────────────────────────────────────

test('a new clan gets the top-tier trial, with no card: Gold in force, clans.plan still free', async () => {
  const { db, schema: s } = await loadDb();
  const { createClan } = await import('../src/lib/clanCreate.ts');
  const T = await import('../src/lib/planTrials.ts');
  const owner = await user('Owner');
  const made = await createClan({ slug: 'fresh-one', name: 'Fresh One', inGameName: 'Fresh One CC', ownerUserId: owner.id });
  assert.ok(made.ok);
  if (!made.ok) return;
  const row = await reload(made.clanId);
  assert.equal(row.plan, 'free', 'the trial tier is never written as if it were paid');
  assert.equal(row.memberCap, 50);
  assert.equal(row.gumroadSubscriptionId, null, 'no card, no membership');

  const [trial] = await db.select().from(s.ownerTrials).where(and(eq(s.ownerTrials.clanId, row.id), eq(s.ownerTrials.kind, 'plan')));
  assert.equal(trial.tier, 'gold');
  assert.equal(trial.days, 30);
  assert.equal(trial.grantedBy, null, 'started by the site, not a staff person');
  assert.equal(trial.note, 'on create');
  const days = (trial.endsAt.getTime() - Date.now()) / DAY;
  assert.ok(days > 29.9 && days <= 30);

  assert.equal(await T.planInForce(row), 'gold');
  assert.equal(await T.capInForce(row), 600);
  // The clan the request resolves (lib/clanContext) carries the plan in force and what is paid for.
  const { resolveClanById } = await import('../src/lib/clanContext.ts');
  const ctx = await resolveClanById(row.id);
  assert.deepEqual([ctx?.plan, ctx?.paidPlan, ctx?.memberCap], ['gold', 'free', 600]);
});

test('the same owner\'s second clan gets a trial too', async () => {
  const { createClan } = await import('../src/lib/clanCreate.ts');
  const T = await import('../src/lib/planTrials.ts');
  const owner = await user('Twice');
  const a = await createClan({ slug: 'twice-a', name: 'Twice A', inGameName: 'Twice A CC', ownerUserId: owner.id });
  const b = await createClan({ slug: 'twice-b', name: 'Twice B', inGameName: 'Twice B CC', ownerUserId: owner.id });
  assert.ok(a.ok && b.ok);
  if (!a.ok || !b.ok) return;
  assert.equal((await T.runningPlanTrial(a.clanId))?.tier, 'gold');
  assert.equal((await T.runningPlanTrial(b.clanId))?.tier, 'gold');
});

test('a creator space gets the top creator tier', async () => {
  const { createCreatorSpace } = await import('../src/lib/clanCreate.ts');
  const T = await import('../src/lib/planTrials.ts');
  const owner = await user('Streamer');
  const made = await createCreatorSpace({ slug: 'streamer-space', name: 'Streamer Space', ownerUserId: owner.id } as never);
  assert.ok(made.ok);
  if (!made.ok) return;
  const row = await reload(made.clanId);
  assert.equal(row.plan, 'creator_free');
  assert.equal(await T.planInForce(row), 'creator_gold');
});

test('a deleted clan created again under the same VERIFIED in-game name does not restart the trial', async () => {
  const { db, schema: s } = await loadDb();
  const { createClan } = await import('../src/lib/clanCreate.ts');
  const { deleteClan } = await import('../src/lib/clanDelete.ts');
  const T = await import('../src/lib/planTrials.ts');
  const owner = await user('Repeat');
  const first = await createClan({ slug: 'repeat-a', name: 'Repeat', inGameName: 'Repeat CC', ownerUserId: owner.id });
  assert.ok(first.ok);
  if (!first.ok) return;
  await db.update(s.clans).set({ ingameNameVerifiedAt: new Date().toISOString() }).where(eq(s.clans.id, first.clanId));
  await deleteClan(first.clanId, owner.id, 'test');

  const again = await createClan({ slug: 'repeat-b', name: 'Repeat', inGameName: 'repeat cc', ownerUserId: owner.id });
  assert.ok(again.ok);
  if (!again.ok) return;
  assert.equal(await T.runningPlanTrial(again.clanId), null, 'same name, deleted and created again: no second trial');
  assert.equal(await T.planInForce(await reload(again.clanId)), 'free');

  // The NAME memory is about the name, whoever asks: a different person creating it gets no trial either.
  const stranger = await user('Stranger');
  await deleteClan(again.clanId, owner.id, 'test');
  const byStranger = await createClan({ slug: 'repeat-c', name: 'Repeat', inGameName: 'Repeat CC', ownerUserId: stranger.id });
  assert.ok(byStranger.ok);
  if (byStranger.ok) assert.equal(await T.runningPlanTrial(byStranger.clanId), null);

  // An UNVERIFIED name that was deleted leaves no mark on the NAME: typing a name proves nothing.
  const first2 = await user('Unproven One');
  const second2 = await user('Unproven Two');
  const other = await createClan({ slug: 'unproven-a', name: 'Unproven', inGameName: 'Unproven CC', ownerUserId: first2.id });
  assert.ok(other.ok);
  if (!other.ok) return;
  await deleteClan(other.clanId, first2.id, 'test');
  const otherAgain = await createClan({ slug: 'unproven-b', name: 'Unproven', inGameName: 'Unproven CC', ownerUserId: second2.id });
  assert.ok(otherAgain.ok);
  if (otherAgain.ok) assert.equal((await T.runningPlanTrial(otherAgain.clanId))?.tier, 'gold');
});

test('delete and create again: an owner who DELETED a trialed clan gets no automatic trial on the next, and is told so', async () => {
  const { db, schema: s } = await loadDb();
  const { createClan, createCreatorSpace } = await import('../src/lib/clanCreate.ts');
  const { deleteClan } = await import('../src/lib/clanDelete.ts');
  const T = await import('../src/lib/planTrials.ts');
  const O = await import('../src/lib/ownerTrials.ts');
  const owner = await user('Looper');
  const root = await user('Root', { platformRole: 'root' });
  assert.deepEqual(await T.autoTrialOfferFor(owner.id), { days: 30, reason: null });

  // The name is never verified, and is even changed before the delete: the owner memory does not care.
  const a = await createClan({ slug: 'loop-a', name: 'Loop A', inGameName: 'Loop A CC', ownerUserId: owner.id });
  assert.ok(a.ok);
  if (!a.ok) return;
  assert.equal((await T.runningPlanTrial(a.clanId))?.tier, 'gold');
  await db.update(s.clans).set({ inGameName: 'Renamed Before Delete', ingameNameVerifiedAt: null }).where(eq(s.clans.id, a.clanId));
  await deleteClan(a.clanId, root.id, 'deleted by staff on the owner\'s request');

  assert.equal(await T.ownerDeletedTrialedClan(owner.id), true, 'remembered against the clan\'s OWNER, whoever pressed delete');
  assert.equal(await T.ownerDeletedTrialedClan(root.id), false);
  assert.deepEqual(await T.autoTrialOfferFor(owner.id), { days: 0, reason: 'owner-deleted-trialed' }, 'the create screen says so instead of promising a trial');
  const b = await createClan({ slug: 'loop-b', name: 'Loop B', inGameName: 'Loop B CC', ownerUserId: owner.id });
  assert.ok(b.ok);
  if (!b.ok) return;
  assert.equal(await T.runningPlanTrial(b.clanId), null, 'no fresh 30 days from deleting and creating again');
  assert.equal(await T.planInForce(await reload(b.clanId)), 'free');
  const space = await createCreatorSpace({ slug: 'loop-space', name: 'Loop Space', ownerUserId: owner.id } as never);
  assert.ok(space.ok);
  if (space.ok) assert.equal(await T.runningPlanTrial(space.clanId), null, 'a creator space is the same loop');

  // Staff can still grant one by hand.
  await O.grantTrial({ kind: 'plan', clanId: b.clanId, tier: 'gold', days: 14, actorUserId: root.id });
  assert.equal(await T.planInForce(await reload(b.clanId)), 'gold');

  // Deleting a clan that never had an automatic trial marks nobody.
  const clean = await user('Clean');
  const bare = await clanRow({});
  await db.insert(s.clanStaff).values({ clanId: bare.id, userId: clean.id, role: 'owner', canEditTiles: true });
  await deleteClan(bare.id, clean.id, 'test');
  assert.equal(await T.ownerDeletedTrialedClan(clean.id), false);
});

test('a clan with a past membership, or one that already had a trial, gets no automatic trial', async () => {
  const { db, schema: s } = await loadDb();
  const T = await import('../src/lib/planTrials.ts');
  const paidBefore = await clanRow({ inGameName: 'Paid Before CC' });
  await db.insert(s.clanAuditLog).values({ clanId: paidBefore.id, eventType: 'billing_ended', newValue: JSON.stringify({ from: 'silver', to: 'free' }) });
  const a = await db.transaction((tx) => T.startAutoTrial(tx, paidBefore));
  assert.deepEqual(a, { granted: false, reason: 'had-membership' });

  const once = await clanRow({ inGameName: 'Once CC' });
  assert.equal((await db.transaction((tx) => T.startAutoTrial(tx, once))).granted, true);
  assert.deepEqual(await db.transaction((tx) => T.startAutoTrial(tx, once)), { granted: false, reason: 'clan-had-trial' });

  await withEnv({ ANVIL_PLAN_TRIAL_DAYS: '0' }, async () => {
    const off = await clanRow({ inGameName: 'Off CC' });
    assert.deepEqual(await db.transaction((tx) => T.startAutoTrial(tx, off)), { granted: false, reason: 'off' });
  });
});

test('a clan that later takes a deleted clan\'s in-game name keeps its trial and is flagged for staff', async () => {
  const { db, schema: s } = await loadDb();
  const { createClan } = await import('../src/lib/clanCreate.ts');
  const { deleteClan } = await import('../src/lib/clanDelete.ts');
  const T = await import('../src/lib/planTrials.ts');
  const O = await import('../src/lib/ownerTrials.ts');
  const owner = await user('Later');
  const old = await createClan({ slug: 'later-old', name: 'Later Old', inGameName: 'Later CC', ownerUserId: owner.id });
  assert.ok(old.ok);
  if (!old.ok) return;
  await db.update(s.clans).set({ ingameNameVerifiedAt: new Date().toISOString() }).where(eq(s.clans.id, old.clanId));
  await deleteClan(old.clanId, owner.id, 'test');
  const someoneElse = await user('Later Two');
  const fresh = await createClan({ slug: 'later-new', name: 'Later New', inGameName: 'Something Else', ownerUserId: someoneElse.id });
  assert.ok(fresh.ok);
  if (!fresh.ok) return;
  await db.update(s.clans).set({ inGameName: 'Later CC' }).where(eq(s.clans.id, fresh.clanId));
  assert.equal((await T.runningPlanTrial(fresh.clanId))?.tier, 'gold', 'nothing is clawed back');
  const listed = (await O.listTrials()).trials.find((t) => t.kind === 'plan' && t.target === 'Later New');
  assert.match(listed?.flag ?? '', /already used a trial/);
  assert.equal(listed?.automatic, true);
});

// ── The trial ends by itself; nobody is removed ─────────────────────────────────────────────────

test('when the trial ends the plan in force is what is paid for, and over-cap members stay', async () => {
  const { db, schema: s } = await loadDb();
  const T = await import('../src/lib/planTrials.ts');
  const C = await import('../src/lib/member-cap.ts');
  const R = await import('../src/lib/memberCapRules.ts');
  const clan = await clanRow({ plan: 'free', memberCap: 50 });
  await db.transaction((tx) => T.startAutoTrial(tx, clan));
  // 60 members: over Free, inside Gold.
  const people = await db.insert(s.players).values(Array.from({ length: 60 }, (_, i) => ({ displayName: `M${i}` }))).returning({ id: s.players.id });
  const accounts = await db
    .insert(s.accounts)
    .values(people.map((person, i) => ({ playerId: person.id, rsn: `M${clan.id}x${i}`, rsnNormalized: `m${clan.id}x${i}` })))
    .returning({ id: s.accounts.id });
  await db.insert(s.clanMemberships).values(accounts.map((a) => ({ clanId: clan.id, accountId: a.id, kind: 'member' })));

  const during = await C.rosterCapStatus(clan.id);
  assert.equal(during.cap, 600);
  assert.equal(during.overLimit, false);

  // After the end date (asked from the future: there is no sweep to wait for).
  const later = Date.now() + 31 * DAY;
  assert.equal(await T.planInForce(clan, later), 'free');
  assert.equal(await T.capInForce(clan, later), 50);
  // The existing over-cap rule for a lapsed plan then applies to the same roster: a grace clock,
  // new members blocked only after it, and nobody removed.
  const after = R.statusFrom(50, await C.activeMemberCount(clan.id), null, new Date(later));
  assert.equal(after.overLimit, true);
  assert.equal(after.state, 'grace');
  assert.equal(R.newMemberAllowance(after), null, 'still adding members inside the grace');
  assert.equal(await C.activeMemberCount(clan.id), 60, 'nobody was removed');
  assert.equal((await reload(clan.id)).plan, 'free');
});

// ── Subscribing after the trial: the pay-now product, never a second free period ────────────────

test('subscribe after a site trial opens the pay-now product; a missing pay-now link shows "opens soon"', async () => {
  const { db } = await loadDb();
  const T = await import('../src/lib/planTrials.ts');
  const B = await import('../src/lib/buyOffer.ts');
  const R = await import('../src/lib/planTrialRules.ts');
  const { PLANS } = await import('../src/lib/plans.ts');
  const clan = await clanRow({});
  const never = await clanRow({});
  await db.transaction((tx) => T.startAutoTrial(tx, clan));
  assert.equal(await T.clanTrialUsed(clan), true, 'a clan on a site trial has had its trial');
  assert.equal(await T.clanTrialUsed(never), false);

  await withEnv({ GUMROAD_URL_GOLD: 'https://gum.test/gold', GUMROAD_URL_GOLD_NOW: 'https://gum.test/gold-now', GUMROAD_URL_SILVER: 'https://gum.test/silver', GUMROAD_URL_SILVER_NOW: undefined }, async () => {
    assert.deepEqual(B.clanBuy(PLANS.gold, clan.gumroadRef, 'monthly', true), { kind: 'subscribe', url: `https://gum.test/gold-now?ref=${clan.gumroadRef}` });
    // With Gumroad's trial ON (30 days), the rule itself: the trial product is never the fallback.
    assert.deepEqual(R.buyButtons({ gumroadTrialDays: 30, trialUsed: true, trialUrl: 'https://gum.test/silver', nowUrl: null }), { kind: 'soon' });
    // A clan from before automatic trials that never had one may still take Gumroad's.
    assert.deepEqual(R.buyButtons({ gumroadTrialDays: 30, trialUsed: await T.clanTrialUsed(never), trialUrl: 'https://gum.test/gold', nowUrl: 'https://gum.test/gold-now' }).kind, 'trial');
  });
});

// ── Sales ───────────────────────────────────────────────────────────────────────────────────────

test('a "-now" sale applies the tier at once, with no trial', async () => {
  const clan = await clanRow({});
  await withEnv({ GUMROAD_PRODUCT_GOLD: 'prod-gold', GUMROAD_PRODUCT_GOLD_NOW: 'prod-gold-now' }, () =>
    withGumroad({ 'sub-now-1': { free_trial_ends_at: null } }, () =>
      post({ resource_name: 'sale', sale_id: 'sale-now-1', subscription_id: 'sub-now-1', product_id: 'prod-gold-now', product_permalink: 'gold-now', recurrence: 'monthly', 'url_params[ref]': clan.gumroadRef! }),
    ),
  );
  const after = await reload(clan.id);
  assert.equal(after.plan, 'gold');
  assert.equal(after.memberCap, 600);
  assert.equal(after.trialEndsAt, null);
  const due = (Date.parse(after.currentPeriodEnd!) - Date.now()) / DAY;
  assert.ok(due > 27 && due < 32, 'next charge a month out');
});

test('a sale with no trial known and no token to ask is NOT guessed to be a trial (TRIAL_DAYS 0)', async () => {
  const { guessedTrialEnd } = await import('../src/lib/clanSale.ts');
  assert.equal(guessedTrialEnd(Date.now(), 0), null);
  assert.ok(guessedTrialEnd(Date.now(), 30), 'only a configured Gumroad trial is ever guessed, and only for display');
  const clan = await clanRow({});
  await post({ resource_name: 'sale', sale_id: 'sale-ng-1', subscription_id: 'sub-ng-1', 'variants[Tier]': 'Anvil Silver', recurrence: 'monthly', 'url_params[ref]': clan.gumroadRef! });
  const after = await reload(clan.id);
  assert.equal(after.plan, 'silver');
  assert.equal(after.trialEndsAt, null, 'no trial is invented');
});

test('a normal sale with a Gumroad trial, on a clan with no history, applies and records the trial end', async () => {
  const clan = await clanRow({});
  const end = trialEnd();
  await withGumroad({ 'sub-ft-1': { free_trial_ends_at: end } }, () =>
    post({ resource_name: 'sale', sale_id: 'sale-ft-1', subscription_id: 'sub-ft-1', 'variants[Tier]': 'Anvil Silver', 'url_params[ref]': clan.gumroadRef! }),
  );
  const after = await reload(clan.id);
  assert.equal(after.plan, 'silver', 'the first trial is the clan\'s to have');
  assert.equal(after.trialEndsAt, end);
  assert.equal(after.currentPeriodEnd, end, 'the first charge is due when Gumroad\'s trial ends');
});

test('a trial-product sale after a SITE trial is held until its first real charge', async () => {
  const { db } = await loadDb();
  const T = await import('../src/lib/planTrials.ts');
  const clan = await clanRow({});
  await db.transaction((tx) => T.startAutoTrial(tx, clan, null, Date.now() - 40 * DAY)); // a trial that has ended
  assert.equal(await T.runningPlanTrial(clan.id), null);
  const end = trialEnd();
  await withGumroad({ 'sub-st-1': { free_trial_ends_at: end } }, async () => {
    const res = await post({ resource_name: 'sale', sale_id: 'sale-st-1', subscription_id: 'sub-st-1', 'variants[Tier]': 'Anvil Gold', 'url_params[ref]': clan.gumroadRef! });
    assert.equal((await res.json()).note, 'held until first charge');
    const held = await reload(clan.id);
    assert.equal(held.plan, 'free', 'no paid tier during a second free period');
    assert.equal(held.gumroadSubscriptionId, 'sub-st-1', 'recorded, so its first charge finds the clan');
    assert.equal(held.trialEndsAt, end);

    await post({ resource_name: 'sale', is_recurring_charge: 'true', sale_id: 'sale-st-2', subscription_id: 'sub-st-1', 'variants[Tier]': 'Anvil Gold', recurrence: 'monthly' });
    const paid = await reload(clan.id);
    assert.equal(paid.plan, 'gold', 'the first real charge starts it');
    assert.equal(paid.trialEndsAt, null);
  });
});

test('a site trial running, then a pay-now purchase: the paid tier takes over, and a lower tier does not cut the trial short', async () => {
  const { db } = await loadDb();
  const T = await import('../src/lib/planTrials.ts');
  const O = await import('../src/lib/ownerTrials.ts');
  const clan = await clanRow({});
  await db.transaction((tx) => T.startAutoTrial(tx, clan));
  // Bronze bought during a Gold trial: applied at once as what they pay for, Gold still in force.
  await withGumroad({ 'sub-rt-1': { free_trial_ends_at: null } }, () =>
    post({ resource_name: 'sale', sale_id: 'sale-rt-1', subscription_id: 'sub-rt-1', 'variants[Tier]': 'Anvil Bronze', recurrence: 'monthly', 'url_params[ref]': clan.gumroadRef! }),
  );
  let row = await reload(clan.id);
  assert.equal(row.plan, 'bronze');
  assert.equal(await T.planInForce(row), 'gold');
  assert.equal(await T.planInForce(row, Date.now() + 31 * DAY), 'bronze', 'after the trial: what they pay for');
  assert.notEqual((await O.listTrials()).trials.find((t) => t.kind === 'plan' && t.target === clan.name)?.status, 'converted', 'Bronze is not the trial tier');

  // Gold bought: it simply takes over, the trial is converted, and Bronze is the membership to cancel.
  await withGumroad({ 'sub-rt-2': { free_trial_ends_at: null } }, () =>
    post({ resource_name: 'sale', sale_id: 'sale-rt-2', subscription_id: 'sub-rt-2', 'variants[Tier]': 'Anvil Gold', recurrence: 'monthly', 'url_params[ref]': clan.gumroadRef! }),
  );
  row = await reload(clan.id);
  assert.equal(row.plan, 'gold');
  assert.equal(row.gumroadSubscriptionId, 'sub-rt-2');
  assert.equal((await O.listTrials()).trials.find((t) => t.kind === 'plan' && t.target === clan.name)?.status, 'converted');
  assert.deepEqual((await extrasOf(clan.id)).map((e) => [e.gumroadSubscriptionId, e.state, e.resolvedAt]), [['sub-rt-1', 'to_cancel', null]]);
});

test('a site trial ended, then a purchase: applies at once', async () => {
  const { db } = await loadDb();
  const T = await import('../src/lib/planTrials.ts');
  const clan = await clanRow({});
  await db.transaction((tx) => T.startAutoTrial(tx, clan, null, Date.now() - 40 * DAY));
  await withGumroad({ 'sub-et-1': { free_trial_ends_at: null } }, () =>
    post({ resource_name: 'sale', sale_id: 'sale-et-1', subscription_id: 'sub-et-1', 'variants[Tier]': 'Anvil Silver', recurrence: 'monthly', 'url_params[ref]': clan.gumroadRef! }),
  );
  const row = await reload(clan.id);
  assert.equal(row.plan, 'silver');
  assert.equal(await T.planInForce(row), 'silver');
});

// ── Upgrades between paid tiers ─────────────────────────────────────────────────────────────────

test('an upgrade purchase while another membership is live applies at once; the older one is an open item until Gumroad closes it', async () => {
  const { db, schema: s } = await loadDb();
  const X = await import('../src/lib/extraMemberships.ts');
  const clan = await clanRow({ plan: 'silver', memberCap: 300, gumroadSubscriptionId: 'sub-up-old' });
  await db.insert(s.clanAuditLog).values({ clanId: clan.id, eventType: 'billing_subscribed', newValue: JSON.stringify({ plan: 'silver' }) });

  await withGumroad({ 'sub-up-new': { free_trial_ends_at: null } }, () =>
    post({ resource_name: 'sale', sale_id: 'sale-up-1', subscription_id: 'sub-up-new', 'variants[Tier]': 'Anvil Gold', recurrence: 'monthly', 'url_params[ref]': clan.gumroadRef! }),
  );
  let row = await reload(clan.id);
  assert.equal(row.plan, 'gold', 'not held: no trial was reported, the purchase is real');
  assert.equal(row.gumroadSubscriptionId, 'sub-up-new');
  let extras = await extrasOf(clan.id);
  assert.deepEqual(extras.map((e) => [e.gumroadSubscriptionId, e.plan, e.state, e.resolvedAt]), [['sub-up-old', 'silver', 'to_cancel', null]]);
  assert.equal((await X.listOpenExtras()).filter((e) => e.clanId === clan.id).length, 1, 'staff see it as an open item');

  // The older one is charged again: noted for staff, still open, and the clan is untouched.
  await post({ resource_name: 'sale', is_recurring_charge: 'true', sale_id: 'sale-up-old-2', subscription_id: 'sub-up-old', recurrence: 'monthly' });
  extras = await extrasOf(clan.id);
  assert.ok(extras[0].lastChargedAt, 'charged twice is exactly what staff need to see');
  assert.equal(extras[0].resolvedAt, null);
  assert.equal((await reload(clan.id)).plan, 'gold');

  // A refund of the older one never suspends the clan, and does not clear the item.
  await post({ resource_name: 'refund', refunded: 'true', sale_id: 'sale-up-old-2', subscription_id: 'sub-up-old' });
  row = await reload(clan.id);
  assert.deepEqual([row.plan, row.status, row.gumroadSubscriptionId], ['gold', 'active', 'sub-up-new']);
  assert.equal((await extrasOf(clan.id))[0].resolvedAt, null);

  // Its cancellation arrives: it still has the term that was paid for, so the row STAYS OPEN, marked
  // cancelled, and the owner is no longer asked to cancel it.
  await post({ resource_name: 'cancellation', subscription_id: 'sub-up-old' });
  extras = await extrasOf(clan.id);
  assert.equal(extras[0].resolvedAt, null, 'not closed by a cancellation');
  assert.ok(extras[0].cancelledAt);
  const D = await import('../src/lib/supporterDuplicates.ts');
  const notice = D.extraMembershipNotice({ tierName: 'Silver', keptTierName: 'Gold', reason: extras[0].reason, cancelledAt: extras[0].cancelledAt!.getTime(), periodEndsAt: Date.parse('2027-03-14T00:00:00Z') });
  assert.equal(notice.askCancel, false);
  assert.equal(notice.lead, 'Your other Silver membership is cancelled, ends 14 Mar 2027. It will not be charged again, so there is nothing more to do');
  row = await reload(clan.id);
  assert.deepEqual([row.plan, row.cancelAtPeriodEnd], ['gold', false], 'the kept membership is not the one cancelled');

  // Its END arrives: closed.
  await post({ resource_name: 'subscription_ended', subscription_id: 'sub-up-old' });
  extras = await extrasOf(clan.id);
  assert.equal(extras[0].resolution, 'ended');
  assert.ok(extras[0].resolvedAt);
  assert.equal((await X.listOpenExtras()).filter((e) => e.clanId === clan.id).length, 0);

  // A resolved row is never reopened by a replay: noting it again writes nothing.
  assert.equal(await X.noteToCancel(clan.id, 'sub-up-old', 'silver'), false);
  assert.ok((await extrasOf(clan.id))[0].resolvedAt, 'still closed');
});

test('latest sale does not always win: the older membership\'s sale redelivered after an upgrade is not applied', async () => {
  const clan = await clanRow({});
  const silver = { resource_name: 'sale', sale_id: 'sale-rd-silver', subscription_id: 'sub-rd-silver', 'variants[Tier]': 'Anvil Silver', recurrence: 'monthly', 'url_params[ref]': clan.gumroadRef! };
  await post(silver);
  await post({ resource_name: 'sale', sale_id: 'sale-rd-gold', subscription_id: 'sub-rd-gold', 'variants[Tier]': 'Anvil Gold', recurrence: 'monthly', 'url_params[ref]': clan.gumroadRef! });
  assert.equal((await reload(clan.id)).plan, 'gold');

  // Silver's own sale notification arrives again (Gumroad redelivers, or someone replays it).
  const res = await post(silver);
  assert.equal((await res.json()).note, 'older membership, not applied');
  const row = await reload(clan.id);
  assert.deepEqual([row.plan, row.memberCap, row.gumroadSubscriptionId], ['gold', 600, 'sub-rd-gold'], 'Gold stays the plan');
  assert.deepEqual((await extrasOf(clan.id)).map((e) => [e.gumroadSubscriptionId, e.state, e.reason, e.resolvedAt]), [['sub-rd-silver', 'to_cancel', 'superseded', null]], 'and Gold was not made the one to cancel');

  // Even after the older one has ENDED (its row resolved), its sale replayed changes nothing.
  await post({ resource_name: 'subscription_ended', subscription_id: 'sub-rd-silver' });
  await post(silver);
  assert.deepEqual([(await reload(clan.id)).plan, (await reload(clan.id)).gumroadSubscriptionId], ['gold', 'sub-rd-gold']);
});

test('two tiers arriving in either order end on the higher; a Gold payer buying Bronze stays Gold', async () => {
  const D = await import('../src/lib/supporterDuplicates.ts');
  // Silver first, then Gold: Gold applies, Silver is the older one to cancel.
  const up = await clanRow({});
  await post({ resource_name: 'sale', sale_id: 'sale-or-1', subscription_id: 'sub-or-silver', 'variants[Tier]': 'Anvil Silver', recurrence: 'monthly', 'url_params[ref]': up.gumroadRef! });
  await post({ resource_name: 'sale', sale_id: 'sale-or-2', subscription_id: 'sub-or-gold', 'variants[Tier]': 'Anvil Gold', recurrence: 'monthly', 'url_params[ref]': up.gumroadRef! });
  assert.deepEqual([(await reload(up.id)).plan, (await reload(up.id)).gumroadSubscriptionId], ['gold', 'sub-or-gold']);

  // Gold first, then Silver: Gold STAYS, Silver is the extra membership to cancel.
  const down = await clanRow({});
  await post({ resource_name: 'sale', sale_id: 'sale-or-3', subscription_id: 'sub-or-gold2', 'variants[Tier]': 'Anvil Gold', recurrence: 'monthly', 'url_params[ref]': down.gumroadRef! });
  const res = await post({ resource_name: 'sale', sale_id: 'sale-or-4', subscription_id: 'sub-or-silver2', 'variants[Tier]': 'Anvil Silver', recurrence: 'monthly', 'url_params[ref]': down.gumroadRef! });
  assert.equal((await res.json()).note, 'kept the higher plan');
  let row = await reload(down.id);
  assert.deepEqual([row.plan, row.memberCap, row.gumroadSubscriptionId], ['gold', 600, 'sub-or-gold2']);
  let extras = await extrasOf(down.id);
  assert.deepEqual(extras.map((e) => [e.gumroadSubscriptionId, e.plan, e.state, e.reason]), [['sub-or-silver2', 'silver', 'to_cancel', 'lower_tier']]);
  assert.ok(extras[0].periodEndsAt, 'when the extra one next charges is known');

  // A Gold payer buys Bronze: Gold stays, and the notice says exactly that.
  await post({ resource_name: 'sale', sale_id: 'sale-or-5', subscription_id: 'sub-or-bronze', 'variants[Tier]': 'Anvil Bronze', recurrence: 'monthly', 'url_params[ref]': down.gumroadRef! });
  row = await reload(down.id);
  assert.deepEqual([row.plan, row.gumroadSubscriptionId], ['gold', 'sub-or-gold2']);
  extras = await extrasOf(down.id);
  const bronze = extras.find((e) => e.plan === 'bronze')!;
  assert.deepEqual(D.extraMembershipNotice({ tierName: 'Bronze', keptTierName: 'Gold', reason: bronze.reason, cancelledAt: null, periodEndsAt: null }), {
    lead: 'You bought Bronze while you have Gold. Gold stays. Cancel the Bronze membership here so you are not charged twice',
    link: 'manage the Bronze membership on Gumroad',
    askCancel: true,
  });

  // The same tier bought twice: the existing one is kept, the new one is the extra.
  await post({ resource_name: 'sale', sale_id: 'sale-or-6', subscription_id: 'sub-or-gold-again', 'variants[Tier]': 'Anvil Gold', recurrence: 'monthly', 'url_params[ref]': down.gumroadRef! });
  row = await reload(down.id);
  assert.equal(row.gumroadSubscriptionId, 'sub-or-gold2');
  const twice = (await extrasOf(down.id)).find((e) => e.gumroadSubscriptionId === 'sub-or-gold-again')!;
  assert.deepEqual([twice.plan, twice.reason], ['gold', 'lower_tier']);
  assert.match(D.extraMembershipNotice({ tierName: 'Gold', keptTierName: 'Gold', reason: twice.reason, cancelledAt: null, periodEndsAt: null }).lead, /^You bought Gold twice\. One Gold membership stays\./);

  // The extra lower one ending, or being charged, never touches the plan; the kept one ending falls
  // back to a lower one only on Gumroad's word that it is alive.
  await post({ resource_name: 'sale', is_recurring_charge: 'true', sale_id: 'sale-or-7', subscription_id: 'sub-or-bronze', recurrence: 'monthly' });
  await post({ resource_name: 'subscription_ended', subscription_id: 'sub-or-silver2' });
  assert.equal((await reload(down.id)).plan, 'gold');
});

test('a held sale remembers the tier that was bought: the first charge applies it even when the charge names no tier', async () => {
  const { db, schema: s } = await loadDb();
  const clan = await clanRow({});
  await db.insert(s.clanAuditLog).values({ clanId: clan.id, eventType: 'billing_ended', newValue: JSON.stringify({ from: 'bronze', to: 'free' }) });
  const end = trialEnd();
  await withGumroad({ 'sub-ht-1': { free_trial_ends_at: end } }, async () => {
    await post({ resource_name: 'sale', sale_id: 'sale-ht-1', subscription_id: 'sub-ht-1', 'variants[Tier]': 'Anvil Gold', 'url_params[ref]': clan.gumroadRef! });
    assert.equal((await reload(clan.id)).plan, 'free');
    // The first charge carries no tier and no product: before, this fell back to the plan the clan had
    // before its last membership ended (Bronze) or the entry tier, not the Gold that was bought.
    await post({ resource_name: 'sale', is_recurring_charge: 'true', sale_id: 'sale-ht-2', subscription_id: 'sub-ht-1', recurrence: 'monthly' });
  });
  const row = await reload(clan.id);
  assert.deepEqual([row.plan, row.memberCap], ['gold', 600]);
});

test('could not ask Gumroad: a sale that shows a real charge is applied, never held', async () => {
  const { db, schema: s } = await loadDb();
  const clan = await clanRow({});
  await db.insert(s.clanAuditLog).values({ clanId: clan.id, eventType: 'billing_ended', newValue: JSON.stringify({ from: 'silver', to: 'free' }) });
  // No token (nobody to ask), no trial field, a price: applied at once.
  await post({ resource_name: 'sale', sale_id: 'sale-rc-1', subscription_id: 'sub-rc-1', 'variants[Tier]': 'Anvil Silver', recurrence: 'monthly', price: '699', 'url_params[ref]': clan.gumroadRef! });
  assert.equal((await reload(clan.id)).plan, 'silver');
});

test('a full refund of the NEWER membership while the older one is alive falls back to it instead of suspending', async () => {
  const clan = await clanRow({ plan: 'silver', memberCap: 300, gumroadSubscriptionId: 'sub-rf-old', currentPeriodEnd: new Date(Date.now() + 12 * DAY).toISOString() });
  await post({ resource_name: 'sale', sale_id: 'sale-rf-1', subscription_id: 'sub-rf-new', 'variants[Tier]': 'Anvil Gold', recurrence: 'monthly', 'url_params[ref]': clan.gumroadRef! });
  assert.equal((await reload(clan.id)).plan, 'gold');
  await withGumroad({ 'sub-rf-old': { status: 'alive' } }, () => post({ resource_name: 'refund', refunded: 'true', sale_id: 'sale-rf-1', subscription_id: 'sub-rf-new' }));
  const row = await reload(clan.id);
  assert.deepEqual([row.plan, row.memberCap, row.status, row.gumroadSubscriptionId], ['silver', 300, 'active', 'sub-rf-old'], 'still paying Silver: Silver, and not suspended');
  assert.ok(row.currentPeriodEnd, 'with the older membership\'s own term end');
  assert.equal((await extrasOf(clan.id))[0].resolution, 'restored');

  // With nobody to ask, or no older membership, a full refund suspends exactly as before.
  const plain = await clanRow({ plan: 'silver', memberCap: 300, gumroadSubscriptionId: 'sub-rf-plain' });
  await post({ resource_name: 'refund', refunded: 'true', sale_id: 'sale-rf-9', subscription_id: 'sub-rf-plain' });
  const after = await reload(plain.id);
  assert.deepEqual([after.plan, after.status], ['free', 'suspended']);
  const unasked = await clanRow({ plan: 'silver', memberCap: 300, gumroadSubscriptionId: 'sub-rf-old2' });
  await post({ resource_name: 'sale', sale_id: 'sale-rf-3', subscription_id: 'sub-rf-new2', 'variants[Tier]': 'Anvil Gold', recurrence: 'monthly', 'url_params[ref]': unasked.gumroadRef! });
  await post({ resource_name: 'refund', refunded: 'true', sale_id: 'sale-rf-3', subscription_id: 'sub-rf-new2' });
  assert.equal((await reload(unasked.id)).status, 'suspended', 'no token: nothing is granted unconfirmed');
});

test('an older membership already cancelled is recorded as cancelled, not as something to cancel, and can still be fallen back to', async () => {
  const until = new Date(Date.now() + 9 * DAY).toISOString();
  const clan = await clanRow({ plan: 'silver', memberCap: 300, gumroadSubscriptionId: 'sub-co-old', cancelAtPeriodEnd: true, currentPeriodEnd: until });
  await post({ resource_name: 'sale', sale_id: 'sale-co-1', subscription_id: 'sub-co-new', 'variants[Tier]': 'Anvil Gold', recurrence: 'monthly', 'url_params[ref]': clan.gumroadRef! });
  assert.equal((await reload(clan.id)).plan, 'gold');
  const [extra] = await extrasOf(clan.id);
  assert.deepEqual([extra.gumroadSubscriptionId, extra.state, extra.resolvedAt], ['sub-co-old', 'to_cancel', null]);
  assert.ok(extra.cancelledAt, 'nobody is asked to cancel it');
  assert.equal(extra.periodEndsAt?.toISOString(), until);
  // The new Gold ends while the cancelled Silver still has term: back to Silver, still leaving.
  await withGumroad({ 'sub-co-old': { status: 'pending_cancellation' } }, () => post({ resource_name: 'subscription_ended', subscription_id: 'sub-co-new' }));
  const row = await reload(clan.id);
  assert.deepEqual([row.plan, row.gumroadSubscriptionId, row.cancelAtPeriodEnd, row.currentPeriodEnd], ['silver', 'sub-co-old', true, until]);
});

test('an upgrade bought WITH a Gumroad trial on a clan with history waits for its first charge, then takes over', async () => {
  const { db, schema: s } = await loadDb();
  const clan = await clanRow({ plan: 'silver', memberCap: 300, gumroadSubscriptionId: 'sub-wt-old' });
  await db.insert(s.clanAuditLog).values({ clanId: clan.id, eventType: 'billing_subscribed', newValue: JSON.stringify({ plan: 'silver' }) });
  const end = trialEnd();
  await withGumroad({ 'sub-wt-new': { free_trial_ends_at: end } }, async () => {
    const res = await post({ resource_name: 'sale', sale_id: 'sale-wt-1', subscription_id: 'sub-wt-new', 'variants[Tier]': 'Anvil Gold', 'url_params[ref]': clan.gumroadRef! });
    assert.equal((await res.json()).note, 'waits for first charge');
    let row = await reload(clan.id);
    assert.deepEqual([row.plan, row.gumroadSubscriptionId], ['silver', 'sub-wt-old'], 'no free Gold: Silver stays the clan\'s');
    let extras = await extrasOf(clan.id);
    assert.deepEqual(extras.map((e) => [e.gumroadSubscriptionId, e.plan, e.state]), [['sub-wt-new', 'gold', 'waiting']]);
    assert.equal(extras[0].trialEndsAt?.toISOString(), end, 'the owner is told the date');

    // Gumroad's trial ends and it charges: Gold takes over, and Silver becomes the one to cancel.
    await post({ resource_name: 'sale', is_recurring_charge: 'true', sale_id: 'sale-wt-2', subscription_id: 'sub-wt-new', 'variants[Tier]': 'Anvil Gold', recurrence: 'monthly' });
    row = await reload(clan.id);
    assert.deepEqual([row.plan, row.memberCap, row.gumroadSubscriptionId], ['gold', 600, 'sub-wt-new']);
    extras = await extrasOf(clan.id);
    assert.deepEqual(
      extras.map((e) => [e.gumroadSubscriptionId, e.state, e.resolution]),
      [['sub-wt-new', 'waiting', 'applied'], ['sub-wt-old', 'to_cancel', null]],
    );
  });
});

test('the newer membership ends while the older one is still running: the clan goes back to it, not to free', async () => {
  const clan = await clanRow({ plan: 'silver', memberCap: 300, gumroadSubscriptionId: 'sub-fb-old' });
  await post({ resource_name: 'sale', sale_id: 'sale-fb-1', subscription_id: 'sub-fb-new', 'variants[Tier]': 'Anvil Gold', recurrence: 'monthly', 'url_params[ref]': clan.gumroadRef! });
  assert.equal((await reload(clan.id)).plan, 'gold');
  await withGumroad({ 'sub-fb-old': { status: 'alive' } }, () => post({ resource_name: 'subscription_ended', subscription_id: 'sub-fb-new' }));
  const row = await reload(clan.id);
  assert.deepEqual([row.plan, row.memberCap, row.gumroadSubscriptionId], ['silver', 300, 'sub-fb-old'], 'still paying Silver, so Silver');
  assert.equal((await extrasOf(clan.id))[0].resolution, 'restored');
});

test('with no way to ask Gumroad, an ended membership still drops to free: nothing is granted unconfirmed', async () => {
  const clan = await clanRow({ plan: 'silver', memberCap: 300, gumroadSubscriptionId: 'sub-nf-old' });
  await post({ resource_name: 'sale', sale_id: 'sale-nf-1', subscription_id: 'sub-nf-new', 'variants[Tier]': 'Anvil Gold', recurrence: 'monthly', 'url_params[ref]': clan.gumroadRef! });
  await post({ resource_name: 'subscription_ended', subscription_id: 'sub-nf-new' });
  const row = await reload(clan.id);
  assert.equal(row.plan, 'free');
  assert.equal((await extrasOf(clan.id))[0].resolvedAt, null, 'the older one stays open for staff');
});

test('a partial refund still does not suspend a clan', async () => {
  const clan = await clanRow({ plan: 'silver', memberCap: 300, gumroadSubscriptionId: 'sub-pr-1' });
  await post({ resource_name: 'refund', partially_refunded: 'true', sale_id: 'sale-pr-1', subscription_id: 'sub-pr-1' });
  const row = await reload(clan.id);
  assert.deepEqual([row.plan, row.status], ['silver', 'active']);
});

// ── Staff plan trial by hand ────────────────────────────────────────────────────────────────────

test('a staff plan trial: one at a time, every past one on record, running / ended / converted in the trials view', async () => {
  const { db, schema: s } = await loadDb();
  const O = await import('../src/lib/ownerTrials.ts');
  const T = await import('../src/lib/planTrials.ts');
  const root = await user('Root', { platformRole: 'root' });
  const clan = await clanRow({ plan: 'bronze', memberCap: 150 });

  await assert.rejects(O.grantTrial({ kind: 'plan', clanId: clan.id, tier: 'bronze', days: 14, actorUserId: root.id }), /would change nothing/);
  await assert.rejects(O.grantTrial({ kind: 'plan', clanId: clan.id, tier: 'creator_gold', days: 14, actorUserId: root.id }), /Bronze, Silver or Gold/);
  const t = await O.grantTrial({ kind: 'plan', clanId: clan.id, tier: 'silver', days: 14, note: 'partner', actorUserId: root.id });
  assert.equal(await T.planInForce(clan), 'silver');
  assert.equal((await reload(clan.id)).plan, 'bronze', 'what they pay for is untouched');
  await assert.rejects(O.grantTrial({ kind: 'plan', clanId: clan.id, tier: 'gold', days: 14, actorUserId: root.id }), /already has a plan trial running/);

  let view = (await O.listTrials()).trials.find((x) => x.id === `o${t.id}`)!;
  assert.deepEqual([view.kind, view.tier, view.status, view.valueCents, view.automatic], ['plan', 'Clan plan Silver', 'active', 699, false]);

  assert.equal(await O.revokeTrial(t.id, root.id), true);
  assert.equal(await T.planInForce(clan), 'bronze', 'ended early: back to what they pay for at once');
  view = (await O.listTrials()).trials.find((x) => x.id === `o${t.id}`)!;
  assert.equal(view.status, 'revoked');
  const again = await O.grantTrial({ kind: 'plan', clanId: clan.id, tier: 'gold', days: 7, actorUserId: root.id });
  assert.equal(await T.planInForce(clan), 'gold');
  const all = await db.select().from(s.ownerTrials).where(and(eq(s.ownerTrials.clanId, clan.id), eq(s.ownerTrials.kind, 'plan')));
  assert.equal(all.length, 2, 'the platform can see every past one');
  const audit = await db.select().from(s.clanAuditLog).where(and(eq(s.clanAuditLog.clanId, clan.id), eq(s.clanAuditLog.eventType, 'owner_trial_granted')));
  assert.deepEqual(audit.map((a) => a.actorUserId), [root.id, root.id]);
  assert.ok(again.id > t.id);
});

test('"Remind me when the trial ends" is recorded and answered once, with an inbox notice for the clan\'s admins', async () => {
  const { db, schema: s } = await loadDb();
  const T = await import('../src/lib/planTrials.ts');
  const R = await import('../src/lib/trialReminders.ts');
  const clan = await clanRow({});
  await db.transaction((tx) => T.startAutoTrial(tx, clan));
  assert.equal(await T.requestPlanTrialReminder(clan.id), true);
  assert.equal((await R.sendTrialReminders()).sent, 0, 'not before the end date');
  assert.equal((await R.sendTrialReminders(Date.now() + 31 * DAY)).sent, 1);
  assert.equal((await R.sendTrialReminders(Date.now() + 32 * DAY)).sent, 0, 'once');
  const [notice] = await db.select().from(s.platformNotices).where(eq(s.platformNotices.audience, `clan:${clan.id}`));
  assert.match(notice.title, /your Gold trial has ended/);
  assert.equal(notice.byDm, true, 'a Discord DM only for those who opted in (the notice\'s own DM path)');
  const none = await clanRow({});
  assert.equal(await T.requestPlanTrialReminder(none.id), false, 'no running trial, nothing to remind about');
});

// ── Supporter: the same one-trial rule for a person ─────────────────────────────────────────────

async function supporterRows(userId: number) {
  const { db, schema: s } = await loadDb();
  return db.select().from(s.supporterSubscriptions).where(eq(s.supporterSubscriptions.userId, userId)).orderBy(s.supporterSubscriptions.id);
}
/** What a paid row is worth: its tier, state, term and Gumroad ids (not the Discord announcement stamp, set in the background). */
function paidFacts(r: Awaited<ReturnType<typeof supporterRows>>[number]) {
  return [r.tier, r.status, r.recurrence, r.currentPeriodEnd, r.gumroadSubscriptionId, r.gumroadSaleId, r.startedAt, r.endedAt, r.queuedDays];
}
async function tierOf(userId: number) {
  const { supporterForUser } = await import('../src/lib/supporter.ts');
  return (await supporterForUser(userId))?.tier.id ?? null;
}

test('a person\'s first Supporter sale with a Gumroad trial starts at once', async () => {
  const u = await user('First', { supporterRef: 'sref-first' });
  await post({ product_id: 'prod-supporter', resource_name: 'sale', sale_id: 'ss-1', subscription_id: 'ssub-1', 'variants[Tier]': 'Champion', recurrence: 'monthly', free_trial_ends_at: trialEnd(), 'url_params[ref]': 'sref-first' });
  assert.equal(await tierOf(u.id), 'champion');
});

test('a platform Supporter trial, then (wrongly) a trial-product sale: held until its first charge', async () => {
  const O = await import('../src/lib/ownerTrials.ts');
  const B = await import('../src/lib/supporterBilling.ts');
  const N = await import('../src/lib/supporterPlanNotes.ts');
  const root = await user('Root', { platformRole: 'root' });
  const u = await user('Trialled', { supporterRef: 'sref-trialled' });
  assert.equal(await B.supporterTrialUsed(u.id), false);
  const t = await O.grantTrial({ kind: 'supporter', userId: u.id, tier: 'supporter', days: 7, actorUserId: root.id });
  assert.equal(await B.supporterTrialUsed(u.id), true, 'a person on a platform trial has had a trial');
  await O.revokeTrial(t.id, root.id);
  assert.equal(await tierOf(u.id), null);

  const end = trialEnd();
  await post({ product_id: 'prod-supporter', resource_name: 'sale', sale_id: 'ss-2', subscription_id: 'ssub-2', 'variants[Tier]': 'Patron', recurrence: 'monthly', free_trial_ends_at: end, 'url_params[ref]': 'sref-trialled' });
  let rows = await supporterRows(u.id);
  assert.equal(rows.at(-1)?.status, 'held');
  assert.equal(await tierOf(u.id), null, 'no Patron during a second free period');
  const notes = await N.supporterPlanNotes(u.id);
  assert.deepEqual([notes.held?.tierName, notes.held?.startsAt], ['Patron', new Date(end).toISOString()]);

  // A restart carries no money: still held. The first real charge starts it.
  await post({ product_id: 'prod-supporter', resource_name: 'subscription_restarted', subscription_id: 'ssub-2' });
  assert.equal(await tierOf(u.id), null);
  await post({ product_id: 'prod-supporter', resource_name: 'sale', is_recurring_charge: 'true', sale_id: 'ss-3', subscription_id: 'ssub-2', 'variants[Tier]': 'Patron', recurrence: 'monthly' });
  rows = await supporterRows(u.id);
  assert.equal(rows.at(-1)?.status, 'active');
  assert.equal(await tierOf(u.id), 'patron');
});

test('a platform Supporter trial, then a pay-now sale: the tier starts at once', async () => {
  const O = await import('../src/lib/ownerTrials.ts');
  const root = await user('Root', { platformRole: 'root' });
  const u = await user('PaysNow', { supporterRef: 'sref-paysnow' });
  await O.grantTrial({ kind: 'supporter', userId: u.id, tier: 'supporter', days: 7, actorUserId: root.id });
  await post({ product_id: 'prod-supporter-now', product_permalink: 'supporter-now', resource_name: 'sale', sale_id: 'ss-4', subscription_id: 'ssub-4', 'variants[Tier]': 'Champion', recurrence: 'monthly', 'url_params[ref]': 'sref-paysnow' });
  assert.equal(await tierOf(u.id), 'champion', 'a pay-now sale carries no trial, so nothing holds it');
  const rows = await supporterRows(u.id);
  assert.equal(rows.at(-1)?.status, 'active');
  const O2 = await O.listTrials();
  assert.equal(O2.trials.find((x) => x.kind === 'supporter' && x.target === u.displayName)?.status, 'converted');
});

test('someone who had a membership before gets no second Gumroad trial either', async () => {
  const u = await user('Returner', { supporterRef: 'sref-returner' });
  await post({ product_id: 'prod-supporter', resource_name: 'sale', sale_id: 'ss-5', subscription_id: 'ssub-5', 'variants[Tier]': 'Supporter', recurrence: 'monthly', 'url_params[ref]': 'sref-returner' });
  await post({ product_id: 'prod-supporter', resource_name: 'subscription_ended', subscription_id: 'ssub-5' });
  assert.equal(await tierOf(u.id), null);
  await post({ product_id: 'prod-supporter', resource_name: 'sale', sale_id: 'ss-6', subscription_id: 'ssub-6', 'variants[Tier]': 'Supporter', recurrence: 'monthly', free_trial_ends_at: trialEnd(), 'url_params[ref]': 'sref-returner' });
  assert.equal(await tierOf(u.id), null);
  assert.equal((await supporterRows(u.id)).at(-1)?.status, 'held');
});

test('a second Supporter membership: the higher tier at once, the older one to cancel until Gumroad reports it', async () => {
  const N = await import('../src/lib/supporterPlanNotes.ts');
  const u = await user('Upgrader', { supporterRef: 'sref-upgrader' });
  await post({ product_id: 'prod-supporter', resource_name: 'sale', sale_id: 'ss-7', subscription_id: 'ssub-7', 'variants[Tier]': 'Supporter', recurrence: 'monthly', 'url_params[ref]': 'sref-upgrader' });
  await post({ product_id: 'prod-supporter-now', resource_name: 'sale', sale_id: 'ss-8', subscription_id: 'ssub-8', 'variants[Tier]': 'Patron', recurrence: 'monthly', 'url_params[ref]': 'sref-upgrader' });
  assert.equal(await tierOf(u.id), 'patron');
  let notes = await N.supporterPlanNotes(u.id);
  assert.deepEqual(notes.toCancel.map((m) => [m.subscriptionId, m.tierName]), [['ssub-7', 'Supporter']]);
  await post({ product_id: 'prod-supporter', resource_name: 'cancellation', subscription_id: 'ssub-7' });
  notes = await N.supporterPlanNotes(u.id);
  assert.deepEqual(notes.toCancel, []);
  assert.equal(await tierOf(u.id), 'patron');
});

// ── Staff gifts ─────────────────────────────────────────────────────────────────────────────────

test('gift lift: at least that tier until the date, the paid membership untouched, audited with the option', async () => {
  const { db, schema: s } = await loadDb();
  const G = await import('../src/lib/supporterGifts.ts');
  const root = await user('Root', { platformRole: 'root' });
  const u = await user('Lifted', { supporterRef: 'sref-lifted' });
  await post({ product_id: 'prod-supporter', resource_name: 'sale', sale_id: 'sg-1', subscription_id: 'gsub-1', 'variants[Tier]': 'Supporter', recurrence: 'monthly', 'url_params[ref]': 'sref-lifted' });
  const before = paidFacts((await supporterRows(u.id))[0]);

  const preview = await G.previewGift({ userId: u.id, playerId: u.playerId ?? -1, tier: 'champion', days: 30, mode: 'lift' });
  assert.equal(preview.nothing, false);
  const gift = await G.giveGift({ userId: u.id, tier: 'champion', days: 30, actorUserId: root.id, note: 'thanks', mode: 'lift' });
  assert.equal(gift.outcome, 'new');
  assert.equal(await tierOf(u.id), 'champion');
  assert.deepEqual(paidFacts((await supporterRows(u.id))[0]), before, 'the paid row is not edited');

  const listed = (await G.listGifts(u.id))[0];
  assert.deepEqual([listed.mode, listed.live, listed.grantedBy, listed.note], ['lift', true, root.displayName, 'thanks']);
  const [entry] = await db.select().from(s.clanAuditLog).where(and(eq(s.clanAuditLog.eventType, 'supporter_gift_granted'), eq(s.clanAuditLog.actorUserId, root.id)));
  const v = JSON.parse(entry.newValue!);
  assert.deepEqual([v.userId, v.giftId, v.tier, v.mode, v.days, v.note], [u.id, gift.id, 'champion', 'lift', 30, 'thanks']);
  assert.ok(v.from && v.endsAt, 'from when to when');

  // Ending a gift early stays possible: back to what they pay for.
  assert.equal(await G.endGift(u.id, gift.id, root.id), true);
  assert.equal(await tierOf(u.id), 'supporter');
  assert.equal((await G.listGifts(u.id))[0].endedBy, root.displayName);
});

test('giveGift without the new option behaves exactly as before (owner trials, older callers)', async () => {
  const G = await import('../src/lib/supporterGifts.ts');
  const root = await user('Root', { platformRole: 'root' });
  const u = await user('Default');
  const a = await G.giveGift({ userId: u.id, tier: 'supporter', days: 10, actorUserId: root.id });
  const b = await G.giveGift({ userId: u.id, tier: 'supporter', days: 20, actorUserId: root.id });
  assert.notEqual(a.id, b.id, 'two separate entitlements that overlap: a lift, as it always was');
  assert.deepEqual([a.mode, b.mode], ['lift', 'lift']);
});

test('gift add time twice: one entitlement whose end moves out, never two overlapping', async () => {
  const G = await import('../src/lib/supporterGifts.ts');
  const root = await user('Root', { platformRole: 'root' });
  const u = await user('Stacker');
  const first = await G.giveGift({ userId: u.id, tier: 'champion', days: 30, actorUserId: root.id, mode: 'add' });
  const second = await G.giveGift({ userId: u.id, tier: 'champion', days: 60, actorUserId: root.id, mode: 'add' });
  assert.equal(second.id, first.id);
  assert.deepEqual([first.outcome, second.outcome], ['new', 'extended']);
  const rows = await supporterRows(u.id);
  assert.equal(rows.length, 1);
  const days = (Date.parse(rows[0].currentPeriodEnd!) - Date.parse(rows[0].startedAt)) / DAY;
  assert.ok(Math.abs(days - 90) < 0.01, `30 + 60 = 90 days, got ${days}`);
  const listed = (await G.listGifts(u.id))[0];
  assert.deepEqual([listed.mode, listed.addedDays], ['add', 60]);
});

test('add time on a running Anvil trial moves the trial\'s end with it', async () => {
  const { db, schema: s } = await loadDb();
  const G = await import('../src/lib/supporterGifts.ts');
  const O = await import('../src/lib/ownerTrials.ts');
  const root = await user('Root', { platformRole: 'root' });
  const u = await user('TrialPlus');
  const t = await O.grantTrial({ kind: 'supporter', userId: u.id, tier: 'champion', days: 14, actorUserId: root.id });
  await G.giveGift({ userId: u.id, tier: 'champion', days: 30, actorUserId: root.id, mode: 'add' });
  const [trial] = await db.select().from(s.ownerTrials).where(eq(s.ownerTrials.id, t.id));
  const days = (trial.endsAt.getTime() - trial.startsAt.getTime()) / DAY;
  assert.ok(Math.abs(days - 44) < 0.01, `14 + 30 = 44 days, got ${days}`);
});

test('add time for a Gumroad payer takes effect only after their paid period ends', async () => {
  const { db, schema: s } = await loadDb();
  const G = await import('../src/lib/supporterGifts.ts');
  const N = await import('../src/lib/supporterPlanNotes.ts');
  const root = await user('Root', { platformRole: 'root' });
  const u = await user('Payer', { supporterRef: 'sref-payer' });
  await post({ product_id: 'prod-supporter', resource_name: 'sale', sale_id: 'sq-1', subscription_id: 'qsub-1', 'variants[Tier]': 'Champion', recurrence: 'monthly', 'url_params[ref]': 'sref-payer' });
  const paidBefore = paidFacts((await supporterRows(u.id))[0]);

  const preview = await G.previewGift({ userId: u.id, playerId: u.playerId ?? -1, tier: 'champion', days: 90, mode: 'add' });
  assert.match(preview.text, /Anvil cannot delay Gumroad's charges/);
  const gift = await G.giveGift({ userId: u.id, tier: 'champion', days: 90, actorUserId: root.id, mode: 'add' });
  assert.equal(gift.outcome, 'queued');
  let rows = await supporterRows(u.id);
  assert.deepEqual(paidFacts(rows[0]), paidBefore, 'their paid period is never extended or edited');
  assert.deepEqual([rows[1].status, rows[1].queuedDays, rows[1].currentPeriodEnd], ['queued', 90, null]);
  assert.deepEqual((await N.supporterPlanNotes(u.id)).giftLines, ['3 months of Champion added by Anvil, starting when your membership ends.']);
  assert.equal(await G.startQueuedGifts(u.id), 0, 'nothing starts while they are paying');

  // A second add: the stored days add up.
  await G.giveGift({ userId: u.id, tier: 'champion', days: 30, actorUserId: root.id, mode: 'add' });
  rows = await supporterRows(u.id);
  assert.equal(rows.length, 2);
  assert.equal(rows[1].queuedDays, 120);

  // They stop paying: the membership ends, and the stored time starts that day.
  await post({ product_id: 'prod-supporter', resource_name: 'cancellation', subscription_id: 'qsub-1' });
  assert.equal((await supporterRows(u.id))[1].status, 'queued', 'cancelled but still inside the paid term: not yet');
  await post({ product_id: 'prod-supporter', resource_name: 'subscription_ended', subscription_id: 'qsub-1' });
  rows = await supporterRows(u.id);
  assert.equal(rows[0].status, 'ended');
  assert.equal(rows[1].status, 'granted');
  const days = (Date.parse(rows[1].currentPeriodEnd!) - Date.now()) / DAY;
  assert.ok(days > 119.9 && days <= 120, `120 days from the day the paid membership stopped, got ${days}`);
  assert.equal(await tierOf(u.id), 'champion', 'carried on for free');
  const started = await db.select().from(s.clanAuditLog).where(eq(s.clanAuditLog.eventType, 'supporter_gift_started'));
  assert.ok(started.some((a) => JSON.parse(a.newValue!).giftId === rows[1].id));
});

test('stored time can be removed before it starts, and the daily pass starts anything a notification missed', async () => {
  const { db, schema: s } = await loadDb();
  const G = await import('../src/lib/supporterGifts.ts');
  const root = await user('Root', { platformRole: 'root' });
  const u = await user('Missed');
  const [paid] = await db
    .insert(s.supporterSubscriptions)
    .values({ userId: u.id, tier: 'supporter', status: 'active', recurrence: 'monthly', gumroadSubscriptionId: `missed-${u.id}`, currentPeriodEnd: new Date(Date.now() + 5 * DAY).toISOString(), startedAt: new Date().toISOString() })
    .returning();
  const a = await G.giveGift({ userId: u.id, tier: 'supporter', days: 30, actorUserId: root.id, mode: 'add' });
  assert.equal(a.outcome, 'queued');
  assert.equal(await G.endGift(u.id, a.id, root.id), true, 'removed while still stored');
  const b = await G.giveGift({ userId: u.id, tier: 'supporter', days: 30, actorUserId: root.id, mode: 'add' });
  assert.notEqual(b.id, a.id);
  // The membership ended with no notification reaching us.
  await db.update(s.supporterSubscriptions).set({ status: 'ended', endedAt: new Date().toISOString() }).where(eq(s.supporterSubscriptions.id, paid.id));
  assert.ok((await G.startDueQueuedGifts()).started >= 1);
  assert.equal(await tierOf(u.id), 'supporter');
});

test('a waiting membership stops being an extra one the moment it is the clan\'s own', async () => {
  const { db, schema: s } = await loadDb();
  const X = await import('../src/lib/extraMemberships.ts');
  const clan = await clanRow({ plan: 'silver', memberCap: 300, gumroadSubscriptionId: 'sub-wo-old' });
  await db.insert(s.clanAuditLog).values({ clanId: clan.id, eventType: 'billing_subscribed', newValue: JSON.stringify({ plan: 'silver' }) });
  await withGumroad({ 'sub-wo-new': { free_trial_ends_at: trialEnd() } }, () =>
    post({ resource_name: 'sale', sale_id: 'sale-wo-1', subscription_id: 'sub-wo-new', 'variants[Tier]': 'Anvil Gold', 'url_params[ref]': clan.gumroadRef! }),
  );
  assert.equal((await extrasOf(clan.id))[0].state, 'waiting');
  // The Silver ends first, and staff put the clan on the waiting membership by hand: its next charge
  // arrives for the clan's OWN subscription, and the waiting row is closed with it.
  await db.update(s.clans).set({ plan: 'free', memberCap: 50, gumroadSubscriptionId: 'sub-wo-new' }).where(eq(s.clans.id, clan.id));
  await post({ resource_name: 'sale', is_recurring_charge: 'true', sale_id: 'sale-wo-2', subscription_id: 'sub-wo-new', 'variants[Tier]': 'Anvil Gold', recurrence: 'monthly' });
  assert.equal((await reload(clan.id)).plan, 'gold');
  assert.equal((await extrasOf(clan.id))[0].resolution, 'applied');
  assert.equal((await X.listOpenExtras()).filter((e) => e.clanId === clan.id).length, 0);
});

test('Supporter: the trial is read from Gumroad\'s own record when the notification does not carry it', async () => {
  const O = await import('../src/lib/ownerTrials.ts');
  const root = await user('Root', { platformRole: 'root' });
  const u = await user('AskedGumroad', { supporterRef: 'sref-asked' });
  const t = await O.grantTrial({ kind: 'supporter', userId: u.id, tier: 'supporter', days: 7, actorUserId: root.id });
  await O.revokeTrial(t.id, root.id);
  const end = trialEnd();
  // No free_trial_ends_at in the notification: before, this was applied at once.
  await withGumroad({ 'ssub-ask-1': { free_trial_ends_at: end } }, () =>
    post({ product_id: 'prod-supporter', resource_name: 'sale', sale_id: 'ss-ask-1', subscription_id: 'ssub-ask-1', 'variants[Tier]': 'Champion', recurrence: 'monthly', 'url_params[ref]': 'sref-asked' }),
  );
  const rows = await supporterRows(u.id);
  assert.deepEqual([rows.at(-1)?.status, rows.at(-1)?.currentPeriodEnd], ['held', new Date(end).toISOString()]);
  assert.equal(await tierOf(u.id), null);

  // Gumroad says there is NO trial: applied, even for someone who has had one.
  const v = await user('NoTrialSaid', { supporterRef: 'sref-notrial' });
  const t2 = await O.grantTrial({ kind: 'supporter', userId: v.id, tier: 'supporter', days: 7, actorUserId: root.id });
  await O.revokeTrial(t2.id, root.id);
  await withGumroad({ 'ssub-ask-2': { free_trial_ends_at: null } }, () =>
    post({ product_id: 'prod-supporter', resource_name: 'sale', sale_id: 'ss-ask-2', subscription_id: 'ssub-ask-2', 'variants[Tier]': 'Champion', recurrence: 'monthly', 'url_params[ref]': 'sref-notrial' }),
  );
  assert.equal(await tierOf(v.id), 'champion');
});

test('a queued gift waits while the PERSON pays for that tier or a higher one, on any of their logins', async () => {
  const { db, schema: s } = await loadDb();
  const G = await import('../src/lib/supporterGifts.ts');
  const root = await user('Root', { platformRole: 'root' });
  const [person] = await db.insert(s.players).values({ displayName: 'Two Logins' }).returning();
  const main = await user('Main', { supporterRef: 'sref-q-main', playerId: person.id });
  await user('Alt', { supporterRef: 'sref-q-alt', playerId: person.id });

  // Pays for Supporter, staff add Supporter time: stored.
  await post({ product_id: 'prod-supporter', resource_name: 'sale', sale_id: 'sq-up-1', subscription_id: 'qsub-up-1', 'variants[Tier]': 'Supporter', recurrence: 'monthly', 'url_params[ref]': 'sref-q-main' });
  const gift = await G.giveGift({ userId: main.id, tier: 'supporter', days: 30, actorUserId: root.id, mode: 'add' });
  assert.equal(gift.outcome, 'queued');

  // They UPGRADE: a Champion membership (bought on their other login), then the Supporter one ends.
  await post({ product_id: 'prod-supporter-now', resource_name: 'sale', sale_id: 'sq-up-2', subscription_id: 'qsub-up-2', 'variants[Tier]': 'Champion', recurrence: 'monthly', 'url_params[ref]': 'sref-q-alt' });
  await post({ product_id: 'prod-supporter', resource_name: 'subscription_ended', subscription_id: 'qsub-up-1' });
  let stored = (await supporterRows(main.id)).find((r) => r.id === gift.id)!;
  assert.equal(stored.status, 'queued', 'still paying, for a HIGHER tier: the stored Supporter time must not start and run out unseen');
  assert.equal(await G.startQueuedGifts(main.id), 0);
  assert.equal((await G.startDueQueuedGifts()).started, 0);

  // The Champion membership ends too: now it starts.
  await post({ product_id: 'prod-supporter-now', resource_name: 'subscription_ended', subscription_id: 'qsub-up-2' });
  stored = (await supporterRows(main.id)).find((r) => r.id === gift.id)!;
  assert.equal(stored.status, 'granted', 'started by the end of a membership on the person\'s OTHER login');
  assert.equal(await tierOf(main.id), 'supporter');
});

test('add time submitted twice at once extends twice in sequence: no lost extension, no second row', async () => {
  const G = await import('../src/lib/supporterGifts.ts');
  const root = await user('Root', { platformRole: 'root' });
  const u = await user('DoubleClick');
  await G.giveGift({ userId: u.id, tier: 'champion', days: 10, actorUserId: root.id, mode: 'add' });
  const [a, b] = await Promise.all([
    G.giveGift({ userId: u.id, tier: 'champion', days: 30, actorUserId: root.id, mode: 'add' }),
    G.giveGift({ userId: u.id, tier: 'champion', days: 30, actorUserId: root.id, mode: 'add' }),
  ]);
  assert.equal(a.id, b.id);
  const rows = await supporterRows(u.id);
  assert.equal(rows.length, 1, 'one entitlement');
  const days = (Date.parse(rows[0].currentPeriodEnd!) - Date.parse(rows[0].startedAt)) / DAY;
  assert.ok(Math.abs(days - 70) < 0.01, `10 + 30 + 30 = 70 days, got ${days}`);

  // Two at once for someone holding NOTHING: one row, both lengths on it.
  const fresh = await user('DoubleFresh');
  await Promise.all([
    G.giveGift({ userId: fresh.id, tier: 'patron', days: 30, actorUserId: root.id, mode: 'add' }),
    G.giveGift({ userId: fresh.id, tier: 'patron', days: 30, actorUserId: root.id, mode: 'add' }),
  ]);
  const made = await supporterRows(fresh.id);
  assert.equal(made.length, 1);
  const total = (Date.parse(made[0].currentPeriodEnd!) - Date.parse(made[0].startedAt)) / DAY;
  assert.ok(Math.abs(total - 60) < 0.01, `30 + 30 = 60 days, got ${total}`);
});
