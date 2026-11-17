// Anvil's own plan trial, the one-trial rule and which checkout a buy button opens: the pure halves
// (lib/planTrialRules, lib/buyOffer, lib/plans earlyBird, the pay-now product envs).
//
// Run: npx tsx --test tests/plan-trial-rules.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PLAN_TRIAL_GRACE_DAYS,
  autoTrialDays,
  autoTrialDecision,
  buyButtons,
  daysLeft,
  effectiveMemberCap,
  effectivePlanId,
  inGameNameKey,
  planConverted,
  topTrialTier,
  trialPhase,
  usedTrialHold,
} from '../src/lib/planTrialRules.ts';
import { buyWording, chargeText, clanBuy, creatorBuy, supporterBuy } from '../src/lib/buyOffer.ts';
import { PLANS, checkoutUrl, earlyBird, planForGumroadProduct, trialDaysFrom, EARLY_BIRD_LOCK_LINE } from '../src/lib/plans.ts';
import { CREATOR_PLANS, creatorPlanForGumroadProduct } from '../src/lib/creatorCatalog.ts';
import { gumroadPurchase } from '../src/lib/billingCatalog.ts';

const DAY = 86_400_000;
const NOW = Date.parse('2027-03-01T12:00:00Z');

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

// ── The automatic trial: every new clan, with three exceptions ──────────────────────────────────

const fresh = { days: 30, clanHadTrial: false, hadMembership: false, nameHadTrial: false, ownerDeletedTrialed: false };

test('every new clan or space starts its trial', () => {
  assert.deepEqual(autoTrialDecision(fresh), { grant: true });
});

test('automatic trials can be switched off', () => {
  assert.deepEqual(autoTrialDecision({ ...fresh, days: 0 }), { grant: false, reason: 'off' });
});

test('once per clan: a row that already had a trial does not get another', () => {
  assert.deepEqual(autoTrialDecision({ ...fresh, clanHadTrial: true }), { grant: false, reason: 'clan-had-trial' });
});

test('a clan that has ever had a paid membership gets no automatic trial', () => {
  assert.deepEqual(autoTrialDecision({ ...fresh, hadMembership: true }), { grant: false, reason: 'had-membership' });
});

test('the same verified in-game clan name, deleted and created again, does not restart it', () => {
  assert.deepEqual(autoTrialDecision({ ...fresh, nameHadTrial: true }), { grant: false, reason: 'name-had-trial' });
});

test('there is no once-per-owner rule: nothing about the owner is asked', () => {
  // The facts the rule reads name the clan and its in-game name only.
  assert.deepEqual(Object.keys(fresh).sort(), ['clanHadTrial', 'days', 'hadMembership', 'nameHadTrial', 'ownerDeletedTrialed']);
  // The one thing asked about the owner is whether they DELETED a clan that had used its trial.
  assert.deepEqual(autoTrialDecision({ ...fresh, ownerDeletedTrialed: true }), { grant: false, reason: 'owner-deleted-trialed' });
});

test('the trial length is 30 days by default, configurable, and 0 or junk means off', () => {
  assert.equal(autoTrialDays(undefined), 30);
  assert.equal(autoTrialDays(''), 30);
  assert.equal(autoTrialDays('14'), 14);
  assert.equal(autoTrialDays('0'), 0);
  assert.equal(autoTrialDays('-3'), 0);
  assert.equal(autoTrialDays('soon'), 0);
  assert.equal(autoTrialDays('9999'), 365);
});

test('the trial lends the top tier on sale, per catalogue', () => {
  assert.equal(topTrialTier('clan'), 'gold');
  assert.equal(topTrialTier('creator'), 'creator_gold');
});

test('an in-game name is remembered case- and space-insensitively', () => {
  assert.equal(inGameNameKey('  Iron  Forge '), 'iron forge');
  assert.equal(inGameNameKey(''), null);
  assert.equal(inGameNameKey(null), null);
});

// ── The plan in force ───────────────────────────────────────────────────────────────────────────

