// A space's or clan's accent (lib/artPalette) as CSS custom properties, set on a page's root so
// anything inside can use it — `bg-[var(--sa)]`, `text-[var(--sa-text)]` — without each component
// being handed a colour. Pure.
//
//   --sa       the colour as picked: fills, borders, buttons
//   --sa-text  readable as text on the dark page (lightened when the pick is too dark)
//   --sa-ink   text ON an --sa fill (dark or white, whichever reads)
//   --sa-soft  a low-alpha tint for chips and soft panels
//   --sa-deep  the colour sunk into the page ground, for banners without an image

import type { CSSProperties } from 'react';

import { accentTokens } from '@/lib/artPalette';

/** Anvil's own gold: what a space that never picked a colour looks like, exactly as before. */
export const DEFAULT_ACCENT = '#e0aa1e';

export function accentStyle(hex: string | null | undefined): CSSProperties {
  const t = accentTokens(hex ?? DEFAULT_ACCENT);
  return {
    '--sa': t.accent,
    '--sa-text': t.text,
    '--sa-ink': t.ink,
    '--sa-soft': t.soft,
    '--sa-deep': t.deep,
  } as CSSProperties;
}
