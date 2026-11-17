'use client';

import { useEffect, useRef, useState } from 'react';
import { hubKind } from '@/lib/hubKinds';
import type { HubKind } from '@/lib/eventsHub';

/**
 * The square at the head of a competition, wherever one is listed (the events rows, the public
 * clan home's finished cards): the competition's own picture (an event's icon or its clan's logo),
 * else the metric's sprite (a skill or a boss), else the format's glyph, on the format's colour.
 *
 * One component so every list draws the same thing from the same fields (lib/eventCards and
 * lib/weeklyCards `iconUrl`). Decorative: the name and the kind are always written beside it.
 * The box is a fixed 40px, so nothing moves while the image loads, and an image that fails to
 * load gives way to the glyph instead of the browser's broken-image mark.
 */
export default function CompetitionBadge({
  kind,
  pictureUrl,
  iconUrl,
}: {
  kind: HubKind;
  /** The competition's own picture, drawn edge to edge. */
  pictureUrl?: string | null;
  /** The metric's sprite, drawn small in the middle. */
  iconUrl?: string | null;
}) {
  const meta = hubKind(kind);
  const src = pictureUrl || iconUrl || null;
  // Keyed to the source, so a new picture starts over without an effect to reset it.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const ref = useRef<HTMLImageElement>(null);

  // A server-rendered <img> can fail before React is listening, and then onError never fires.
  useEffect(() => {
    const img = ref.current;
    if (img && src && img.complete && img.naturalWidth === 0) setFailedSrc(src);
  }, [src]);

  return (
    <span
      aria-hidden
      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border text-base"
      style={{
        background: `color-mix(in srgb, ${meta.accent} 16%, transparent)`,
        borderColor: `color-mix(in srgb, ${meta.accent} 38%, transparent)`,
      }}
    >
      {src && failedSrc !== src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={ref}
          src={src}
          alt=""
          onError={() => setFailedSrc(src)}
          className={pictureUrl ? 'h-full w-full rounded-[7px] object-cover' : 'h-5 w-5 object-contain'}
        />
      ) : (
        meta.emoji
      )}
    </span>
  );
}
