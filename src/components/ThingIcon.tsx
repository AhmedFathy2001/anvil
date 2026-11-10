'use client';

import { cn } from '@/lib/utils';

/**
 * The small icon at the left of a picker row or chip: an item sprite, a boss sprite, a skill icon —
 * whatever lib/tileIcons derives for the thing, through our own asset cache. A fixed square so rows
 * line up, lazy so a long result list doesn't fetch every sprite at once, and a quiet empty square
 * when there is no icon.
 */
export default function ThingIcon({ src, alt, size = 24, className }: { src: string | null | undefined; alt: string; size?: number; className?: string }) {
  if (!src) return <span aria-hidden className={cn('inline-block shrink-0 rounded bg-card-border/60', className)} style={{ width: size, height: size }} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={cn('shrink-0 object-contain', className)}
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
    />
  );
}
