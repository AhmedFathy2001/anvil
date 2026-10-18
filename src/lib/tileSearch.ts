// The board search: a tile matches when every word of the query appears somewhere in what the
// tile IS, not only its name. Names are often jokes ("Big hilt energy"), so a member searching
// "graardor" or "twisted bow" or "timed zulrah" still finds it. Client-safe; item names the
// tile only knows by id come in precomputed as `searchText` (lib/tileSearchText, server-only).

import { parseJsonArray, statLabel, tileKindLabel, tileKindKey, type TileKindLike } from './tileKinds';

export interface SearchableTile extends TileKindLike {
  label: string;
  description?: string | null;
  category?: string | null;
  position?: number | null;
  sourceNpcs?: string | null;
  timedActivity?: string | null;
  /** Item names and their clog sources, resolved on the server from the tile's item ids. */
  searchText?: string | null;
}

/** What a player might type for a kind, beyond its label ("kc" for a boss tile). */
const KIND_WORDS: Partial<Record<string, string>> = {
  boss: 'boss kc bosses',
  skill: 'skill xp skilling',
  drop: 'drop drops',
  collection: 'drop drops set sets item set collection',
  kill: 'kill kills kc',
  lap: 'laps agility',
  pvp: 'pvp pk',
  gain: 'gain gather',
  timed: 'timed time speedrun',
  value: 'value gp loot value',
  diary: 'diary diaries achievement diary',
  ca: 'ca cas combat achievement',
  standard: 'manual',
};

export function normalizeSearch(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Everything the search looks through for one tile, normalised. */
export function tileSearchHaystack(tile: SearchableTile): string {
  const reqs = parseJsonArray<{ name?: string | null; group?: string | null }>(tile.itemRequirements);
  const kind = tileKindKey(tile);
  return normalizeSearch(
    [
      tile.label,
      tile.description,
      tile.category,
      tile.trackedStat,
      tile.trackedStat ? statLabel(tile.trackedStat, tile.statType) : null,
      ...parseJsonArray<string>(tile.sourceNpcs),
      ...parseJsonArray<string>(tile.targetNpcs),
      tile.timedActivity,
      ...reqs.flatMap((r) => [r?.name, r?.group]),
      tileKindLabel(tile),
      KIND_WORDS[kind],
      tile.searchText,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

/** True when every word of `query` is in the tile; "#12" also finds the tile at position 12. */
export function tileMatchesSearch(tile: SearchableTile, query: string): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  if (tile.position != null && /^#?\d+$/.test(query.trim()) && String(tile.position + 1) === q) return true;
  const haystack = tileSearchHaystack(tile);
  return q.split(' ').every((word) => haystack.includes(word));
}
