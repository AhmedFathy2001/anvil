// k6: the observed traffic mix, replayed at rising headcounts, until the box stops keeping up.
//
//   BASE_URL=http://127.0.0.1:3000 k6 run loadtest/k6/anvil.js
//
// Each VU is ONE PERSON — a plugin client holding a seeded token, or a browser visitor — and each
// iteration is one minute of what such a person asks for, drawn from the per-actor-minute rates in
// profile.json (loadtest/profile.mjs). The headcount starts at the observed peak and is multiplied
// stage by stage (MULTS); the run aborts when a class's p95 or error rate crosses its threshold, and
// the VU count it got to is the answer: "the box holds ~N players at this mix".
//
// Env:
//   BASE_URL       target (required). anvilosrs.com and its subdomains are refused without ALLOW_LIVE=1.
//   PROFILE        default loadtest/.out/profile.json     FIXTURES  default loadtest/.out/fixtures.json
//   MULTS          headcount multipliers of the observed peak, default 0.5,1,2,3,5,8
//   RAMP / HOLD    per stage, default 1m / 3m
//   PEAK_PLUGIN / PEAK_WEB   override the observed peaks (e.g. 50 before any real logs exist)
//   P95_MS         abort threshold, default 1500        MAX_FAIL  default 0.02
//   CLASSES        which to run, default plugin,web
//
// NOT REPLAYED: writes with side effects outside the server (notify, moments, clip, claims, clan
// sync, link/auth flows), sockets, static assets (Cloudflare serves those), bots. The setup prints
// how much of the observed traffic that leaves out, so the result is read against it.

import http from 'k6/http';
import { sleep } from 'k6';
import exec from 'k6/execution';
import { Counter } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

const BASE = (__ENV.BASE_URL || '').replace(/\/$/, '');
if (!BASE) throw new Error('BASE_URL is required');
// k6 has no URL global; the host is all the guard needs.
const HOST = (/^[a-z]+:\/\/([^/:]+)/i.exec(BASE) || [])[1] || '';
if (/(^|\.)anvilosrs\.com$/i.test(HOST) && __ENV.ALLOW_LIVE !== '1') {
  throw new Error(`${BASE} is a live host (prod and beta share one box). Use a copy, or ALLOW_LIVE=1 if you mean it.`);
}

const profile = JSON.parse(open(__ENV.PROFILE || '../.out/profile.json'));
const fixtures = JSON.parse(open(__ENV.FIXTURES || '../.out/fixtures.json'));
const CLASSES = (__ENV.CLASSES || 'plugin,web').split(',');
const MULTS = (__ENV.MULTS || '0.5,1,2,3,5,8').split(',').map(Number);
const RAMP = __ENV.RAMP || '1m';
const HOLD = __ENV.HOLD || '3m';
const P95 = Number(__ENV.P95_MS || 1500);
const MAX_FAIL = Number(__ENV.MAX_FAIL || 0.02);

const limited = new Counter('rate_limited'); // 429s: the app's own limiter, not the box failing
const unmodelled = new Counter('unmodelled_skips');

// ── Building a request from a route pattern ──────────────────────────────────────────────────

// Writes that touch only this server's database, with a body small enough to be plausible.
const WRITES = {
  'POST /api/plugin/hello': (p) => ({ rsn: p.rsn }),
  'POST /api/plugin/stats': (p, it) => ({ skills: [{ name: 'Attack', xp: 13_034_431 + it * 50 }] }),
  'POST /api/plugin/progress': () => ({ progress: [] }),
  'POST /api/plugin/activity': () => ({ since: null }),
};
// GETs that are not a read a person repeats: one-time auth and link flows, operator/cron routes.
const SKIP_GET = /^\/api\/(plugin\/(auth|link)|cron|webhooks|tls-check|auth)\b/;

