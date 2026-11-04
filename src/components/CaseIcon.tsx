'use client';

import { useEffect, useRef, useState } from 'react';

// An item / boss icon for the display case and its picker. Icons are read through to RuneLite's
// cache on a miss (/img/item), and a page that asks for dozens at once can lose one on first load —
// so a failed icon is retried once with a cache-busting `?r=1`, and if that fails too a plain tile of
// the same size takes its place instead of the browser's broken-image glyph.

export function retryIconUrl(src: string): string {
  return `${src}${src.includes('?') ? '&' : '?'}r=1`;
}

export default function CaseIcon({
  src,
  width,
  height,
  className = '',
}: {
  src: string;
  width: number;
  height: number;
  className?: string;
}) {
  // Keyed to the source, so a new icon starts over without an effect to reset it.
  const [failed, setFailed] = useState<{ src: string; attempt: 1 | 2 } | null>(null);
  const attempt = failed?.src === src ? failed.attempt : 0;
  const ref = useRef<HTMLImageElement>(null);

  const fail = () => setFailed((f) => ({ src, attempt: f?.src === src && f.attempt >= 1 ? 2 : 1 }));

  // A server-rendered <img> can fail before React is listening, and then onError never fires.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) fail();
    // Only on mount and when the source changes: a retry sets its own listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  if (attempt === 2) {
    return <span aria-hidden="true" style={{ width, height }} className={`inline-block rounded bg-card-border/40 ${className}`} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={attempt === 1 ? retryIconUrl(src) : src}
      alt=""
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      onError={fail}
      className={`[image-rendering:pixelated] ${className}`}
    />
  );
}
