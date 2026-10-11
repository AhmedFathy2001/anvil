// Which extra event webhooks get which posts (lib/eventWebhookKinds hookWants).
//
// Run: node --experimental-strip-types --test tests/event-webhook-kinds.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hookWants, parseEventPostKinds } from '../src/lib/eventWebhookKinds.ts';

const wholeEvent = { teamId: null, kinds: parseEventPostKinds('["drops","lifecycle"]') };
const teamA = { teamId: 1, kinds: parseEventPostKinds('["drops","completions","lifecycle"]') };

test('a hook only gets the kinds it asked for', () => {
  assert.equal(hookWants(wholeEvent, { kind: 'drops', teamId: 2 }), true);
  assert.equal(hookWants(wholeEvent, { kind: 'completions', teamId: 2 }), false);
});

test("a team hook gets its own team's posts and the event-wide ones, not a rival's", () => {
  assert.equal(hookWants(teamA, { kind: 'drops', teamId: 1 }), true);
  assert.equal(hookWants(teamA, { kind: 'drops', teamId: 2 }), false);
  assert.equal(hookWants(teamA, { kind: 'drops', teamId: null }), false, 'an untagged team post stays off team hooks');
  assert.equal(hookWants(teamA, { kind: 'lifecycle' }), true);
});

test('unknown or malformed kinds are dropped', () => {
  assert.deepEqual(parseEventPostKinds('["drops","nope"]'), ['drops']);
  assert.deepEqual(parseEventPostKinds('not json'), []);
});