test('a running trial lifts the plan in force; an ended one does not, with no sweep', () => {
  const trial = { tier: 'gold', endsAt: NOW + 5 * DAY };
  assert.equal(effectivePlanId('clan', 'free', trial, NOW), 'gold');
  assert.equal(effectivePlanId('clan', 'free', trial, NOW + 5 * DAY), 'free', 'at the end instant it is over');
  assert.equal(effectivePlanId('clan', 'free', null, NOW), 'free');
});

test('a purchase of the trial tier or above takes over; a lower one does not cut the trial short', () => {
  const trial = { tier: 'silver', endsAt: NOW + 5 * DAY };
  assert.equal(effectivePlanId('clan', 'gold', trial, NOW), 'gold');
  assert.equal(effectivePlanId('clan', 'silver', trial, NOW), 'silver');
  assert.equal(effectivePlanId('clan', 'bronze', trial, NOW), 'silver', 'Bronze bought during a Silver trial: still Silver until it ends');
  assert.equal(effectivePlanId('clan', 'bronze', trial, NOW + 6 * DAY), 'bronze', 'then what they pay for');
});

test('a trial tier from the other catalogue lends nothing', () => {
  assert.equal(effectivePlanId('creator', 'creator_free', { tier: 'gold', endsAt: NOW + DAY }, NOW), 'creator_free');
  assert.equal(effectivePlanId('clan', 'free', { tier: 'creator_gold', endsAt: NOW + DAY }, NOW), 'free');
  assert.equal(effectivePlanId('creator', 'creator_free', { tier: 'creator_gold', endsAt: NOW + DAY }, NOW), 'creator_gold');
});

test('the member cap follows: the trial tier while it runs, the stored cap the moment it ends', () => {
  const trial = { tier: 'gold', endsAt: NOW + DAY };
  assert.equal(effectiveMemberCap('clan', 'free', 50, trial, NOW), 600);
  assert.equal(effectiveMemberCap('clan', 'free', 50, trial, NOW + 2 * DAY), 50, 'back to Free: over-cap members are handled by the cap grace clock, never removed');
  assert.equal(effectiveMemberCap('clan', 'free', null, trial, NOW), null, 'a clan staff gave no cap keeps none');
  assert.equal(effectiveMemberCap('clan', 'free', 900, trial, NOW), 900, 'a cap raised by hand above the tier is kept');
});

// ── What the owner sees, by date ────────────────────────────────────────────────────────────────

test('trial phases: running, last days, the grace after the end, then nothing', () => {
  const t = { endsAt: NOW + 20 * DAY, revoked: false };
  assert.equal(trialPhase(t, false, NOW), 'running');
  assert.equal(trialPhase(t, false, NOW + 14 * DAY), 'last-days');
  assert.equal(trialPhase(t, false, NOW + 20 * DAY + 1), 'just-ended');
  assert.equal(trialPhase(t, false, NOW + (20 + PLAN_TRIAL_GRACE_DAYS) * DAY + 1), 'none');
  assert.equal(trialPhase(t, true, NOW), 'none', 'paid for at that tier: nothing to say');
  assert.equal(trialPhase({ ...t, revoked: true }, false, NOW), 'none');
  assert.equal(trialPhase(null, false, NOW), 'none');
  assert.equal(PLAN_TRIAL_GRACE_DAYS, 3);
});

test('days left round up, and are 0 once it is over', () => {
  assert.equal(daysLeft(NOW + 1, NOW), 1);
  assert.equal(daysLeft(NOW + 3 * DAY, NOW), 3);
  assert.equal(daysLeft(NOW - 1, NOW), 0);
});

test('converted means the clan now PAYS (a Gumroad membership) for the trial tier or above', () => {
  assert.equal(planConverted({ kind: 'clan', plan: 'gold', gumroadSubscriptionId: 'sub' }, 'gold'), true);
  assert.equal(planConverted({ kind: 'clan', plan: 'bronze', gumroadSubscriptionId: 'sub' }, 'gold'), false);
  assert.equal(planConverted({ kind: 'clan', plan: 'gold', gumroadSubscriptionId: null }, 'gold'), false, 'a plan staff set by hand is not a conversion');
  assert.equal(planConverted({ kind: 'clan', plan: 'free', gumroadSubscriptionId: 'sub-ended' }, 'gold'), false);
});

// ── Two buttons per tier, and who sees which ────────────────────────────────────────────────────

