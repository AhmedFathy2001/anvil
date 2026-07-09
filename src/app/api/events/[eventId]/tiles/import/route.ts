import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tiles, events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyTileEditor } from '@/lib/auth';
import { logTileAudit } from '@/lib/tile-audit';
import { getItemMapping, type MappingItem } from '@/lib/osrsItems';
import { parseTileWorkbook } from '@/lib/tileSpreadsheet';

// Bulk tile import — maps CSV/JSON rows onto an event's tiles by position (row order).
// Built for Leagues-style boards where configuring hundreds of tiles one at a time is
// impractical. Row index i targets the tile at position i (0-based):
//   • rows that line up with existing tiles UPDATE them, and
//   • on Leagues/Tile-race boards (arbitrary-length task lists), extra rows beyond the
//     current tile count CREATE new tiles (up to MAX_TILES), pre-start only.
// A classic bingo grid is a fixed N×N shape, so extra rows there are ignored, not created.
// Label/type/requiredAmount are only applied/created before the event starts (mirrors the
// single-tile PUT); description/points/category/optional/stat fields are always applied.
//
// The round trip is 1:1: rows that exactly match a tile's current config are skipped
// (no write, no updatedAt stamp) and reported as `unchanged`, so downloading the
// spreadsheet and uploading it straight back is a verifiable no-op.
//
// JSON body: { rows: Array<{
//   label?, description?, tileType?, requiredAmount?, points?, category?,
//   optional?, trackedStat?, statType?, statGoal?,
//   targetNpcs?, timedActivity?, timeThresholdSeconds?, items?
// }> }
// or multipart/form-data with `file` = the downloaded .xlsx workbook (only its Tiles
// sheet is read), which parses into the same rows.

interface ImportRow {
  label?: string;
  description?: string | null;
  tileType?: string;
  requiredAmount?: number | null;
  points?: number | null;
  category?: string | null;
  optional?: boolean;
  trackedStat?: string | null;
  statType?: string | null;
  statGoal?: number | null;
  targetNpcs?: string[] | null;
  timedActivity?: string | null;
  timeThresholdSeconds?: number | null;
  items?: { name?: string; count: number; id?: number; group?: string | null }[] | null;
}

// Drop fields derived from a row's resolved `items` list — built before the transaction so the
// same values feed both kind validation and the insert/update.
interface DerivedItemFields {
  tileType: 'drop';
  requiredAmount: number;
  trackedItemIds: number[] | null;
  itemRequirements: { itemId: number; name: string; requiredAmount: number }[] | null;
}

const MAX_TILES = 1000;

// Every tile kind the board supports. Anything else in a `type` cell is a typo — reject it
// loudly rather than storing a junk type the trackers would never match.
const VALID_TILE_TYPES = new Set(['standard', 'drop', 'kill', 'pvp', 'gain', 'timed', 'deathless', 'diary', 'ca', 'lms', 'value', 'valuetotal']);

// Structural subset of a tile row that the kind cross-validation reads. A full tile row is
// assignable to this; new (to-be-created) tiles use the blank template below.
interface TileBase {
  tileType: string;
  trackedStat: string | null;
  statType: string | null;
  statGoal: number | null;
  requiredAmount: number | null;
  targetNpcs: string | null;
  trackedItemIds: string | null;
  itemRequirements: string | null;
  timedActivity: string | null;
  timeThresholdSeconds: number | null;
}

const BLANK_TILE: TileBase = {
  tileType: 'standard',
  trackedStat: null,
  statType: null,
  statGoal: null,
  requiredAmount: null,
  targetNpcs: null,
  trackedItemIds: null,
  itemRequirements: null,
  timedActivity: null,
  timeThresholdSeconds: null,
};

