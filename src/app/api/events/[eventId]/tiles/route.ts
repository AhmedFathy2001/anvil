import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tiles, events } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyTileEditor, verifyAdminOrModerator } from '@/lib/auth';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);

  // Tiles hidden from members until an admin reveals them. Staff (admin/treasurer/
  // moderator/editor) still get the full list so the admin tooling works pre-reveal;
  // everyone else gets an empty list. Mirrors the web board + plugin gates.
  const event = await db.query.events.findFirst({ where: eq(events.id, eId) });
  if (event && !event.tilesRevealed) {
    const staff = await verifyAdminOrModerator();
    if (!staff) return NextResponse.json([]);
  }

  const eventTiles = await db.query.tiles.findMany({
    where: eq(tiles.eventId, eId),
  });

  return NextResponse.json(eventTiles);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const editor = await verifyTileEditor();
  if (!editor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  const { tileId, label, description, tileType, requiredAmount, trackedStat, statType, statGoal, trackingMode, optional, trackedItemIds, itemRequirements, points, category, sourceNpcs, targetNpcs, timedActivity, timeThresholdSeconds } = await request.json();

  if (!tileId) {
    return NextResponse.json({ error: 'tileId is required' }, { status: 400 });
  }

  // Verify tile belongs to this event
  const tile = await db.query.tiles.findFirst({
    where: and(eq(tiles.id, tileId), eq(tiles.eventId, eId)),
  });
  if (!tile) {
    return NextResponse.json({ error: 'Tile not found in this event' }, { status: 404 });
  }

  // Get event to check start date
  const event = await db.query.events.findFirst({
    where: eq(events.id, eId),
  });

  const now = new Date();
  const eventStarted = event?.startDate && new Date(event.startDate) <= now;

  // Validate inputs
  if (requiredAmount !== undefined && requiredAmount !== null) {
    if (!Number.isInteger(requiredAmount) || requiredAmount < 1) {
      return NextResponse.json({ error: 'requiredAmount must be an integer >= 1' }, { status: 400 });
    }
  }

  if (points !== undefined && points !== null) {
    if (!Number.isInteger(points) || points < 0) {
      return NextResponse.json({ error: 'points must be a non-negative integer' }, { status: 400 });
    }
  }

  if (trackedItemIds !== undefined && trackedItemIds !== null) {
    if (!Array.isArray(trackedItemIds) || trackedItemIds.length > 50 ||
        !trackedItemIds.every((id: unknown) => Number.isInteger(id) && (id as number) > 0)) {
      return NextResponse.json({ error: 'trackedItemIds must be an array of up to 50 positive integers' }, { status: 400 });
    }
  }

  if (itemRequirements !== undefined && itemRequirements !== null) {
    if (!Array.isArray(itemRequirements) ||
        !itemRequirements.every((r: unknown) => {
          const req = r as { itemId?: unknown; requiredAmount?: unknown };
          return req && Number.isInteger(req.itemId) && (req.itemId as number) > 0 &&
                 Number.isInteger(req.requiredAmount) && (req.requiredAmount as number) >= 1;
        })) {
      return NextResponse.json({ error: 'Each itemRequirement must have a positive itemId and requiredAmount >= 1' }, { status: 400 });
    }
  }

  // sourceNpcs: optional JSON array of specific source NPC names for a drop tile.
  let sourceNpcsJson: string | null | undefined;
  if (sourceNpcs !== undefined) {
    if (sourceNpcs === null || (Array.isArray(sourceNpcs) && sourceNpcs.length === 0)) {
      sourceNpcsJson = null;
    } else if (
      Array.isArray(sourceNpcs) &&
      sourceNpcs.length <= 25 &&
      sourceNpcs.every((n: unknown) => typeof n === 'string' && n.trim().length > 0 && n.length <= 40)
    ) {
      sourceNpcsJson = JSON.stringify(sourceNpcs.map((n: string) => n.trim()));
    } else {
      return NextResponse.json(
        { error: 'sourceNpcs must be an array of up to 25 non-empty NPC names (≤40 chars each)' },
        { status: 400 },
      );
    }
  }

  // targetNpcs: optional JSON array of NPC names a KILL tile counts. Same shape as sourceNpcs.
  let targetNpcsJson: string | null | undefined;
  if (targetNpcs !== undefined) {
    if (targetNpcs === null || (Array.isArray(targetNpcs) && targetNpcs.length === 0)) {
      targetNpcsJson = null;
    } else if (
      Array.isArray(targetNpcs) &&
      targetNpcs.length <= 25 &&
      targetNpcs.every((n: unknown) => typeof n === 'string' && n.trim().length > 0 && n.length <= 40)
    ) {
      targetNpcsJson = JSON.stringify(targetNpcs.map((n: string) => n.trim()));
    } else {
      return NextResponse.json(
        { error: 'targetNpcs must be an array of up to 25 non-empty NPC names (≤40 chars each)' },
        { status: 400 },
      );
    }
  }

  // timedActivity: optional free-text activity identifier for a TIMED tile (≤60 chars).
  let timedActivityValue: string | null | undefined;
  if (timedActivity !== undefined) {
    if (timedActivity === null || (typeof timedActivity === 'string' && timedActivity.trim() === '')) {
      timedActivityValue = null;
    } else if (typeof timedActivity === 'string' && timedActivity.trim().length <= 60) {
      timedActivityValue = timedActivity.trim();
    } else {
      return NextResponse.json({ error: 'timedActivity must be a string of at most 60 characters' }, { status: 400 });
    }
  }

  // timeThresholdSeconds: optional completion-time cap for a TIMED tile (1..86400 seconds).
  let timeThresholdValue: number | null | undefined;
  if (timeThresholdSeconds !== undefined) {
    if (timeThresholdSeconds === null) {
      timeThresholdValue = null;
    } else if (Number.isInteger(timeThresholdSeconds) && timeThresholdSeconds >= 1 && timeThresholdSeconds <= 86400) {
      timeThresholdValue = timeThresholdSeconds;
    } else {
      return NextResponse.json(
        { error: 'timeThresholdSeconds must be an integer between 1 and 86400' },
        { status: 400 },
      );
    }
  }

  // Build update set
  const updateSet: Record<string, unknown> = {
    // description is always editable
    description: description !== undefined ? (description || null) : tile.description,
    // stat tracking is always editable
    trackedStat: trackedStat !== undefined ? (trackedStat || null) : tile.trackedStat,
    statType: statType !== undefined ? (statType || null) : tile.statType,
    statGoal: statGoal !== undefined ? (statGoal || null) : tile.statGoal,
    trackingMode: trackingMode !== undefined ? trackingMode : tile.trackingMode,
    // optional is always editable
    optional: optional !== undefined ? (optional ? 1 : 0) : tile.optional,
    // point weight is always editable (admin can tune standings even mid-event)
    points: points !== undefined && points !== null ? points : tile.points,
    // category (free-text grouping for plugin filters) is always editable
    category: category !== undefined ? (category ? String(category).slice(0, 120) : null) : tile.category,
    // source-NPC restriction (drop tiles only) is always editable
    ...(sourceNpcsJson !== undefined ? { sourceNpcs: sourceNpcsJson } : {}),
    // kill-tile target NPCs and timed-tile activity/threshold are always editable
    ...(targetNpcsJson !== undefined ? { targetNpcs: targetNpcsJson } : {}),
    ...(timedActivityValue !== undefined ? { timedActivity: timedActivityValue } : {}),
    ...(timeThresholdValue !== undefined ? { timeThresholdSeconds: timeThresholdValue } : {}),
  };

  // trackedItemIds is always editable (admin can update plugin mappings anytime)
  if (trackedItemIds !== undefined) {
    updateSet.trackedItemIds = trackedItemIds ? JSON.stringify(trackedItemIds) : null;
  }

  // itemRequirements is always editable — when set, auto-compute trackedItemIds and requiredAmount.
  // When cleared (null or []), also clear trackedItemIds so the plugin doesn't try to track this
  // tile per-item, and submission validation doesn't demand itemId for a tile with no requirements.
  if (itemRequirements !== undefined) {
    if (itemRequirements && Array.isArray(itemRequirements) && itemRequirements.length > 0) {
      updateSet.itemRequirements = JSON.stringify(itemRequirements);
      updateSet.trackedItemIds = JSON.stringify(itemRequirements.map((r: { itemId: number }) => r.itemId));
      updateSet.requiredAmount = itemRequirements.reduce((sum: number, r: { requiredAmount: number }) => sum + r.requiredAmount, 0);
    } else {
      // Cleared. Wipe derived trackedItemIds unless the admin explicitly set a non-empty
      // trackedItemIds in the same request (simple-mode drop tile).
      updateSet.itemRequirements = null;
      if (trackedItemIds === undefined) {
        updateSet.trackedItemIds = null;
      }
    }
  }

  // label, tileType, requiredAmount only editable before event start
  if (!eventStarted) {
    if (label !== undefined) updateSet.label = label || tile.label;
    if (tileType !== undefined) updateSet.tileType = tileType || 'standard';
    if (requiredAmount !== undefined) updateSet.requiredAmount = requiredAmount || null;
  }

  // Cross-validate the FINAL persisted state so a tile is always exactly one kind.
  // Prevents nonsense like a 10M-XP goal on a drop tile (stat tracking + drop tracking
  // on the same row), which downstream submission/cron logic would otherwise fight over.
  const merged = { ...tile, ...updateSet } as typeof tile;
  const parseLen = (v: unknown): number => {
    if (typeof v !== 'string' || !v) return 0;
    try {
      const arr = JSON.parse(v);
      return Array.isArray(arr) ? arr.length : 0;
    } catch {
      return 0;
    }
  };
  const hasStat = !!merged.trackedStat || !!merged.statType || merged.statGoal != null;
  const dropItemFields =
    parseLen(merged.trackedItemIds) > 0 ||
    parseLen(merged.itemRequirements) > 0 ||
    parseLen(merged.sourceNpcs) > 0;
  // targetNpcs doubles as the diary-selector list ("Ardougne Elite", "Any Elite") when the
  // tile is the diary kind — same column, per-tileType interpretation.
  const hasKillFields = parseLen(merged.targetNpcs) > 0;
  const hasTimedFields = merged.timeThresholdSeconds != null || !!merged.timedActivity;
  const isDrop = merged.tileType === 'drop';
  const isKill = merged.tileType === 'kill';
  const isTimed = merged.tileType === 'timed';
  const isDiary = merged.tileType === 'diary';
  // LMS placement tiles reuse timeThresholdSeconds as the placement cap (1 = win) and
  // requiredAmount as the number of qualifying games. No timedActivity.
  const isLms = merged.tileType === 'lms';
  // Loot-value tiles reuse requiredAmount as the gp threshold — one haul must meet it
  // ('value') or all hauls together must reach it ('valuetotal') — and sourceNpcs as the
  // optional source filter ("PvP", "Loot Chest", NPC names).
  const isValue = merged.tileType === 'value' || merged.tileType === 'valuetotal';
  // requiredAmount is shared by drop (item count), kill (kill count), diary (completions),
  // lms (qualifying games) and value (gp threshold).
  const hasRequiredAmount = merged.requiredAmount != null;
  const hasDropItems = parseLen(merged.trackedItemIds) > 0 || parseLen(merged.itemRequirements) > 0;
  const hasSourceNpcs = parseLen(merged.sourceNpcs) > 0;

  // A tile is exactly one kind — stat tiles can't carry any submission-kind fields.
  if (hasStat && (isDrop || isKill || isTimed || isDiary || isLms || isValue || dropItemFields || hasKillFields || hasTimedFields || hasRequiredAmount)) {
    return NextResponse.json(
      { error: 'A stat-tracked tile (skill/boss) cannot also be a drop, kill, timed, diary, LMS, or value tile. Pick one kind.' },
      { status: 400 },
    );
  }
  if (hasStat && merged.statType !== 'skill' && merged.statType !== 'boss') {
    return NextResponse.json({ error: "Stat tracking requires statType 'skill' or 'boss'." }, { status: 400 });
  }
  // Field/kind coherence for the submission-backed kinds.
  if (hasDropItems && !isDrop) {
    return NextResponse.json({ error: 'Only drop tiles can carry tracked items.' }, { status: 400 });
  }
  if (hasSourceNpcs && !isDrop && !isValue) {
    return NextResponse.json({ error: 'Only drop or value tiles can restrict loot sources.' }, { status: 400 });
  }
  if (hasKillFields && !isKill && !isDiary) {
    return NextResponse.json({ error: 'Only kill tiles can target NPCs (or diary tiles, diary selectors).' }, { status: 400 });
  }
  if (merged.timedActivity && !isTimed) {
    return NextResponse.json({ error: 'Only timed tiles can carry an activity.' }, { status: 400 });
  }
  if (merged.timeThresholdSeconds != null && !isTimed && !isLms) {
    return NextResponse.json({ error: 'Only timed tiles (time cap) or LMS tiles (placement cap) can carry a threshold.' }, { status: 400 });
  }
  if (hasRequiredAmount && !isDrop && !isKill && !isDiary && !isLms && !isValue) {
    return NextResponse.json({ error: 'Only drop, kill, diary, LMS, or value tiles can have a required amount.' }, { status: 400 });
  }

  const [updated] = await db
    .update(tiles)
    .set(updateSet)
    .where(eq(tiles.id, tileId))
    .returning();

  return NextResponse.json(updated);
}

