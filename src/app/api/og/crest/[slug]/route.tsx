import { resolveClanBySlug } from '@/lib/clanContext';
import { getClanDisplayName } from '@/lib/pluginConfig';
import { clanMark, markRateLimited } from '@/lib/crestImage';
import { cardParam } from '@/lib/ogKit';

export const dynamic = 'force-dynamic';

/**
 * The clan's mark (its uploaded logo, else its crest), keyed by SLUG — for posts built server-side off the apex base URL (the webhook
 * lifecycle announcements), which only know a clan id, not the clan's own host. Same mark as the
 * by-host route; the slug is looked up, not rendered as text, so this stays a closed endpoint like
 * /api/og/clan/[slug]. An unknown slug falls back to a neutral Anvil mark rather than 404ing, so an
 * embed pointing here never shows a broken image.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const limited = await markRateLimited(request, 'crest-slug');
  if (limited) return limited;
  // A slug is short; anything longer is not one, and is not worth a lookup.
  const slug = cardParam((await params).slug, 64);
  const clan = slug ? await resolveClanBySlug(slug, new URL(request.url).searchParams.get('k') === 's' ? 'creator' : 'clan') : null; // `?k=s`: a creator space
  const name = clan ? await getClanDisplayName(clan.id, clan.name) : 'Anvil';
  return clanMark(name, clan?.logoUrl ?? null);
}
