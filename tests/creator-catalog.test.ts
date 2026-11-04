// The creator-space plan catalogue split from the clan ladder (lib/creatorCatalog, lib/billingCatalog,
// lib/billingPortalCards): own ids and Gumroad env vars, each kind reads only its own catalogue, the
// webhook routes a product to its catalogue, the pre-split mapping, and the portal's checkout links.
//
// Run: npm run test:creator-plans

import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as Cat from '../src/lib/creatorCatalog.ts';
import * as BC from '../src/lib/billingCatalog.ts';
import { PLANS, PLAN_IDS, checkoutUrl } from '../src/lib/plans.ts';
import { isFreePlan } from '../src/lib/clanBilling.ts';
import { clanCardModel, creatorCardModel, type OwnedBillingRow } from '../src/lib/billingPortalCards.ts';

/** Run `fn` with these env vars set (undefined = unset), restoring whatever was there. */
function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const PRODUCTS = {
  GUMROAD_PRODUCT_BRONZE: 'p-clan-bronze',
  GUMROAD_PRODUCT_SILVER: 'p-clan-silver',
  GUMROAD_PRODUCT_GOLD: 'p-clan-gold',
  GUMROAD_PRODUCT_CREATOR_BRONZE: 'p-cr-bronze',
  GUMROAD_PRODUCT_CREATOR_SILVER: 'p-cr-silver',
  GUMROAD_PRODUCT_CREATOR_GOLD: 'p-cr-gold',
};

test('two catalogues: own ids, own env vars, nothing shared', () => {
  const clanIds = new Set<string>(PLAN_IDS);
  for (const id of Cat.CREATOR_PLAN_IDS) {
    assert.ok(id.startsWith('creator_'), `${id} names its catalogue`);
    assert.ok(!clanIds.has(id));
  }
  const clanEnvs = Object.values(PLANS).flatMap((p) => [p.gumroadProductEnv, p.gumroadUrlEnv]).filter(Boolean);
  const creatorEnvs = Object.values(Cat.CREATOR_PLANS).flatMap((p) => [p.gumroadProductEnv, p.gumroadUrlEnv]).filter(Boolean);
  assert.deepEqual(creatorEnvs.sort(), [
    'GUMROAD_PRODUCT_CREATOR_BRONZE',
    'GUMROAD_PRODUCT_CREATOR_GOLD',
    'GUMROAD_PRODUCT_CREATOR_SILVER',
    'GUMROAD_URL_CREATOR_BRONZE',
    'GUMROAD_URL_CREATOR_GOLD',
    'GUMROAD_URL_CREATOR_SILVER',
  ]);
  for (const e of creatorEnvs) assert.ok(!clanEnvs.includes(e), `${e} is the creator catalogue's alone`);
  // Today's numbers are the clan ladder's, so nothing a creator sees changes yet.
  assert.deepEqual(
    Cat.CREATOR_BUYABLE.map((p) => [p.name, p.priceUsd, p.memberCap]),
    [PLANS.bronze, PLANS.silver, PLANS.gold].map((p) => [p.name, p.priceUsd, p.memberCap]),
  );
  assert.deepEqual(Cat.CREATOR_BUYABLE.map((p) => p.id), ['creator_bronze', 'creator_silver', 'creator_gold']);
});

test('each kind reads its own catalogue; the other one reads as its Free', () => {
  assert.equal(BC.catalogOfKind('creator'), 'creator');
  assert.equal(BC.catalogOfKind('clan'), 'clan');
  assert.equal(BC.catalogOfKind(null), 'clan');
  assert.equal(BC.billingTierOf('creator', 'creator_silver').id, 'creator_silver');
  assert.equal(BC.billingTierOf('creator', 'silver').id, 'creator_free', 'a clan tier never counts for a creator space');
  assert.equal(BC.billingTierOf('clan', 'creator_silver').id, 'free', 'a creator tier never counts for a clan');
  assert.equal(BC.freeTierFor('creator').id, 'creator_free');
  assert.equal(BC.freeTierFor('clan').id, 'free');
  assert.equal(BC.entryTierFor('creator').id, 'creator_bronze');
  assert.equal(BC.entryTierFor('clan').id, 'bronze');
  assert.deepEqual([...BC.planIdsFor('creator')], [...Cat.CREATOR_PLAN_IDS]);
  assert.deepEqual([...BC.planIdsFor('clan')], [...PLAN_IDS]);
  // lib/clanBilling inlines the free ids to stay dependency-free; they must agree.
  for (const id of [...PLAN_IDS, ...Cat.CREATOR_PLAN_IDS, 'nonsense']) assert.equal(isFreePlan(id), BC.isFreePlanId(id), id);
});