const urls = { trialUrl: 'https://gum.test/silver?ref=r', nowUrl: 'https://gum.test/silver-now?ref=r' };

test('never had a trial, Gumroad trial on: "Start free trial" beside "Skip trial, pay now"', () => {
  assert.deepEqual(buyButtons({ gumroadTrialDays: 30, trialUsed: false, ...urls }), { kind: 'trial', trialUrl: urls.trialUrl, nowUrl: urls.nowUrl, trialDays: 30 });
});

test('never had a trial, but the pay-now link is not configured: only "Start free trial", no dead button', () => {
  assert.deepEqual(buyButtons({ gumroadTrialDays: 30, trialUsed: false, trialUrl: urls.trialUrl, nowUrl: null }), { kind: 'trial', trialUrl: urls.trialUrl, nowUrl: null, trialDays: 30 });
});

test('Gumroad trial off (TRIAL_DAYS 0): one "Subscribe" button, no trial mentioned', () => {
  assert.deepEqual(buyButtons({ gumroadTrialDays: 0, trialUsed: false, ...urls }), { kind: 'subscribe', url: urls.trialUrl });
});

test('has had a trial: only ever the pay-now product', () => {
  assert.deepEqual(buyButtons({ gumroadTrialDays: 30, trialUsed: true, ...urls }), { kind: 'subscribe', url: urls.nowUrl });
  assert.deepEqual(buyButtons({ gumroadTrialDays: 0, trialUsed: true, ...urls }), { kind: 'subscribe', url: urls.nowUrl });
});

test('has had a trial and the pay-now link is missing: "Subscribing opens soon", never the trial product', () => {
  assert.deepEqual(buyButtons({ gumroadTrialDays: 30, trialUsed: true, trialUrl: urls.trialUrl, nowUrl: null }), { kind: 'soon' });
});

test('has had a trial, pay-now missing, but Gumroad\'s trial is off: the original product charges at once, so it is used', () => {
  assert.deepEqual(buyButtons({ gumroadTrialDays: 0, trialUsed: true, trialUrl: urls.trialUrl, nowUrl: null }), { kind: 'subscribe', url: urls.trialUrl });
});

test('no checkout configured at all: no button', () => {
  assert.deepEqual(buyButtons({ gumroadTrialDays: 30, trialUsed: false, trialUrl: null, nowUrl: null }), { kind: 'none' });
  assert.deepEqual(buyButtons({ gumroadTrialDays: 30, trialUsed: true, trialUrl: null, nowUrl: null }), { kind: 'none' });
});

test('the pay-now checkout is the original env with _NOW, per tier and interval, carrying the ref', () => {
  withEnv(
    { GUMROAD_URL_SILVER: 'https://gum.test/silver', GUMROAD_URL_SILVER_NOW: 'https://gum.test/silver-now', GUMROAD_URL_SILVER_YEARLY: 'https://gum.test/silver-y', GUMROAD_URL_SILVER_YEARLY_NOW: undefined, GUMROAD_URL_GOLD: 'https://gum.test/gold', GUMROAD_URL_GOLD_NOW: undefined },
    () => {
      assert.equal(checkoutUrl(PLANS.silver, 'monthly', 'now'), 'https://gum.test/silver-now');
      assert.equal(checkoutUrl(PLANS.silver, 'monthly'), 'https://gum.test/silver');
      // A clan that has had its trial: Silver opens the pay-now product; Gold (not configured) opens nothing.
      assert.deepEqual(clanBuy(PLANS.silver, 'ref-1', 'monthly', true), { kind: 'subscribe', url: 'https://gum.test/silver-now?ref=ref-1' });
      // TRIAL_DAYS is 0 in tests, so the original product charges at once and may stand in.
      assert.deepEqual(clanBuy(PLANS.gold, 'ref-1', 'monthly', true), { kind: 'subscribe', url: 'https://gum.test/gold?ref=ref-1' });
      assert.deepEqual(clanBuy(PLANS.silver, 'ref-1', 'yearly', true), { kind: 'subscribe', url: 'https://gum.test/silver-y?ref=ref-1' });
      assert.deepEqual(clanBuy(PLANS.bronze, 'ref-1', 'monthly', true), { kind: 'none' });
    },
  );
  withEnv({ GUMROAD_URL_CREATOR_GOLD: 'https://gum.test/cr-gold', GUMROAD_URL_CREATOR_GOLD_NOW: 'https://gum.test/cr-gold-now' }, () => {
    assert.deepEqual(creatorBuy(CREATOR_PLANS.creator_gold, 'ref-2', 'monthly', true), { kind: 'subscribe', url: 'https://gum.test/cr-gold-now?ref=ref-2' });
  });
});

