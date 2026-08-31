// Public origin for building absolute redirect URLs (post-login, logout).
//
// Behind a reverse proxy the Next standalone server sees its own bind address in `request.url`
// (e.g. http://0.0.0.0:3000), so redirects built from it point at the container, not the public
// host. We must NOT instead trust Host / X-Forwarded-Host — those are attacker-controllable and
// would be an open-redirect / host-header-injection vector. The origin comes from configured env
// and never from headers.
//
// WHAT THIS ANSWERS, on a platform serving many clans: the APEX origin. A clan's own absolute URL is
// built from its resolved row (lib/clanContext.originForHost), which is a value the database
// produced; this is the fallback for everything that names no clan — the front page, /clans,
// /profile, /staff, and signing out from any of them.
//
// Resolution order: APP_URL → the origin of DISCORD_REDIRECT_URI (set wherever OAuth is used) →
// ANVIL_APEX_DOMAIN (the one env that means exactly "the apex", and the only one a deployment
// without OAuth is guaranteed to have) → request.url, which is correct ONLY in local dev, where
// there is no proxy in front and the server's own address really is the public one.
function originOf(u: string | undefined): string | null {
  if (!u) return null;
  try {
    return new URL(u).origin;
  } catch {
    return null;
  }
}

export function publicOrigin(request: Request): string {
  const configured = configuredOrigin();
  if (configured) return configured;
  // No proxy, no config (local dev): the server's own origin is correct.
  return new URL(request.url).origin;
}

/**
 * The same canonical origin, for code with no Request in hand (cron sweeps, background reconciles).
 * Null when nothing is configured — a self-hoster running without APP_URL has no way for us to know
 * the public URL, and guessing one is worse than skipping the work that needed it.
 */
export function configuredOrigin(): string | null {
  return (
    originOf(process.env.APP_URL) || originOf(process.env.DISCORD_REDIRECT_URI) || apexOrigin()
  );
}

/**
 * The apex as an origin, from the one variable that names it.
 *
 * Read here rather than imported from lib/clanContext on purpose: this module is deliberately
 * dependency-free, and clanContext reaches the database. The scheme follows the same rule
 * originForHost uses — a hostname with no dot is a dev machine, and http is what it speaks.
 */
function apexOrigin(): string | null {
  const apex = process.env.ANVIL_APEX_DOMAIN?.trim().toLowerCase();
  if (!apex) return null;
  const scheme = apex.startsWith('localhost') || apex.startsWith('127.') ? 'http' : 'https';
  return originOf(`${scheme}://${apex}`);
}
