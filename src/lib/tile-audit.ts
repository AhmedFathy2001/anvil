/**
 * Tile change history. Records who created / updated / deleted / imported / reordered a tile,
 * and (for edits) the exact old→new field diff, into `tile_audit_log`. The event's Tiles tab
 * renders these as a timeline.
 *
 * Writes are fire-and-forget (`.catch(() => {})`) like clan_audit_log — an audit failure must
 * never break the actual tile mutation. Callers pass the acting user from verifyTileEditor().
 */
import { db } from '@/db';
import { tileAuditLog, type tiles } from '@/db/schema';

type TileRow = typeof tiles.$inferSelect;

export type TileAuditAction = 'created' | 'updated' | 'deleted' | 'imported' | 'reordered';

export interface FieldChange {
  field: string;
  label: string;
  from: unknown;
  to: unknown;
}

// The tile columns worth showing in history, with human labels. JSON columns are compared as
// normalised strings so a re-serialisation with the same contents doesn't read as a change.
const AUDITED_FIELDS: { key: keyof TileRow; label: string; json?: boolean }[] = [
  { key: 'label', label: 'Title' },
  { key: 'description', label: 'Description' },
  { key: 'icon', label: 'Icon' },
  { key: 'tileType', label: 'Type' },
  { key: 'points', label: 'Points' },
  { key: 'requiredAmount', label: 'Required amount' },
  { key: 'trackedStat', label: 'Tracked stat' },
  { key: 'statType', label: 'Stat type' },
  { key: 'statGoal', label: 'Stat goal' },
  { key: 'trackingMode', label: 'Tracking mode' },
  { key: 'optional', label: 'Optional' },
  { key: 'category', label: 'Category' },
  { key: 'position', label: 'Board position' },
  { key: 'timedActivity', label: 'Timed activity' },
  { key: 'timeThresholdSeconds', label: 'Time cap (s)' },
  { key: 'partySize', label: 'Party size' },
  { key: 'trackedItemIds', label: 'Tracked items', json: true },
  { key: 'itemRequirements', label: 'Item requirements', json: true },
  { key: 'acceptedSources', label: 'Accepted sources', json: true },
  { key: 'sourceNpcs', label: 'Source NPCs', json: true },
  { key: 'targetNpcs', label: 'Target selectors', json: true },
];

// Normalise a value for comparison: null/undefined/'' all collapse to null so "cleared vs never
// set" doesn't show as a spurious change; JSON strings are re-stringified in a stable form.
function normalize(v: unknown, json: boolean): unknown {
  if (v === undefined || v === null || v === '') return null;
  if (json && typeof v === 'string') {
    try {
      return JSON.stringify(JSON.parse(v));
    } catch {
      return v;
    }
  }
  return v;
}

/** Diff two tile rows over the audited fields. Returns only the fields that actually changed. */
export function diffTiles(before: Partial<TileRow>, after: Partial<TileRow>): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const { key, label, json } of AUDITED_FIELDS) {
    const from = normalize(before[key], !!json);
    const to = normalize(after[key], !!json);
    if (from !== to) {
      changes.push({ field: key as string, label, from: before[key] ?? null, to: after[key] ?? null });
    }
  }
  return changes;
}

/** Compact snapshot of a tile (audited fields only) for created/deleted rows. */
export function snapshotTile(tile: Partial<TileRow>): Record<string, unknown> {
  const snap: Record<string, unknown> = {};
  for (const { key } of AUDITED_FIELDS) {
    const v = tile[key];
    if (v !== undefined && v !== null && v !== '') snap[key as string] = v;
  }
  return snap;
}

export interface TileAuditEntry {
  eventId: number;
  action: TileAuditAction;
  tileId?: number | null;
  tileLabel?: string | null;
  changedFields?: FieldChange[];
  oldValue?: unknown;
  newValue?: unknown;
  actorUserId?: number | null;
}

/**
 * Record a tile-history entry. Fire-and-forget — never awaited on the mutation's happy path,
 * never throws. A 'updated' entry with no changed fields is dropped (nothing happened).
 */
export function logTileAudit(entry: TileAuditEntry): void {
  if (entry.action === 'updated' && (!entry.changedFields || entry.changedFields.length === 0)) {
    return;
  }
  db.insert(tileAuditLog)
    .values({
      eventId: entry.eventId,
      tileId: entry.tileId ?? null,
      tileLabel: entry.tileLabel ?? null,
      action: entry.action,
      changedFields:
        entry.changedFields && entry.changedFields.length ? JSON.stringify(entry.changedFields) : null,
      oldValue: entry.oldValue != null ? JSON.stringify(entry.oldValue) : null,
      newValue: entry.newValue != null ? JSON.stringify(entry.newValue) : null,
      actorUserId: entry.actorUserId ?? null,
    })
    .catch(() => {});
}
