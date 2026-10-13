import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clans } from '@/db/schema';
import { currentClan } from '@/lib/clanContext';
import { clanVisibilityOf } from '@/lib/clanVisibility';
import { clanHallView, hallConfig } from '@/lib/clanHall';
import { renderEmbedHtml } from '@/lib/discordEmbedRender';
import { configuredOrigin } from '@/lib/request-origin';

export const dynamic = 'force-dynamic';

/**
 * `/c/<slug>/api/discord/embed` — the clan's live card, for an <iframe> on somebody else's site.
 *
 * Counts only, never names. A private clan, a clan that switched its embed (or the whole card) off,
 * or a server with Discord's widget disabled answers 404: an embed that half-renders on a stranger's
 * forum is worse than none.
 */
export async function GET(request: Request) {
  const clan = await currentClan();
  if (!clan || clanVisibilityOf(clan.visibility) !== 'public') return new Response('Not found', { status: 404 });
  const config = await hallConfig(clan.id);
  if (!config.embed) return new Response('Not found', { status: 404 });
  const [hall, row] = await Promise.all([
    clanHallView(clan.id, { includeNames: false }),
    db.query.clans.findFirst({ where: eq(clans.id, clan.id), columns: { bannerUrl: true, bannerPosition: true } }),
  ]);
  if (!hall) return new Response('Not found', { status: 404 });

  const origin = configuredOrigin() ?? new URL(request.url).origin;
  const html = renderEmbedHtml({
    clan: { name: clan.name, slug: clan.slug, logoUrl: clan.logoUrl, bannerUrl: row?.bannerUrl ?? null, bannerPosition: row?.bannerPosition ?? null },
    counts: hall.counts,
    clanUrl: `${origin}/c/${encodeURIComponent(clan.slug)}`,
    inviteUrl: hall.guild?.inviteUrl ?? null,
  });
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Shared by every reader of the page it is embedded in; Discord is cached for 60s behind it anyway.
      'Cache-Control': 'public, max-age=60, s-maxage=60',
      // Made to be framed anywhere — that is the point of it.
      'Content-Security-Policy': "frame-ancestors *; default-src 'none'; img-src https:; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
    },
  });
}
