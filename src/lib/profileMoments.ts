// A profile's "Lately" list, tidied. The store keeps generously (event luck counts every stack, a board
// files its own copy of a log slot), which is right for scoring and wrong for a person's own page: one
// Zul-andra teleport read as three rows, and a Zulrah trip as a column of scale stacks.
//
// Pure: no database. lib/moments decides what is worth a line; this only merges and drops rows.

import { isEventFeedWorthy } from '@/lib/moments';
import { stampMs } from '@/lib/feedRuns';

export interface TidyRow {
  id: number;
  kind: string;
  itemId: number | null;
  itemName: string | null;
  quantity: number;
  valueGp?: number | null;
  source: string | null;
  kc: number | null;
  occurredAt: string;
}

/** Two sightings of one drop: the loot, its collection-log line, a board's copy of either. */
const SAME_DROP_MS = 120_000;
/** One opening of a chest hands its items over together. */
const SAME_CHEST_MS = 60_000;
/** Plain loot under this is a filler on a profile, unless it filled a new log slot. */
const FILLER_BELOW_GP = 1_000_000;

const isDrop = (k: string) => k === 'unique' || k === 'loot' || k === 'clog' || k === 'pet';
const sameItem = (a: TidyRow, b: TidyRow) =>
  (a.itemId != null && a.itemId === b.itemId) || (!!a.itemName && a.itemName.toLowerCase() === (b.itemName ?? '').toLowerCase());
/** The fuller of two rows about one drop: a source and a kill count beat a bare log line. */
const weight = (r: TidyRow) => (r.kc != null && r.kc > 0 ? 4 : 0) + (r.source ? 2 : 0) + (r.kind === 'clog' ? 0 : 1);
const isChest = (r: TidyRow) => !!r.source && /chest/i.test(r.source) && (r.kind === 'unique' || r.kind === 'loot');

function joinNames(names: string[]): string {
  return names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * `rows` newest first, as the store returns them. Returns the same order with:
 *  - common stacks that are neither a log slot nor worth a line dropped (lib/moments isEventFeedWorthy);
 *  - one row per drop, where the same item was filed twice within two minutes (the fuller row is kept);
 *  - the items of one chest opening on one row, named together.
 */
export function tidyProfileMoments<T extends TidyRow>(rows: readonly T[]): T[] {
  const merged: T[] = [];
  /** Rows that met their own collection-log line: a new slot, worth its line whatever it sells for. */
  const newSlot = new Set<number>();
  for (const row of rows) {
    if (!isEventFeedWorthy(row)) continue;
    if (isDrop(row.kind)) {
      const at = stampMs(row.occurredAt);
      const i = merged.findIndex((k) => isDrop(k.kind) && sameItem(k, row) && Math.abs(stampMs(k.occurredAt) - at) <= SAME_DROP_MS);
      if (i >= 0) {
        const slot = row.kind === 'clog' || merged[i].kind === 'clog' || newSlot.has(merged[i].id);
        if (weight(row) > weight(merged[i])) merged[i] = row;
        if (slot) newSlot.add(merged[i].id);
        continue;
      }
    }
    merged.push(row);
  }
  // Ordinary loot off a boss that happens to have a log slot (scale stacks, the tenth teleport scroll):
  // kept by the store for luck and tiles, a filler here. A million's worth still gets its line.
  const kept = merged.filter((r) => r.kind !== 'loot' || newSlot.has(r.id) || (r.valueGp ?? 0) >= FILLER_BELOW_GP);
  const out: T[] = [];
  for (const row of kept) {
    const prev = out[out.length - 1];
    if (prev && isChest(prev) && isChest(row) && prev.source === row.source
      && Math.abs(stampMs(prev.occurredAt) - stampMs(row.occurredAt)) <= SAME_CHEST_MS && prev.itemName && row.itemName) {
      const names = [...(prev as T & { chest?: string[] }).chest ?? [prev.itemName], row.itemName];
      const lead = (row.valueGp ?? 0) > (prev.valueGp ?? 0) ? row : prev;
      out[out.length - 1] = {
        ...prev,
        itemId: lead.itemId,
        itemName: joinNames(names),
        quantity: 1,
        valueGp: (prev.valueGp ?? 0) + (row.valueGp ?? 0),
        chest: names,
      } as T;
      continue;
    }
    out.push(row);
  }
  return out;
}
