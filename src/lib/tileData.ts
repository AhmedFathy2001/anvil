'use client';

import { useEffect, useState } from 'react';
import { clanFetch, clanPrefixFromLocation } from '@/lib/clanFetch';
import { createJsonCache } from '@/lib/jsonCache';
import { needChecks, tileNeeds, type TileNeedsLike } from '@/lib/tileRequirements';

/**
 * The reads behind an open tile dialog, cached and prefetchable (lib/jsonCache). The URL builders
 * live here so the prefetch and the dialog always ask for exactly the same thing.
 */

const cache = createJsonCache((key) => clanFetch(key.slice(key.indexOf('|') + 1)));
/** The clan prefix is part of the key: the same path on two clans is two answers. */
const keyOf = (url: string) => `${clanPrefixFromLocation()}|${url}`;

export const tileProofUrl = (eventId: number, tileId: number, teamId: number | null) =>
  `/api/events/${eventId}/submissions?tileId=${tileId}${teamId != null ? `&teamId=${teamId}` : ''}&limit=500`;
export const tileReadinessUrl = (eventId: number, tileId: number) => `/api/events/${eventId}/tiles/${tileId}/readiness`;
export const racePickUrl = (eventId: number, teamId: number) => `/api/events/${eventId}/race-pick?teamId=${teamId}`;

export function peekTileData<T>(url: string): T | undefined {
  return cache.peek<T>(keyOf(url));
}

export function loadTileData<T>(url: string): Promise<T | undefined> {
  return cache.load<T>(keyOf(url));
}

export function forgetTileData(url: string): void {
  cache.drop(keyOf(url));
}

export function prefetchTileData(url: string): void {
  cache.prefetch(keyOf(url));
}

/** What a tile will ask for when opened — the hover/focus "intent" warms exactly this. */
export function prefetchTileDialog(opts: { eventId: number; tile: TileNeedsLike & { id: number }; teamId: number | null; race?: boolean; skipProof?: boolean }) {
  if (!opts.skipProof) prefetchTileData(tileProofUrl(opts.eventId, opts.tile.id, opts.teamId));
  if (needChecks(tileNeeds(opts.tile)).length > 0) prefetchTileData(tileReadinessUrl(opts.eventId, opts.tile.id));
  if (opts.race && opts.teamId != null) prefetchTileData(racePickUrl(opts.eventId, opts.teamId));
}

/**
 * `url` read through the cache: the cached value at once when there is one, the fresh one when it
 * lands, and the previous value kept (never blanked) while a refetch runs. `undefined` until the
 * first answer, or `fallback` when the read fails. Pass null to skip.
 */
export function useTileData<T>(url: string | null, fallback?: T): T | undefined {
  const [got, setGot] = useState<{ url: string; data: T } | null>(null);
  useEffect(() => {
    if (!url) return;
    let gone = false;
    cache.load<T>(keyOf(url)).then((d) => {
      if (gone) return;
      if (d !== undefined) setGot({ url, data: d });
      else if (fallback !== undefined) setGot((prev) => (prev?.url === url ? prev : { url, data: fallback }));
    });
    return () => {
      gone = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  if (!url) return undefined;
  if (got && got.url === url) return got.data;
  return peekTileData<T>(url);
}