function parseLen(v: unknown): number {
  if (typeof v !== 'string' || !v) return 0;
  try {
    const arr = JSON.parse(v);
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}

// Validate a row's standalone numeric/array fields. Returns an error string or null.
function validateRowFields(i: number, row: ImportRow): string | null {
  if (row.tileType !== undefined && row.tileType !== '' && !VALID_TILE_TYPES.has(String(row.tileType).toLowerCase())) {
    return `Row ${i + 1}: unknown type "${row.tileType}" — use one of ${[...VALID_TILE_TYPES].join(', ')}`;
  }
  if (
    row.requiredAmount !== undefined && row.requiredAmount !== null &&
    (!Number.isInteger(row.requiredAmount) || row.requiredAmount < 1)
  ) {
    return `Row ${i + 1}: requiredAmount must be an integer >= 1`;
  }
  if (
    row.points !== undefined && row.points !== null &&
    (!Number.isInteger(row.points) || row.points < 0)
  ) {
    return `Row ${i + 1}: points must be a non-negative integer`;
  }
  if (
    row.statGoal !== undefined && row.statGoal !== null &&
    (!Number.isInteger(row.statGoal) || row.statGoal < 0)
  ) {
    return `Row ${i + 1}: statGoal must be a non-negative integer`;
  }
  if (
    row.timeThresholdSeconds !== undefined && row.timeThresholdSeconds !== null &&
    (!Number.isInteger(row.timeThresholdSeconds) || row.timeThresholdSeconds < 1 || row.timeThresholdSeconds > 86400)
  ) {
    return `Row ${i + 1}: timeThresholdSeconds must be an integer between 1 and 86400`;
  }
  if (
    row.targetNpcs !== undefined && row.targetNpcs !== null &&
    (!Array.isArray(row.targetNpcs) || row.targetNpcs.length > 25 ||
      // 60-char cap matches the single-tile PUT — CA task names run up to 44 chars.
      !row.targetNpcs.every((n) => typeof n === 'string' && n.trim().length > 0 && n.length <= 60))
  ) {
    return `Row ${i + 1}: targetNpcs must be up to 25 NPC names (≤60 chars each)`;
  }
  return null;
}

// Resolve a row's `items` into the concrete drop fields. With a `requiredAmount` it's a simple
// drop pool (any tracked item counts toward the total); without one it's a collection (each
// item needs its own count, and the total is their sum). Name entries are guaranteed resolvable
// by the caller (missing names already errored); id entries are used verbatim with a backfilled
// label. Returns null when the row carries no items.
function deriveItemFields(
  row: ImportRow,
  byName: Map<string, MappingItem>,
  byId: Map<number, MappingItem>,
): DerivedItemFields | null {
  if (!Array.isArray(row.items) || row.items.length === 0) return null;
  const reqs = row.items.map((it) => {
    const requiredAmount = Math.max(1, Math.floor(it.count) || 1);
    const group = it.group?.trim() ? it.group.trim().slice(0, 30) : null;
    if (it.id != null) {
      const label = it.name && it.name.trim() ? it.name.trim() : byId.get(it.id)?.name ?? `Item #${it.id}`;
      return { itemId: it.id, name: label, requiredAmount, group };
    }
    const hit = byName.get((it.name ?? '').trim().toLowerCase())!;
    return { itemId: hit.id, name: hit.name, requiredAmount, group };
  });
  const simpleAmount =
    row.requiredAmount != null && Number.isInteger(row.requiredAmount) && row.requiredAmount >= 1
      ? row.requiredAmount
      : null;
  if (simpleAmount != null) {
    return { tileType: 'drop', requiredAmount: simpleAmount, trackedItemIds: reqs.map((r) => r.itemId), itemRequirements: null };
  }
  // Collections: classic all-of totals sum every item; "any full set" groups (via @Set)
  // count the ungrouped items plus the smallest set — the shortest path to completion.
  const groupSums = new Map<string, number>();
  let ungroupedSum = 0;
  for (const r of reqs) {
    const g = r.group?.toLowerCase();
    if (g) groupSums.set(g, (groupSums.get(g) ?? 0) + r.requiredAmount);
    else ungroupedSum += r.requiredAmount;
  }
  return {
    tileType: 'drop',
    requiredAmount: groupSums.size === 0 ? ungroupedSum : ungroupedSum + Math.min(...groupSums.values()),
    trackedItemIds: null,
    itemRequirements: reqs,
  };
}

// Cross-validate the resulting tile kind — a tile is exactly one kind. `base` is the current
// DB state of the target tile (blank for a to-be-created tile). `derived` (when present) is the
// drop config the row's `items` resolve to and overrides the kind/amount. Returns an error or null.
function validateRowKind(
  i: number,
  row: ImportRow,
  base: TileBase,
  eventStarted: boolean,
  derived: DerivedItemFields | null,
): string | null {
  const effTileType = derived
    ? 'drop'
    : !eventStarted && row.tileType !== undefined
      ? row.tileType || 'standard'
      : base.tileType;
  const effTrackedStat = row.trackedStat !== undefined ? row.trackedStat || null : base.trackedStat;
  const effStatType = row.statType !== undefined ? row.statType || null : base.statType;
  const effStatGoal = row.statGoal !== undefined ? row.statGoal ?? null : base.statGoal;
  const effRequiredAmount = derived
    ? derived.requiredAmount
    : !eventStarted && row.requiredAmount !== undefined
      ? row.requiredAmount ?? null
      : base.requiredAmount;
  const effTargetNpcsLen = row.targetNpcs !== undefined ? (row.targetNpcs?.length ?? 0) : parseLen(base.targetNpcs);
  const effActivity = row.timedActivity !== undefined ? !!row.timedActivity : !!base.timedActivity;
  const effThreshold =
    row.timeThresholdSeconds !== undefined ? row.timeThresholdSeconds != null : base.timeThresholdSeconds != null;
  const effTimed = effActivity || effThreshold;
  const hasStat = !!effTrackedStat || !!effStatType || effStatGoal != null;
  const dropItemFields = derived
    ? (derived.trackedItemIds?.length ?? 0) > 0 || (derived.itemRequirements?.length ?? 0) > 0
    : parseLen(base.trackedItemIds) > 0 || parseLen(base.itemRequirements) > 0;
  const isDrop = effTileType === 'drop';
  const isKill = effTileType === 'kill';
  // PvP tiles carry 'team:other' / 'rsn:<name>' selectors in the targetNpcs column.
  const isPvp = effTileType === 'pvp';
  const isTimed = effTileType === 'timed';
  // Diary tiles carry their "<Area> <Tier>" selectors in the targetNpcs column; CA tiles
  // likewise carry task names / "Any <Tier>" selectors there.
  const isDiary = effTileType === 'diary';
  const isCa = effTileType === 'ca';
  // LMS reuses timeThresholdSeconds (placement cap) + requiredAmount (games); loot-value
  // tiles reuse requiredAmount (gp threshold) — mirrors the single-tile PUT validation.
  const isLms = effTileType === 'lms';
  const isValue = effTileType === 'value' || effTileType === 'valuetotal';
  // Item-gain tiles reuse trackedItemIds (item pool) + requiredAmount (target count);
  // deathless tiles reuse timedActivity (the raid) + requiredAmount (runs needed).
  const isGain = effTileType === 'gain';
  const isDeathless = effTileType === 'deathless';

  if (hasStat && (isDrop || isKill || isPvp || isTimed || isDiary || isCa || isLms || isValue || isGain || isDeathless || dropItemFields || effTargetNpcsLen > 0 || effTimed || effRequiredAmount != null)) {
    return `Row ${i + 1}: a stat-tracked tile cannot also be a drop, kill, PvP, gain, timed, deathless, diary, CA, LMS, or value tile.`;
  }
  if (hasStat && effStatType !== 'skill' && effStatType !== 'boss') {
    return `Row ${i + 1}: stat tiles need statType 'skill' or 'boss'.`;
  }
  if (dropItemFields && !isDrop && !isGain) {
    return `Row ${i + 1}: only drop or gain tiles can carry items.`;
  }
  if (effTargetNpcsLen > 0 && !isKill && !isDiary && !isCa && !isPvp) {
    return `Row ${i + 1}: only kill tiles can target NPCs (or diary/CA/PvP tiles, their selectors).`;
  }
  if (effActivity && !isTimed && !isDeathless) {
    return `Row ${i + 1}: only timed or deathless tiles can carry an activity.`;
  }
  if (effThreshold && !isTimed && !isLms && !isDeathless && !isDrop) {
    return `Row ${i + 1}: only timed (time cap), LMS (placement cap), deathless (party size), or drop (raid party size) tiles can carry a threshold.`;
  }
  if (effRequiredAmount != null && !isDrop && !isKill && !isPvp && !isGain && !isDiary && !isCa && !isLms && !isValue && !isDeathless) {
    return `Row ${i + 1}: only drop, kill, PvP, gain, diary, CA, LMS, value, or deathless tiles can have a required amount.`;
  }
  return null;
}

// Map a row to the tile columns it sets. `allowPreStart` gates the fields that are locked once
// the event starts (label/tileType/requiredAmount and the item config). `derived` (when present)
// is the drop config from the row's `items` and overrides type/amount/items. Used for updates+inserts.
function tileFieldsFromRow(row: ImportRow, allowPreStart: boolean, derived: DerivedItemFields | null): Record<string, unknown> {
  // Concurrency stamp — imports count as edits, so open editors detect the change on save.
  const s: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (row.description !== undefined) s.description = row.description || null;
  if (row.points !== undefined && row.points !== null) s.points = row.points;
  if (row.category !== undefined) s.category = row.category ? String(row.category).slice(0, 120) : null;
  if (row.optional !== undefined) s.optional = row.optional ? 1 : 0;
  if (row.trackedStat !== undefined) s.trackedStat = row.trackedStat || null;
  if (row.statType !== undefined) s.statType = row.statType || null;
  if (row.statGoal !== undefined) s.statGoal = row.statGoal ?? null;
  if (row.targetNpcs !== undefined) {
    s.targetNpcs = row.targetNpcs && row.targetNpcs.length > 0
      ? JSON.stringify(row.targetNpcs.map((n) => n.trim()))
      : null;
  }
  if (row.timedActivity !== undefined) s.timedActivity = row.timedActivity ? String(row.timedActivity).slice(0, 60) : null;
  if (row.timeThresholdSeconds !== undefined) s.timeThresholdSeconds = row.timeThresholdSeconds ?? null;
  if (allowPreStart) {
    if (row.label !== undefined && row.label) s.label = String(row.label).slice(0, 200);
    if (row.tileType !== undefined) s.tileType = row.tileType || 'standard';
    if (row.requiredAmount !== undefined) s.requiredAmount = row.requiredAmount ?? null;
    // Item config (resolved from the row's `items`) wins over the raw type/requiredAmount above.
    // A `type=gain` row keeps its kind: the items become the flat tracked pool (no per-item
    // requirements) and the row's own requiredAmount is the gain target.
    if (derived) {
      if (row.tileType === 'gain') {
        s.tileType = 'gain';
        s.requiredAmount = row.requiredAmount ?? derived.requiredAmount;
        // Flat pool either way — a per-item breakdown (row without requiredAmount) still
        // flattens to its item ids for gain tiles.
        const gainIds = derived.trackedItemIds ?? derived.itemRequirements?.map((r) => r.itemId) ?? null;
        s.trackedItemIds = gainIds && gainIds.length > 0 ? JSON.stringify(gainIds) : null;
        s.itemRequirements = null;
      } else {
        s.tileType = 'drop';
        s.requiredAmount = derived.requiredAmount;
        s.trackedItemIds = derived.trackedItemIds ? JSON.stringify(derived.trackedItemIds) : null;
        s.itemRequirements = derived.itemRequirements ? JSON.stringify(derived.itemRequirements) : null;
      }
    }
  }
  return s;
}

// ---------------------------------------------------------------------------
// No-op detection — a row that exactly matches its tile's stored config is skipped (no write,
// no updatedAt stamp), so re-uploading an unchanged sheet is a verifiable 1:1 no-op.
// ---------------------------------------------------------------------------

// Normalize a JSON-text column (targetNpcs, trackedItemIds) for comparison.
function normalizeJsonCell(v: unknown): string {
  if (v == null || v === '') return '';
  try {
    return JSON.stringify(typeof v === 'string' ? JSON.parse(v) : v);
  } catch {
    return String(v);
  }
}

// itemRequirements rows can differ in key order / optional-group shape depending on which
// editor wrote them, so compare a normalized [itemId, name, requiredAmount, group] projection.
function normalizeItemReqsCell(v: unknown): string {
  if (v == null || v === '') return '';
  let arr: unknown;
  try {
    arr = typeof v === 'string' ? JSON.parse(v) : v;
  } catch {
    return String(v);
  }
  if (!Array.isArray(arr)) return '';
  return JSON.stringify(
    arr.map((r) => {
      const req = r as { itemId?: number; name?: string; requiredAmount?: number; group?: string | null };
      return [req.itemId ?? null, req.name ?? '', req.requiredAmount ?? 1, req.group ?? null];
    }),
  );
}

// True when applying `updateSet` to the tile would change nothing (updatedAt excluded).
function isNoopUpdate(updateSet: Record<string, unknown>, tile: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(updateSet)) {
    if (k === 'updatedAt') continue;
    const cur = tile[k];
    if (k === 'optional') {
      if ((v ? 1 : 0) !== (cur ? 1 : 0)) return false;
    } else if (k === 'targetNpcs' || k === 'trackedItemIds') {
      if (normalizeJsonCell(v) !== normalizeJsonCell(cur)) return false;
    } else if (k === 'itemRequirements') {
      if (normalizeItemReqsCell(v) !== normalizeItemReqsCell(cur)) return false;
    } else if ((v === '' ? null : v ?? null) !== (cur === '' ? null : cur ?? null)) {
      return false;
    }
  }
  return true;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const editor = await verifyTileEditor();
  if (!editor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const eId = parseInt(eventId, 10);

  const event = await db.query.events.findFirst({ where: eq(events.id, eId) });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  const eventStarted = !!event.startDate && new Date(event.startDate) <= new Date();
  const isClassicGrid = (event.format ?? 'bingo') === 'bingo' && (event.scoringMode ?? 'tiles') === 'tiles';

  // Rows arrive either as a JSON body (client-parsed CSV / programmatic use) or as a
  // multipart upload of the downloaded .xlsx workbook, parsed server-side into the same rows
  // so both paths behave identically.
  let rows: unknown;
  let appendMode = false;
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid file upload' }, { status: 400 });
    }
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing spreadsheet file' }, { status: 400 });
    }
    const parsed = await parseTileWorkbook(Buffer.from(await file.arrayBuffer()));
    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    rows = parsed.rows;
    appendMode = form.get('append') === 'true';
  } else {
    let body: { rows?: unknown; append?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    rows = body.rows;
    // Append mode: every row becomes a NEW tile after the last existing one, instead of the default
    // position-mapped update. Used by the "generate from collection log" bulk-authoring flow, which
    // wants to add a page's items without disturbing tiles already on the board.
    appendMode = body.append === true;
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'rows must be a non-empty array' }, { status: 400 });
  }
  // Normalize type case up front ("Drop" → "drop") so validation and writes agree.
  for (const r of rows) {
    if (r && typeof r === 'object' && typeof (r as ImportRow).tileType === 'string') {
      (r as ImportRow).tileType = (r as ImportRow).tileType!.trim().toLowerCase();
    }
  }

  const eventTiles = (await db.select().from(tiles).where(eq(tiles.eventId, eId))).sort(
    (a, b) => a.position - b.position,
  );
  if (eventTiles.length === 0) {
    return NextResponse.json({ error: 'Event has no tiles to import into' }, { status: 400 });
  }

  const existingCount = eventTiles.length;
  // Extra/appended rows become new tiles only on dynamic (Leagues/race) boards, pre-start, up to the cap.
  const canGrow = !isClassicGrid && !eventStarted;
  if (appendMode && !canGrow) {
    return NextResponse.json(
      { error: 'Appending tiles needs a Leagues or Tile-race board that hasn\'t started yet.' },
      { status: 400 },
    );
  }
  // Non-append: row i updates the tile at position i; surplus rows create tiles. Append: every row
  // is a create, so there are no updates and the create rows start at row 0.
  const updates = appendMode ? 0 : Math.min(rows.length, existingCount);
  const createRowOffset = appendMode ? 0 : existingCount;
  const creates = appendMode
    ? Math.min(rows.length, Math.max(0, MAX_TILES - existingCount))
    : canGrow
      ? Math.max(0, Math.min(rows.length - existingCount, MAX_TILES - existingCount))
      : 0;
  const processed = updates + creates;
  const ignored = rows.length - processed;

  // Item config is only applied pre-start (it sets the tile kind). Load the merged item mapping
  // once if any row carries items, index it by name + id, then fail loudly on any name that
  // doesn't resolve so nothing partial lands. (id-pinned entries skip name resolution.)
  const byName = new Map<string, MappingItem>();
  const byId = new Map<number, MappingItem>();
  const hasAnyItems =
    !eventStarted &&
    rows.slice(0, processed).some((r) => r && typeof r === 'object' && Array.isArray((r as ImportRow).items) && (r as ImportRow).items!.length > 0);
  if (hasAnyItems) {
    let mapping: MappingItem[];
    try {
      mapping = await getItemMapping();
    } catch {
      return NextResponse.json(
        { error: 'Could not reach the OSRS item database to resolve item names. Try again shortly.' },
        { status: 502 },
      );
    }
    for (const it of mapping) {
      const key = it.name.toLowerCase();
      if (!byName.has(key)) byName.set(key, it);
      if (!byId.has(it.id)) byId.set(it.id, it);
    }
    // Collect name entries (those without an explicit id) that don't resolve.
    const missing = new Set<string>();
    for (let i = 0; i < processed; i++) {
      const row = rows[i] as ImportRow;
      if (!row || typeof row !== 'object' || !Array.isArray(row.items)) continue;
      for (const it of row.items) {
        if (it && it.id == null) {
          const name = (it.name ?? '').trim();
          if (name && !byName.has(name.toLowerCase())) missing.add(name);
        }
      }
    }
    if (missing.size > 0) {
      return NextResponse.json(
        { error: `Unknown item name(s): ${[...missing].join(', ')}. Match the in-game spelling exactly, or pin an id with "Name#id".` },
        { status: 400 },
      );
    }
  }

  // Drop fields each processed row's `items` resolve to (null when no items / event started).
  const derivedList: (DerivedItemFields | null)[] = [];
  for (let i = 0; i < processed; i++) {
    const row = rows[i] as ImportRow;
    derivedList.push(!eventStarted && row && typeof row === 'object' ? deriveItemFields(row, byName, byId) : null);
  }

  // Validate every processed row up front so the whole import is all-or-nothing.
  for (let i = 0; i < processed; i++) {
    const row = rows[i] as ImportRow;
    if (row == null || typeof row !== 'object') {
      return NextResponse.json({ error: `Row ${i + 1} is not an object` }, { status: 400 });
    }
    const fieldErr = validateRowFields(i, row);
    if (fieldErr) {
      return NextResponse.json({ error: fieldErr }, { status: 400 });
    }
    // Items can only live on a drop or gain tile — an explicit conflicting type is an error, not a coerce.
    if (derivedList[i] && row.tileType && row.tileType !== 'drop' && row.tileType !== 'gain') {
      return NextResponse.json(
        { error: `Row ${i + 1}: items can only be set on drop or gain tiles (got type "${row.tileType}").` },
        { status: 400 },
      );
    }
    // Existing tiles validate against their DB state (and the event's real started flag);
    // new tiles validate against a blank template and are always pre-start. In append mode every
    // processed row is a new tile, so none count as existing.
    const isExisting = !appendMode && i < existingCount;
    const kindErr = validateRowKind(
      i,
      row,
      isExisting ? eventTiles[i] : BLANK_TILE,
      isExisting ? eventStarted : false,
      derivedList[i],
    );
    if (kindErr) {
      return NextResponse.json({ error: kindErr }, { status: 400 });
    }
  }

  const maxPos = existingCount > 0 ? eventTiles[existingCount - 1].position : -1;

  let applied = 0;
  let unchanged = 0;
  await db.transaction(async (tx) => {
    for (let i = 0; i < updates; i++) {
      const updateSet = tileFieldsFromRow(rows[i] as ImportRow, !eventStarted, derivedList[i]);
      if (isNoopUpdate(updateSet, eventTiles[i] as unknown as Record<string, unknown>)) {
        unchanged++;
        continue;
      }
      await tx.update(tiles).set(updateSet).where(eq(tiles.id, eventTiles[i].id));
      applied++;
    }
    for (let j = 0; j < creates; j++) {
      const row = rows[createRowOffset + j] as ImportRow;
      const position = maxPos + 1 + j;
      const fields = tileFieldsFromRow(row, true, derivedList[createRowOffset + j]);
      const label = typeof fields.label === 'string' && fields.label ? fields.label : `Tile ${position + 1}`;
      await tx.insert(tiles).values({ eventId: eId, position, label, ...fields });
    }
    if (creates > 0) {
      // Keep boardSize == tile count so the Leagues/race display helpers stay accurate.
      await tx.update(events).set({ boardSize: existingCount + creates }).where(eq(events.id, eId));
    }
  });

  // History: a single summary entry per import (per-tile diffs would flood the timeline on a
  // big sheet). Records who imported and how many tiles were changed / created.
  if (applied > 0 || creates > 0) {
    logTileAudit({
      eventId: eId,
      action: 'imported',
      newValue: { applied, created: creates, unchanged, ignored, total: existingCount + creates },
      actorUserId: editor.userId,
    });
  }

  return NextResponse.json({
    applied,
    unchanged,
    created: creates,
    ignored,
    total: existingCount + creates,
  });
}
