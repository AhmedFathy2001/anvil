import { markRateLimited } from '@/lib/crestImage';
import { OG_CACHE_CONTROL } from '@/lib/ogCard';
import { MAX_STOPS, MIN_STOPS, normalizeHex, type Hex } from '@/lib/supporterStyle';

export const dynamic = 'force-dynamic';

const STAR = 'M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z';

/**
 * A Supporter star in someone's own name colours, for the author line of their Discord posts
 * (lib/supporterTiers withSupporterAuthor). Discord won't take an SVG or a data: URI as an icon, so
 * it is drawn to a 64px PNG like the static /icons/supporter-*.png. The path is only the colour stops
 * ("ff9a5a-e05ad0-7a8cff"), checked the same way a saved style is: no text is ever rendered, and
 * anything else is a 404.
 */
export async function GET(request: Request, { params }: { params: Promise<{ stops: string }> }) {
  const limited = await markRateLimited(request, 'supporter-star');
  if (limited) return limited;
  const parts = (await params).stops.slice(0, 64).split('-');
  const stops = parts.map(normalizeHex);
  if (stops.length < MIN_STOPS || stops.length > MAX_STOPS || stops.some((h) => !h)) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  const hex = stops as Hex[];
  const offsets = hex.map((h, i) => `<stop offset="${(i / Math.max(1, stops.length - 1)).toFixed(3)}" stop-color="${h}"/>`).join('');
  const paint = hex.length === 1 ? hex[0] : 'url(#g)';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0">${offsets}</linearGradient></defs><path d="${STAR}" fill="${paint}"/></svg>`;
  const { default: sharp } = await import('sharp');
  const png = await sharp(Buffer.from(svg)).resize(64, 64).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Cache-Control': OG_CACHE_CONTROL } });
}
