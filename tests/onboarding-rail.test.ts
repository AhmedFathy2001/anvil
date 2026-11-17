// What /welcome draws: the order of the steps and what ticks each one.
//
// The rules worth pinning: the plugin comes straight after Discord (it is what links a character, so
// there is no character step in front of it), it is done only when the plugin has actually reported
// (a character proved by XP is linked but not tracked), and an owner makes the clan first.
//
// Pure: no database. Run: npx tsx --test tests/onboarding-rail.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { StepKey } from '../src/lib/onboarding.ts';
import { railOrder, railProgress, welcomeRail } from '../src/lib/onboardingRail.ts';

const facts = (over: Partial<Record<StepKey, boolean>> = {}): Record<StepKey, boolean> => ({
  discord: true,
  character: false,
  clan: false,
  plugin: false,
  ...over,
});
const none = new Set<StepKey>();
const step = (rail: ReturnType<typeof welcomeRail>, key: string) => rail.find((s) => s.key === key)!;

test('the plugin is the step after Discord for somebody here for themselves, joining, or not asked', () => {
  for (const intent of ['solo', 'member', null] as const) {
    assert.deepEqual(railOrder(intent), ['discord', 'plugin', 'clan'], String(intent));
  }
});

test('an owner makes the clan first: it needs no character, and it is what they came for', () => {
  assert.deepEqual(railOrder('owner'), ['discord', 'clan', 'plugin']);
});

test('there is no character step on the rail', () => {
  for (const intent of ['solo', 'member', 'owner', null] as const) {
    assert.equal(welcomeRail(facts(), none, intent).some((s) => (s.key as string) === 'character'), false);
  }
});

test('somebody brand new is sent to the plugin, not to a manual check', () => {
  const rail = welcomeRail(facts(), none, 'solo');
  const p = railProgress(rail);
  assert.equal(p.current, 'plugin');
  assert.equal(p.doneCount, 1);
  assert.equal(p.total, 3);
  assert.equal(step(rail, 'plugin').title, 'Get the Anvil plugin');
});

test('linking through the plugin ticks the step, with nothing left to prove', () => {
  // The plugin reporting implies the character, so nobody who came in this way meets the XP check.
  const rail = welcomeRail(facts({ character: true, plugin: true }), none, 'solo');
  assert.equal(step(rail, 'plugin').done, true);
  const p = railProgress(rail);
  assert.equal(p.current, null, 'solo: the clan is passed over, so nothing is left');
  assert.equal(p.allSettled, true);
});

test('a character proved by XP does not tick the plugin step: nothing is tracking them yet', () => {
  const rail = welcomeRail(facts({ character: true }), none, 'solo');
  const plugin = step(rail, 'plugin');
  assert.equal(plugin.done, false);
  assert.equal(railProgress(rail).current, 'plugin', 'still nudged to install it');
  // And it stops reading as "link your character", which they have done.
  assert.equal(plugin.title, 'Add the Anvil plugin');
  assert.match(plugin.blurb, /Your character is linked/);
});

test('"Skip for now" on the plugin step passes it, and a later report still ticks it', () => {
  const skipped = new Set<StepKey>(['plugin']);
  const passed = welcomeRail(facts({ character: true }), skipped, 'solo');
  assert.equal(step(passed, 'plugin').skipped, true);
  assert.equal(railProgress(passed).allSettled, true);

  const reported = welcomeRail(facts({ character: true, plugin: true }), skipped, 'solo');
  assert.equal(step(reported, 'plugin').done, true);
  assert.equal(step(reported, 'plugin').skipped, false, 'done wins over skipped');
});

test('a character skip left by the old four-step page passes over nothing', () => {
  const rail = welcomeRail(facts(), new Set<StepKey>(['character']), 'member');
  assert.equal(step(rail, 'plugin').skipped, false);
  assert.equal(railProgress(rail).current, 'plugin');
});

test('"just me" is the clan skip, and joining is not', () => {
  assert.equal(step(welcomeRail(facts(), none, 'solo'), 'clan').skipped, true);
  assert.equal(step(welcomeRail(facts(), none, 'member'), 'clan').skipped, false);
  // In a clan after all (an admin added them): ticked, not passed over.
  const joined = step(welcomeRail(facts({ clan: true }), none, 'solo'), 'clan');
  assert.equal(joined.done, true);
  assert.equal(joined.skipped, false);
});

test('somebody joining goes plugin, then clan; an owner goes clan, then plugin', () => {
  assert.equal(railProgress(welcomeRail(facts(), none, 'member')).current, 'plugin');
  assert.equal(railProgress(welcomeRail(facts({ character: true, plugin: true }), none, 'member')).current, 'clan');
  assert.equal(railProgress(welcomeRail(facts(), none, 'owner')).current, 'clan');
  assert.equal(railProgress(welcomeRail(facts({ clan: true }), none, 'owner')).current, 'plugin');
});

test('the clan step is worded for why they came', () => {
  assert.equal(step(welcomeRail(facts(), none, 'owner'), 'clan').title, 'Start your clan');
  assert.equal(step(welcomeRail(facts(), none, 'member'), 'clan').title, 'Find your clan');
  assert.equal(step(welcomeRail(facts(), none, 'solo'), 'clan').title, 'A clan, if you ever want one');
  assert.equal(step(welcomeRail(facts(), none, null), 'clan').title, 'Join a clan, or start one');
});
