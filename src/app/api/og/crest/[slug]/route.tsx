import { resolveClanBySlug } from '@/lib/clanContext';
import { getClanDisplayName } from '@/lib/pluginConfig';
import { crestImage } from '@/lib/crestImage';

export const dynamic = 'force-dynamic';

/**
 * The clan's crest, keyed by SLUG — for posts built server-side off the apex base URL (the webhook
 * lifecycle announcements), which only know a clan id, not the clan's own host. Same mark as the
 * by-host route; the slug is looked up, not rendered as text, so this stays a closed endpoint like
 * /api/og/clan/[slug]. An unknown slug falls back to a neutral Anvil mark rather than 404ing, so an
 * embed pointing here never shows a broken image.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clan = await resolveClanBySlug(slug);
  const name = clan ? await getClanDisplayName(clan.id, clan.name) : 'Anvil';
  return crestImage(name);
}
