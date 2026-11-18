import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDecisions, type DecisionClanInput } from '../src/lib/staffDecisions.ts';

const clan = (over: Partial<DecisionClanInput>): DecisionClanInput => ({
  id: 1, name: 'Clan', hasOwner: true, verified: true, creator: false, healthKey: 'steady', healthReason: '1 running', flags: [], billing: 'free', billingLabel: 'Free', botMissing: false, engaged: true, ...over,
});
const build = (clans: DecisionClanInput[], errors = 0, versions: { version: string; accounts: number }[] = []) => buildDecisions({ clans, errors, versions });

test('a quiet platform has nothing to decide', () => {
  assert.deepEqual(build([clan({})]), []);
});

test('worst first: broken, then money, then quiet, stuck and notes', () => {
  const d = build(
    [
      clan({ id: 1, name: 'Stuck Co', healthKey: 'stuck', healthReason: 'Joined 11 days ago and has never created an event' }),
      clan({ id: 2, name: 'Quiet Co', healthKey: 'quiet', healthReason: '6 on the plugin last week, none this week' }),
      clan({ id: 3, name: 'Embervale', botMissing: true }),
      clan({ id: 4, name: 'Cloudvale', flags: ['trial-ending'], billing: 'trialing', billingLabel: 'Trial · 5 days left' }),
    ],
    3,
  );
  assert.deepEqual(d.map((x) => x.key), ['bot-missing', 'trial', 'quiet', 'stuck', 'errors']);
  assert.equal(d[0].title, "Embervale's Discord features are not working");
  assert.equal(d[1].detail, '1 of them has run an event with players on the plugin: the likely ones to stay.');
  assert.equal(d[1].clans[0].why, 'Trial · 5 days left: has run an event and has players on the plugin');
});

test('a trial with no sign of use says what is missing', () => {
  const [d] = build([clan({ flags: ['trial-ending'], billing: 'trialing', billingLabel: 'Trial · 2 days left', engaged: false, healthKey: 'stuck', healthReason: 'Joined 12 days ago and has never created an event' })]);
  assert.equal(d.key, 'trial');
  assert.equal(d.detail, 'None has run an event with players on the plugin yet.');
  assert.equal(d.clans[0].why, 'Trial · 2 days left: joined 12 days ago and has never created an event');
});

test('the plugin line shows only while most players are on an older build', () => {
  assert.equal(build([], 0, [{ version: '1.17.1', accounts: 15 }, { version: '1.17.0', accounts: 156 }])[0].title, '156 of 171 players are not on plugin 1.17.1 yet');
  assert.deepEqual(build([], 0, [{ version: '1.17.1', accounts: 150 }, { version: '1.17.0', accounts: 20 }]), []);
});

test('a creator space is never called unverified, and an ownerless clan is not asked to verify', () => {
  assert.deepEqual(build([clan({ verified: false, creator: true })]), []);
  assert.deepEqual(build([clan({ verified: false, hasOwner: false })]).map((x) => x.key), ['ownerless']);
});
