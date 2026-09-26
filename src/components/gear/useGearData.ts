'use client';

import { useEffect, useState } from 'react';

import { indexGear, type GearData, type GearIndex } from '@/lib/dps/summary';

// One fetch per page load, shared by every calculator on the page.
let pending: Promise<GearIndex> | null = null;

export function loadGearIndex(): Promise<GearIndex> {
  pending ??= fetch('/api/gear/data')
    .then((r) => {
      if (!r.ok) throw new Error(`gear data ${r.status}`);
      return r.json() as Promise<GearData>;
    })
    .then(indexGear)
    .catch((err) => {
      pending = null; // let a later mount retry
      throw err;
    });
  return pending;
}

/** Forget the cached data — after a /staff edit, so this page's calculators show the change. */
export function reloadGearIndex(): Promise<GearIndex> {
  pending = fetch('/api/gear/data', { cache: 'no-store' })
    .then((r) => r.json() as Promise<GearData>)
    .then(indexGear);
  return pending;
}

export function useGearData(): { idx: GearIndex | null; error: string | null } {
  const [idx, setIdx] = useState<GearIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadGearIndex().then(
      (i) => alive && setIdx(i),
      () => alive && setError('Could not load gear data.'),
    );
    return () => {
      alive = false;
    };
  }, []);
  return { idx, error };
}

/** The wiki's image for an item. */
export function itemIcon(img: string | undefined | null): string | null {
  return img ? `https://oldschool.runescape.wiki/images/${encodeURIComponent(img.replace(/ /g, '_'))}` : null;
}
