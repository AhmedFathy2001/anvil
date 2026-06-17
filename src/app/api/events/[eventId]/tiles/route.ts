import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tiles, events } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);

  const eventTiles = await db.query.tiles.findMany({
    where: eq(tiles.eventId, eId),
  });

  return NextResponse.json(eventTiles);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
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
    category: category !== undefined ? (category ? String(category).slice(0, 60) : null) : tile.category,
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
  const hasKillFields = parseLen(merged.targetNpcs) > 0;
  const hasTimedFields = merged.timeThresholdSeconds != null || !!merged.timedActivity;
  const isDrop = merged.tileType === 'drop';
  const isKill = merged.tileType === 'kill';
  const isTimed = merged.tileType === 'timed';
  // requiredAmount is shared by drop (item count) and kill (kill count).
  const hasRequiredAmount = merged.requiredAmount != null;

  // A tile is exactly one kind — stat tiles can't carry any submission-kind fields.
  if (hasStat && (isDrop || isKill || isTimed || dropItemFields || hasKillFields || hasTimedFields || hasRequiredAmount)) {
    return NextResponse.json(
      { error: 'A stat-tracked tile (skill/boss) cannot also be a drop, kill, or timed tile. Pick one kind.' },
      { status: 400 },
    );
  }
  if (hasStat && merged.statType !== 'skill' && merged.statType !== 'boss') {
    return NextResponse.json({ error: "Stat tracking requires statType 'skill' or 'boss'." }, { status: 400 });
  }
  // Field/kind coherence for the submission-backed kinds.
  if (dropItemFields && !isDrop) {
    return NextResponse.json({ error: 'Only drop tiles can carry tracked items or source restrictions.' }, { status: 400 });
  }
  if (hasKillFields && !isKill) {
    return NextResponse.json({ error: 'Only kill tiles can target NPCs.' }, { status: 400 });
  }
  if (hasTimedFields && !isTimed) {
    return NextResponse.json({ error: 'Only timed tiles can carry an activity or time threshold.' }, { status: 400 });
  }
  if (hasRequiredAmount && !isDrop && !isKill) {
    return NextResponse.json({ error: 'Only drop or kill tiles can have a required amount.' }, { status: 400 });
  }

  const [updated] = await db
    .update(tiles)
    .set(updateSet)
    .where(eq(tiles.id, tileId))
    .returning();

  return NextResponse.json(updated);
}
