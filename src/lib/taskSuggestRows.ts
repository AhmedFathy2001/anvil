// The pure half of lib/taskSuggest: reading an amount off a query and turning a task-library row
// into editor fields. No database, so tests/task-suggest.test.ts can import it directly.

import type { MappingItem } from '@/lib/osrsItems';
import type { TileCsvRow } from '@/lib/csvTiles';
import type { TileConfig } from '@/lib/types';

/**
 * A leading amount in the query: "100 zulrah", "5m fishing", "2.5k slayer". Returns the number and
 * the rest of the query, or a null amount when there is none.
 */
export function splitAmount(query: string): { amount: number | null; rest: string } {
  const m = query.trim().match(/^(\d+(?:[.,]\d+)?)\s*([km])?\b\s*(.*)$/i);
  if (!m) return { amount: null, rest: query.trim() };
  const n = parseFloat(m[1].replace(',', '.'));
  const mult = m[2]?.toLowerCase() === 'm' ? 1_000_000 : m[2]?.toLowerCase() === 'k' ? 1_000 : 1;
  return { amount: Math.round(n * mult), rest: m[3] };
}

/** A library row as editor fields. Item names resolve to ids here, the same way the importer does. */
export function rowToTileConfig(row: TileCsvRow, byName: Map<string, MappingItem>): Partial<TileConfig> | null {
  const cfg: Partial<TileConfig> = {
    tileType: !row.tileType || (row.tileType as string) === 'stat' ? 'standard' : row.tileType,
    requiredAmount: row.requiredAmount ?? null,
    trackedStat: row.trackedStat ?? null,
    statType: row.statType ?? null,
    statGoal: row.statGoal ?? null,
    statBasis: row.statBasis ?? 'gain',
    targetNpcs: row.targetNpcs ?? null,
    timedActivity: row.timedActivity ?? null,
    timeThresholdSeconds: row.timeThresholdSeconds ?? null,
    trackedItemIds: null,
    itemRequirements: null,
    countMode: row.countMode ?? null,
    perKillCap: row.perKillCap ?? null,
    groupMode: row.groupMode ?? null,
    setsRequired: row.setsRequired ?? null,
  };
  if (row.items && row.items.length > 0) {
    const resolved = row.items.map((it) => {
      const hit = it.id != null ? { id: it.id, name: it.name } : byName.get(it.name.trim().toLowerCase());
      return hit ? { itemId: hit.id, name: hit.name || it.name, requiredAmount: Math.max(1, it.count || 1), group: it.group ?? null } : null;
    });
    // An item name the catalogue doesn't know would leave a tile tracking nothing — skip the task.
    if (resolved.some((r) => r == null)) return null;
    const reqs = resolved as NonNullable<(typeof resolved)[number]>[];
    cfg.tileType = row.tileType === 'gain' ? 'gain' : 'drop';
    if (row.requiredAmount != null) {
      cfg.trackedItemIds = reqs.map((r) => r.itemId);
    } else if (reqs.length === 1) {
      // One item, a count: a simple drop pool reads better than a one-item collection.
      cfg.trackedItemIds = [reqs[0].itemId];
      cfg.requiredAmount = reqs[0].requiredAmount;
    } else {
      // Several items and no total: any one of them (the seed's "any boss pet" shape).
      cfg.trackedItemIds = reqs.map((r) => r.itemId);
      cfg.requiredAmount = 1;
    }
  }
  return cfg;
}
