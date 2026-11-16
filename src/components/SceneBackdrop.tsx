import type { CSSProperties } from 'react';
import type { Scene } from '@/lib/scenes';

/** The clan's accent where a page set one (lib/accentStyle), else Anvil's gold. */
const ACCENT = 'var(--sa, #d4af37)';
const tint = (pct: number) => `color-mix(in srgb, ${ACCENT} ${pct}%, transparent)`;

/**
 * Backdrop art behind a card's text (lib/scenes), built from the game's own art in the CLAN'S colour:
 *
 *   - a wash of the accent from the art's side, and fine diagonal lines of it across the card;
 *   - a skill: its icon blown up into a tilted emblem, cut out in the accent (a silhouette, so it
 *     takes any colour the clan picks), with the real icon over it on a wide card;
 *   - a boss: its render standing at the right edge, lit from behind in the accent.
 *
 * The card's own dark runs in from the left, where the words are. `wide` is a hero or a lead card.
 */
export default function SceneBackdrop({ scene, wide = false, tone = '#14100f' }: { scene: Scene; wide?: boolean; tone?: string }) {
  const mask: CSSProperties = {
    backgroundColor: ACCENT,
    WebkitMaskImage: `url("${scene.url}")`,
    maskImage: `url("${scene.url}")`,
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    imageRendering: 'pixelated',
  };
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      <span
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(75% 130% at 90% 45%, ${tint(42)} 0%, ${tint(14)} 38%, transparent 68%), repeating-linear-gradient(135deg, ${tint(10)} 0 2px, transparent 2px 20px)`,
        }}
      />
      {scene.kind === 'emblem' ? (
        <>
          {/* Sized so the shape still reads as the icon: bigger than the card on a hero, about its height on a small one. */}
          <span
            className={`absolute top-1/2 aspect-square -translate-y-1/2 -rotate-12 opacity-30 ${wide ? '-right-[4%] h-[150%]' : '-right-[8%] h-[118%]'}`}
            style={mask}
          />
          {wide && (
            // eslint-disable-next-line @next/next/no-img-element -- cached game art (lib/assetUrls), decorative
            <img
              src={scene.url}
              alt=""
              loading="lazy"
              className="absolute right-[9%] top-1/2 h-[58%] w-auto -translate-y-1/2 -rotate-6 object-contain [image-rendering:pixelated]"
              style={{ filter: `drop-shadow(0 6px 18px rgba(0,0,0,0.55)) drop-shadow(0 0 22px ${tint(55)})` }}
            />
          )}
        </>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- cached game art (lib/assetUrls), decorative
        <img
          src={scene.url}
          alt=""
          loading="lazy"
          className="absolute bottom-0 right-0 h-[128%] w-auto max-w-[60%] object-contain object-right-bottom opacity-90"
          style={{ filter: `drop-shadow(0 0 26px ${tint(60)})` }}
        />
      )}
      <span className="absolute inset-0" style={{ backgroundImage: `linear-gradient(90deg, ${tone} 0%, ${tone}e0 38%, ${tone}66 70%, transparent 100%)` }} />
    </span>
  );
}
