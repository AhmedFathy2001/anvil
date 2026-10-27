import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { routeMatcher, routeTableFromApp, makeRoute } from '../loadtest/routes.mjs';
import { entryFromCaddy, profileBuilder } from '../loadtest/profile-core.mjs';

const table = [
  makeRoute(['api', 'plugin', 'config'], 'api'),
  makeRoute(['api', 'plugin', 'event', '[id]'], 'api'),
  makeRoute(['api', 'plugin', 'event', '[id]', 'roster'], 'api'),
  makeRoute(['members', '[rsn]'], 'page'),
  makeRoute(['members', 'compare'], 'page'),
  makeRoute(['guide', '[...slug]'], 'page'),
  makeRoute([], 'page'),
];
const match = routeMatcher(table);

test('raw paths fold to routes, static beating dynamic, clan prefix stripped', () => {
  assert.deepEqual(match('/api/plugin/event/412/roster?page=2'), { pattern: '/api/plugin/event/[id]/roster', kind: 'api', clan: false });
  assert.equal(match('/c/afk-test/members/Zezima').pattern, '/members/[rsn]');
  assert.equal(match('/c/afk-test/members/Zezima').clan, true);
  assert.equal(match('/members/compare').pattern, '/members/compare');
  assert.equal(match('/guide/a/b/c').pattern, '/guide/[...slug]');
  assert.equal(match('/').pattern, '/');
  assert.equal(match('/_next/static/chunks/x.js').kind, 'asset');
});

test('an unclaimed path keeps its shape but not its ids', () => {
  const r = match('/wp-admin/123456/setup');
  assert.equal(r.kind, 'unmatched');
  assert.equal(r.pattern, '/wp-admin/[id]/setup');
});

test('the real app tree resolves the plugin hot paths', () => {
  const real = routeMatcher(routeTableFromApp(path.join(import.meta.dirname, '..', 'src', 'app')));
  assert.equal(real('/api/plugin/config').pattern, '/api/plugin/config');
  assert.equal(real('/c/x1/api/plugin/board').pattern, '/api/plugin/board');
  assert.equal(real('/api/plugin/event/9/tile/3/progress').pattern, '/api/plugin/event/[id]/tile/[tileId]/progress');
});

function line(ts: number, uri: string, extra: { auth?: string; status?: number; method?: string; dur?: number } = {}) {
  return entryFromCaddy({
    ts,
    duration: extra.dur ?? 0.02,
    status: extra.status ?? 200,
    size: 100,
    request: {
      method: extra.method ?? 'GET',
      uri,
      host: 'anvilosrs.com',
      headers: { 'User-Agent': ['RuneLite/1.11'], ...(extra.auth ? { Authorization: [extra.auth] } : {}) },
    },
  });
}

test('per-actor-minute rates come from presence, gaps bridged', () => {
  const b = profileBuilder({ match });
  const t0 = 1_800_000_000 - (1_800_000_000 % 60);
  // Two plugin clients. A polls config every minute for 10 minutes; B polls once at minute 0 and
  // once at minute 4 — present for 5 minutes, not 2.
  for (let m = 0; m < 10; m++) b.add(line(t0 + m * 60 + 1, '/api/plugin/config', { auth: 'aaaa1111', status: m ? 304 : 200 }));
  b.add(line(t0 + 1, '/api/plugin/config', { auth: 'bbbb2222' }));
  b.add(line(t0 + 4 * 60 + 1, '/api/plugin/config', { auth: 'bbbb2222' }));
  const p = b.finish();
  assert.equal(p.classes.plugin.sessions, 2);
  assert.equal(p.classes.plugin.presentMinutes, 15);
  assert.equal(p.classes.plugin.present.peak, 2);
  const cfg = p.routes.find((r) => r.key === 'GET /api/plugin/config');
  assert.ok(cfg);
  assert.equal(cfg.count, 12);
  assert.equal(cfg.perActorMinute, 0.8);
  assert.equal(cfg.status['304'], 9);
});

test('a gap past the session limit starts a new session', () => {
  const b = profileBuilder({ match });
  const t0 = 1_800_000_000 - (1_800_000_000 % 60);
  b.add(line(t0, '/api/plugin/config', { auth: 'aaaa1111' }));
  b.add(line(t0 + 30 * 60, '/api/plugin/config', { auth: 'aaaa1111' }));
  const p = b.finish();
  assert.equal(p.classes.plugin.sessions, 2);
  assert.equal(p.classes.plugin.presentMinutes, 2);
});
