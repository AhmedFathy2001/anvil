// The one setup reminder a stalled clan's owner gets.
//
// The rules worth pinning: same window as the ops digest (not on the night they signed up, not a
// month later), only the two stalls the plugin fixes, never twice, never to someone we cannot reach
// — and the message names the three in-game steps, because not knowing them is why owners stalled.
//
// Run: npx tsx --test tests/onboarding-nudge.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { LeadRow } from '../src/lib/leadsDigest.ts';
import { nudgeEmbedDescription, nudgeReasonFor, nudgeText } from '../src/lib/onboardingNudgeText.ts';

const NOW = Date.parse('2026-10-31T12:00:00.000Z');
const hoursAgo = (n: number) => new Date(NOW - n * 3_600_000).toISOString();

function lead(over: Partial<LeadRow> = {}): LeadRow {
  return {
    id: 1,
    slug: 'embervale',
    name: 'Embervale',
    inGameName: 'Embervale',
    createdAt: hoursAgo(48),
    verified: false,
    members: 1,
    events: 0,
    ownerName: 'owner',
    ownerDiscordId: '123',
    ownerEmail: null,
    ...over,
  };
}

test('an unverified clan past a day old is reminded', () => {
  assert.equal(nudgeReasonFor(lead(), NOW, false), 'unverified');
});

test('a verified clan with nobody on the roster is reminded too', () => {
  assert.equal(nudgeReasonFor(lead({ verified: true, members: 0 }), NOW, false), 'no-members');
});

test('a verified clan holding only its owner counts as empty', () => {
  assert.equal(nudgeReasonFor(lead({ verified: true, members: 1 }), NOW, false), 'no-members');
});

test('not on the night they signed up', () => {
  assert.equal(nudgeReasonFor(lead({ createdAt: hoursAgo(5) }), NOW, false), null);
});

test('not a month and more later', () => {
  assert.equal(nudgeReasonFor(lead({ createdAt: hoursAgo(31 * 24) }), NOW, false), null);
});

test('never twice', () => {
  assert.equal(nudgeReasonFor(lead(), NOW, true), null);
});

test('a clan with members and no events is not this reminder', () => {
  assert.equal(nudgeReasonFor(lead({ verified: true, members: 40 }), NOW, false), null);
});

test('nobody to send it to, nothing to send', () => {
  assert.equal(nudgeReasonFor(lead({ ownerDiscordId: null, ownerEmail: null }), NOW, false), null);
  assert.equal(nudgeReasonFor(lead({ ownerDiscordId: null, ownerEmail: 'a@b.c' }), NOW, false), 'unverified');
});

test('the message names the plugin, the sign-in and the clan-window button, and says it is the only one', () => {
  const t = nudgeText({ clanName: 'Embervale', reason: 'unverified', setupUrl: 'https://x/setup', guideUrl: 'https://x/guide' });
  const body = nudgeEmbedDescription(t);
  assert.match(body, /Plugin Hub/);
  assert.match(body, /Sign in with Discord/);
  assert.match(body, /clan window/);
  assert.match(body, /Any rank works/);
  assert.match(body, /only reminder/);
  assert.match(body, /https:\/\/x\/setup/);
  assert.match(t.subject, /Embervale/);
});

test('an already-verified clan is not told the sync proves the clan is theirs', () => {
  const t = nudgeText({ clanName: 'Raptors', reason: 'no-members', setupUrl: 'u', guideUrl: 'g' });
  assert.doesNotMatch(nudgeEmbedDescription(t), /proves the clan is yours/);
});
