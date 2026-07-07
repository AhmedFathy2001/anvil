import { BOSSES, SKILL_LABELS } from './constants';

// Structural subset of a tile row that the kind/target helpers need — board clients keep
// their own narrowed Tile interfaces, so we type against the shape, not the shared Tile.
export interface TileKindLike {
  tileType?: string | null;
  trackedStat?: string | null;
  statType?: string | null;
  itemRequirements?: string | null;
}

// Human label for a tile's tracking kind — mirrors the kind picker in TileTrackingConfig.
// Collection is a drop tile that carries per-item requirements (deriveKind does the same).
export function tileKindLabel(tile: TileKindLike): string {
  switch (tile.tileType) {
    case 'drop':
      return tile.itemRequirements ? 'Collection' : 'Drop';
    case 'kill':
      return 'Kill count';
    case 'gain':
      return 'Item gain';
    case 'timed':
      return 'Timed clear';
    case 'deathless':
      return 'Deathless raid';
    case 'lms':
      return 'LMS placement';
    case 'value':
      return 'Loot value';
    case 'valuetotal':
      return 'Loot value (total)';
    case 'diary':
      return 'Diary';
    case 'ca':
      return 'Combat task';
    default:
      return tile.trackedStat ? (tile.statType === 'boss' ? 'Boss KC' : 'XP') : 'Standard';
  }
}

// A stat tile's trackedStat can hold SEVERAL hiscores keys, comma-separated ("chambersOfXeric,
// chambersOfXericChallengeMode" — CoX + CM count together). Single-key tiles are the common
// case and pass through unchanged. Gains for a composite tile are the SUM across its keys.
export function statKeys(trackedStat: string | null | undefined): string[] {
  return (trackedStat ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Human labels for a (possibly composite) trackedStat — "CoX + CoX: CM" instead of raw keys.
export function statLabel(trackedStat: string | null | undefined, statType?: string | null): string {
  return statKeys(trackedStat)
    .map((key) =>
      statType === 'boss'
        ? BOSSES.find((b) => b.key === key)?.label ?? key
        : SKILL_LABELS[key] ?? key,
    )
    .join(' + ');
}

// Safe JSON.parse for the tiles table's JSON-array text columns (targetNpcs, sourceNpcs, …).
// Some client stores keep these already parsed — pass arrays through untouched.
export function parseJsonArray<T>(raw: string | T[] | null | undefined): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
