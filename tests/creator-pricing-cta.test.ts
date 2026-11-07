// The action under each column of /pricing's creator table (lib/creatorPricingCta), per viewer.
//
// Run: node --import tsx --test tests/creator-pricing-cta.test.ts   (no database)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CREATOR_PLANS } from '../src/lib/creatorCatalog';
import { creatorPricingCta, hostPlanParam, type CreatorCtaOpts } from '../src/lib/creatorPricingCta';

const P = CREATOR_PLANS;
const opts = (over: Partial<CreatorCtaOpts> = {}): CreatorCtaOpts => ({
  enforced: false,
  checkoutFor: (p) => `https://gum.example/${p.id}?ref=abc`,
  contactUrl: 'https://discord.gg/x',
  ...over,
});
const out = { signedIn: false, space: null };
const fresh = { signedIn: true, space: null };

test('signed out: every column starts free through sign-in to /host; paid columns carry the tier', () => {
  assert.deepEqual(creatorPricingCta(P.creator_free, out, opts()), {
    kind: 'link',
    label: 'Start free',
    href: '/login?return=%2Fhost',
    primary: true,
  });
  const bronze = creatorPricingCta(P.creator_bronze, out, opts());
  assert.equal(bronze.kind, 'link');
  assert.equal(bronze.label, 'Start free');
  assert.equal(bronze.kind === 'link' && bronze.href, `/login?return=${encodeURIComponent('/host?plan=creator_bronze')}`);
});

test('once caps are enforced a paid column names its tier', () => {
  assert.equal(creatorPricingCta(P.creator_silver, out, opts({ enforced: true })).label, 'Start with Silver');
  assert.equal(creatorPricingCta(P.creator_free, out, opts({ enforced: true })).label, 'Start free');
});

test('signed in without a space: straight to /host, ?plan= on a paid column', () => {
  const free = creatorPricingCta(P.creator_free, fresh, opts());
  assert.equal(free.kind === 'link' && free.href, '/host');
  const gold = creatorPricingCta(P.creator_gold, fresh, opts());
  assert.equal(gold.kind === 'link' && gold.href, '/host?plan=creator_gold');
});

test('Partner is always "Talk to us" on the contact link, unless it is your plan', () => {
  for (const v of [out, fresh, { signedIn: true, space: { slug: 's', plan: 'creator_free' as const } }]) {
    assert.deepEqual(creatorPricingCta(P.creator_partner, v, opts()), {
      kind: 'external',
      label: 'Talk to us',
      href: 'https://discord.gg/x',
      primary: false,
    });
  }
  const partner = { signedIn: true, space: { slug: 's', plan: 'creator_partner' as const } };
  assert.deepEqual(creatorPricingCta(P.creator_partner, partner, opts()), { kind: 'inert', label: 'Your plan' });
});

test('a free space: its column is "Your plan"; paid columns go to the dashboard card\'s checkout', () => {
  const v = { signedIn: true, space: { slug: 'my-space', plan: 'creator_free' as const } };
  assert.deepEqual(creatorPricingCta(P.creator_free, v, opts()), { kind: 'inert', label: 'Your plan' });
  assert.deepEqual(creatorPricingCta(P.creator_bronze, v, opts()), {
    kind: 'external',
    label: 'Upgrade to Bronze',
    href: 'https://gum.example/creator_bronze?ref=abc',
    primary: true,
  });
  // No checkout configured: the space's own plan card instead of a dead button.
  const none = creatorPricingCta(P.creator_bronze, v, opts({ checkoutFor: () => null }));
  assert.equal(none.kind === 'link' && none.href, '/c/my-space/admin/dashboard#plan');
});

test('a paying space: lower tiers are included, higher ones change in the billing portal', () => {
  const v = { signedIn: true, space: { slug: 'my-space', plan: 'creator_silver' as const } };
  assert.deepEqual(creatorPricingCta(P.creator_free, v, opts()), { kind: 'inert', label: 'Included' });
  assert.deepEqual(creatorPricingCta(P.creator_bronze, v, opts()), { kind: 'inert', label: 'Included' });
  assert.deepEqual(creatorPricingCta(P.creator_silver, v, opts()), { kind: 'inert', label: 'Your plan' });
  const gold = creatorPricingCta(P.creator_gold, v, opts());
  assert.equal(gold.kind === 'link' && gold.href, '/portal');
  assert.equal(gold.label, 'Upgrade to Gold');
});

test('/host ?plan= reads only a buyable creator tier', () => {
  assert.equal(hostPlanParam('creator_bronze'), 'creator_bronze');
  assert.equal(hostPlanParam(['creator_gold']), 'creator_gold');
  assert.equal(hostPlanParam('creator_free'), null);
  assert.equal(hostPlanParam('creator_partner'), null);
  assert.equal(hostPlanParam('bronze'), null);
  assert.equal(hostPlanParam(undefined), null);
});

test('yearly: owners get the yearly checkout; an unconfigured yearly tier is "coming soon", never a dead link', () => {
  const v = { signedIn: true, space: { slug: 'my-space', plan: 'creator_free' as const } };
  const yearly = opts({ interval: 'yearly', checkoutFor: (p) => `https://gum.example/${p.id}-yearly?ref=abc`, yearlyOffered: (p) => p.id === 'creator_bronze' });
  const bronze = creatorPricingCta(P.creator_bronze, v, yearly);
  assert.equal(bronze.kind === 'external' && bronze.href, 'https://gum.example/creator_bronze-yearly?ref=abc');
  assert.deepEqual(creatorPricingCta(P.creator_silver, v, yearly), { kind: 'inert', label: 'Yearly coming soon' });
  // Starting a space is free, so the early-access "Start free" stands, carrying billing when it exists.
  const start = creatorPricingCta(P.creator_bronze, fresh, yearly);
  assert.equal(start.kind === 'link' && start.href, '/host?plan=creator_bronze&billing=yearly');
  const startSilver = creatorPricingCta(P.creator_silver, fresh, yearly);
  assert.equal(startSilver.kind === 'link' && startSilver.href, '/host?plan=creator_silver');
  // Once a paid start means a card, an unconfigured yearly tier cannot be started yearly.
  assert.deepEqual(creatorPricingCta(P.creator_silver, fresh, { ...yearly, enforced: true }), { kind: 'inert', label: 'Yearly coming soon' });
});
