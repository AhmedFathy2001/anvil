import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tiles, events } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyTileEditorForEvent, verifyAdminOrModerator } from '@/lib/auth';
import { logTileAudit, diffTiles, snapshotTile } from '@/lib/tile-audit';
import { parseEventRules, hasRevealPolicy, visibleTiles, serializeTileMissionRules, type MissionRules } from '@/lib/eventRules';
import { assertEventEditable } from '@/lib/eventLock';
import { collectionDisplayTotal, type CollectionRequirement } from '@/lib/collectionSets';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);

  // Tiles hidden from members until an admin reveals them. Staff (admin/treasurer/
  // moderator/editor) still get the full list so the admin tooling works pre-reveal;
  // everyone else gets an empty list. Mirrors the web board + plugin gates.
  // Reveal-policy events (lib/eventRules) trim members to the revealed subset the same way.
  const event = await db.query.events.findFirst({ where: eq(events.id, eId) });
  const rules = parseEventRules(event?.rules);
  if (event && (!event.tilesRevealed || hasRevealPolicy(rules))) {
    // Board-scoped editors aren't mod-tier (verifyAdminOrModerator excludes them), but they still
    // need the FULL board for the event they're granted — so treat this event's tile editors as
    // staff here too.
    const staff = (await verifyAdminOrModerator()) || (await verifyTileEditorForEvent(eId));
    if (!staff && !event.tilesRevealed) return NextResponse.json([]);
    if (!staff) {
      const eventTiles = await db.query.tiles.findMany({ where: eq(tiles.eventId, eId) });
      return NextResponse.json(visibleTiles(rules, eventTiles));
    }
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
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  const editor = await verifyTileEditorForEvent(eId);
  if (!editor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Finished events are read-only unless explicitly unlocked (lib/eventLock).
  const lockedResponse = await assertEventEditable(eId);
  if (lockedResponse) return lockedResponse;
  const { tileId, label, description, tileType, requiredAmount, trackedStat, statType, statGoal, trackingMode, optional, autoTrackDisabled, trackedItemIds, itemRequirements, groupMode, perKillCap, points, category, sourceNpcs, targetNpcs, timedActivity, timeThresholdSeconds, partySize, pvpMinLootValue, revealAt, mission, missionRules, baseUpdatedAt, liveOverride } = await request.json();

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

  // Optimistic concurrency: the editor sends the updatedAt stamp it loaded. A mismatch means
  // someone else saved this tile in between — reject instead of silently clobbering their
  // edit, and return the current row so the client can reload it. Callers that don't send
  // baseUpdatedAt (CSV import, older clients) keep last-write-wins.
  if (baseUpdatedAt !== undefined && (baseUpdatedAt ?? null) !== (tile.updatedAt ?? null)) {
    return NextResponse.json(
      { error: 'This tile was updated by someone else while you were editing. Reopen it to load their version.', conflict: true, tile },
      { status: 409 },
    );
  }

  // Get event to check start date
  const event = await db.query.events.findFirst({
    where: eq(events.id, eId),
  });

  const now = new Date();
  const eventStarted = event?.startDate && new Date(event.startDate) <= now;

  // Admin-only live-event override. After start, label / kind / required-amount are frozen so a
  // running board's rules don't shift under contestants. An admin can knowingly override that to
  // fix a genuinely misconfigured tile (wrong name or count) mid-event — the edit is stamped as a
  // live override in the tile history. Editors (non-admin tile authors) can't invoke it; they get a
  // 403 rather than a silent skip so the UI can explain why. No-op when the event hasn't started.
  const liveOverrideActive = !!eventStarted && liveOverride === true;
  if (liveOverrideActive && editor.role !== 'admin') {
    return NextResponse.json(
      { error: 'Editing a locked field (label, kind, or required amount) on a live event is admin-only.' },
      { status: 403 },
    );
  }

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
          const req = r as { itemId?: unknown; requiredAmount?: unknown; group?: unknown; groupRequire?: unknown };
          const groupOk = req.group == null || (typeof req.group === 'string' && req.group.length <= 30);
          // How many of the set count as satisfying it — only meaningful ON a set. Clamping to the
          // group's size happens at read time (lib/collectionSets), so a later edit that shrinks a
          // group can't strand a tile; this only rejects nonsense.
          const requireOk = req.groupRequire == null ||
            (Number.isInteger(req.groupRequire) && (req.groupRequire as number) >= 1 && (req.groupRequire as number) <= 100);
          return req && Number.isInteger(req.itemId) && (req.itemId as number) > 0 &&
                 Number.isInteger(req.requiredAmount) && (req.requiredAmount as number) >= 1 && groupOk && requireOk;
        })) {
      return NextResponse.json({ error: 'Each itemRequirement must have a positive itemId, requiredAmount >= 1, an optional set name (≤30 chars), and an optional groupRequire of 1-100' }, { status: 400 });
    }
  }

  // How a collection's sets combine — 'any' (satisfy one) or 'all' (satisfy each). Null clears it
  // back to the default rather than storing a value.
  if (groupMode !== undefined && groupMode !== null && groupMode !== 'any' && groupMode !== 'all') {
    return NextResponse.json({ error: "groupMode must be 'any' or 'all'" }, { status: 400 });
  }

  // Most credits one kill can give this tile. Small ceiling: this exists to count rolls (1) or the
  // odd "a double still counts as two, but no more" case, not to express a requirement.
  if (perKillCap !== undefined && perKillCap !== null) {
    if (!Number.isInteger(perKillCap) || perKillCap < 1 || perKillCap > 10) {
      return NextResponse.json({ error: 'perKillCap must be an integer between 1 and 10 (or null for uncapped)' }, { status: 400 });
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
  // The 60-char cap fits the longest selector the column carries — CA task names run up to 44
  // chars ("Chambers of Xeric: CM (5-Scale) Speed-Runner").
  let targetNpcsJson: string | null | undefined;
  if (targetNpcs !== undefined) {
    if (targetNpcs === null || (Array.isArray(targetNpcs) && targetNpcs.length === 0)) {
      targetNpcsJson = null;
    } else if (
      Array.isArray(targetNpcs) &&
      targetNpcs.length <= 25 &&
      targetNpcs.every((n: unknown) => typeof n === 'string' && n.trim().length > 0 && n.length <= 60)
    ) {
      targetNpcsJson = JSON.stringify(targetNpcs.map((n: string) => n.trim()));
    } else {
      return NextResponse.json(
        { error: 'targetNpcs must be an array of up to 25 non-empty NPC names (≤60 chars each)' },
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

  // partySize: optional exact-party-size gate for a TIMED raid tile (1..100).
  let partySizeValue: number | null | undefined;
  if (partySize !== undefined) {
    if (partySize === null) {
      partySizeValue = null;
    } else if (Number.isInteger(partySize) && partySize >= 1 && partySize <= 100) {
      partySizeValue = partySize;
    } else {
      return NextResponse.json({ error: 'partySize must be an integer between 1 and 100' }, { status: 400 });
    }
  }

  // revealAt: planned reveal time for a 'scheduled' reveal-policy event (lib/eventRules). Always
  // editable — including mid-event, so a host can re-time an upcoming reveal — but it can't hide a
  // tile the engine already flipped live (revealedAt is engine-owned and never written here).
  // Setting a past time is the "reveal now" gesture: the next minute tick flips the tile.
  let revealAtValue: string | null | undefined;
  if (revealAt !== undefined) {
    if (revealAt === null || revealAt === '') {
      revealAtValue = null;
    } else if (typeof revealAt === 'string' && !Number.isNaN(Date.parse(revealAt))) {
      revealAtValue = new Date(revealAt).toISOString();
    } else {
      return NextResponse.json({ error: 'revealAt must be an ISO date string or null' }, { status: 400 });
    }
  }

  // pvpMinLootValue: optional minimum loot value (gp) a PvP kill must yield to count. 0 (or null)
  // means no minimum. Capped at the max cash stack (2,147,483,647). Normalised so 0 stores as null.
  let pvpMinLootValueValue: number | null | undefined;
  if (pvpMinLootValue !== undefined) {
    if (pvpMinLootValue === null || pvpMinLootValue === 0) {
      pvpMinLootValueValue = null;
    } else if (Number.isInteger(pvpMinLootValue) && pvpMinLootValue >= 1 && pvpMinLootValue <= 2147483647) {
      pvpMinLootValueValue = pvpMinLootValue;
    } else {
      return NextResponse.json(
        { error: 'pvpMinLootValue must be an integer between 0 and 2,147,483,647 gp' },
        { status: 400 },
      );
    }
  }

  // Build update set
  const updateSet: Record<string, unknown> = {
    // Concurrency stamp — every successful edit gets a fresh one (see baseUpdatedAt above).
    updatedAt: new Date().toISOString(),
    // description is always editable
    description: description !== undefined ? (description || null) : tile.description,
    // stat tracking is always editable
    trackedStat: trackedStat !== undefined ? (trackedStat || null) : tile.trackedStat,
    statType: statType !== undefined ? (statType || null) : tile.statType,
    statGoal: statGoal !== undefined ? (statGoal || null) : tile.statGoal,
    trackingMode: trackingMode !== undefined ? trackingMode : tile.trackingMode,
    // optional is always editable
    optional: optional !== undefined ? (optional ? 1 : 0) : tile.optional,
    // auto-tracking kill-switch — always editable, deliberately even after event start, so a
    // broken tile can be flipped to manual on a live board without waiting on a plugin release.
    autoTrackDisabled: autoTrackDisabled !== undefined ? (autoTrackDisabled ? 1 : 0) : tile.autoTrackDisabled,
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
    ...(partySizeValue !== undefined ? { partySize: partySizeValue } : {}),
    // PvP min-loot floor — always editable (admin can tune it on a live board, like the other
    // PvP config), so no live-override gate is needed to change it.
    ...(pvpMinLootValueValue !== undefined ? { pvpMinLootValue: pvpMinLootValueValue } : {}),
    // Scheduled reveal time — always editable (see validation above).
    ...(revealAtValue !== undefined ? { revealAt: revealAtValue } : {}),
    // Mission flag + per-mission scoring (lockout/bonus/decay/expiry). Always editable so a host can
    // designate/adjust a mission on a live board. Clearing the flag drops its rules.
    ...(mission !== undefined ? { mission: mission ? 1 : 0 } : {}),
    ...(mission === false
      ? { rules: null }
      : missionRules !== undefined
        ? { rules: serializeTileMissionRules(missionRules as Partial<MissionRules>) }
        : {}),
  };

  // trackedItemIds is always editable (admin can update plugin mappings anytime)
  if (trackedItemIds !== undefined) {
    updateSet.trackedItemIds = trackedItemIds ? JSON.stringify(trackedItemIds) : null;
  }

  // itemRequirements is always editable — when set, auto-compute trackedItemIds and requiredAmount.
  // When cleared (null or []), also clear trackedItemIds so the plugin doesn't try to track this
  // tile per-item, and submission validation doesn't demand itemId for a tile with no requirements.
  if (groupMode !== undefined) {
    // Only ever meaningful with sets; stored as null for the default so a plain collection carries
    // no mode at all.
    updateSet.groupMode = groupMode === 'all' ? 'all' : null;
  }

  if (perKillCap !== undefined) {
    updateSet.perKillCap = perKillCap ?? null;
  }

  if (itemRequirements !== undefined) {
    if (itemRequirements && Array.isArray(itemRequirements) && itemRequirements.length > 0) {
      updateSet.itemRequirements = JSON.stringify(itemRequirements);
      updateSet.trackedItemIds = JSON.stringify(itemRequirements.map((r: { itemId: number }) => r.itemId));
      // Display total: the shortest path to completion under this tile's group mode
      // (lib/collectionSets owns that arithmetic).
      updateSet.requiredAmount = collectionDisplayTotal(
        itemRequirements as CollectionRequirement[],
        groupMode !== undefined ? groupMode : tile.groupMode,
      );
    } else {
      // Cleared. Wipe derived trackedItemIds unless the admin explicitly set a non-empty
      // trackedItemIds in the same request (simple-mode drop tile).
      updateSet.itemRequirements = null;
      if (trackedItemIds === undefined) {
        updateSet.trackedItemIds = null;
      }
    }
  }

  // label, tileType, requiredAmount only editable before event start — unless an admin invokes the
  // live-event override (liveOverrideActive), which unlocks them on a running board.
  if (!eventStarted || liveOverrideActive) {
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
  // PvP-kill tiles reuse targetNpcs as the selector list ('team:other' = any rival team
  // member, 'rsn:<name>' = named bounty) and requiredAmount as kills needed.
  const isPvp = merged.tileType === 'pvp';
  const isTimed = merged.tileType === 'timed';
  const isDiary = merged.tileType === 'diary';
  // Combat-achievement tiles reuse targetNpcs as the task-selector list (exact task names like
  // "Whack-a-Mole", or "Any <Tier>" wildcards) and requiredAmount as completions needed. Players
  // who already own a task re-fire the completion line via the in-game "Repeat completion" toggle.
  const isCa = merged.tileType === 'ca';
  // LMS placement tiles reuse timeThresholdSeconds as the placement cap (1 = win) and
  // requiredAmount as the number of qualifying games. No timedActivity.
  const isLms = merged.tileType === 'lms';
  // Loot-value tiles reuse requiredAmount as the gp threshold — one haul must meet it
  // ('value') or all hauls together must reach it ('valuetotal') — and sourceNpcs as the
  // optional source filter ("PvP", "Loot Chest", NPC names).
  const isValue = merged.tileType === 'value' || merged.tileType === 'valuetotal';
  // Item-gain tiles count tracked items appearing in the inventory (catch/cook/gather);
  // they reuse trackedItemIds as the item pool and requiredAmount as the target count.
  const isGain = merged.tileType === 'gain';
  // Deathless tiles reuse timedActivity as the raid and requiredAmount as runs needed.
  const isDeathless = merged.tileType === 'deathless';
  // requiredAmount is shared by drop (item count), kill (kill count), gain (items gained),
  // diary (completions), lms (qualifying games), value (gp threshold) and deathless (runs).
  const hasRequiredAmount = merged.requiredAmount != null;
  const hasDropItems = parseLen(merged.trackedItemIds) > 0 || parseLen(merged.itemRequirements) > 0;
  const hasSourceNpcs = parseLen(merged.sourceNpcs) > 0;

  // A tile is exactly one kind — stat tiles can't carry any submission-kind fields.
  if (hasStat && (isDrop || isKill || isPvp || isTimed || isDiary || isCa || isLms || isValue || isGain || isDeathless || dropItemFields || hasKillFields || hasTimedFields || hasRequiredAmount)) {
    return NextResponse.json(
      { error: 'A stat-tracked tile (skill/boss) cannot also be a drop, kill, PvP, gain, timed, deathless, diary, CA, LMS, or value tile. Pick one kind.' },
      { status: 400 },
    );
  }
  if (hasStat && merged.statType !== 'skill' && merged.statType !== 'boss') {
    return NextResponse.json({ error: "Stat tracking requires statType 'skill' or 'boss'." }, { status: 400 });
  }
  // Field/kind coherence for the submission-backed kinds.
  if (hasDropItems && !isDrop && !isGain) {
    return NextResponse.json({ error: 'Only drop or gain tiles can carry tracked items.' }, { status: 400 });
  }
  if (parseLen(merged.itemRequirements) > 0 && isGain) {
    return NextResponse.json({ error: 'Gain tiles track a flat item list — per-item requirements are for drop collections.' }, { status: 400 });
  }
  if (hasSourceNpcs && !isDrop && !isValue) {
    return NextResponse.json({ error: 'Only drop or value tiles can restrict loot sources.' }, { status: 400 });
  }
  if (hasKillFields && !isKill && !isDiary && !isCa && !isPvp) {
    return NextResponse.json({ error: 'Only kill tiles can target NPCs (or diary/CA/PvP tiles, their selectors).' }, { status: 400 });
  }
  // Min-loot floor is a PvP-only knob — reject it on any other kind so switching kind can't leave a
  // stray value behind (the editor clears it on kind change, but the API is the real guard).
  if (merged.pvpMinLootValue != null && merged.pvpMinLootValue > 0 && !isPvp) {
    return NextResponse.json({ error: 'Only PvP tiles can carry a minimum loot value.' }, { status: 400 });
  }
  if (merged.timedActivity && !isTimed && !isDeathless) {
    return NextResponse.json({ error: 'Only timed or deathless tiles can carry an activity.' }, { status: 400 });
  }
  if (merged.timeThresholdSeconds != null && !isTimed && !isLms && !isDeathless && !isDrop) {
    return NextResponse.json({ error: 'Only timed (time cap), LMS (placement cap), deathless (party size), or drop (raid party size) tiles can carry a threshold.' }, { status: 400 });
  }
  if (hasRequiredAmount && !isDrop && !isKill && !isPvp && !isGain && !isDiary && !isCa && !isLms && !isValue && !isDeathless) {
    return NextResponse.json({ error: 'Only drop, kill, PvP, gain, diary, CA, LMS, value, or deathless tiles can have a required amount.' }, { status: 400 });
  }

  const [updated] = await db
    .update(tiles)
    .set(updateSet)
    .where(eq(tiles.id, tileId))
    .returning();

  // History: record the exact field diff (no-op edits are dropped by logTileAudit). Edits made
  // through the admin live-event override are flagged so the timeline can mark them.
  logTileAudit({
    eventId: eId,
    action: 'updated',
    tileId: updated.id,
    tileLabel: updated.label,
    changedFields: diffTiles(tile, updated),
    actorUserId: editor.userId,
    liveOverride: liveOverrideActive,
  });

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
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  const editor = await verifyTileEditorForEvent(eId);
  if (!editor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Finished events are read-only unless explicitly unlocked (lib/eventLock).
  const lockedResponse = await assertEventEditable(eId);
  if (lockedResponse) return lockedResponse;

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
  let duplicateOf: number | null = null;
  try {
    const body = await request.json();
    if (body && typeof body.label === 'string' && body.label.trim()) {
      label = body.label.trim().slice(0, 200);
    }
    if (body && Number.isInteger(body.duplicateOf)) duplicateOf = body.duplicateOf as number;
  } catch {
    /* empty body is fine — fall back to the placeholder label */
  }

  // Duplicating copies the whole row rather than a list of fields the client knows about. A tile has
  // ~30 configurable columns and gains more with every tile kind; enumerating them anywhere but here
  // guarantees that the next one silently fails to copy.
  let source: typeof tiles.$inferSelect | null = null;
  if (duplicateOf !== null) {
    source = (await db.query.tiles.findFirst({ where: eq(tiles.id, duplicateOf) })) ?? null;
    // Scoped to this event: a tile id from another board is not this editor's to read.
    if (!source || source.eventId !== eId) {
      return NextResponse.json({ error: 'That tile is not on this board.' }, { status: 404 });
    }
    label = `${source.label} (copy)`.slice(0, 200);
  }

  const created = await db.transaction(async (tx) => {
    const values = source
      ? (() => {
          // Everything except identity, board placement and per-tile progress state: a copy starts
          // unrevealed and uncompleted, wherever the original had got to.
          const {
            id: _id,
            eventId: _eventId,
            position: _position,
            label: _label,
            revealedAt: _revealedAt,
            closedAt: _closedAt,
            updatedAt: _updatedAt,
            ...config
          } = source;
          return { ...config, eventId: eId, position: nextPosition, label };
        })()
      : { eventId: eId, position: nextPosition, label };
    const [tile] = await tx.insert(tiles).values(values).returning();
    // Keep boardSize == tile count so the display helpers (eventTileCount / eventShapeBadge) stay accurate.
    await tx.update(events).set({ boardSize: existing.length + 1 }).where(eq(events.id, eId));
    return tile;
  });

  logTileAudit({
    eventId: eId,
    action: source ? 'duplicated' : 'created',
    tileId: created.id,
    tileLabel: created.label,
    newValue: snapshotTile(created),
    actorUserId: editor.userId,
  });

  return NextResponse.json(created, { status: 201 });
}
