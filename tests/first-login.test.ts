// Where a brand-new account lands after its first sign-in (lib/firstLogin).
//
// A deep link used to skip onboarding entirely: only a sign-in from '/' was sent to /welcome. Now
// every first sign-in goes through it, carrying the original target as `next` — except the few
// targets that are the reason they signed in and cannot wait (the plugin's sign-in code expires).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { firstLoginDestination, onboardingNext, returnedToClanHost } from '../src/lib/firstLogin.ts';

test('home page sign-in goes to onboarding with nothing to continue to', () => {
  assert.equal(firstLoginDestination('/', false), '/welcome');
  assert.equal(firstLoginDestination('/', true), '/profile?welcome=1');
});

test('a deep link goes through onboarding and rides along as next', () => {
  assert.equal(firstLoginDestination('/events/12', false), '/welcome?next=%2Fevents%2F12');
  assert.equal(
    firstLoginDestination('/c/ironfoundry/leaderboard?tab=xp', false),
    '/welcome?next=%2Fc%2Fironfoundry%2Fleaderboard%3Ftab%3Dxp',
  );
  assert.equal(firstLoginDestination('/events/12/leaderboard', true), '/profile?welcome=1&next=%2Fevents%2F12%2Fleaderboard');
});

test('time-sensitive targets are not detoured', () => {
  for (const path of [
    '/link-device?code=ABCD',
    '/link-device',
    '/welcome',
    '/profile?welcome=1',
    '/portal',
    '/clans/new',
    '/events/7/join/tok123',
    '/c/foo/events/7/join/tok123',
    '/host',
    '/host/friends',
    '/events/12/signup',
    '/c/foo/events/12/signup',
  ]) {
    assert.equal(firstLoginDestination(path, false), path, path);
  }
  // Look-alikes are not exempt.
  assert.equal(firstLoginDestination('/link-devices', false), '/welcome?next=%2Flink-devices');
});

test('an unsafe return path never becomes next', () => {
  assert.equal(firstLoginDestination('//evil.com', false), '/welcome');
  assert.equal(firstLoginDestination('/\\evil.com', false), '/welcome');
});

test('onboardingNext reads only safe, non-root paths', () => {
  assert.equal(onboardingNext('/events/12'), '/events/12');
  assert.equal(onboardingNext(['/a', '/b']), '/a');
  assert.equal(onboardingNext('/'), null);
  assert.equal(onboardingNext('https://evil.com'), null);
  assert.equal(onboardingNext('//evil.com'), null);
  assert.equal(onboardingNext(undefined), null);
});

test('the apex host is not a clan host, so apex-first newcomers reach /welcome', () => {
  const apex = ['anvilosrs.com', 'www.anvilosrs.com'];
  assert.equal(returnedToClanHost('anvilosrs.com', apex), false);
  assert.equal(returnedToClanHost('ANVILOSRS.com:443', apex), false);
  assert.equal(returnedToClanHost('www.anvilosrs.com', apex), false);
  assert.equal(returnedToClanHost(null, apex), false);
  assert.equal(returnedToClanHost('ironfoundry.anvilosrs.com', apex), true);
});
