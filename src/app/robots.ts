import type { MetadataRoute } from 'next';

import { NOINDEX_ROOTS, absoluteUrl, apexOrigin } from '@/lib/seo';

/**
 * There was no robots.txt at all, which is not the neutral state it sounds like: a crawler with no
 * instructions walks `/admin`, `/team` and `/captain` on every clan, gets bounced to /login by
 * middleware, and indexes the login page a few hundred times over.
 *
 * EVERY RULE IS WRITTEN TWICE — bare, and under a clan prefix — because the same page is reachable
 * both ways and `Disallow: /admin` says nothing about `/c/theafkspot/admin`. `/c/*` is a wildcard
 * every major crawler honours.
 */
// Read at request time, not baked at build. `apexOrigin()` comes from ANVIL_APEX_DOMAIN, and the
// Docker image is built once and run by self-hosters on their own domain — a prerendered
// robots.txt would name anvilosrs.com on every one of them.
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const disallow = NOINDEX_ROOTS.flatMap((root) => [root, `/c/*${root}`]);

  return {
    rules: [{ userAgent: '*', allow: '/', disallow }],
    sitemap: absoluteUrl('/sitemap.xml'),
    // Names the apex as the canonical host, so the legacy per-clan subdomains and any custom domain
    // are read as aliases of it rather than as separate sites competing with it.
    host: apexOrigin(),
  };
}
