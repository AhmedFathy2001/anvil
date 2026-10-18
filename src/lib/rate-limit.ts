// Per-IP (or per-key) fixed-window rate limiter, held in this process's memory — see the store below.
//
// Fixed-window is fine here: bucket aliasing at window boundaries can let a well-timed burst double
// the nominal limit, but the use case is gate-keeping, not fair share.

import { getClientIp } from '@/lib/clientIp';

interface Options {
  limit: number;
  windowMs: number;
}

interface Result {
  ok: boolean;
  limit: number;
  remaining: number;
  reset: number; // unix ms when the window resets
}

// getClientIp lives in lib/clientIp (the `@/`-free, testable module) and trusts Cloudflare's
// CF-Connecting-IP, then the proxy-appended XFF hop — never a value the client chose.

export async function rateLimit(
  request: Request,
  scope: string,
  opts: Options,
): Promise<Result> {
  return rateLimitByKey(scope, getClientIp(request), opts);
}

// Fixed-window limiter keyed on an EXPLICIT identifier rather than the request IP — for throttling
// per actor (member, account, clan) instead of per network origin, where the same person behind one
// IP should share a budget and one person on many IPs should not get many budgets. Same
// self-cleaning bucket store as rateLimit().
export async function rateLimitByKey(
  scope: string,
  ident: string,
  opts: Options,
): Promise<Result> {
  const now = Date.now();
  const windowStart = Math.floor(now / opts.windowMs) * opts.windowMs;
  const reset = windowStart + opts.windowMs;
  const key = `${scope}:${ident}:${windowStart}`;

  const count = (buckets.get(key)?.count ?? 0) + 1;
  buckets.set(key, { count, reset, limit: opts.limit });
  // Swept on a clock, and when over capacity at most once a second — a full pass per request under a
  // flood would itself be the denial of service.
  if (now - lastSweep > SWEEP_EVERY_MS || (buckets.size > MAX_BUCKETS && now - lastSweep > 1_000)) sweep(now);

  return {
    ok: count <= opts.limit,
    limit: opts.limit,
    remaining: Math.max(0, opts.limit - count),
    reset,
  };
}

// ── The store: this process's memory ─────────────────────────────────────────────────────────────
//
// It used to be the database — an upsert per limited request, plus an opportunistic DELETE — which
// on production meant over half a million writes to a table nobody reads, from the routes the plugin
// calls most. One slot serves traffic at a time (blue-green), so a process-local window protects
// exactly as well: during a slot switch each process counts on its own for a moment, which at worst
// lets a burst through twice, and a restart forgets the counts — both fine for a throttle.
const buckets = new Map<string, { count: number; reset: number; limit: number }>();
const MAX_BUCKETS = 50_000;
/** The hard ceiling: past it, the oldest buckets go whatever their state — memory must stay bounded. */
const HARD_MAX_BUCKETS = 2 * MAX_BUCKETS;
const SWEEP_EVERY_MS = 60_000;
let lastSweep = 0;

function sweep(now: number): void {
  lastSweep = now;
  for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
  // Still over (a flood of distinct keys inside one window): drop the oldest buckets that are UNDER
  // their limit. Never one that is over it — otherwise a caller who is being throttled could flood
  // fresh keys to push their own bucket out and start again at zero.
  if (buckets.size > MAX_BUCKETS) {
    let extra = buckets.size - MAX_BUCKETS;
    for (const [k, b] of buckets) {
      if (extra <= 0) break;
      if (b.count > b.limit) continue;
      buckets.delete(k);
      extra--;
    }
  }
  // A flood of keys that are ALL over their limit: protecting them stops being affordable. Reaching
  // this takes ~100k distinct client networks inside one window (IPv6 is counted per /64 — see
  // lib/clientIp bucketOf), which is a botnet, and no in-process throttle stops one of those anyway;
  // bounded memory is the property worth keeping here.
  if (buckets.size > HARD_MAX_BUCKETS) {
    let extra = buckets.size - HARD_MAX_BUCKETS;
    for (const k of buckets.keys()) {
      if (extra-- <= 0) break;
      buckets.delete(k);
    }
  }
}

export function rateLimitHeaders(r: Result): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(r.limit),
    'X-RateLimit-Remaining': String(r.remaining),
    'X-RateLimit-Reset': String(r.reset),
  };
}
