// What a clan may be called. Pure — no database import.
//
// Split from lib/clanCreate for the same reason lib/clanRoles is split from lib/clanGrants: these
// are string rules, and asking whether "staff" is a reserved name should not open a connection,
// least of all in a test.

export const SLUG_RE = /^[a-z0-9-]{2,32}$/;
export const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

/**
 * Subdomains that must never become a clan.
 *
 * Two kinds, and the second matters more. Infrastructure names (`mail`, `ns1`, `mx`) would break
 * real services. Platform names (`api`, `admin`, `login`, `staff`, `portal`) would let a clan sit at
 * a host that looks like it belongs to us — a phishing surface, not merely a routing clash.
 */
export const RESERVED_SLUGS = new Set([
  'www', 'api', 'admin', 'app', 'mail', 'smtp', 'imap', 'ftp', 'ns1', 'ns2', 'mx', 'cdn', 'static',
  'assets', 'img', 'media', 'status', 'pay', 'checkout', 'billing', 'onboard', 'register', 'login',
  'logout', 'dashboard', 'account', 'accounts', 'help', 'support', 'docs', 'doc', 'blog', 'store',
  'shop', 'staging', 'stage', 'dev', 'test', 'demo', 'anvil', 'root', 'internal', 'caddy',
  // Added with the platform surfaces: a clan at staff.<apex> reading as the operator console is
  // exactly the confusion the apex-only rule exists to prevent.
  'staff', 'platform', 'clans', 'profile', 'events', 'members', 'guide', 'guides', 'pricing',
  'leaderboard', 'leaderboards',
  'portal', 'legal', 'privacy', 'terms', 'refunds', 'preview',
]);

export interface AvailabilityResult {
  ok: boolean;
  reason?: 'invalid' | 'reserved' | 'taken';
}

/** Everything that can be decided about a slug WITHOUT asking the database. Null when it's fine. */
export function slugRuleFailure(slug: string): AvailabilityResult | null {
  if (!SLUG_RE.test(slug)) return { ok: false, reason: 'invalid' };
  if (RESERVED_SLUGS.has(slug)) return { ok: false, reason: 'reserved' };
  return null;
}

/** The same for a custom domain. An empty domain is fine — the field is optional. */
export function domainRuleFailure(domain: string): AvailabilityResult | null {
  if (!domain) return null;
  if (!DOMAIN_RE.test(domain)) return { ok: false, reason: 'invalid' };
  return null;
}

/** A slug as it will actually be stored, so casing and padding cannot smuggle a duplicate. */
export function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

export function availabilityMessage(field: string, r: AvailabilityResult): string {
  switch (r.reason) {
    case 'reserved':
      return `That ${field.toLowerCase()} is reserved — pick another.`;
    case 'taken':
      return `That ${field.toLowerCase()} is already taken — pick another.`;
    case 'invalid':
      return field === 'Domain'
        ? 'That domain looks invalid (e.g. bingo.yourclan.com).'
        : 'Subdomain must be 2–32 characters: lowercase letters, numbers and hyphens.';
    default:
      return '';
  }
}
