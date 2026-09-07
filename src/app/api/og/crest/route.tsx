import { ImageResponse } from 'next/og';

import { requireClanFromRequest } from '@/lib/clanContext';
import { OG_CACHE_CONTROL } from '@/lib/ogCard';

export const dynamic = 'force-dynamic';

/**
 * The clan's crest, as a raster image — for the author icon on the Discord embeds.
 *
 * Discord will not render an SVG or a data: URI as an author/thumbnail icon, so the monogram the
 * site draws in <ClanCrest> (a CSS box) cannot be handed over as-is. This redraws the SAME mark —
 * the initials, on the same deterministic hue derived from the name — to a PNG, so a clan wears one
 * identity on the web and in chat, with nothing stored or chosen.
 *
 * NO CALLER-SUPPLIED TEXT. The name is the clan THIS HOST resolves to, never a query parameter — the
 * same rule ogCard follows, so this can't become an open text-render endpoint on a clan's domain.
 */
export async function GET(request: Request) {
  let name = 'Anvil';
  try {
    name = (await requireClanFromRequest(request)).name || 'Anvil';
  } catch {
    // Unknown host (the apex, or a clan with no site of its own) — a neutral mark beats erroring,
    // so an embed that points here never shows a broken image.
  }

  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'A';

  // The same hue walk as <ClanCrest>: deterministic, fixed saturation/lightness, only the hue moves.
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;

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
