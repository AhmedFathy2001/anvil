// Owner analytics: attribution, the new funnels, and the owner gate. Pure — no database.
// Run: npx tsx --test tests/analytics-owner.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { routePattern, isBotUserAgent } from '../src/lib/analyticsPattern.ts';
import {
  classifyFirstTouch, clampLeaveMs, conversionRate, isOptedOut, referrerHost, sourceLabel, viewportClass,
} from '../src/lib/analyticsSource.ts';
import { funnelFromCounts, SUPPORTER_JOURNEY, computeFunnel, CLAN_OWNER_JOURNEY, worstStep } from '../src/lib/analyticsFunnels.ts';
import { ownerGate } from '../src/lib/ownerGate.ts';

test('path templates never carry ids or query strings', () => {
  assert.equal(routePattern('/c/foo/events/12?x=1', { eventId: '12' }), '/c/[clan]/events/[eventId]');
});

test('Do Not Track and Global Privacy Control opt out', () => {
  assert.equal(isOptedOut({ doNotTrack: '1' }), true);
  assert.equal(isOptedOut({ globalPrivacyControl: true }), true);
  assert.equal(isOptedOut({ doNotTrack: '0' }), false);
});

test('bots and empty user agents are skipped', () => {
  assert.equal(isBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1)'), true);
  assert.equal(isBotUserAgent(null), true);
  assert.equal(isBotUserAgent('Mozilla/5.0 (X11; Linux x86_64) Firefox/130.0'), false);
});

test('viewport classes and leave timing are bounded', () => {
  assert.equal(viewportClass(390), 'phone');
  assert.equal(viewportClass(800), 'tablet');
  assert.equal(viewportClass(1440), 'desktop');
  assert.equal(clampLeaveMs(-5), null);
  assert.equal(clampLeaveMs(12_345), 12_345);
  assert.equal(clampLeaveMs(10 * 3_600_000), 30 * 60_000);
});

test('referrers become readable sources', () => {
  const src = (host: string | null, extra = {}) => classifyFirstTouch({ host, ...extra }).source;
  assert.equal(src('www.google.co.uk'), 'google');
  assert.equal(src('discord.com'), 'discord');
  assert.equal(src('ptb.discordapp.com'), 'discord');
  assert.equal(src('m.youtube.com'), 'youtube');
  assert.equal(src('www.twitch.tv'), 'twitch');
  assert.equal(src('old.reddit.com'), 'reddit');
  assert.equal(src('runelite.net'), 'runelite');
  assert.equal(src(null), 'direct');
  assert.equal(src('some.blog.example'), 'some.blog.example');
  assert.equal(referrerHost('https://www.google.com/search?q=secret'), 'google.com');
  assert.equal(sourceLabel('google'), 'Google');
});

test('a ref or utm tag beats the referrer', () => {
  assert.equal(classifyFirstTouch({ host: 'discord.com', ref: 'Zezi Ma!' }).source, 'ref:zezi-ma');
  assert.equal(classifyFirstTouch({ host: 'discord.com', source: 'newsletter', medium: 'Email' }).source, 'utm:newsletter');
  assert.equal(classifyFirstTouch({ source: 'youtube' }).source, 'youtube');
  assert.equal(sourceLabel('ref:zezi-ma'), 'Creator link · zezi-ma');
});

test('conversion rate is conversions per visit and never NaN', () => {
  assert.equal(conversionRate(5, 100), 0.05);
  assert.equal(conversionRate(3, 0), 0);
});

test('count funnels report drop-off between steps', () => {
  const rows = funnelFromCounts(SUPPORTER_JOURNEY, [200, 50, 5]);
  assert.deepEqual(rows.map((r) => r.count), [200, 50, 5]);
  assert.equal(rows[1].dropFromPrev, 0.75);
  assert.equal(rows[2].dropFromPrev, 0.9);
  assert.equal(worstStep(rows)?.key, 'purchased');
  // a later step larger than the one before reads as no drop, not a negative one
  assert.equal(funnelFromCounts(SUPPORTER_JOURNEY, [10, 2, 4])[2].dropFromPrev, 0);
  assert.equal(funnelFromCounts(SUPPORTER_JOURNEY, [0, 0, 0])[1].ofStart, 0);
});

test('the owner journey counts a clan only if it reached every earlier step', () => {
  const rows = computeFunnel(CLAN_OWNER_JOURNEY, [
    ['created', 'discord', 'roster', 'event', 'started'],
    ['created', 'discord'],
    ['created', 'roster'], // skipped Discord: stops at created
  ]);
  assert.deepEqual(rows.map((r) => r.count), [3, 2, 1, 1, 1]);
});

test('the owner gate admits only the owner, signed in, on the apex', () => {
  assert.equal(ownerGate({ onApex: true, signedIn: true, isOwner: true }), true);
  assert.equal(ownerGate({ onApex: true, signedIn: true, isOwner: false }), false); // support/staff
  assert.equal(ownerGate({ onApex: true, signedIn: false, isOwner: true }), false);
  assert.equal(ownerGate({ onApex: false, signedIn: true, isOwner: true }), false);
});
