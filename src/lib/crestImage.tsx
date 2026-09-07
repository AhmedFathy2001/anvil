import { ImageResponse } from 'next/og';

import { OG_CACHE_CONTROL } from '@/lib/ogCard';

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