test('Supporter buttons go through the site route, which re-checks the rule', () => {
  assert.deepEqual(supporterBuy(true, { GUMROAD_URL_SUPPORTER: 'x', GUMROAD_URL_SUPPORTER_NOW: 'y' }), { kind: 'subscribe', url: '/api/supporter/checkout?pay=now' });
  assert.deepEqual(supporterBuy(false, { GUMROAD_URL_SUPPORTER: 'x' }), { kind: 'subscribe', url: '/api/supporter/checkout' });
  assert.deepEqual(supporterBuy(false, {}), { kind: 'none' });
});

// ── A sale of a "-now" product is the same catalogue and tier as its original ───────────────────

test('a pay-now product id maps to its tier in the right catalogue', () => {
  withEnv(
    { GUMROAD_PRODUCT_SILVER: 'prod-silver', GUMROAD_PRODUCT_SILVER_NOW: 'prod-silver-now', GUMROAD_PRODUCT_CREATOR_GOLD: 'prod-cr-gold', GUMROAD_PRODUCT_CREATOR_GOLD_NOW: 'prod-cr-gold-now' },
    () => {
      assert.equal(planForGumroadProduct('prod-silver-now')?.id, 'silver');
      assert.equal(creatorPlanForGumroadProduct('prod-cr-gold-now')?.id, 'creator_gold');
      assert.deepEqual(
        [gumroadPurchase({ productId: 'prod-silver-now', tier: null })?.catalog, gumroadPurchase({ productId: 'prod-silver-now', tier: null })?.tier.id],
        ['clan', 'silver'],
      );
      assert.equal(gumroadPurchase({ productId: 'prod-cr-gold-now', tier: null })?.tier.id, 'creator_gold');
      // The tier name wins inside a product, as for the originals ("Anvil Gold" on the Silver-now id is Gold).
      assert.equal(gumroadPurchase({ productId: 'prod-silver-now', tier: 'Anvil Gold' })?.tier.id, 'gold');
    },
  );
  // With no ids configured the tier NAME still decides, and the -now products use the originals' names.
  assert.equal(gumroadPurchase({ productId: 'unknown-now-id', tier: 'Anvil Bronze' })?.tier.id, 'bronze');
  assert.equal(gumroadPurchase({ productId: 'unknown-now-id', tier: 'Anvil Creator Silver' })?.tier.id, 'creator_silver');
});

// ── What the buttons say ────────────────────────────────────────────────────────────────────────