test('backfill mapping: pre-split clan ids map to the same creator tier (migration 0203)', () => {
  assert.deepEqual(
    ['free', 'bronze', 'silver', 'gold', 'custom', 'nonsense', null].map((v) => Cat.creatorPlanFromLegacy(v).id),
    ['creator_free', 'creator_bronze', 'creator_silver', 'creator_gold', 'creator_partner', 'creator_free', 'creator_free'],
  );
  assert.equal(Cat.creatorPlanFromLegacy('creator_gold').id, 'creator_gold', 'already moved: kept');
  // A billing_ended entry from before the split restores the creator tier it meant.
  assert.equal(BC.endedTierFor('creator', 'silver')?.id, 'creator_silver');
  assert.equal(BC.endedTierFor('creator', 'creator_gold')?.id, 'creator_gold');
  assert.equal(BC.endedTierFor('creator', 'free'), null);
  assert.equal(BC.endedTierFor('clan', 'creator_gold'), null, 'never a creator tier for a clan');
  assert.equal(BC.endedTierFor('clan', 'gold')?.id, 'gold');
});

test('webhook routing: a product names its catalogue', () => {
  withEnv(PRODUCTS, () => {
    const at = (productId: string | null, tier: string | null = null) => {
      const p = BC.gumroadPurchase({ productId, tier });
      return p ? `${p.catalog}:${p.tier.id}` : null;
    };
    assert.equal(at('p-cr-silver'), 'creator:creator_silver');
    assert.equal(at('p-cr-gold', 'Gold'), 'creator:creator_gold');
    assert.equal(at('p-cr-bronze', 'Silver'), 'creator:creator_silver', 'one creator product with tiers: the tier refines it');
    assert.equal(at('p-clan-silver'), 'clan:silver');
    assert.equal(at('p-clan-bronze', 'Anvil Gold'), 'clan:gold', 'clan: tier name first, as always');
    // No configured product: the tier name decides, "Creator …" for creators, a bare name for clans.
    assert.equal(at('p-unknown', 'Anvil Creator Gold'), 'creator:creator_gold');
    assert.equal(at(null, 'Anvil Silver'), 'clan:silver');
    assert.equal(at('p-unknown', null), null);
    // The Creator tier name never reads as a clan tier, nor a bare one as a creator tier.
    assert.equal(Cat.creatorPlanForGumroadTier('Silver'), null);
    assert.equal(Cat.creatorPlanForGumroadTier('Creator Silver')?.id, 'creator_silver');
  });
});

const row = (over: Partial<OwnedBillingRow> = {}): OwnedBillingRow => ({
  id: 1,
  slug: 'space',
  name: 'Space',
  kind: 'creator',
  plan: 'creator_free',
  trialEndsAt: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  subscriptionId: null,
  gumroadRef: 'ref-1',
  ...over,
});

test('portal cards: a creator space links creator checkouts only, and none while unconfigured', () => {
  delete process.env.FREEMIUM_ENFORCED;
  const urls = {
    GUMROAD_URL_BRONZE: 'https://gum.test/clan-bronze',
    GUMROAD_URL_SILVER: 'https://gum.test/clan-silver',
    GUMROAD_URL_GOLD: 'https://gum.test/clan-gold',
    GUMROAD_URL_CREATOR_BRONZE: 'https://gum.test/cr-bronze',
    GUMROAD_URL_CREATOR_SILVER: 'https://gum.test/cr-silver',
    GUMROAD_URL_CREATOR_GOLD: undefined,
  };
  withEnv(urls, () => {
    const free = creatorCardModel(row(), { name: 'Viewer Bingo', players: 42 });
    assert.equal(free.tierName, 'Free');
    assert.equal(free.upgrade?.href, 'https://gum.test/cr-bronze?ref=ref-1');
    assert.equal(free.upgrade?.label, 'Upgrade to Bronze');
    assert.match(free.meter, /42 \/ 50 players/);
    const big = creatorCardModel(row(), { name: 'Huge', players: 200 });
    assert.equal(big.upgrade?.href, 'https://gum.test/cr-silver?ref=ref-1', 'jumps to the tier that holds the event');
    assert.ok(big.overLine);
    // Silver → Gold, but creator Gold's checkout is not configured: no button, never the clan Gold one.
    const silver = creatorCardModel(row({ plan: 'creator_silver' }), null);
    assert.equal(silver.upgrade, null);
    assert.equal(silver.tierName, 'Silver');

    const clan = clanCardModel(row({ kind: 'clan', plan: 'free' }), 60);
    assert.equal(clan.upgrade?.href, 'https://gum.test/clan-bronze?ref=ref-1');
    assert.equal(clan.creator, false);
    assert.match(clan.meter, /60 \/ 50 members/);
  });
  withEnv(
    { GUMROAD_URL_CREATOR_BRONZE: undefined, GUMROAD_URL_CREATOR_SILVER: undefined, GUMROAD_URL_CREATOR_GOLD: undefined, GUMROAD_URL_BRONZE: 'https://gum.test/clan-bronze' },
    () => {
      assert.ok(checkoutUrl(PLANS.bronze), 'the clan checkout exists');
      assert.equal(creatorCardModel(row(), null).upgrade, null, 'no creator checkout configured: no button at all');
    },
  );
});
