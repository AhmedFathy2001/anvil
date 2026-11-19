import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clanHealth, inClanView, type ClanHealthFacts } from '../src/lib/clanHealth.ts';

const now = Date.parse('2026-11-18T08:00:00Z');
const ago = (d: number) => new Date(now - d * 86_400_000).toISOString();
const facts = (over: Partial<ClanHealthFacts> = {}): ClanHealthFacts => ({
  createdAt: ago(60), members: 90, memberCap: null, plugin7d: 12, pluginPrev7d: 10, eventsTotal: 4, running: 1, scheduled: 0, lastActiveAt: ago(0), billing: 'free', billingDaysLeft: null, ...over,
});
const h = (over: Partial<ClanHealthFacts> = {}) => clanHealth(facts(over), now);

test('a failed payment is broken, whatever else is true', () => {
  assert.equal(h({ billing: 'lapsed' }).key, 'broken');
});

test('no event yet: new for three days, stuck after', () => {
  assert.equal(h({ eventsTotal: 0, running: 0, createdAt: ago(2) }).key, 'new');
  const stuck = h({ eventsTotal: 0, running: 0, plugin7d: 0, pluginPrev7d: 0, createdAt: ago(11) });
  assert.equal(stuck.key, 'stuck');
  assert.equal(stuck.reason, 'Joined 11 days ago and has never created an event');
});

test('no event of its own but players on the plugin: steady, and still in the never-ran-an-event view', () => {
  const lfl = h({ eventsTotal: 0, running: 0, plugin7d: 21, pluginPrev7d: 30 });
  assert.equal(lfl.key, 'steady');
  assert.equal(lfl.reason, '21 on the plugin this week, no event of its own yet');
  assert.equal(inClanView('stuck', lfl, 'active'), true);
  assert.equal(inClanView('stuck', h(), 'free'), false);
});

test('going quiet: players last week and none this week, or nothing on and a week idle', () => {
  assert.equal(h({ plugin7d: 0, pluginPrev7d: 6 }).reason, '6 on the plugin last week, none this week');
  const idle = h({ running: 0, scheduled: 0, plugin7d: 0, pluginPrev7d: 0, lastActiveAt: ago(9) });
  assert.equal(idle.key, 'quiet');
  assert.equal(idle.reason, 'Nothing running or scheduled, last active 9 days ago');
  // Idle a week but with something scheduled is not quiet.
  assert.equal(h({ running: 0, scheduled: 1, plugin7d: 0, pluginPrev7d: 0, lastActiveAt: ago(9) }).key, 'steady');
});

test('thriving needs something running and a third of members on the plugin', () => {
  assert.equal(h({ plugin7d: 30 }).key, 'thriving');
  assert.equal(h({ plugin7d: 29 }).key, 'steady');
  assert.equal(h({ plugin7d: 60, running: 0, scheduled: 1 }).key, 'steady');
});

test('flags ride along with any label, and the views pick by them', () => {
  const trial = h({ billing: 'trialing', billingDaysLeft: 5, plugin7d: 40 });
  assert.equal(trial.key, 'thriving');
  assert.deepEqual(trial.flags, ['trial-ending']);
  assert.equal(inClanView('trial', trial, 'trialing'), true);
  assert.equal(inClanView('attention', trial, 'trialing'), true);
  assert.deepEqual(h({ members: 120, memberCap: 100 }).flags, ['over-plan']);
  assert.equal(inClanView('attention', h({ plugin7d: 40 }), 'free'), false);
  assert.equal(inClanView('paying', h(), 'active'), true);
  assert.equal(inClanView('paying', h(), 'free'), false);
});