test('the wording says what happens to the card before the button is pressed', () => {
  const charge = chargeText(6.99);
  assert.equal(charge, '$6.99 a month');
  assert.equal(chargeText(6.99, 'yearly'), '$69.90 a year');
  const trial = buyWording({ kind: 'trial', trialUrl: 'a', nowUrl: 'b', trialDays: 30 }, { tierName: 'Silver', charge })!;
  assert.equal(trial.primary.label, 'Start free trial');
  assert.equal(trial.secondary?.label, 'Skip trial, pay now');
  assert.match(trial.note, /^30-day free trial, then \$6\.99 a month\./);
  assert.match(trial.note, /Skip the trial: You'll be charged \$6\.99 today, then every month\./);

  const sub = buyWording({ kind: 'subscribe', url: 'b' }, { tierName: 'Silver', charge })!;
  assert.deepEqual(sub.primary, { label: 'Subscribe to Silver', href: 'b' });
  assert.equal(sub.secondary, null);
  assert.equal(sub.note, "You'll be charged $6.99 today, then every month. No free trial: cancel any time on Gumroad.");
  assert.ok(!/free(?! trial)/i.test(sub.note.replace('No free trial', '')), 'never "free" for something that is charged');

  const soon = buyWording({ kind: 'soon' }, { tierName: 'Gold', charge: chargeText(14.99) })!;
  assert.deepEqual(soon.primary, { label: 'Subscribing opens soon', href: null });
  assert.equal(buyWording({ kind: 'none' }, { tierName: 'Gold', charge }), null);
});

// ── TRIAL_DAYS and the early-bird line ──────────────────────────────────────────────────────────

test('a trial length from env is a whole number of days, else 0: the default is no Gumroad trial', () => {
  assert.equal(trialDaysFrom(undefined), 0);
  assert.equal(trialDaysFrom(''), 0);
  assert.equal(trialDaysFrom('30'), 30);
  assert.equal(trialDaysFrom('abc'), 0);
  assert.equal(trialDaysFrom('-5'), 0);
});

test('early-bird line: on by default, one switch off, rewordable, the price lock only when promised', () => {
  assert.deepEqual(earlyBird({}), { heading: 'Early-bird pricing', line: 'These are our launch prices for early clans and supporters.', lock: null });
  assert.equal(earlyBird({ EARLY_BIRD_PRICING: 'off' }), null);
  assert.equal(earlyBird({ EARLY_BIRD_PRICE_LOCK: 'true' })?.lock, EARLY_BIRD_LOCK_LINE);
  assert.equal(EARLY_BIRD_LOCK_LINE, 'Subscribe now and keep this price for as long as your membership stays active.');
  assert.deepEqual(earlyBird({ EARLY_BIRD_HEADING: 'Launch prices', EARLY_BIRD_LINE: 'Prices for our first clans.' }), { heading: 'Launch prices', line: 'Prices for our first clans.', lock: null });
  const said = JSON.stringify(earlyBird({ EARLY_BIRD_PRICE_LOCK: 'true' }));
  assert.ok(!/\d+ (left|days|hours)|until|ends on|only/i.test(said), 'no date, countdown or scarcity');
});

// ── Holding a sale to its first real charge (clan, space and Supporter share this) ──────────────

const holdFacts = { trialUsed: true, asked: undefined as string | null | undefined, said: null as string | null, nowProduct: false, configuredTrialDays: 30, priceCents: null as number | null };
const ahead = new Date(NOW + 30 * DAY).toISOString();

test('someone who has never had a trial is never held', () => {
  assert.deepEqual(usedTrialHold({ ...holdFacts, trialUsed: false, asked: ahead }, NOW), { hold: false });
});

test('Gumroad answered: its word decides, either way', () => {
  assert.deepEqual(usedTrialHold({ ...holdFacts, asked: ahead }, NOW), { hold: true, until: ahead, known: true });
  assert.deepEqual(usedTrialHold({ ...holdFacts, asked: null, said: ahead, priceCents: 0 }, NOW), { hold: false }, 'confirmed absent beats the notification');
  assert.deepEqual(usedTrialHold({ ...holdFacts, asked: new Date(NOW - DAY).toISOString() }, NOW), { hold: false }, 'a trial already over');
});

test('could not ask, but the notification names a trial end still ahead: held', () => {
  assert.deepEqual(usedTrialHold({ ...holdFacts, said: ahead, priceCents: 699 }, NOW), { hold: true, until: ahead, known: true });
});

test('could not ask and nothing said: held only when a trial is possible and no money shows', () => {
  // No price, or a price of zero: no charge evidence, so held until the configured trial would end.
  assert.deepEqual(usedTrialHold(holdFacts, NOW), { hold: true, until: ahead, known: false });
  assert.deepEqual(usedTrialHold({ ...holdFacts, priceCents: 0 }, NOW), { hold: true, until: ahead, known: false });
  // A real charge is never held.
  assert.deepEqual(usedTrialHold({ ...holdFacts, priceCents: 699 }, NOW), { hold: false });
  // A pay-now product has no trial by construction; nor has anything when the configured trial is 0.
  assert.deepEqual(usedTrialHold({ ...holdFacts, nowProduct: true }, NOW), { hold: false });
  assert.deepEqual(usedTrialHold({ ...holdFacts, configuredTrialDays: 0 }, NOW), { hold: false });
});
