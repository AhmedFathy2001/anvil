// Folding a logged URL back onto the route that served it.
//
// The access log has raw paths — `/c/afk/members/Zezima`, `/api/plugin/event/412/roster` — and a
// load profile needs routes: 4,000 hits on "the member profile" is a cost, 3 hits on Zezima's is
// noise. Same rule as lib/analyticsPattern, but server-side there are no resolved params to read, so
// the route list is taken from the filesystem Next builds from (src/app) and each path is matched
// against it.
//
// PURE apart from `routeTableFromApp`, which reads the directory once. No `@/` imports: this runs
// under plain node, outside the app.

import fs from 'node:fs';
import path from 'node:path';

/** The `/c/<slug>` prefix the proxy strips (middleware.ts). */
const CLAN_PREFIX = /^\/c\/[a-z0-9-]{2,32}(?=\/|$)/;

// Next's file-convention routes that are not page.tsx / route.ts.
const META_FILES = {
  'opengraph-image': 'opengraph-image',
  'twitter-image': 'twitter-image',
  icon: 'icon',
  'apple-icon': 'apple-icon',
  sitemap: 'sitemap.xml',
  robots: 'robots.txt',
  manifest: 'manifest.webmanifest',
};

/**
 * Every route under an app directory, as `{ pattern, kind, segments }`.
 * kind: 'api' (route.ts under /api), 'route' (other route.ts), 'page', 'meta'.
 */
export function routeTableFromApp(appDir) {
  const out = [];
  const walk = (dir, segs) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.isDirectory()) {
        const name = ent.name;
        if (name.startsWith('_') || name.startsWith('@')) continue; // private folders, parallel slots
        // Route groups `(x)` add no segment; intercepting routes `(.)x` are skipped.
        if (/^\(\.+\)/.test(name)) continue;
        walk(path.join(dir, name), /^\(.*\)$/.test(name) ? segs : [...segs, name]);
        continue;
      }
      const m = /^(.+)\.(tsx?|jsx?|mjs)$/.exec(ent.name);
      if (!m) continue;
      const base = m[1];
      if (base === 'page') out.push(makeRoute(segs, 'page'));
      else if (base === 'route') out.push(makeRoute(segs, segs[0] === 'api' ? 'api' : 'route'));
      else if (META_FILES[base]) out.push(makeRoute([...segs, META_FILES[base]], 'meta'));
    }
  };
  walk(appDir, []);
  return out;
}

export function makeRoute(segs, kind) {
  return { pattern: '/' + segs.join('/'), kind, segments: segs };
}

// A static segment beats a dynamic one beats a catch-all — the order Next itself resolves in.
const WEIGHT = { static: 3, dynamic: 2, catchAll: 1, optional: 0 };

function segKind(seg) {
  if (/^\[\[\.\.\..+\]\]$/.test(seg)) return 'optional';
  if (/^\[\.\.\..+\]$/.test(seg)) return 'catchAll';
  if (/^\[.+\]$/.test(seg)) return 'dynamic';
  return 'static';
}

/** The specificity of a match, or null when the route does not match. */
function matchScore(routeSegs, pathSegs) {
  const score = [];
  let i = 0;
  for (let r = 0; r < routeSegs.length; r++) {
    const kind = segKind(routeSegs[r]);
    if (kind === 'catchAll' || kind === 'optional') {
      const rest = pathSegs.length - i;
      if (kind === 'catchAll' && rest < 1) return null;
      score.push(WEIGHT[kind]);
      return r === routeSegs.length - 1 ? score : null;
    }
    if (i >= pathSegs.length) return null;
    if (kind === 'static' && routeSegs[r] !== pathSegs[i]) return null;
    score.push(WEIGHT[kind]);
    i++;
  }
  return i === pathSegs.length ? score : null;
}

function better(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? -1;
    const y = b[i] ?? -1;
    if (x !== y) return x > y;
  }
  return false;
}

/** Segments that are plainly an identifier, for paths no route claims. */
const ID_LIKE = /^(\d+|[0-9a-f]{8,}|[0-9a-f-]{36})$/i;

/**
 * A matcher over a route table: raw path (query allowed) → `{ pattern, kind, clan }`.
 * `clan` says the path carried a `/c/<slug>` prefix; the slug itself is not kept.
 * Memoised on the raw path, because a log is the same few hundred paths a million times.
 */
export function routeMatcher(table) {
  const cache = new Map();
  return (rawPath) => {
    const p = (rawPath || '/').split(/[?#]/)[0];
    const hit = cache.get(p);
    if (hit) return hit;

    let rest = p;
    let clan = false;
    const pm = CLAN_PREFIX.exec(p);
    if (pm) {
      clan = true;
      rest = p.slice(pm[0].length) || '/';
    }
    let segs;
    try {
      segs = rest.split('/').filter(Boolean).map(decodeURIComponent);
    } catch {
      segs = rest.split('/').filter(Boolean);
    }

    let res;
    if (segs[0] === '_next') {
      res = { pattern: segs[1] === 'image' ? '/_next/image' : `/_next/${segs[1] ?? ''}/*`, kind: 'asset', clan };
    } else {
      let best = null;
      let bestScore = null;
      for (const r of table) {
        const s = matchScore(r.segments, segs);
        if (s && (!bestScore || better(s, bestScore))) {
          best = r;
          bestScore = s;
        }
      }
      if (best) res = { pattern: best.pattern, kind: best.kind, clan };
      else if (/\.[a-z0-9]{2,5}$/i.test(rest)) res = { pattern: '/[public-file]', kind: 'asset', clan };
      else {
        // Unclaimed: keep the shape, never the ids, so a probe for /wp-admin shows up as one row.
        const shape = segs.slice(0, 4).map((s) => (ID_LIKE.test(s) ? '[id]' : s.length > 40 ? '[long]' : s));
        res = { pattern: '/' + shape.join('/') + (segs.length > 4 ? '/…' : ''), kind: 'unmatched', clan };
      }
    }
    if (cache.size > 50_000) cache.clear();
    cache.set(p, res);
    return res;
  };
}
