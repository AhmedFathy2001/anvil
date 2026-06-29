// Public origin for building absolute redirect URLs (post-login, logout).
//
// Behind a reverse proxy the Next standalone server sees its own bind address in `request.url`
// (e.g. http://0.0.0.0:3000), so redirects built from it point at the container, not the public
// host. We must NOT instead trust Host / X-Forwarded-Host — those are attacker-controllable and
// would be an open-redirect / host-header-injection vector. Each Anvil instance is single-tenant
// with a known canonical URL, so derive the origin from configured env and never from headers.
//
// Resolution order: APP_URL → the origin of DISCORD_REDIRECT_URI (always set when OAuth is used)
// → request.url (local dev only, where there's no proxy and no config).
function originOf(u: string | undefined): string | null {
  if (!u) return null;
  try {
    return new URL(u).origin;
  } catch {
    return null;
  }
}

export function publicOrigin(request: Request): string {
  const configured = originOf(process.env.APP_URL) || originOf(process.env.DISCORD_REDIRECT_URI);
  if (configured) return configured;
  // No proxy, no config (local dev): the server's own origin is correct.
  return new URL(request.url).origin;
}