// Add a tile. Only Leagues (bingo+points) and Tile-race boards are arbitrary-length task
// lists — there `boardSize` IS the tile count, so admins grow them tile-by-tile here. A
// classic bingo board is a fixed N×N grid and is rejected. Pre-start only (adding tiles
// mid-event would shift everyone's totals). Body: { label? }.
const MAX_TILES = 1000;

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

  const isClassicGrid = (event.format ?? 'bingo') === 'bingo' && (event.scoringMode ?? 'tiles') === 'tiles';
  if (isClassicGrid) {
    return NextResponse.json(
      { error: 'A classic bingo grid is a fixed N×N board — tiles cannot be added individually.' },
      { status: 400 },
    );
  }
  if (event.startDate && new Date(event.startDate) <= new Date()) {
    return NextResponse.json({ error: 'Tiles cannot be added after the event has started.' }, { status: 400 });
  }

  const existing = await db.select({ position: tiles.position }).from(tiles).where(eq(tiles.eventId, eId));
  if (existing.length >= MAX_TILES) {
    return NextResponse.json({ error: `Events are capped at ${MAX_TILES} tiles.` }, { status: 400 });
  }
  const nextPosition = existing.length === 0 ? 0 : Math.max(...existing.map((t) => t.position)) + 1;

  let label = `Tile ${nextPosition + 1}`;
  try {
    const body = await request.json();
    if (body && typeof body.label === 'string' && body.label.trim()) {
      label = body.label.trim().slice(0, 200);
    }
  } catch {
    /* empty body is fine — fall back to the placeholder label */
  }

  const created = await db.transaction(async (tx) => {
    const [tile] = await tx.insert(tiles).values({ eventId: eId, position: nextPosition, label }).returning();
    // Keep boardSize == tile count so the display helpers (eventTileCount / eventShapeBadge) stay accurate.
    await tx.update(events).set({ boardSize: existing.length + 1 }).where(eq(events.id, eId));
    return tile;
  });

  return NextResponse.json(created, { status: 201 });
}
