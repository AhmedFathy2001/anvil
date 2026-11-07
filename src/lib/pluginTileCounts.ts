/**
 * `tiles` on the plugin config: one count per tracked tile, the only thing the plugin's panel (its
 * live counts) and pinned tracker (a combo's part lines) read about a tile's progress. It replaces the
 * plugin scanning every `tracked*` list for `currentAmount`; those lists stay for older plugins and for
 * the kinds the plugin still credits itself.
 *
 * Mirrors what that scan saw: the highest count across a tile's rows, the goal off its first row, and a
 * set / collection drop tile (item requirements) marked `set`, since it counts pieces rather than the
 * best set the panel shows. Value and combo tiles carry no count there and none here.
 */
export interface PluginTileCount {
  t: number;
  have: number;
  of: number;
  set?: true;
}

const COUNTED = [
  'trackedDrops', 'trackedKills', 'trackedPvp', 'trackedDiaries', 'trackedCombatTasks', 'trackedClog',
  'trackedLms', 'trackedGains', 'trackedDeathless', 'trackedTimed', 'trackedStats',
] as const;

interface Row {
  tileId?: unknown;
  currentAmount?: unknown;
  requiredAmount?: unknown;
  goalAmount?: unknown;
  itemRequirements?: unknown[] | null;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function pluginTileCounts(cfg: Record<string, unknown>): PluginTileCount[] {
  const byId = new Map<number, PluginTileCount>();
  for (const key of COUNTED) {
    const rows = cfg[key];
    if (!Array.isArray(rows)) continue;
    for (const r of rows as (Row | null)[]) {
      const t = num(r?.tileId);
      if (!r || t === null) continue;
      // A timed tile without a run count is a plain one-clear tile: no count to show.
      const have = num(r.currentAmount) ?? (key === 'trackedTimed' ? null : 0);
      if (have === null) continue;
      const prev = byId.get(t);
      const row: PluginTileCount = prev ?? { t, have, of: num(r.requiredAmount) ?? num(r.goalAmount) ?? 0 };
      row.have = Math.max(row.have, have);
      if (r.itemRequirements?.length) row.set = true;
      byId.set(t, row);
    }
  }
  return [...byId.values()];
}

/** The config with its `tiles` filled in from its tracked lists (in place). */
export function withTileCounts<T>(body: T): T {
  const b = body as unknown as Record<string, unknown>;
  b.tiles = pluginTileCounts(b);
  return body;
}
