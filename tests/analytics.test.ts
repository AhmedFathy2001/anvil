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
  panelViewOf,
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

// ── Feature registry and ranking ────────────────────────────────────────────────────────────────

import { ACTION_NAMES } from '../src/lib/analyticsActions.ts';
import { FORMAT_CARDS } from '../src/lib/formatCatalog.ts';
import {
  FEATURES,
  ageInDays,
  buildMatcher,
  featureOf,
  rankFeatures,
  stripClanPrefix,
  tileKindLabels,
  trendOf,
  unusedFeatures,
  type FeatureDef,
  type UsageRow,
} from '../src/lib/featureRegistry.ts';

const matchKey = (a: { name: string; prop?: string; value?: string }) => (a.prop ? `${a.name}|${a.prop}=${a.value}` : a.name);

test('every registry action is a real action name', () => {
  const known = new Set<string>(ACTION_NAMES);
  for (const f of FEATURES) for (const a of f.actions ?? []) assert.ok(known.has(a.name), `${f.key}: ${a.name}`);
  assert.equal(new Set(ACTION_NAMES).size, ACTION_NAMES.length, 'no action name listed twice');
});

test('an action belongs to at most one feature (a narrowed action counts once per value)', () => {
  const seen = new Map<string, string>();
  const plain = new Map<string, string>();
  for (const f of FEATURES) {
    for (const a of f.actions ?? []) {
      const k = matchKey(a);
      assert.ok(!seen.has(k), `${k} is in both ${seen.get(k)} and ${f.key}`);
      seen.set(k, f.key);
      if (!a.prop) plain.set(a.name, f.key);
      else assert.equal(a.value !== undefined, true, `${f.key}: prop without value`);
    }
  }
  // A whole-name entry may not share its name with a narrowed one: that would count a row twice.
  for (const f of FEATURES) {
    for (const a of f.actions ?? []) if (a.prop) assert.ok(!plain.has(a.name), `${a.name} is both whole and narrowed`);
  }
  // Feature keys and pages are unique too.
  assert.equal(new Set(FEATURES.map((f) => f.key)).size, FEATURES.length);
  const pages = FEATURES.flatMap((f) => f.pages ?? []);
  assert.equal(new Set(pages).size, pages.length);
});

test('formats and tile kinds come from their catalogs', () => {
  for (const c of FORMAT_CARDS) assert.ok(FEATURES.some((f) => f.key === `format.${c.key}`), c.key);
  const kinds = FEATURES.filter((f) => f.group === 'Tile kinds');
  assert.equal(kinds.length, tileKindLabels().length);
  assert.ok(kinds.length >= 12);
});

test('stripping the clan prefix, and matching pages, narrowed actions and plugin views', () => {
  assert.equal(stripClanPrefix('/c/[clan]/coffer'), '/coffer');
  assert.equal(stripClanPrefix('/s/[clan]'), '/');
  assert.equal(stripClanPrefix('/coffer'), '/coffer');
  const m = buildMatcher();
  const name = (row: Partial<UsageRow>) => {
    const i = featureOf(m, { kind: 'page', name: '', clanId: null, userId: null, accountId: null, day: '2026-11-01', n: 1, ...row });
    return i === null ? null : FEATURES[i].key;
  };
  assert.equal(name({ name: '/c/[clan]/coffer' }), 'coffer');
  assert.equal(name({ name: '/guide/admin' }), 'guides');
  assert.equal(name({ name: '/guides/[slug]' }), 'guides-ingame');
  assert.equal(name({ name: '/staff/analytics' }), null);
  assert.equal(name({ kind: 'action', name: 'event.created', fmt: 'race' }), 'format.race');
  assert.equal(name({ kind: 'action', name: 'event.created', fmt: 'nope' }), null);
  assert.equal(name({ kind: 'action', name: 'weekly.created', type: 'boss' }), 'format.botw');
  assert.equal(name({ kind: 'action', name: 'tile.created', tileKind: 'Collection log' }), 'tile.collection-log');
  assert.equal(name({ kind: 'plugin', name: '/api/plugin/ui?v=feed' }), 'chat');
  assert.equal(name({ kind: 'plugin', name: '/api/plugin/ui?v=nope' }), null);
});

