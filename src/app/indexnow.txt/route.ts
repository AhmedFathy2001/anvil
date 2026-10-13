import { createHash } from 'node:crypto';

import { apexDomain } from '@/lib/apexHost';

/**
 * The IndexNow key, at the site root where the protocol looks for it.
 *
 * IndexNow is how Bing (and Yandex, Seznam, Naver) learn a URL changed without waiting for their
 * next crawl — the stale `theafkspot.anvilosrs.com` results sat in Bing for months because nothing
 * told it the pages now redirect. `npm run seo:indexnow` submits the sitemap with this key.
 *
 * DERIVED, NOT CONFIGURED. The key only proves "this host agreed to submissions"; it is served to
 * anyone who asks, and the worst a third party can do with it is ask Bing to re-crawl our own
 * public pages. Deriving it from the apex means no env var to set on each box, and a self-hoster
 * gets a key for their own domain rather than ours. Answers on every host — the legacy clan
 * hostnames included, since middleware's matcher skips `.txt` — so their old URLs can be submitted
 * under their own host too.
 */
export const dynamic = 'force-dynamic';

function indexNowKey(): string {
  return createHash('sha256').update(`anvil-indexnow:${apexDomain()}`).digest('hex').slice(0, 32);
}

export function GET(): Response {
  return new Response(indexNowKey(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
  });
}
