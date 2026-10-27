// Access log → load profile. The half k6 reads.
//
// WHAT A PROFILE IS. Not "the server did 40 req/s at 20:00" — that only says what one evening cost.
// It is the shape behind it: how many PEOPLE were there (plugin clients, browser visitors), and what
// one of them asks for in a minute. Load is then people × per-person rates, and the test turns the
// first number up while keeping the second, which is the question being asked: how many players can
// the box carry at the mix it really sees.
//
// PRESENCE, not hits. An actor is someone holding a session — one plugin token, one browser — and
// is counted present from their first request to their last, with gaps up to SESSION_GAP_MIN bridged.
// Counting only minutes with a request would call a player who polls every 90s absent half the time,
// and rates per present-minute would come out double.
//
// PURE: entries in, profile out. The CLI (profile.mjs) does the reading.

export const SESSION_GAP_MIN = 10;
const RESERVOIR = 2000;

// Same intent as lib/analyticsPattern isBotUserAgent; copied, not imported, because this runs under
// plain node outside the app.
const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|curl|wget|python-requests|go-http-client|httpclient|uptime|monitor|headless/i;

const first = (h, name) => {
  if (!h) return null;
  const v = h[name];
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
};

/**
 * One Caddy access-log line (already JSON.parsed) → an entry, or null when it is not a request line.
 * Header names are Go-canonical in Caddy's output (`Cf-Connecting-Ip`, `X-Rsn`).
 */
export function entryFromCaddy(line) {
  const r = line?.request;
  if (!r || typeof line.ts !== 'number') return null;
  const h = r.headers ?? {};
  const duration = typeof line.duration === 'number' ? line.duration : 0;
  const uri = r.uri ?? '/';
  return {
    end: line.ts,
    start: line.ts - duration,
    duration,
    method: r.method ?? 'GET',
    uri,
    host: r.host ?? '',
    status: line.status ?? 0,
    size: line.size ?? 0,
    ua: first(h, 'User-Agent') ?? '',
    auth: first(h, 'Authorization'),
    cookie: first(h, 'Cookie'),
    ip: first(h, 'Cf-Connecting-Ip') ?? r.remote_ip ?? null,
    rsc: first(h, 'Rsc') === '1' || /[?&]_rsc=/.test(uri),
    ws: (first(h, 'Upgrade') ?? '').toLowerCase() === 'websocket' || line.status === 101,
    prefetch: first(h, 'Next-Router-Prefetch') === '1' || first(h, 'Purpose') === 'prefetch',
  };
}

/** Which kind of caller, and who. */
export function classify(entry, route) {
  if (BOT_UA.test(entry.ua) && !/runelite/i.test(entry.ua)) return { cls: 'bot', actor: null };
  if (route.kind === 'asset' || route.kind === 'meta') return { cls: 'asset', actor: null };
  const plugin = route.pattern.startsWith('/api/plugin') || /runelite|okhttp/i.test(entry.ua);
  const who = plugin
    ? (entry.auth ? `t:${entry.auth}` : `ip:${entry.ip}|${entry.ua}`)
    : (entry.cookie ? `c:${entry.cookie}` : `ip:${entry.ip}|${entry.ua}`);
  return { cls: plugin ? 'plugin' : 'web', actor: who };
}

const NOT_CLAN_LABELS = new Set(['www', 'beta', 'preview', 'admin']);

/** Was this request addressed to a clan: the `/c/<slug>` prefix, or a clan subdomain (legacy). */
export function clanScoped(entry, route) {
  if (route.clan) return true;
  const labels = (entry.host || '').split(':')[0].split('.');
  return labels.length > 2 && !NOT_CLAN_LABELS.has(labels[0]);
}

export function routeKey(entry, route) {
  return `${entry.method} ${route.pattern}${entry.rsc ? ' (rsc)' : ''}`;
}

function quantile(sorted, q) {
  if (sorted.length === 0) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

const round = (n, d = 3) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);

