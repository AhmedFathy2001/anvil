import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tiles, events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';

// Bulk tile import — maps CSV/JSON rows onto an event's existing tiles by position
// (row order). Built for Leagues-style boards where configuring 49+ tiles one at a
// time in the UI is impractical. Label/type/requiredAmount are only applied before the
// event starts (mirrors the single-tile PUT); description/points/category/optional/stat
// fields are always applied.
//
// Body: { rows: Array<{
//   label?, description?, tileType?, requiredAmount?, points?, category?,
//   optional?, trackedStat?, statType?, statGoal?,
//   targetNpcs?, timedActivity?, timeThresholdSeconds?
// }> }
// Row index i targets the tile at position i (0-based). Extra rows beyond the tile
// count are ignored and reported back.

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
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const eId = parseInt(eventId, 10);

  const event = await db.query.events.findFirst({ where: eq(events.id, eId) });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  const eventStarted = !!event.startDate && new Date(event.startDate) <= new Date();

  let body: { rows?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const rows = body.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'rows must be a non-empty array' }, { status: 400 });
  }

  const eventTiles = (await db.select().from(tiles).where(eq(tiles.eventId, eId))).sort(
    (a, b) => a.position - b.position,
  );
  if (eventTiles.length === 0) {
    return NextResponse.json({ error: 'Event has no tiles to import into' }, { status: 400 });
  }

  const applied = Math.min(rows.length, eventTiles.length);
  const ignored = Math.max(0, rows.length - eventTiles.length);

  // Validate every row up front so the whole import is all-or-nothing.
  for (let i = 0; i < applied; i++) {
    const row = rows[i] as ImportRow;
    if (row == null || typeof row !== 'object') {
      return NextResponse.json({ error: `Row ${i + 1} is not an object` }, { status: 400 });
    }
    if (
      row.requiredAmount !== undefined && row.requiredAmount !== null &&
      (!Number.isInteger(row.requiredAmount) || row.requiredAmount < 1)
    ) {
      return NextResponse.json({ error: `Row ${i + 1}: requiredAmount must be an integer >= 1` }, { status: 400 });
    }
    if (
      row.points !== undefined && row.points !== null &&
      (!Number.isInteger(row.points) || row.points < 0)
    ) {
      return NextResponse.json({ error: `Row ${i + 1}: points must be a non-negative integer` }, { status: 400 });
    }
    if (
      row.statGoal !== undefined && row.statGoal !== null &&
      (!Number.isInteger(row.statGoal) || row.statGoal < 0)
    ) {
      return NextResponse.json({ error: `Row ${i + 1}: statGoal must be a non-negative integer` }, { status: 400 });
    }
    if (
      row.timeThresholdSeconds !== undefined && row.timeThresholdSeconds !== null &&
      (!Number.isInteger(row.timeThresholdSeconds) || row.timeThresholdSeconds < 1 || row.timeThresholdSeconds > 86400)
    ) {
      return NextResponse.json({ error: `Row ${i + 1}: timeThresholdSeconds must be an integer between 1 and 86400` }, { status: 400 });
    }
    if (
      row.targetNpcs !== undefined && row.targetNpcs !== null &&
      (!Array.isArray(row.targetNpcs) || row.targetNpcs.length > 25 ||
        !row.targetNpcs.every((n) => typeof n === 'string' && n.trim().length > 0 && n.length <= 40))
    ) {
      return NextResponse.json({ error: `Row ${i + 1}: targetNpcs must be up to 25 NPC names (≤40 chars each)` }, { status: 400 });
    }

    // Cross-validate the resulting tile kind against the existing row (import never
    // touches tracked items, so those come from the DB). Same rule as the single-tile
    // PUT: a tile is exactly one kind.
    const tile = eventTiles[i];
    const parseLen = (v: unknown): number => {
      if (typeof v !== 'string' || !v) return 0;
      try {
        const arr = JSON.parse(v);
        return Array.isArray(arr) ? arr.length : 0;
      } catch {
        return 0;
      }
    };
    const effTileType = !eventStarted && row.tileType !== undefined ? row.tileType || 'standard' : tile.tileType;
    const effTrackedStat = row.trackedStat !== undefined ? row.trackedStat || null : tile.trackedStat;
    const effStatType = row.statType !== undefined ? row.statType || null : tile.statType;
    const effStatGoal = row.statGoal !== undefined ? row.statGoal ?? null : tile.statGoal;
    const effRequiredAmount =
      !eventStarted && row.requiredAmount !== undefined ? row.requiredAmount ?? null : tile.requiredAmount;
    const effTargetNpcsLen =
      row.targetNpcs !== undefined ? (row.targetNpcs?.length ?? 0) : parseLen(tile.targetNpcs);
    const effTimed =
      (row.timedActivity !== undefined ? !!row.timedActivity : !!tile.timedActivity) ||
      (row.timeThresholdSeconds !== undefined ? row.timeThresholdSeconds != null : tile.timeThresholdSeconds != null);
    const hasStat = !!effTrackedStat || !!effStatType || effStatGoal != null;
    const dropItemFields = parseLen(tile.trackedItemIds) > 0 || parseLen(tile.itemRequirements) > 0;
    const isDrop = effTileType === 'drop';
    const isKill = effTileType === 'kill';
    const isTimed = effTileType === 'timed';

    if (hasStat && (isDrop || isKill || isTimed || dropItemFields || effTargetNpcsLen > 0 || effTimed || effRequiredAmount != null)) {
      return NextResponse.json(
        { error: `Row ${i + 1}: a stat-tracked tile cannot also be a drop, kill, or timed tile.` },
        { status: 400 },
      );
    }
    if (hasStat && effStatType !== 'skill' && effStatType !== 'boss') {
      return NextResponse.json({ error: `Row ${i + 1}: stat tiles need statType 'skill' or 'boss'.` }, { status: 400 });
    }
    if (dropItemFields && !isDrop) {
      return NextResponse.json({ error: `Row ${i + 1}: only drop tiles can carry items.` }, { status: 400 });
    }
    if (effTargetNpcsLen > 0 && !isKill) {
      return NextResponse.json({ error: `Row ${i + 1}: only kill tiles can target NPCs.` }, { status: 400 });
    }
    if (effTimed && !isTimed) {
      return NextResponse.json({ error: `Row ${i + 1}: only timed tiles can carry an activity or time threshold.` }, { status: 400 });
    }
    if (effRequiredAmount != null && !isDrop && !isKill) {
      return NextResponse.json({ error: `Row ${i + 1}: only drop or kill tiles can have a required amount.` }, { status: 400 });
    }
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < applied; i++) {
      const row = rows[i] as ImportRow;
      const tile = eventTiles[i];
      const updateSet: Record<string, unknown> = {};

      if (row.description !== undefined) updateSet.description = row.description || null;
      if (row.points !== undefined && row.points !== null) updateSet.points = row.points;
      if (row.category !== undefined) updateSet.category = row.category ? String(row.category).slice(0, 60) : null;
      if (row.optional !== undefined) updateSet.optional = row.optional ? 1 : 0;
      if (row.trackedStat !== undefined) updateSet.trackedStat = row.trackedStat || null;
      if (row.statType !== undefined) updateSet.statType = row.statType || null;
      if (row.statGoal !== undefined) updateSet.statGoal = row.statGoal ?? null;
      // Kill/timed kind fields — always applied (like stat fields).
      if (row.targetNpcs !== undefined) {
        updateSet.targetNpcs = row.targetNpcs && row.targetNpcs.length > 0
          ? JSON.stringify(row.targetNpcs.map((n) => n.trim()))
          : null;
      }
      if (row.timedActivity !== undefined) updateSet.timedActivity = row.timedActivity ? String(row.timedActivity).slice(0, 60) : null;
      if (row.timeThresholdSeconds !== undefined) updateSet.timeThresholdSeconds = row.timeThresholdSeconds ?? null;

      // Pre-start-only fields.
      if (!eventStarted) {
        if (row.label !== undefined && row.label) updateSet.label = String(row.label).slice(0, 200);
        if (row.tileType !== undefined) updateSet.tileType = row.tileType || 'standard';
        if (row.requiredAmount !== undefined) updateSet.requiredAmount = row.requiredAmount ?? null;
      }

      if (Object.keys(updateSet).length > 0) {
        await tx.update(tiles).set(updateSet).where(eq(tiles.id, tile.id));
      }
    }
  });

  return NextResponse.json({ applied, ignored, total: eventTiles.length });
}
