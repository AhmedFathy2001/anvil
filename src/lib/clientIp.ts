// Client-IP resolution for coarse per-IP throttling.
//
// DESIGN: deliberately free of any `@/` import (no DB, Next, or config) so it stays unit-testable
// under Node's native TS type-stripping (`node --test`) with no bundler.

/**
 * The real client IP, trusting ONLY what our own proxy appended.
 *
 * Behind Caddy (every Anvil deploy) the client's connection IP is in `x-real-ip` (Caddy sets it) or the
 * LAST `x-forwarded-for` entry — each proxy in the chain APPENDS the address it received the connection
 * from, so the rightmost hop is the one our trusted edge saw. The **leftmost** XFF entry is whatever the
 * client prepended and is fully SPOOFABLE: keying a rate limit on it lets one attacker forge unlimited
 * distinct buckets and evade the throttle entirely. Never use the leftmost. Returns 'unknown' when no
 * proxy header is present (a direct/local call), which simply shares one bucket.
 */
export function getClientIp(request: { headers: { get(name: string): string | null } }): string {
  const real = request.headers.get('x-real-ip');
  if (real && real.trim()) return real.trim();
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) {
    const parts = fwd
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!; // proxy-APPENDED (rightmost) — trusted
  }
  return 'unknown';
}