function fillPath(pattern, p) {
  let ok = true;
  const out = pattern.replace(/\[\[?(\.\.\.)?([^\]]+)\]\]?/g, (_, _dots, name) => {
    if (name === 'clan') return fixtures.slug;
    if (name === 'rsn') return encodeURIComponent(p.rsn);
    if (name === 'tileId' && fixtures.tileIds.length) return String(fixtures.tileIds[0]);
    // `[id]` / `[eventId]` only where the route is plainly about an event — elsewhere it would be a
    // guide, a weekly, a user, and an event id there is a 404 that measures nothing.
    if ((name === 'eventId' || (name === 'id' && /\/events?\//.test(pattern))) && fixtures.eventId) {
      return String(fixtures.eventId);
    }
    ok = false;
    return '_';
  });
  return ok ? out : null;
}

/** route row → a request maker, or null when this route is not replayed. */
function makerFor(row) {
  const sp = row.key.indexOf(' ');
  const method = row.key.slice(0, sp);
  const rsc = row.key.endsWith(' (rsc)');
  const pattern = row.key.slice(sp + 1).replace(/ \(rsc\)$/, '');
  if (row.ws || row.kind === 'unmatched') return null;
  if (method !== 'GET' && !WRITES[row.key]) return null;
  if (method === 'GET' && SKIP_GET.test(pattern)) return null;
  return (p, it) => {
    const path = fillPath(pattern, p);
    if (!path) return null;
    const prefix = row.clanShare >= 0.5 && !pattern.startsWith('/c/') ? `/c/${fixtures.slug}` : '';
    const headers = { 'CF-Connecting-IP': p.ip };
    if (row.cls === 'plugin') {
      headers.Authorization = `Bearer ${p.token}`;
      headers['X-RSN'] = p.rsn;
      headers['User-Agent'] = 'RuneLite/1.11 Anvil-loadtest';
      headers.Accept = 'application/json';
    } else {
      headers['User-Agent'] = 'Mozilla/5.0 Anvil-loadtest';
      headers.Accept = row.kind === 'page' ? 'text/html' : '*/*';
      if (rsc) headers.RSC = '1';
    }
    const body = method === 'GET' ? null : JSON.stringify(WRITES[row.key](p, it));
    if (body) headers['Content-Type'] = 'application/json';
    return { method, url: BASE + prefix + path, body, headers, name: row.key };
  };
}

const plan = {};
for (const cls of ['plugin', 'web']) {
  const rows = profile.routes.filter((r) => r.cls === cls && r.perActorMinute > 0);
  const total = rows.reduce((s, r) => s + r.count, 0);
  const replay = [];
  let dropped = 0;
  for (const r of rows) {
    const make = makerFor(r);
    if (make) replay.push({ rate: r.perActorMinute, make, key: r.key });
    else dropped += r.count;
  }
  const peak = Number(__ENV[`PEAK_${cls.toUpperCase()}`] || profile.classes[cls].present.peak || 0);
  plan[cls] = { replay, peak, droppedShare: total ? dropped / total : 0 };
}

// ── Scenarios ────────────────────────────────────────────────────────────────────────────────

const scenarios = {};
const thresholds = {};
for (const cls of CLASSES) {
  const { peak, replay } = plan[cls] || {};
  if (!peak || !replay?.length) continue;
  const stages = [];
  for (const m of MULTS) {
    const target = Math.max(1, Math.round(peak * m));
    stages.push({ duration: RAMP, target }, { duration: HOLD, target });
  }
  stages.push({ duration: '30s', target: 0 });
  scenarios[cls] = { executor: 'ramping-vus', exec: cls, startVUs: 0, stages, gracefulRampDown: '30s', gracefulStop: '30s' };
  thresholds[`http_req_duration{cls:${cls}}`] = [{ threshold: `p(95)<${P95}`, abortOnFail: true, delayAbortEval: '1m' }];
  thresholds[`http_req_failed{cls:${cls}}`] = [{ threshold: `rate<${MAX_FAIL}`, abortOnFail: true, delayAbortEval: '1m' }];
}
if (Object.keys(scenarios).length === 0) throw new Error('nothing to run: no peak (set PEAK_PLUGIN / PEAK_WEB) or no replayable routes');

export const options = {
  scenarios,
  thresholds,
  discardResponseBodies: true,
  // A 304 and a 429 are answers, not failures; the 429s are counted on their own.
  setupTimeout: '30s',
};
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 429));

