import { currentClan } from '@/lib/clanContext';
import { clanVisibilityOf } from '@/lib/clanVisibility';
import { clanHallView, hallConfig } from '@/lib/clanHall';
import { renderBadgeSvg } from '@/lib/discordEmbedRender';

export const dynamic = 'force-dynamic';

/**
 * `/c/<slug>/api/discord/badge` — a small SVG for places that won't take an iframe (forums, READMEs).
 * `?show=game` shows who's in game rather than who's on Discord. Same gate as the embed.
 */
export async function GET(request: Request) {
  const clan = await currentClan();
  if (!clan || clanVisibilityOf(clan.visibility) !== 'public') return new Response('Not found', { status: 404 });
  const config = await hallConfig(clan.id);
  if (!config.embed) return new Response('Not found', { status: 404 });
  const hall = await clanHallView(clan.id, { includeNames: false });
  if (!hall) return new Response('Not found', { status: 404 });

  const show = new URL(request.url).searchParams.get('show');
  const value = show === 'game' ? `${hall.counts.inGame} in game` : `${hall.counts.discord} on Discord`;
  return new Response(renderBadgeSvg(clan.name, value), {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=60',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}
