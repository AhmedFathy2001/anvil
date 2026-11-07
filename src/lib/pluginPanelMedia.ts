import { logoFetchUrl } from '@/lib/crestImage';

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
/** A 220×73/48×48 panel asset should stay tiny even when animated. */
const MAX_PANEL_BYTES = 512 * 1024;
const CACHE = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';

/** Our uploads, plus the one external image host a profile may legitimately inherit from OAuth. */
function panelImageUrl(url: string): URL | null {
  const own = logoFetchUrl(url);
  if (own) return own;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' && parsed.hostname === 'cdn.discordapp.com' && /^\/avatars\/\d+\/[A-Za-z0-9_]+\.(?:png|gif)$/.test(parsed.pathname)) {
      return parsed;
    }
  } catch {
    // Invalid URL: handled as a missing image below.
  }
  return null;
}

/** Fetch one of our uploads and turn it into an exact, small panel asset. */
export async function pluginPanelImage(url: string, width: number, height: number, motion: boolean, focus = false): Promise<Response> {
  const target = panelImageUrl(url);
  if (!target) return new Response('Not found', { status: 404 });
  try {
    const upstream = await fetch(target, { signal: AbortSignal.timeout(8_000), redirect: 'error' });
    const declared = Number(upstream.headers.get('content-length') ?? 0);
    if (!upstream.ok || declared > MAX_SOURCE_BYTES) return new Response('Not found', { status: 404 });
    const input = Buffer.from(await upstream.arrayBuffer());
    if (input.length > MAX_SOURCE_BYTES) return new Response('Not found', { status: 404 });
    const { default: sharp } = await import('sharp');
    const still = () => sharp(input, { animated: false, limitInputPixels: 4096 * 4096 })
      .resize(width, height, { fit: 'cover', position: focus ? 'attention' : 'centre' })
      .jpeg({ quality: 82 })
      .toBuffer();
    if (motion) {
      const animated = await sharp(input, { animated: true, limitInputPixels: 80_000_000 })
        .resize(width, height, { fit: 'cover', position: focus ? 'attention' : 'centre' })
        // Loop forever explicitly: libvips otherwise copies the upload's loop count, and Java's GIF
        // decoder plays a file without an infinite NETSCAPE loop once and then stops.
        .gif({ colours: 96, effort: 4, loop: 0 })
        .toBuffer();
      if (animated.length <= MAX_PANEL_BYTES) {
        return new Response(new Uint8Array(animated), { headers: { 'Content-Type': 'image/gif', 'Cache-Control': CACHE } });
      }
    }
    const image = await still();
    return new Response(new Uint8Array(image), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': CACHE } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
