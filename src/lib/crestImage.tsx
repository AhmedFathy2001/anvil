import { ImageResponse } from 'next/og';

import { OG_CACHE_CONTROL } from '@/lib/ogCard';
import { configuredOrigin } from '@/lib/request-origin';

/**
 * A clan's crest as a raster image — the mark the embeds hang on the author line.
 *
 * The SAME deterministic monogram the site draws in <ClanCrest>: the initials on a hue derived from
 * the name, fixed saturation and lightness. Redrawn to a PNG because Discord will not render an SVG
 * or a data: URI as an author/thumbnail icon, so the CSS box the site uses can't be handed over.
 * Shared by both crest routes (by-host for a clan's own request context, by-slug for the webhook
 * senders that only know a clan id on the apex base).
 */
export function crestImage(name: string): ImageResponse {
  const clean = (name ?? '').trim() || 'Anvil';
  const initials =
    clean
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'A';

  // The same hue walk as <ClanCrest>: deterministic, only the hue moves.
  let h = 0;
  for (const ch of clean) h = (h * 31 + ch.charCodeAt(0)) % 360;

  const size = 128;
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `hsl(${h} 34% 44%)`,
          color: '#1c1512',
          fontFamily: 'sans-serif',
          fontSize: initials.length > 1 ? 56 : 74,
          fontWeight: 700,
          letterSpacing: -2,
        }}
      >
        {initials}
      </div>
    ),
    { width: size, height: size, headers: { 'Cache-Control': OG_CACHE_CONTROL } },
  );
}

/**
 * The clan's mark for an embed icon: its uploaded logo when it has one, else the generated crest.
 *
 * The logo is fetched and re-encoded as a 128px PNG rather than redirected to, so the icon Discord
 * caches is always a small square raster whatever was uploaded (a 4MB photo, a transparent WebP).
 * Any failure falls back to the crest — an embed pointing here never shows a broken image.
 *
 * The server fetches this, so it only ever fetches OUR media: the S3 public base, or a path on the
 * configured site origin (never the request's Host header, which a caller controls). The profile
 * route already refuses anything else on write; this re-checks on read, and refuses redirects.
 */
function logoFetchUrl(logoUrl: string): URL | null {
  const base = (process.env.S3_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  if (base && logoUrl.startsWith(`${base}/`)) return new URL(logoUrl);
  const origin = configuredOrigin();
  if (logoUrl.startsWith('/') && !logoUrl.startsWith('//') && origin) return new URL(logoUrl, origin);
  return null;
}

export async function clanMark(name: string, logoUrl: string | null | undefined): Promise<Response> {
  const target = logoUrl ? logoFetchUrl(logoUrl) : null;
  if (target) {
    try {
      const res = await fetch(target, { signal: AbortSignal.timeout(8_000), redirect: 'error' });
      if (res.ok) {
        const { default: sharp } = await import('sharp');
        const png = await sharp(Buffer.from(await res.arrayBuffer()))
          .resize(128, 128, { fit: 'cover' })
          .png()
          .toBuffer();
        return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Cache-Control': OG_CACHE_CONTROL } });
      }
    } catch {
      // Fall through to the crest.
    }
  }
  return crestImage(name);
}