export function setup() {
  for (const cls of CLASSES) {
    const p = plan[cls];
    if (!p) continue;
    const maxVUs = Math.round(p.peak * Math.max(...MULTS));
    console.log(
      `[${cls}] observed peak ${p.peak} → up to ${maxVUs} VUs · ${p.replay.length} route(s) replayed · ` +
        `${(p.droppedShare * 100).toFixed(1)}% of observed ${cls} requests NOT replayed`,
    );
    if (cls === 'plugin' && maxVUs > fixtures.players.length) {
      console.warn(`[plugin] ${maxVUs} VUs share ${fixtures.players.length} tokens — per-user rate limits will fire. Seed more: --players ${maxVUs}`);
    }
  }
}

// ── One minute of one person ─────────────────────────────────────────────────────────────────

function poisson(lambda) {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

const etags = {}; // per VU (module scope is per VU in k6): the plugin's conditional GETs

function person(vu) {
  const pl = fixtures.players[(vu - 1) % fixtures.players.length];
  // A distinct client address per VU, so the IP-keyed limiters see many players, not one. Only takes
  // effect on a target reached directly — through Cloudflare the header is overwritten.
  const ip = `10.${(vu >> 16) & 255}.${(vu >> 8) & 255}.${vu & 255}`;
  return { ...pl, ip };
}

function minute(cls) {
  const p = person(exec.vu.idInTest);
  const it = exec.vu.iterationInScenario;
  const shots = [];
  for (const r of plan[cls].replay) {
    for (let n = poisson(r.rate); n > 0; n--) shots.push({ at: Math.random() * 60, r });
  }
  shots.sort((a, b) => a.at - b.at);
  let t = 0;
  for (const s of shots) {
    if (s.at > t) sleep(s.at - t);
    t = s.at;
    const req = s.r.make(p, it);
    if (!req) {
      unmodelled.add(1);
      continue;
    }
    if (req.method === 'GET' && etags[req.url]) req.headers['If-None-Match'] = etags[req.url];
    const res = http.request(req.method, req.url, req.body, { headers: req.headers, tags: { name: req.name, cls } });
    if (res.status === 429) limited.add(1, { cls });
    const tag = res.headers.Etag || res.headers.ETag;
    if (tag) etags[req.url] = tag;
    t += res.timings.duration / 1000;
  }
  if (t < 60) sleep(60 - t);
}

export function plugin() {
  minute('plugin');
}

export function web() {
  minute('web');
}

export function handleSummary(data) {
  const m = data.metrics;
  const line = (cls) => {
    const d = m[`http_req_duration{cls:${cls}}`];
    const f = m[`http_req_failed{cls:${cls}}`];
    if (!d) return null;
    return `${cls}: p95 ${d.values['p(95)'].toFixed(0)}ms · fail ${(f.values.rate * 100).toFixed(2)}%`;
  };
  const out = [
    `max VUs reached: ${m.vus_max?.values.max ?? '?'}`,
    ...CLASSES.map(line).filter(Boolean),
    `429s: ${m.rate_limited?.values.count ?? 0}`,
    `aborted on a threshold: ${Object.values(data.metrics).some((x) => x.thresholds && Object.values(x.thresholds).some((t) => !t.ok)) ? 'YES — the VU count above is past the ceiling' : 'no — the box held every stage'}`,
  ].join('\n');
  return { stdout: `${textSummary(data, { indent: ' ', enableColors: true })}\n\n${out}\n`, [__ENV.SUMMARY || 'loadtest/.out/k6-summary.json']: JSON.stringify(data, null, 2) };
}
