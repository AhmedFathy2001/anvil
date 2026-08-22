// Plan-limit rules (lib/memberCapRules) — the grace window that decides whether a clan keeps
// growing, and the promise that going over never breaks the members already playing.
//
// Run: node --experimental-strip-types --test tests/member-cap.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CAP_GRACE_DAYS,
  CAP_NEAR_WINDOW,
  capMessage,
  newMemberAllowance,
  statusFrom,
} from '../src/lib/memberCapRules.ts';

const NOW = new Date('2026-08-11T12:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

test('no cap configured means unlimited, whatever the roster looks like', () => {
  const s = statusFrom(null, 5_000, null, NOW);
  assert.equal(s.state, 'ok');
  assert.equal(s.overLimit, false);
  assert.equal(s.remaining, null);
  assert.equal(newMemberAllowance(s), null);
  assert.equal(capMessage(s), null);
});

test('comfortably under the cap says nothing at all', () => {
  const s = statusFrom(100, 50, null, NOW);
  assert.equal(s.state, 'ok');
  assert.equal(s.remaining, 50);
  assert.equal(capMessage(s), null, 'an "everything is fine" banner is just noise');
});

test('warns while there is still room to act', () => {
  const s = statusFrom(100, 100 - CAP_NEAR_WINDOW, null, NOW);
  assert.equal(s.state, 'approaching');
  assert.equal(s.remaining, CAP_NEAR_WINDOW);
  // Still growing normally — a warning is not a limit.
  assert.equal(newMemberAllowance(s), null);
  assert.match(capMessage(s) ?? '', /slots used/);
});

test('exactly at the cap is not over it', () => {
  const s = statusFrom(100, 100, null, NOW);
  assert.equal(s.overLimit, false);
  assert.equal(s.state, 'approaching');
  assert.equal(s.remaining, 0);
  assert.equal(newMemberAllowance(s), null);
});

test('going over starts the clock and keeps everything working', () => {
  // No stored stamp: the clock starts now, so a clan that just tipped over gets the full window.
  const s = statusFrom(100, 127, null, NOW);
  assert.equal(s.state, 'grace');
  assert.equal(s.overLimit, true);
  assert.equal(s.graceDaysLeft, CAP_GRACE_DAYS);
  assert.equal(s.overSince, NOW.toISOString());
  assert.equal(newMemberAllowance(s), null, 'grace must not block growth');
  assert.match(capMessage(s) ?? '', /days to upgrade or trim/);
});

test('a catch-up sync that lands 200 members at once still only starts the clock', () => {
  // The whole reason the grace is time-based: a numeric "cap + 10" would be spent instantly here,
  // blocking a clan whose only mistake was not syncing for a while.
  const s = statusFrom(100, 300, null, NOW);
  assert.equal(s.state, 'grace');
  assert.equal(newMemberAllowance(s), null);
});

test('the window counts down from when they first went over', () => {
  const s = statusFrom(100, 127, daysAgo(29), NOW);
  assert.equal(s.state, 'grace');
  assert.equal(s.graceDaysLeft, 1);
  assert.equal(newMemberAllowance(s), null);
});

test('past the window, growth stops — and only growth', () => {
  const s = statusFrom(100, 127, daysAgo(CAP_GRACE_DAYS + 1), NOW);
  assert.equal(s.state, 'blocked');
  assert.equal(s.graceDaysLeft, 0);
  assert.equal(newMemberAllowance(s), 0);
  const message = capMessage(s) ?? '';
  assert.match(message, /no longer added/);
  assert.match(message, /Existing members are unaffected/);
});

test('the boundary is the moment the window closes, not a day either side', () => {
  const justInside = statusFrom(100, 101, new Date(NOW.getTime() - (CAP_GRACE_DAYS * 86_400_000 - 1000)).toISOString(), NOW);
  assert.equal(justInside.state, 'grace');
  const justOutside = statusFrom(100, 101, new Date(NOW.getTime() - CAP_GRACE_DAYS * 86_400_000).toISOString(), NOW);
  assert.equal(justOutside.state, 'blocked');
});

test('dropping back under the cap clears the overage entirely', () => {
  // Even with a long-expired stamp still on file, being under the cap is what decides the state —
  // so trimming the roster restores growth immediately rather than leaving a spent window behind.
  const s = statusFrom(100, 80, daysAgo(90), NOW);
  assert.equal(s.state, 'ok');
  assert.equal(s.overLimit, false);
  assert.equal(s.overSince, null);
  assert.equal(s.graceEndsAt, null);
  assert.equal(newMemberAllowance(s), null);
});

test('a clan one member over is treated exactly like one 200 over', () => {
  const barely = statusFrom(100, 101, daysAgo(CAP_GRACE_DAYS + 1), NOW);
  const way = statusFrom(100, 300, daysAgo(CAP_GRACE_DAYS + 1), NOW);
  assert.equal(barely.state, way.state);
  assert.equal(newMemberAllowance(barely), newMemberAllowance(way));
});