test('the panel view is a short word or nothing', () => {
  assert.equal(panelViewOf('https://x.test/api/plugin/ui?v=feed&rsn=Zezima'), 'feed');
  assert.equal(panelViewOf('https://x.test/api/plugin/ui?v=clan-compare'), 'clan-compare');
  assert.equal(panelViewOf('https://x.test/api/plugin/ui?v=Zezima%20x'), null);
  assert.equal(panelViewOf('https://x.test/api/plugin/board?v=feed'), null);
  assert.equal(panelViewOf('not a url'), null);
});

const NOW = new Date('2026-11-15T12:00:00Z');
const row = (o: Partial<UsageRow>): UsageRow => ({ kind: 'action', name: 'coffer.donated', clanId: 1, userId: 1, accountId: null, day: '2026-11-15', n: 1, ...o });

test('ranking: windows, distinct clans and people, last used', () => {
  assert.equal(ageInDays('2026-11-15', NOW), 0);
  assert.equal(ageInDays('2026-11-08', NOW), 7);
  const out = rankFeatures(
    [
      row({ day: '2026-11-15', n: 2 }),
      row({ day: '2026-11-10', clanId: 2, userId: 2 }),
      row({ day: '2026-11-10', clanId: 2, userId: 2, n: 3 }),
      row({ day: '2026-10-20', clanId: 3, userId: 3 }),
      row({ day: '2026-10-05', clanId: 4, userId: 4, n: 4 }),
      row({ day: '2026-09-01', clanId: 5, userId: 5 }),
      row({ day: '2026-06-01', clanId: 6, userId: 6 }),
      row({ kind: 'plugin', name: '/api/plugin/coffer', clanId: 1, userId: null, accountId: 9 }),
    ],
    NOW,
  );
  const coffer = out.find((f) => f.key === 'coffer')!;
  assert.equal(coffer.uses7, 2 + 1 + 3 + 1); // today, twice on the 10th, and the plugin row
  assert.equal(coffer.uses30, 2 + 1 + 3 + 1 + 1);
  assert.equal(coffer.prev30, 4);
  assert.equal(coffer.clans, 3);
  assert.equal(coffer.people, 4);
  assert.equal(coffer.lastUsed, '2026-11-15');
  assert.equal(out[0].key, 'coffer', 'most used first');
});

test('ranking: trend maths and the unused list', () => {
  assert.equal(trendOf(6, 4), 0.5);
  assert.equal(trendOf(2, 4), -0.5);
  assert.equal(trendOf(3, 0), null);
  const out = rankFeatures([row({ day: '2026-08-20' }), row({ name: 'weekly.joined', day: '2026-11-14' })], NOW);
  assert.equal(out.find((f) => f.key === 'coffer')!.lastUsed, '2026-08-20');
  assert.equal(out.find((f) => f.key === 'weekly')!.uses7, 1);
  const unused = unusedFeatures(out).map((f) => f.key);
  assert.ok(unused.includes('draft'));
  assert.ok(!unused.includes('weekly'));
  // 2026-08-20 is 87 days back, inside the 90-day window; one day older is out of it.
  assert.equal(rankFeatures([row({ day: '2026-08-15' })], NOW).find((f) => f.key === 'coffer')!.lastUsed, null);
});

test('ranking leaves proof submission out, though it is tracked', () => {
  const out = rankFeatures([row({ name: 'submission.created', n: 500 }), row({ name: 'submission.removed' })], NOW);
  assert.equal(out.some((f) => f.key === 'submissions'), false);
  assert.equal(FEATURES.find((f) => f.key === 'submissions')?.ranked, false);
  assert.ok(!unusedFeatures(out).some((f) => f.key === 'submissions'));
  const custom: FeatureDef[] = [{ key: 'a', label: 'A', group: 'g', actions: [{ name: 'coffer.donated' }] }];
  assert.equal(rankFeatures([row({})], NOW, custom)[0].uses7, 1);
});
