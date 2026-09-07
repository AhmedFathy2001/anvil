// The apex domain, and how a host is read against it.
//
// PURE — no database import, deliberately, the same split `lib/clanVisibility` is to `lib/clanAccess`
// and `lib/eventVisibility` is to `lib/eventAccess`. These are string predicates over an env var and
// a Host header; nothing here needs a connection pool. `lib/clanContext` re-exports every one of
// them, so no call site changed when they moved out of it.
//
// The reason they had to move: `lib/seo` builds absolute URLs for canonicals, sitemaps and OG tags,
// and it must be importable by a test that has no DATABASE_URL. Reaching for `apexDomain` through
// clanContext dragged the whole `@/db` chain behind it — the exact failure `tests/pure-module-imports`
// exists to catch.

/**
 * The apex domain everything hangs off. A clan lives at `<slug>.<APEX>`; the apex itself is clanless.
 *
 * Env rather than hardcoded so local development and staging resolve too — but note it is only used
 * to STRIP a suffix and recognise the apex, never to decide what a host is allowed to be. That is
 * always the database's answer.
 */
export function apexDomain(): string {
  return (process.env.ANVIL_APEX_DOMAIN || 'anvilosrs.com').toLowerCase();
}

/**
 * Hosts that ARE the apex — the clanless surface serving the directory and platform pages.
 *
 * A list rather than a single value so a preview or staging apex can exist alongside the real one.
 * It is deliberately explicit: an unrecognised host is still nothing, so a spoofed Host gets a 404
 * rather than quietly landing on a real page.
 */
export function apexHosts(): string[] {
  const apex = apexDomain();
  const extra = (process.env.ANVIL_APEX_ALIASES || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return [apex, `www.${apex}`, ...extra];
}

export function isApexHost(rawHost: string | null | undefined): boolean {
  const host = normalizeHost(rawHost);
  return host != null && apexHosts().includes(host);
}

/** Strip the port and lowercase; hosts are compared case-insensitively and port-blind. */
export function normalizeHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const host = raw.trim().toLowerCase().split(':')[0];
  return host || null;
}

/**
 * The subdomain label for a host under the apex, or null when the host IS the apex (or unrelated).
 *
 * `www` is treated as the apex, not a clan, so nobody can register a clan that shadows it.
 */
export function slugFromHost(rawHost: string | null | undefined): string | null {
  const host = normalizeHost(rawHost);
  if (!host) return null;
  const apex = apexDomain();
  if (host === apex || host === `www.${apex}`) return null;
  if (!host.endsWith(`.${apex}`)) return null;
  const label = host.slice(0, -(apex.length + 1));
  // Only a single label is a clan address; `a.b.apex` is not clan `a.b`.
  if (!label || label.includes('.') || label === 'www') return null;
  return label;
}

/**
 * Domain for the session cookie: the apex, so every clan beneath it can read it.
 *
 * Null for a host with no dot (localhost), where browsers reject a domain attribute and a host-only
 * cookie is what you want anyway.
 */
export function sessionCookieDomain(): string | null {
  const apex = apexDomain();
  if (!apex.includes('.')) return null;
  return `.${apex}`;
}

/** Absolute origin for a host WE resolved. Never built from a raw header. */
export function originForHost(host: string): string {
  const scheme = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https';
  return `${scheme}://${host}`;
}
