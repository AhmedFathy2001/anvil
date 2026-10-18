// Client-IP resolution for coarse per-IP throttling.
//
// DESIGN: deliberately free of any `@/` import (no DB, Next, or config) so it stays unit-testable
// under Node's native TS type-stripping (`node --test`) with no bundler.

/**
 * The real client IP, from the one header a client cannot choose.
 *
 * Every public request reaches us through Cloudflare (tunnel-only; the box firewall drops 80/443),
 * and Cloudflare sets `CF-Connecting-IP` to the address that connected to IT, overwriting anything
 * the client sent. That is the only trustworthy answer on this path:
 *
 *   - `X-Real-IP` used to come first, on the belief that Caddy set it. It does not — nothing in our
 *     Caddyfiles writes it — so it passed through from the client untouched, and any caller could
 *     name a fresh rate-limit bucket on every request by sending a random one.
 *   - The rightmost `X-Forwarded-For` hop is whatever connected to Caddy, which behind the tunnel is
 *     cloudflared — the same address for every visitor, so every visitor shared ONE bucket and a
 *     single abuser could throttle everybody out of login.
 *
 * Without Cloudflare in front (local dev, a direct internal call) the rightmost XFF hop — appended by
 * whatever proxy is there — is the fallback; the leftmost is client-written and never used. Returns
 * 'unknown' when no proxy header is present, which simply shares one bucket.
 */
export function getClientIp(request: { headers: { get(name: string): string | null } }): string {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf && cf.trim()) return bucketOf(cf.trim());
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) {
    const parts = fwd
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) return bucketOf(parts[parts.length - 1]!); // proxy-APPENDED (rightmost) — trusted
  }
  return 'unknown';
}

/**
 * The unit a throttle should count: an IPv4 address as is, an IPv6 address by its /64.
 *
 * One household or server is handed a whole /64 — eighteen quintillion addresses — so per-address
 * IPv6 limits are no limit at all: rotate the last half and every request is a stranger. The /64 is
 * the smallest block one subscriber reliably holds, and the conventional unit for exactly this.
 */
export function bucketOf(ip: string): string {
  if (!ip.includes(':')) return ip; // IPv4 (or an IPv4-mapped form already reduced by the proxy)
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1];
  // Expand `::` so the first four hextets are where they belong, then keep them.
  const [head, tail = ''] = ip.toLowerCase().split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const full = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t];
  return `${full.slice(0, 4).map((x) => x.replace(/^0+(?=.)/, '') || '0').join(':')}::/64`;
}
