import { markRateLimited } from '@/lib/crestImage';
import { OG_CACHE_CONTROL } from '@/lib/ogCard';
import { MAX_STOPS, MIN_STOPS, normalizeHex, type Hex } from '@/lib/supporterStyle';
import { TENURE_LADDER } from '@/lib/supporterTiers';
import { tenureStarSvg } from '@/lib/tenureStarSvg';

export const dynamic = 'force-dynamic';

/**
 * A Supporter star in someone's own name colours, for the author line of their Discord posts
 * (lib/supporterTiers withSupporterAuthor). Discord won't take an SVG or a data: URI as an icon, so
 * it is drawn to a 64px PNG like the static /icons/supporter-*.png. The path is only the colour stops
 * ("ff9a5a-e05ad0-7a8cff"), checked the same way a saved style is: no
 * text is ever rendered, and anything else is a 404. `?t=<tenure step>` adds that step's frame.
 */
export async function GET(request: Request, { params }: { params: Promise<{ stops: string }> }) {
  const limited = await markRateLimited(request, 'supporter-star');
  if (limited) return limited;
  const parts = (await params).stops.slice(0, 64).split('-');
  const stops = parts.map(normalizeHex);
  const t = new URL(request.url).searchParams.get('t');
  const step = t == null ? 'apprentice' : TENURE_LADDER.find((s) => s.id === t)?.id;
  if (!step || stops.length < MIN_STOPS || stops.length > MAX_STOPS || stops.some((h) => !h)) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  const svg = tenureStarSvg(stops as Hex[], step);
  const { default: sharp } = await import('sharp');
  const png = await sharp(Buffer.from(svg)).resize(64, 64).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Cache-Control': OG_CACHE_CONTROL } });
}
