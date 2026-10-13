import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

import {
  absoluteUrl,
  apexOrigin,
  isLegacyClanHost,
  isNoIndexDeployment,
  robotsDisallowRoots,
} from '@/lib/seo';

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

export default async function robots(): Promise<MetadataRoute.Robots> {
  // Beta and preview: nothing at all. See isNoIndexDeployment.
  if (isNoIndexDeployment()) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  // A legacy clan hostname answers every page with a 301 to the apex, and a crawler that is not
  // allowed to fetch a URL never sees its redirect. The old rules were served here verbatim, so
  // `theafkspot.anvilosrs.com/login` — indexed before any of this existed — could never be
  // re-crawled and kept outranking the apex. Open everything; the redirects do the rest.
  const host = (await headers()).get('host');
  if (isLegacyClanHost(host)) {
    return { rules: [{ userAgent: '*', allow: '/' }], sitemap: absoluteUrl('/sitemap.xml'), host: apexOrigin() };
  }

  const disallow = robotsDisallowRoots().flatMap((root) => [root, `/c/*${root}`]);

  return {
    rules: [{ userAgent: '*', allow: '/', disallow }],
    sitemap: absoluteUrl('/sitemap.xml'),
    // Names the apex as the canonical host, so the legacy per-clan subdomains and any custom domain
    // are read as aliases of it rather than as separate sites competing with it.
    host: apexOrigin(),
  };
}
