// Server-only half of the board search (lib/tileSearch): a drop tile stores bare item ids, so its
// item names — and the boss each item drops from — are looked up here from the clog dataset and
// shipped to the client as one string. Keeps the 150KB dataset out of the browser bundle.

import clog from '@/data/clog.json';
import { parseJsonArray } from './tileKinds';

let byId: Map<number, string> | null = null;

/** Item id → "Abyssal whip Abyssal Sire" (name plus every clog page it sits on). */
function index(): Map<number, string> {
  if (byId) return byId;
  byId = new Map();
  const activities = (clog as { activities: Record<string, { id: number; name: string }[]> }).activities;
  for (const [activity, items] of Object.entries(activities)) {
    for (const item of items) {
      const prior = byId.get(item.id);
      byId.set(item.id, prior ? `${prior} ${activity}` : `${item.name} ${activity}`);
    }
  }
  return byId;
}

export function tileSearchText(tile: { trackedItemIds?: string | null; itemRequirements?: string | null }): string {
  const ids = new Set<number>(parseJsonArray<number>(tile.trackedItemIds));
  for (const req of parseJsonArray<{ itemId?: number }>(tile.itemRequirements)) {
    if (typeof req?.itemId === 'number') ids.add(req.itemId);
  }
  const lookup = index();
  return [...ids].map((id) => lookup.get(id)).filter(Boolean).join(' ');
}

/** The tiles with `searchText` filled in, for handing to a board client. */
export function withSearchText<T extends { trackedItemIds?: string | null; itemRequirements?: string | null }>(
  tiles: T[],
): (T & { searchText: string })[] {
  return tiles.map((t) => ({ ...t, searchText: tileSearchText(t) }));
}
