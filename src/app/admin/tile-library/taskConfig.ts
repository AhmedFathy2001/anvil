import type { TileCsvRow } from '@/lib/csvTiles';
import type { ItemRequirement, TileConfig } from '@/lib/types';
import { clanFetch } from '@/lib/clanFetch';

// Bridging the two shapes a task lives in.
//
// Storage keeps the canonical TileCsvRow (what the importer consumes when a task is drawn onto a
// board), while the tile editor works in TileConfig (resolved item ids, parsed arrays). Rather than
// storing both and letting them drift, we convert on the way in and out — and the only lossy step,
// item NAME → item id, is resolved through the same search endpoint the editor's own picker uses.

const EMPTY: TileConfig = {
  label: '',
  description: null,
  tileType: 'standard',
  requiredAmount: null,
  trackedStat: null,
  statType: null,
  statGoal: null,
  trackingMode: 'team',
  optional: false,
  autoTrackDisabled: false,
  trackedItemIds: null,
  itemRequirements: null,
  points: 1,
  category: null,
  sourceNpcs: null,
  targetNpcs: null,
  timedActivity: null,
  timeThresholdSeconds: null,
  partySize: null,
  mission: false,
  missionRules: null,
  updatedAt: null,
};

/** A blank task, for "New task". */
export function blankTileConfig(): TileConfig {
  return { ...EMPTY };
}

function asArray(v: unknown): string[] | null {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string' && v.trim()) return v.split(',').map((s) => s.trim()).filter(Boolean);
  return null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/**
 * Stored task → editable TileConfig. Item names are resolved to ids one lookup at a time; an item
 * that can't be resolved is dropped rather than saved as a broken reference, since a tile pointing
 * at item #0 would silently never complete.
 */
export async function toTileConfig(
  row: TileCsvRow,
  fallback: { label: string; points: number; category: string | null; description: string | null },
): Promise<TileConfig> {
  const reqs: ItemRequirement[] = [];
  const items = Array.isArray(row.items) ? row.items : [];
  for (const it of items) {
    const count = it.count ?? 1;
    if (it.id) {
      reqs.push({ itemId: it.id, name: it.name || `Item #${it.id}`, requiredAmount: count, group: it.group ?? null, groupRequire: it.groupRequire ?? null });
      continue;
    }
    if (!it.name) continue;
    try {
      const res = await clanFetch(`/api/admin/items-search?q=${encodeURIComponent(it.name)}`);
      const results: { id: number; name: string }[] = res.ok ? await res.json() : [];
      const hit =
        results.find((r) => r.name.toLowerCase() === it.name.toLowerCase()) ?? results[0] ?? null;
      if (hit) reqs.push({ itemId: hit.id, name: hit.name, requiredAmount: count, group: it.group ?? null, groupRequire: it.groupRequire ?? null });
    } catch {
      /* unresolvable — skip it rather than persist a dead id */
    }
  }

  return {
    ...EMPTY,
    label: row.label ?? fallback.label,
    description: row.description ?? fallback.description,
    tileType: row.tileType || 'standard',
    requiredAmount: asNumber(row.requiredAmount),
    trackedStat: row.trackedStat ?? null,
    statType: row.statType ?? null,
    statGoal: asNumber(row.statGoal),
    optional: !!row.optional,
    points: asNumber(row.points) ?? fallback.points,
    category: row.category ?? fallback.category,
    targetNpcs: asArray(row.targetNpcs),
    timedActivity: row.timedActivity ?? null,
    timeThresholdSeconds: asNumber(row.timeThresholdSeconds),
    itemRequirements: reqs.length ? reqs : null,
    trackedItemIds: reqs.length ? reqs.map((r) => r.itemId) : null,
    groupMode: row.groupMode === 'all' ? 'all' : null,
    perKillCap: asNumber(row.perKillCap),
    coopCredit: row.coopCredit === 'per-kill' ? 'per-kill' : null,
    coopMinMembers: asNumber(row.coopMinMembers),
  };
}

/**
 * The editor's save payload → a stored TileCsvRow. Item ids ride along with their names so a later
 * read doesn't have to re-resolve, and the importer prefers the id when both are present.
 */
export function payloadToCsvRow(payload: Record<string, unknown>): TileCsvRow {
  const reqs = (payload.itemRequirements as ItemRequirement[] | null) ?? null;
  const ids = (payload.trackedItemIds as number[] | null) ?? null;

  const items = reqs?.length
    ? reqs.map((r) => ({
        name: r.name,
        count: r.requiredAmount ?? 1,
        id: r.itemId,
        group: r.group ?? undefined,
        groupRequire: r.groupRequire ?? undefined,
      }))
    : ids?.length
      ? ids.map((id) => ({ name: '', count: 1, id }))
      : null;

  const row: TileCsvRow = {
    label: (payload.label as string) ?? '',
    description: (payload.description as string | null) ?? null,
    tileType: (payload.tileType as string) || 'standard',
    requiredAmount: (payload.requiredAmount as number | null) ?? null,
    points: (payload.points as number | null) ?? null,
    category: (payload.category as string | null) ?? null,
    optional: !!payload.optional,
    trackedStat: (payload.trackedStat as string | null) ?? null,
    statType: (payload.statType as string | null) ?? null,
    statGoal: (payload.statGoal as number | null) ?? null,
    targetNpcs: (payload.targetNpcs as string[] | null) ?? null,
    timedActivity: (payload.timedActivity as string | null) ?? null,
    timeThresholdSeconds: (payload.timeThresholdSeconds as number | null) ?? null,
    items,
    // Only stored when it isn't the default, so a plain collection's library row is unchanged.
    groupMode: payload.groupMode === 'all' ? 'all' : null,
    perKillCap: (payload.perKillCap as number | null) ?? null,
    coopCredit: payload.coopCredit === 'per-kill' ? 'per-kill' : null,
    coopMinMembers: (payload.coopMinMembers as number | null) ?? null,
  };

  // Drop empties so a stored task stays readable as a seed pack.
  (Object.keys(row) as (keyof TileCsvRow)[]).forEach((k) => {
    const v = row[k];
    if (v === null || v === undefined || v === '' || v === false) delete row[k];
  });
  return row;
}
