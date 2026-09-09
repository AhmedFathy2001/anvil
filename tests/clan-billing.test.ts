// What a clan's subscription IS, from four columns that do not read as a state on their own.
//
// Run: node --experimental-strip-types --test tests/clan-billing.test.ts
// (lib/clanBilling imports nothing from `@/`, so Node's native TS type-stripping runs it directly.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  billingStatus,
  liveness,
  daysUntil,
  QUIET_SYNC_DAYS,
  TRIAL_WARN_DAYS,
  type BillingFacts,
} from '../src/lib/clanBilling.ts';

const NOW = Date.parse('2026-09-09T12:00:00Z');
const DAY = 86_400_000;
const inDays = (n: number) => new Date(NOW + n * DAY).toISOString();

const facts = (over: Partial<BillingFacts> = {}): BillingFacts => ({
  plan: 'free',
  trialEndsAt: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  subscribed: false,
  ...over,
});

test('a free clan is free, and is nobody’s problem', () => {
  const s = billingStatus(facts(), NOW);
  assert.equal(s.state, 'free');
  assert.equal(s.attention, false);
});

test('a running trial reports how long is left', () => {
  const s = billingStatus(facts({ trialEndsAt: inDays(20) }), NOW);
  assert.equal(s.state, 'trialing');
  assert.equal(s.daysLeft, 20);
  assert.equal(s.attention, false, '20 days out is a fact, not a task');
});

test('a trial inside the warning window is the thing this page exists for', () => {
  const s = billingStatus(facts({ trialEndsAt: inDays(3) }), NOW);
  assert.equal(s.state, 'trialing');
  assert.equal(s.attention, true);
  assert.match(s.label, /3 days left/);

  // The boundary itself counts — a window that excluded its own edge would let the seventh day pass
  // in silence.
  assert.equal(billingStatus(facts({ trialEndsAt: inDays(TRIAL_WARN_DAYS) }), NOW).attention, true);
  assert.equal(billingStatus(facts({ trialEndsAt: inDays(TRIAL_WARN_DAYS + 1) }), NOW).attention, false);
});

test('a trial ending today says so rather than "0 days left"', () => {
  assert.equal(billingStatus(facts({ trialEndsAt: inDays(0) }), NOW).label, 'Trial ends today');
});

test('a trial that ran out with nothing paid is worth one conversation', () => {
  const s = billingStatus(facts({ trialEndsAt: inDays(-9) }), NOW);
  assert.equal(s.state, 'trial-expired');
  assert.equal(s.attention, true);
  assert.match(s.label, /9 days ago/);
});

test('paying and renewing is quiet', () => {
  const s = billingStatus(facts({ plan: 'gold', subscribed: true, currentPeriodEnd: inDays(18) }), NOW);
  assert.equal(s.state, 'active');
  assert.equal(s.attention, false);
  assert.match(s.label, /Renews in 18 days/);
});

test('CANCELLING IS THE ROW THAT WAS INVISIBLE — still paid up, still served, leaving', () => {
  // Nothing on the platform distinguished this from an ordinary paying clan, because `plan` was the
  // only billing column any operator surface read. They are the most reachable customer there is
  // and the one nobody was told about.
  const s = billingStatus(
    facts({ plan: 'gold', subscribed: true, cancelAtPeriodEnd: true, currentPeriodEnd: inDays(11) }),
    NOW,
  );
  assert.equal(s.state, 'cancelling');
  assert.equal(s.attention, true);
  assert.match(s.label, /Cancelling · 11 days left/);
});

test('a subscription whose period end went by is lapsed, after a day of grace', () => {
  // The renewal webhook does not always land on the hour, so the timestamp passing is not itself
  // delinquency.
  assert.equal(
    billingStatus(facts({ plan: 'gold', subscribed: true, currentPeriodEnd: inDays(-1) }), NOW).state,
    'active',
    'inside the grace day it is still just active',
  );
  const s = billingStatus(facts({ plan: 'gold', subscribed: true, currentPeriodEnd: inDays(-14) }), NOW);
  assert.equal(s.state, 'lapsed');
  assert.equal(s.attention, true);
  assert.match(s.label, /14 days overdue/);
});

test('a paid plan with no subscription is comped, and is never chased', () => {
  const s = billingStatus(facts({ plan: 'gold' }), NOW);
  assert.equal(s.state, 'comped');
  assert.equal(s.attention, false, 'every case of this is deliberate — a migration or a deal');
});

test('a live trial outranks a plan name', () => {
  // A clan can carry a trial date and a plan at once; while the trial runs, that is what it is.
  assert.equal(billingStatus(facts({ plan: 'silver', trialEndsAt: inDays(5) }), NOW).state, 'trialing');
});

test('a subscription outranks a spent trial', () => {
  const s = billingStatus(
    facts({ plan: 'gold', subscribed: true, trialEndsAt: inDays(-30), currentPeriodEnd: inDays(9) }),
    NOW,
  );
  assert.equal(s.state, 'active', 'they trialed and then bought — the trial is history');
});

test('both timestamp shapes in these columns are read the same way', () => {
  // ISO from JS, "YYYY-MM-DD HH:MM:SS" from Postgres, in the same column. See lib/dbTime.
  const iso = daysUntil('2026-09-19T12:00:00.000Z', NOW);
  const pg = daysUntil('2026-09-19 12:00:00', NOW);
  assert.equal(iso, 10);
  assert.equal(pg, 10);
});

test('an unparseable stamp is null rather than NaN days', () => {
  assert.equal(daysUntil('not a date', NOW), null);
  assert.equal(daysUntil(null, NOW), null);
});

/* --- liveness ------------------------------------------------------------- */

test('a clan nothing has arrived from in a month is quiet', () => {
  const l = liveness({ lastEventAt: inDays(-90), lastRosterSyncAt: inDays(-QUIET_SYNC_DAYS) }, NOW);
  assert.equal(l.quiet, true);
  assert.equal(l.syncDays, QUIET_SYNC_DAYS);
  assert.equal(l.eventDays, 90);
});

test('a clan that never synced is NOT called quiet', () => {
  // It is new, or unverified, and both of those already have a line of their own on the overview.
  // Calling it quiet as well would say the same thing twice and bury the clans that went silent.
  const l = liveness({ lastEventAt: null, lastRosterSyncAt: null }, NOW);
  assert.equal(l.quiet, false);
  assert.equal(l.syncDays, null);
  assert.equal(l.eventDays, null);
});

test('a clan that synced this morning is not quiet', () => {
  assert.equal(liveness({ lastEventAt: null, lastRosterSyncAt: inDays(0) }, NOW).quiet, false);
});

test('a future stamp reads as zero days ago, not as negative', () => {
  // Clock skew between the box and Postgres is real and must not render "-1 days quiet".
  assert.equal(liveness({ lastEventAt: inDays(1), lastRosterSyncAt: inDays(1) }, NOW).eventDays, 0);
});
