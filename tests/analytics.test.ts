// Platform analytics: the parts that decide what is stored and how the funnels count.
//
// The pattern rules are the privacy boundary — a raw RSN or id reaching analytics_events turns a
// feature counter into a browsing history — so the cases here are the ways one could slip through.
//
// Run: npm run test:analytics

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  boundProps,
  clanSlugOf,
  isBotUserAgent,
  isSessionId,
  routePattern,
  scrubPattern,
} from '../src/lib/analyticsPattern.ts';
import {
  CLAN_ONBOARDING,
  computeFunnel,
  densifyDays,
  parseWindow,
  windowStart,
  worstStep,
} from '../src/lib/analyticsFunnels.ts';

test('a clan page becomes its route, with the clan and the ids folded away', () => {
  assert.equal(
    routePattern('/c/theafkspot/events/12/tiles', { eventId: '12' }),
    '/c/[clan]/events/[eventId]/tiles',
  );
  assert.equal(routePattern('/c/theafkspot', {}), '/c/[clan]');
});

test('an RSN in the path is never kept — by the param map or, failing that, the scrub', () => {
  assert.equal(routePattern('/c/lfl/members/Zezima', { rsn: 'Zezima' }), '/c/[clan]/members/[rsn]');
  // Encoded spaces: the param arrives decoded, the path does not.
  assert.equal(routePattern('/p/Iron%20Man', { rsn: 'Iron Man' }), '/p/[rsn]');
  // A param the map did not cover still cannot leak.
  assert.equal(routePattern('/members/Zezima', {}), '/members/[value]');
  assert.equal(routePattern('/events/42', {}), '/events/[id]');
});

test('catch-all params collapse to one placeholder', () => {
  assert.equal(routePattern('/guide/setup/plugin', { slug: ['setup', 'plugin'] }), '/guide/[...slug]');
});

test('static routes, the apex and the query string', () => {
  assert.equal(routePattern('/staff/errors', {}), '/staff/errors');
  assert.equal(routePattern('/', {}), '/');
  assert.equal(routePattern('/clans?q=Zezima', {}), '/clans');
});

test('the collector re-scrubs whatever a forged beacon sends', () => {
  assert.equal(scrubPattern('/c/[clan]/events/[eventId]'), '/c/[clan]/events/[eventId]');
  assert.equal(scrubPattern('/members/Zezima/123'), '/members/[value]/[id]');
  assert.equal(scrubPattern('/x?rsn=Zezima'), '/x');
  assert.equal(scrubPattern('no-slash'), null);
  assert.equal(scrubPattern(42), null);
  assert.ok((scrubPattern(`/${'a/'.repeat(150)}`) ?? '').length <= 200);
});

test('the clan slug is read from the prefix only', () => {
  assert.equal(clanSlugOf('/c/theafkspot/events'), 'theafkspot');
  assert.equal(clanSlugOf('/clans'), null);
  assert.equal(clanSlugOf('/c/'), null);
});

test('bots and empty user agents are not visitors', () => {
  assert.equal(isBotUserAgent('Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'), true);
  assert.equal(isBotUserAgent('Googlebot/2.1'), true);
  assert.equal(isBotUserAgent(null), true);
  assert.equal(isBotUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36'), false);
});

test('session ids are the shape the browser mints', () => {
  assert.equal(isSessionId('a1b2c3d4e5f60718293a4b5c6d7e8f90'), true);
  assert.equal(isSessionId('short'), false);
  assert.equal(isSessionId('has spaces in it!'), false);
  assert.equal(isSessionId(undefined), false);
});

test('props are bounded to small primitives', () => {
  assert.equal(boundProps(null), null);
  assert.equal(boundProps({}), null);
  const out = boundProps({ rows: 49, ok: true, fmt: 'x'.repeat(100), nested: { a: 1 }, 'bad key': 1, inf: Infinity });
  assert.deepEqual(out, { rows: 49, ok: true, fmt: 'x'.repeat(64) });
  const many = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, i]));
  assert.equal(Object.keys(boundProps(many) ?? {}).length, 12);
});

test('a funnel counts an actor only as far as its first missing step', () => {
  const rows = computeFunnel(CLAN_ONBOARDING, [
    ['created', 'event', 'tiles', 'started'],
    ['created', 'event', 'tiles'],
    ['created', 'event'],
    ['created'],
    // Started without ever adding a tile: stops at "event", whatever came later.
    ['created', 'event', 'started'],
  ]);
  assert.deepEqual(rows.map((r) => r.count), [5, 4, 2, 1]);
  assert.equal(rows[0].ofStart, 1);
  assert.equal(rows[0].dropFromPrev, 0);
  assert.equal(rows[2].ofStart, 2 / 5);
  assert.equal(rows[2].dropFromPrev, 1 - 2 / 4);
  assert.equal(worstStep(rows)?.key, 'tiles');
});

test('an empty funnel is zeros, not NaN', () => {
  const rows = computeFunnel(CLAN_ONBOARDING, []);
  assert.deepEqual(rows.map((r) => [r.count, r.ofStart, r.dropFromPrev]), [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]);
  assert.equal(worstStep(rows), null);
});

test('windows: only the offered choices, and stamps in the stored format', () => {
  assert.equal(parseWindow('7'), 7);
  assert.equal(parseWindow('90'), 90);
  assert.equal(parseWindow('365'), 30);
  assert.equal(parseWindow(undefined), 30);
  assert.equal(windowStart(1, new Date('2026-10-12T10:00:00Z')), '2026-10-11 10:00:00');
});

test('a daily series fills the quiet days with zeros', () => {
  const out = densifyDays([{ day: '2026-10-10', count: 3 }, { day: '2026-10-12', count: 1 }], 4, new Date('2026-10-12T15:00:00Z'));
  assert.deepEqual(out, [
    { day: '2026-10-09', count: 0 },
    { day: '2026-10-10', count: 3 },
    { day: '2026-10-11', count: 0 },
    { day: '2026-10-12', count: 1 },
  ]);
});
