// The creator plan catalogue against a real database: migration 0203's backfill (creator spaces move
// to creator ids, clans untouched), the constraint that keeps the catalogues apart, and /portal's
// read of everything one person pays for (lib/billingPortal).
//
// Run: npm run test:creator-plans   (needs the test Postgres, see tests/helpers/testDb)

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { dropDatabase, loadDb, migrateRest, resetDatabase, seedOldShape, useTestDatabase } from './helpers/testDb.ts';

const DB = useTestDatabase('creator_catalog');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
const seeded: Record<string, number> = {};

before(async () => {
  // Stop just before 0203 and seed rows in the pre-split shape: creator spaces on clan tiers.
  await resetDatabase(DB, '0202_display_case_stat_pins');
  ({ db, pool, schema: s } = await loadDb());
  const rows: [string, string, string][] = [
    ['cr-free', 'creator', 'free'],
    ['cr-bronze', 'creator', 'bronze'],
    ['cr-silver', 'creator', 'silver'],
    ['cr-gold', 'creator', 'gold'],
    ['cr-custom', 'creator', 'custom'],
    ['cr-odd', 'creator', 'platinum'],
    ['clan-free', 'clan', 'free'],
    ['clan-gold', 'clan', 'gold'],
    ['clan-custom', 'clan', 'custom'],
  ];
  for (const [slug, kind, plan] of rows) {
    seeded[slug] = (await seedOldShape(pool, 'clans', { slug, name: slug, kind, plan }))[0].id;
  }
  migrateRest(DB);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

async function planOfRow(id: number): Promise<string | undefined> {
  return (await db.query.clans.findFirst({ where: eq(s.clans.id, id), columns: { plan: true } }))?.plan;
}

test('0203 backfill: every creator space keeps its tier, in creator terms; clans are untouched', async () => {
  const want: Record<string, string> = {
    'cr-free': 'creator_free',
    'cr-bronze': 'creator_bronze',
    'cr-silver': 'creator_silver',
    'cr-gold': 'creator_gold',
    'cr-custom': 'creator_partner',
    'cr-odd': 'creator_free',
    'clan-free': 'free',
    'clan-gold': 'gold',
    'clan-custom': 'custom',
  };
  for (const [slug, plan] of Object.entries(want)) assert.equal(await planOfRow(seeded[slug]), plan, slug);

  // The migration and lib/creatorCatalog say the same thing.
  const { creatorPlanFromLegacy } = await import('../src/lib/creatorCatalog.ts');
  for (const legacy of ['free', 'bronze', 'silver', 'gold', 'custom', 'platinum']) {
    const slug = legacy === 'platinum' ? 'cr-odd' : `cr-${legacy}`;
    assert.equal(creatorPlanFromLegacy(legacy).id, await planOfRow(seeded[slug]), legacy);
  }
});

test('the database refuses a creator space on a clan tier, and a clan on a creator tier', async () => {
  const violates = (err: unknown) => (err as { cause?: { code?: string } }).cause?.code === '23514';
  await assert.rejects(() => db.update(s.clans).set({ plan: 'gold' }).where(eq(s.clans.id, seeded['cr-free'])), violates);
  await assert.rejects(() => db.update(s.clans).set({ plan: 'creator_gold' }).where(eq(s.clans.id, seeded['clan-free'])), violates);
  // A creator row must be given a creator id: the column default is a clan tier.
  await assert.rejects(() => db.insert(s.clans).values({ slug: 'cr-default', name: 'x', kind: 'creator' }), violates);
  await db.update(s.clans).set({ plan: 'creator_silver' }).where(eq(s.clans.id, seeded['cr-free']));
  assert.equal(await planOfRow(seeded['cr-free']), 'creator_silver');
  await db.update(s.clans).set({ plan: 'creator_free' }).where(eq(s.clans.id, seeded['cr-free']));
});

// ── /portal: everything one person pays for ───────────────────────────────────────────────────

let n = 0;
async function user(name: string): Promise<number> {
  n += 1;
  const [u] = await db.insert(s.users).values({ displayName: name, discordId: `99500000000000${String(n).padStart(4, '0')}` }).returning();
  return u.id;
}

test('portal: clans and creator spaces in their own catalogues, plus the Supporter membership', async () => {
  const { billingPortalForUser } = await import('../src/lib/billingPortal.ts');
  const owner = await user('Billing Owner');
  const [clan] = await db.insert(s.clans).values({ slug: 'billing-clan', name: 'Billing Clan', plan: 'silver', gumroadSubscriptionId: 'sub-clan' }).returning();
  const [space] = await db
    .insert(s.clans)
    .values({ slug: 'billing-space', name: 'Billing Space', kind: 'creator', plan: 'creator_bronze', gumroadSubscriptionId: 'sub-space' })
    .returning();
  // Staff of another clan, not its owner: not theirs to pay for.
  const [notMine] = await db.insert(s.clans).values({ slug: 'billing-mod', name: 'Mod Clan', plan: 'gold' }).returning();
  await db.insert(s.clanStaff).values([
    { clanId: clan.id, userId: owner, role: 'owner' },
    { clanId: space.id, userId: owner, role: 'owner' },
    { clanId: notMine.id, userId: owner, role: 'moderator' },
  ]);
  const future = new Date(Date.now() + 20 * 86_400_000).toISOString();
  await db.insert(s.supporterSubscriptions).values({
    userId: owner,
    tier: 'champion',
    status: 'active',
    recurrence: 'monthly',
    gumroadSubscriptionId: 'sub-supporter',
    currentPeriodEnd: future,
    startedAt: new Date(Date.now() - 40 * 86_400_000).toISOString(),
  });

  const portal = await billingPortalForUser(owner);
  assert.deepEqual(portal.clans.map((c) => [c.slug, c.tierName, c.creator]), [['billing-clan', 'Silver', false]]);
  assert.deepEqual(portal.spaces.map((c) => [c.slug, c.tierName, c.creator]), [['billing-space', 'Bronze', true]]);
  assert.match(portal.spaces[0].meter, /players at once across your events/, 'a space is metered by players, not members');
  assert.match(portal.clans[0].meter, /members/);
  assert.equal(portal.supporter?.tier.id, 'champion');
  assert.equal(portal.supporter?.renewsAt, future);
  assert.equal(portal.supporterSubscriptionId, 'sub-supporter');

  // Somebody with nothing: empty sections and no Supporter.
  const nobody = await user('Nobody');
  const empty = await billingPortalForUser(nobody);
  assert.deepEqual([empty.clans.length, empty.spaces.length, empty.supporter, empty.supporterSubscriptionId], [0, 0, null, null]);

  // A gifted tier has nothing to manage on Gumroad.
  const gifted = await user('Gifted');
  await db.insert(s.supporterSubscriptions).values({
    userId: gifted,
    tier: 'supporter',
    status: 'granted',
    recurrence: 'gift',
    currentPeriodEnd: future,
    startedAt: new Date().toISOString(),
  });
  const g = await billingPortalForUser(gifted);
  assert.equal(g.supporter?.gift, true);
  assert.equal(g.supporterSubscriptionId, null);
});
