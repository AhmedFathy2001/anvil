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

/**
 * The cover crop for a `W`x`H` source into `w`x`h`: scale so both sides cover, centre horizontally,
 * and place vertically at `position` percent (0 top … 100 bottom) — the banner focal point a person or
 * clan set on the site, so the panel shows the same part of the picture as their profile.
 */
export function coverCrop(W: number, H: number, w: number, h: number, position: number | null | undefined) {
  const k = Math.max(w / W, h / H);
  const rw = Math.max(w, Math.round(W * k));
  const rh = Math.max(h, Math.round(H * k));
  const p = typeof position === 'number' && position >= 0 && position <= 100 ? position : 50;
  return { rw, rh, left: Math.round((rw - w) / 2), top: Math.round(((rh - h) * p) / 100) };
}

/**
 * Fetch one of our uploads and turn it into an exact, small panel asset. `position` is a banner's
 * vertical focal point (null: centred). The crop is done by hand rather than with sharp's
 * 'attention' strategy, which sharp refuses for animated images: every animated banner that needed
 * cropping (anything not already 3:1) failed and the panel showed nothing.
 */
export async function pluginPanelImage(url: string, width: number, height: number, motion: boolean, position: number | null = null): Promise<Response> {
  const target = panelImageUrl(url);
  if (!target) return new Response('Not found', { status: 404 });
  try {
    const upstream = await fetch(target, { signal: AbortSignal.timeout(8_000), redirect: 'error' });
    const declared = Number(upstream.headers.get('content-length') ?? 0);
    if (!upstream.ok || declared > MAX_SOURCE_BYTES) return new Response('Not found', { status: 404 });
    const input = Buffer.from(await upstream.arrayBuffer());
    if (input.length > MAX_SOURCE_BYTES) return new Response('Not found', { status: 404 });
    const { default: sharp } = await import('sharp');
    const meta = await sharp(input, { animated: false, limitInputPixels: 4096 * 4096 }).metadata();
    const W = meta.width ?? 0;
    const H = meta.pageHeight ?? meta.height ?? 0;
    if (W <= 0 || H <= 0) return new Response('Not found', { status: 404 });
    const crop = coverCrop(W, H, width, height, position);
    const cut = { left: crop.left, top: crop.top, width, height };
    const still = () => sharp(input, { animated: false, limitInputPixels: 4096 * 4096 })
      .resize(crop.rw, crop.rh, { fit: 'fill' })
      .extract(cut)
      // PNG, not JPEG: a transparent logo flattened onto black vanishes against the dark panel.
      .png({ palette: true, quality: 90, effort: 7 })
      .toBuffer();
    if (motion) {
      const animated = await sharp(input, { animated: true, limitInputPixels: 80_000_000 })
        .resize(crop.rw, crop.rh, { fit: 'fill' })
        .extract(cut)
        // Loop forever explicitly: libvips otherwise copies the upload's loop count, and Java's GIF
        // decoder plays a file without an infinite NETSCAPE loop once and then stops.
        // Inter-frame/palette reuse: a 60-frame 1500x500 banner was 763 KB at 220x73 (over the cap, so
        // the panel silently got the still) and is ~200 KB with it. Fewer colours alone saved nothing.
        .gif({ colours: 96, effort: 7, loop: 0, interFrameMaxError: 8, interPaletteMaxError: 8 })
        .toBuffer();
      if (animated.length <= MAX_PANEL_BYTES) {
        return new Response(new Uint8Array(animated), { headers: { 'Content-Type': 'image/gif', 'Cache-Control': CACHE } });
      }
    }
    const image = await still();
    return new Response(new Uint8Array(image), { headers: { 'Content-Type': 'image/png', 'Cache-Control': CACHE } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
