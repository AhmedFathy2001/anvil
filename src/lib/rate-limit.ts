// Per-IP fixed-window rate limiter backed by the app's own Turso DB.
//
// Used on the auth-adjacent /api/plugin/link endpoint to throttle brute-force
// attempts against the 6-character link code. Sized for a small clan — no
// external store, no extra env vars. The rate_limits table self-cleans via an
// opportunistic DELETE on write (1-in-20 probability) so it never grows
// unbounded.
//
// Fixed-window is fine here: bucket aliasing at window boundaries can let a
// well-timed burst double the nominal limit, but the use case is gate-keeping,
// not fair share.

import { db } from '@/db';
import { rateLimits } from '@/db/schema';
import { lt, sql } from 'drizzle-orm';
import { log } from '@/lib/logger';

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

function getClientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

export async function rateLimit(
  request: Request,
  scope: string,
  opts: Options,
): Promise<Result> {
  const ident = getClientIp(request);
  const now = Date.now();
  const windowStart = Math.floor(now / opts.windowMs) * opts.windowMs;
  const reset = windowStart + opts.windowMs;
  const key = `${scope}:${ident}:${windowStart}`;
  const expiresAt = new Date(reset).toISOString();

  try {
    const rows = await db
      .insert(rateLimits)
      .values({ key, count: 1, expiresAt })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: { count: sql`${rateLimits.count} + 1` },
      })
      .returning({ count: rateLimits.count });

    const count = rows[0]?.count ?? 1;

    // Opportunistic GC: 1-in-20 writes also clean up expired buckets.
    if (Math.random() < 0.05) {
      void db
        .delete(rateLimits)
        .where(lt(rateLimits.expiresAt, new Date(now).toISOString()))
        .catch((err) => log.warn('ratelimit.gc-fail', {}, err));
    }

    return {
      ok: count <= opts.limit,
      limit: opts.limit,
      remaining: Math.max(0, opts.limit - count),
      reset,
    };
  } catch (err) {
    // If the DB itself is misbehaving, don't lock legitimate users out.
    log.warn('ratelimit.store-error', { scope, ident }, err);
    return { ok: true, limit: opts.limit, remaining: opts.limit, reset };
  }
}

export function rateLimitHeaders(r: Result): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(r.limit),
    'X-RateLimit-Remaining': String(r.remaining),
    'X-RateLimit-Reset': String(r.reset),
  };
}