/**
 * An accumulator. `add(entry)` per line, `finish()` once.
 * opts.match: path → route (routes.mjs routeMatcher). opts.hostRe: keep only matching hosts.
 * opts.from / opts.to: unix seconds window on the request start.
 */
export function profileBuilder({ match, hostRe = null, from = null, to = null }) {
  const routes = new Map(); // key → { cls, kind, count, status{}, bytes, durs[], seen }
  const actors = new Map(); // actor → { cls, minutes:Set }
  const sockets = []; // [startMin, endMin]
  const perMinute = new Map(); // minute → { plugin, web, bot, asset } request counts
  const classTotals = { plugin: 0, web: 0, bot: 0, asset: 0 };
  let minTs = Infinity;
  let maxTs = -Infinity;
  let skipped = 0;

  function add(e) {
    if (!e) return void skipped++;
    if (hostRe && !hostRe.test(e.host)) return void skipped++;
    if (from != null && e.start < from) return void skipped++;
    if (to != null && e.start >= to) return void skipped++;
    // The push socket is served beside Next, not by it, so no app route claims it.
    const route = e.ws ? { ...match(e.uri), kind: 'ws' } : match(e.uri);
    const { cls, actor } = classify(e, route);
    classTotals[cls]++;
    minTs = Math.min(minTs, e.start);
    maxTs = Math.max(maxTs, e.end);
    const minute = Math.floor(e.start / 60);

    const pm = perMinute.get(minute) ?? { plugin: 0, web: 0, bot: 0, asset: 0 };
    pm[cls]++;
    perMinute.set(minute, pm);

    if (e.ws) {
      // A socket's line is written when it CLOSES; its duration is how long it was held.
      sockets.push([minute, Math.floor(e.end / 60)]);
    }

    const key = routeKey(e, route);
    let r = routes.get(key);
    if (!r) {
      r = { cls, kind: route.kind, count: 0, clanHits: 0, status: {}, bytes: 0, durs: [], seen: 0, ws: e.ws };
      routes.set(key, r);
    }
    r.count++;
    if (clanScoped(e, route)) r.clanHits++;
    const band = e.status === 304 ? '304' : e.status === 429 ? '429' : e.status === 101 ? '101' : `${Math.floor(e.status / 100)}xx`;
    r.status[band] = (r.status[band] ?? 0) + 1;
    r.bytes += e.size;
    // Reservoir sample, so a route hit a million times costs 2,000 numbers.
    r.seen++;
    if (!e.ws) {
      if (r.durs.length < RESERVOIR) r.durs.push(e.duration);
      else {
        const j = Math.floor(Math.random() * r.seen);
        if (j < RESERVOIR) r.durs[j] = e.duration;
      }
    }

    if (actor) {
      let a = actors.get(actor);
      if (!a) {
        a = { cls, minutes: new Set() };
        actors.set(actor, a);
      }
      a.minutes.add(minute);
    }
  }

  function finish() {
    // Presence: bridge gaps up to SESSION_GAP_MIN, per actor.
    const present = new Map(); // minute → { plugin, web }
    const presentMinutes = { plugin: 0, web: 0 };
    const sessions = { plugin: 0, web: 0 };
    for (const a of actors.values()) {
      const ms = [...a.minutes].sort((x, y) => x - y);
      let prev = null;
      for (const m of ms) {
        if (prev == null || m - prev > SESSION_GAP_MIN) {
          sessions[a.cls]++;
          mark(m, a.cls);
        } else {
          for (let k = prev + 1; k <= m; k++) mark(k, a.cls);
        }
        prev = m;
      }
    }
    function mark(m, cls) {
      const p = present.get(m) ?? { plugin: 0, web: 0 };
      p[cls]++;
      present.set(m, p);
      presentMinutes[cls]++;
    }

    const minutes = [...new Set([...perMinute.keys(), ...present.keys()])].sort((a, b) => a - b);
    const series = (cls) => minutes.map((m) => present.get(m)?.[cls] ?? 0).sort((a, b) => a - b);
    const presence = (cls) => {
      const s = series(cls);
      return { peak: s.at(-1) ?? 0, p95: quantile(s, 0.95) ?? 0, median: quantile(s, 0.5) ?? 0 };
    };

    let peakMinute = null;
    let peakReq = 0;
    for (const [m, c] of perMinute) {
      const n = c.plugin + c.web;
      if (n > peakReq) {
        peakReq = n;
        peakMinute = m;
      }
    }

    // Hourly, for picking which window to model (an event night vs a Tuesday).
    const hourly = new Map();
    for (const [m, c] of perMinute) {
      const hr = Math.floor(m / 60);
      const h = hourly.get(hr) ?? { plugin: 0, web: 0, bot: 0, asset: 0, peakPresent: { plugin: 0, web: 0 } };
      for (const k of Object.keys(classTotals)) h[k] += c[k];
      hourly.set(hr, h);
    }
    for (const [m, p] of present) {
      const h = hourly.get(Math.floor(m / 60));
      if (!h) continue;
      h.peakPresent.plugin = Math.max(h.peakPresent.plugin, p.plugin);
      h.peakPresent.web = Math.max(h.peakPresent.web, p.web);
    }

    // Sockets held at once, minute by minute.
    const held = new Map();
    for (const [s, e] of sockets) for (let m = s; m <= e; m++) held.set(m, (held.get(m) ?? 0) + 1);
    const heldSorted = [...held.values()].sort((a, b) => a - b);

    const routeRows = [...routes.entries()]
      .map(([key, r]) => {
        const d = r.durs.sort((a, b) => a - b);
        const pmin = presentMinutes[r.cls] || 0;
        return {
          key,
          cls: r.cls,
          kind: r.kind,
          count: r.count,
          // What ONE present actor of this class asks for, per minute. The number k6 replays.
          // How often it was asked for inside a clan (`/c/<slug>/…` or a clan subdomain) rather than on
          // the apex — k6 replays it the way it was mostly called.
          clanShare: round(r.clanHits / r.count, 3),
          perActorMinute: r.cls === 'plugin' || r.cls === 'web' ? (pmin ? round(r.count / pmin, 5) : 0) : null,
          status: r.status,
          avgBytes: Math.round(r.bytes / r.count),
          p50ms: round((quantile(d, 0.5) ?? 0) * 1000, 1),
          p95ms: round((quantile(d, 0.95) ?? 0) * 1000, 1),
          p99ms: round((quantile(d, 0.99) ?? 0) * 1000, 1),
          ws: r.ws || undefined,
        };
      })
      .sort((a, b) => b.count - a.count);

    const spanMin = minutes.length ? minutes.at(-1) - minutes[0] + 1 : 0;
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      window: {
        from: Number.isFinite(minTs) ? new Date(minTs * 1000).toISOString() : null,
        to: Number.isFinite(maxTs) ? new Date(maxTs * 1000).toISOString() : null,
        minutes: spanMin,
      },
      sessionGapMin: SESSION_GAP_MIN,
      skipped,
      totals: classTotals,
      classes: {
        plugin: { sessions: sessions.plugin, presentMinutes: presentMinutes.plugin, present: presence('plugin') },
        web: { sessions: sessions.web, presentMinutes: presentMinutes.web, present: presence('web') },
      },
      peakMinute: peakMinute == null ? null : {
        at: new Date(peakMinute * 60_000).toISOString(),
        requests: peakReq,
        rps: round(peakReq / 60, 2),
        present: present.get(peakMinute) ?? { plugin: 0, web: 0 },
      },
      sockets: { total: sockets.length, peakHeld: heldSorted.at(-1) ?? 0, p95Held: quantile(heldSorted, 0.95) ?? 0 },
      hourly: [...hourly.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([hr, h]) => ({ hour: new Date(hr * 3_600_000).toISOString(), ...h })),
      routes: routeRows,
    };
  }

  return { add, finish };
}
