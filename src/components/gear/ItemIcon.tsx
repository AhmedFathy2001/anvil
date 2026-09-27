'use client';

// A small item icon from the wiki, with the slot's initial when there is none.
import type { GearItem } from '@/lib/dps/engine';
import { itemIcon } from './useGearData';

/** A small item icon, or the slot's initial when there is none. */
export function ItemIcon({ item, size = 28, fallback }: { item: GearItem | null; size?: number; fallback?: string }) {
  const src = itemIcon(item?.img);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded bg-black/30"
      style={{ width: size, height: size }}
      title={item?.n ?? fallback}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
      ) : (
        <span className="text-[10px] uppercase text-text-muted/60">{(fallback ?? '').slice(0, 2)}</span>
      )}
    </span>
  );
}
