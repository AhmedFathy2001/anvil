import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseLoginTarget } from '../src/lib/loginTarget.ts';

test('invite, sign-up, clan, new clan and device targets are told apart', () => {
  assert.deepEqual(parseLoginTarget('/c/ironforge/events/19/join/gnvufp57narkgkno'), { kind: 'invite', eventId: 19, token: 'gnvufp57narkgkno' });
  assert.deepEqual(parseLoginTarget('/events/19/join/gnvufp57narkgkno'), { kind: 'invite', eventId: 19, token: 'gnvufp57narkgkno' });
  assert.deepEqual(parseLoginTarget('/c/ironforge/events/17/signup?invite=x'), { kind: 'event-signup', eventId: 17 });
  assert.deepEqual(parseLoginTarget('/c/ironforge'), { kind: 'clan', slug: 'ironforge', creator: false });
  assert.deepEqual(parseLoginTarget('/s/cleo/'), { kind: 'clan', slug: 'cleo', creator: true });
  assert.deepEqual(parseLoginTarget('/clans/new?plan=x'), { kind: 'new-clan' });
  assert.deepEqual(parseLoginTarget('/link-device?code=AB'), { kind: 'device' });
});

test('anything else, and anything unsafe, is no reason', () => {
  assert.deepEqual(parseLoginTarget('/c/ironforge/leaderboard'), { kind: 'other' });
  assert.deepEqual(parseLoginTarget('//evil.com'), { kind: 'other' });
  assert.deepEqual(parseLoginTarget(undefined), { kind: 'other' });
  assert.deepEqual(parseLoginTarget('/events/19/join/short'), { kind: 'other' });
});
