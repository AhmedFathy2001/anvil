import { NextResponse } from 'next/server';
import { parseJsonArray } from '@/lib/tileKinds';
import { clogTileError, MAX_CLOG_TILE_ITEMS } from '@/lib/clogTiles';
import { killSourceOf } from '@/lib/killSource';
import { eventForRequest } from '@/lib/eventScope';
import { db } from '@/db';
import { tiles, events } from '@/db/schema';
import { eq, and, sql, inArray, isNull } from 'drizzle-orm';
import { verifyTileEditorForEvent } from '@/lib/auth';
import { logTileAudit, diffTiles, snapshotTile } from '@/lib/tile-audit';
import { isMissionTile, serializeTileMissionRules, type MissionRules } from '@/lib/eventRules';
import { assertEventEditable } from '@/lib/eventLock';
import { collectionDisplayTotal, type CollectionRequirement } from '@/lib/collectionSets';
import { atLeast } from '@/lib/clanRoles';
import { isRaidEffortMode, parseTileEffortConfig } from '@/lib/tileEffortConfig';
import { track } from '@/lib/analytics';
import { captureRevealStats } from '@/lib/revealStatsCapture';
import { MAX_TRACKED_ITEMS } from '@/lib/tileItemLimits';
import { capEligible, serializeCapBy, validateCapBy } from '@/lib/tileCaps';
import { COMBO_TILE_TYPE, MAX_COMBO_PARTS, MIN_COMBO_PARTS, serializeComboRule, validateComboRule, validateComboWeight } from '@/lib/combo';
import { syncPartRevealState } from '@/lib/comboSql';
import { tilesForViewer } from '@/lib/tilesForViewer';
import { STAFF_HIDE_ERROR, raceTileHiddenForSession } from '@/lib/raceHideAheadDb';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);

  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, eId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  // Tiles hidden from members until an admin reveals them. Staff (admin/treasurer/
  // moderator/editor) still get the full list so the admin tooling works pre-reveal;
  // everyone else gets an empty list. Mirrors the web board + plugin gates.
  // Reveal-policy events (lib/eventRules) trim members to the revealed subset the same way.
  // One gate (lib/tilesForViewer): the reveal policy, and a race's tiles past each team's next step
  // (lib/raceHideAhead) masked as locked "?" cells.
  const event = await db.query.events.findFirst({ where: eq(events.id, eId) });
  if (!event) return NextResponse.json([]);
  const eventTiles = await db.query.tiles.findMany({ where: eq(tiles.eventId, eId) });
  return NextResponse.json(await tilesForViewer(event, eventTiles));
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, eId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const editor = await verifyTileEditorForEvent(eId, 'edit');
  if (!editor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Finished events are read-only unless explicitly unlocked (lib/eventLock).
  const lockedResponse = await assertEventEditable(eId);
  if (lockedResponse) return lockedResponse;
  const body = (await request.json()) as Record<string, unknown> & { tileId?: number; baseUpdatedAt?: string | null; liveOverride?: boolean; parts?: unknown };
  const { tileId, baseUpdatedAt, liveOverride } = body;

  if (!tileId) {
    return NextResponse.json({ error: 'tileId is required' }, { status: 400 });
  }

  // Verify tile belongs to this event
  const tile = await db.query.tiles.findFirst({
    where: and(eq(tiles.id, tileId as number), eq(tiles.eventId, eId)),
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
  // "Also hide from event staff" (lib/raceHideAhead): a tile this caller only sees as a "?" can't be
  // saved over (the editor would write the placeholder back).
  if (event && (await raceTileHiddenForSession(event, tile))) {
    return NextResponse.json({ error: STAFF_HIDE_ERROR }, { status: 403 });
  }

  const now = new Date();
  const eventStarted = event?.startDate && new Date(event.startDate) <= now;

  // Admin-only live-event override. After start, label / kind / required-amount are frozen so a
  // running board's rules don't shift under contestants. An admin can knowingly override that to
  // fix a genuinely misconfigured tile (wrong name or count) mid-event — the edit is stamped as a
  // live override in the tile history. Editors (non-admin tile authors) can't invoke it; they get a
  // 403 rather than a silent skip so the UI can explain why. No-op when the event hasn't started.
  const liveOverrideActive = !!eventStarted && liveOverride === true;
  if (liveOverrideActive && !atLeast(editor.role, 'admin')) {
    return NextResponse.json(
      { error: 'Editing a locked field (label, kind, or required amount) on a live event is admin-only.' },
      { status: 403 },
    );
  }

  const ctx: TileUpdateCtx = { eId, editor, event, eventStarted: !!eventStarted, liveOverrideActive };

  // COMBO tiles (lib/combo): a `parts` list saves the combo and its parts together — each part through
  // the very same update below, so every kind's validation applies to it unchanged. Everything is
  // validated first (a dry run of the combo and each part) and only then written, so a bad part can't
  // leave a half-saved combo behind.
  const finalType = body.tileType !== undefined ? (body.tileType || 'standard') : tile.tileType;
  const existingParts = await db.select().from(tiles).where(eq(tiles.parentTileId, tile.id));
  if (body.parts !== undefined || (finalType !== COMBO_TILE_TYPE && existingParts.length > 0)) {
    return saveCombo(ctx, tile, body, existingParts);
  }
  // A combo edited without its parts (points, description…) keeps the parts it has.
  return applyTileUpdate(ctx, tile, body, finalType === COMBO_TILE_TYPE ? { partCount: existingParts.length } : {});
}

interface TileUpdateCtx {
  eId: number;
  editor: NonNullable<Awaited<ReturnType<typeof verifyTileEditorForEvent>>>;
  event: typeof events.$inferSelect | undefined;
  eventStarted: boolean;
  liveOverrideActive: boolean;
}
type TileRow = typeof tiles.$inferSelect;

/** Fields a part never takes from its body: placement, reveal and mission state are its combo's. */
const PART_STRIPPED = ['tileId', 'revealAt', 'revealState', 'mission', 'missionRules', 'baseUpdatedAt', 'liveOverride', 'parts', 'points', 'optional', 'lottery'] as const;

/** A blank part row under `parent` — what a new part is validated against before it exists. */
function blankPartRow(parent: TileRow): TileRow {
  return {
    ...parent,
    id: 0,
    parentTileId: parent.id,
    label: 'Part',
    icon: null,
    description: null,
    tileType: 'standard',
    requiredAmount: null,
    trackedStat: null,
    statType: null,
    statGoal: null,
    statBasis: 'gain',
    trackingMode: 'team',
    optional: 0,
    lottery: false,
    autoTrackDisabled: 0,
    trackedItemIds: null,
    itemRequirements: null,
    groupMode: null,
    setsRequired: null,
    countMode: null,
    perKillCap: null,
    coopCredit: null,
    coopMinMembers: null,
    acceptedSources: null,
    sourceNpcs: null,
    targetNpcs: null,
    timedActivity: null,
    timeThresholdSeconds: null,
    partySize: null,
    minRaidLevel: null,
    partyTeamOnly: null,
    pvpMinLootValue: null,
    revealStats: null,
    comboRule: null,
    comboWeight: null,
    capBy: null,
    points: 0,
    effortConfig: null,
    updatedAt: null,
    mission: 0,
    rules: null,
  };
}

async function errorOf(res: NextResponse): Promise<string> {
  try {
    const j = (await res.clone().json()) as { error?: string };
    return j.error ?? 'Invalid part';
  } catch {
    return 'Invalid part';
  }
}

async function saveCombo(ctx: TileUpdateCtx, tile: TileRow, body: Record<string, unknown>, existingParts: TileRow[]): Promise<NextResponse> {
  const finalType = body.tileType !== undefined ? ((body.tileType as string) || 'standard') : tile.tileType;
  const frozen = ctx.eventStarted && !ctx.liveOverrideActive;

  // Kind changed away from combo: its parts go with it (pre-start only — the kind is frozen after).
  if (finalType !== COMBO_TILE_TYPE) {
    if (frozen) return NextResponse.json({ error: 'A combo’s kind can’t change once the event has started.' }, { status: 400 });
    const res = await applyTileUpdate(ctx, tile, { ...body, parts: undefined, comboRule: null });
    if (res.ok && existingParts.length > 0) await db.delete(tiles).where(eq(tiles.parentTileId, tile.id));
    return res;
  }
  if (tile.parentTileId != null) {
    return NextResponse.json({ error: 'A combo’s part can’t be a combo itself.' }, { status: 400 });
  }
  const rawParts = body.parts === undefined ? existingParts.map((p) => ({ id: p.id })) : body.parts;
  if (!Array.isArray(rawParts) || rawParts.length < MIN_COMBO_PARTS || rawParts.length > MAX_COMBO_PARTS) {
    return NextResponse.json({ error: `A combo needs ${MIN_COMBO_PARTS}–${MAX_COMBO_PARTS} parts.` }, { status: 400 });
  }
  const parts: Record<string, unknown>[] = [];
  for (const raw of rawParts) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return NextResponse.json({ error: 'Each part must be a tile object.' }, { status: 400 });
    }
    const part = { ...(raw as Record<string, unknown>) };
    for (const k of PART_STRIPPED) delete part[k];
    parts.push(part);
  }
  const byId = new Map(existingParts.map((p) => [p.id, p]));
  const keptIds = new Set<number>();
  for (const p of parts) {
    if (p.id === undefined || p.id === null) continue;
    if (!Number.isInteger(p.id) || !byId.has(p.id as number) || keptIds.has(p.id as number)) {
      return NextResponse.json({ error: 'A part doesn’t belong to this combo.' }, { status: 400 });
    }
    keptIds.add(p.id as number);
  }
  const added = parts.filter((p) => p.id == null).length;
  const removed = existingParts.filter((p) => !keptIds.has(p.id));
  // Parts freeze with the combo once the event runs, like its kind and amount.
  if (frozen && (added > 0 || removed.length > 0)) {
    return NextResponse.json({ error: 'A combo’s parts can’t be added or removed once the event has started.' }, { status: 400 });
  }

  // Dry run: the combo, then every part, through the one validator.
  const combo = { ...body, parts: undefined };
  const dry = await applyTileUpdate(ctx, tile, combo, { dryRun: true, partCount: parts.length });
  if (!dry.ok) return dry;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const row = p.id != null ? byId.get(p.id as number)! : blankPartRow(tile);
    const res = await applyTileUpdate(ctx, row, p, { dryRun: true, asPart: true });
    if (!res.ok) return NextResponse.json({ error: `Part ${i + 1}: ${await errorOf(res)}` }, { status: res.status });
  }

  // Write: drop removed parts, save the combo, then each part (creating new ones first).
  if (removed.length > 0) await db.delete(tiles).where(inArray(tiles.id, removed.map((p) => p.id)));
  const saved = await applyTileUpdate(ctx, tile, combo, { partCount: parts.length });
  if (!saved.ok) return saved;
  const comboRow = (await saved.clone().json()) as TileRow;
  const savedParts: TileRow[] = [];
  for (const p of parts) {
    let row = p.id != null ? byId.get(p.id as number)! : null;
    if (!row) {
      const { id: _id, ...blank } = blankPartRow(comboRow);
      [row] = await db.insert(tiles).values({ ...blank, label: typeof p.label === 'string' && p.label.trim() ? p.label.trim().slice(0, 200) : 'Part' }).returning();
    }
    const res = await applyTileUpdate(ctx, row, p, { asPart: true });
    if (!res.ok) return NextResponse.json({ error: `Part: ${await errorOf(res)}` }, { status: res.status });
    savedParts.push((await res.json()) as TileRow);
  }
  // A part carries its combo's reveal state (lib/comboSql).
  await syncPartRevealState(ctx.eId);
  return NextResponse.json({ ...comboRow, parts: savedParts });
}

/**
 * Validate and apply one tile's update. Every tile — a board tile, a combo, a combo's part — is saved
 * through here. `dryRun` validates without writing (used before a combo save); `partCount` is a
 * combo's part count after the save; `asPart` marks a combo's part (no missions, no nested combos).
 */
async function applyTileUpdate(
  ctx: TileUpdateCtx,
  tile: TileRow,
  body: Record<string, unknown>,
  opts: { dryRun?: boolean; partCount?: number; asPart?: boolean } = {},
): Promise<NextResponse> {
  const { eId, editor, event, eventStarted, liveOverrideActive } = ctx;
  const tileId = tile.id;
  const { label, description, tileType, requiredAmount, trackedStat, statType, statGoal, statBasis, trackingMode, optional, lottery, autoTrackDisabled, trackedItemIds, itemRequirements, groupMode, setsRequired, countMode, perKillCap, coopCredit, coopMinMembers, points, effortConfig, category, sourceNpcs, targetNpcs, timedActivity, timeThresholdSeconds, partySize, minRaidLevel, partyTeamOnly, pvpMinLootValue, revealAt, revealState, mission, missionRules, capBy, comboRule, comboWeight } = body as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

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

  // Balance-only assumptions. They deliberately live outside tracking config: changing a ToA
  // invocation/unique-rate assumption must never change what loot source completes the tile.
  let effortConfigJson: string | null | undefined;
  if (effortConfig !== undefined) {
    if (effortConfig === null) {
      effortConfigJson = null;
    } else if (!effortConfig || typeof effortConfig !== 'object' || Array.isArray(effortConfig)) {
      return NextResponse.json({ error: 'effortConfig must be an object or null' }, { status: 400 });
    } else {
      const cfg = effortConfig as Record<string, unknown>;
      if (cfg.skillRating != null &&
          (!Number.isInteger(cfg.skillRating) || (cfg.skillRating as number) < 0 || (cfg.skillRating as number) > 5)) {
        return NextResponse.json({ error: 'effortConfig.skillRating must be an integer from 0 to 5' }, { status: 400 });
      }
      if (cfg.expectedHours != null &&
          (typeof cfg.expectedHours !== 'number' || !Number.isFinite(cfg.expectedHours) || cfg.expectedHours <= 0 || cfg.expectedHours > 100_000)) {
        return NextResponse.json({ error: 'effortConfig.expectedHours must be greater than 0 and at most 100,000' }, { status: 400 });
      }
      if (cfg.raid != null) {
        if (typeof cfg.raid !== 'object' || Array.isArray(cfg.raid)) {
          return NextResponse.json({ error: 'effortConfig.raid must be an object or null' }, { status: 400 });
        }
        const raid = cfg.raid as Record<string, unknown>;
        if (!isRaidEffortMode(raid.mode)) {
          return NextResponse.json({ error: 'effortConfig.raid.mode is not a supported raid mode' }, { status: 400 });
        }
        if (raid.uniqueDenominator != null &&
            (typeof raid.uniqueDenominator !== 'number' || !Number.isFinite(raid.uniqueDenominator) || raid.uniqueDenominator <= 1 || raid.uniqueDenominator > 1_000_000)) {
          return NextResponse.json({ error: 'Raid unique denominator must be greater than 1 and at most 1,000,000' }, { status: 400 });
        }
        if (raid.completionMinutes != null &&
            (typeof raid.completionMinutes !== 'number' || !Number.isFinite(raid.completionMinutes) || raid.completionMinutes <= 0 || raid.completionMinutes > 1_440)) {
          return NextResponse.json({ error: 'Raid completion minutes must be greater than 0 and at most 1,440' }, { status: 400 });
        }
        if (raid.raidLevel != null &&
            (!Number.isInteger(raid.raidLevel) || (raid.raidLevel as number) < 0 || (raid.raidLevel as number) > 1_000)) {
          return NextResponse.json({ error: 'Raid level must be an integer from 0 to 1,000' }, { status: 400 });
        }
      }
      const parsed = parseTileEffortConfig(effortConfig);
      effortConfigJson = parsed ? JSON.stringify(parsed) : null;
    }
  }

  if (trackedItemIds !== undefined && trackedItemIds !== null) {
    // A collection-log tile lists the items it counts, and a whole page can run past the drop cap.
    const itemCap = tileType === 'clog' ? MAX_CLOG_TILE_ITEMS : MAX_TRACKED_ITEMS;
    if (!Array.isArray(trackedItemIds) || trackedItemIds.length > itemCap ||
        !trackedItemIds.every((id: unknown) => Number.isInteger(id) && (id as number) > 0)) {
      return NextResponse.json({ error: `trackedItemIds must be an array of up to ${itemCap} positive integers` }, { status: 400 });
    }
  }

  if (itemRequirements !== undefined && itemRequirements !== null) {
    if (!Array.isArray(itemRequirements) || itemRequirements.length > MAX_TRACKED_ITEMS ||
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
      return NextResponse.json({ error: `Up to ${MAX_TRACKED_ITEMS} items; each itemRequirement must have a positive itemId, requiredAmount >= 1, an optional set name (≤30 chars), and an optional groupRequire of 1-100` }, { status: 400 });
    }
  }

  // How a collection's sets combine — 'any' (satisfy one) or 'all' (satisfy each). Null clears it
  // back to the default rather than storing a value.
  if (groupMode !== undefined && groupMode !== null && groupMode !== 'any' && groupMode !== 'all') {
    return NextResponse.json({ error: "groupMode must be 'any' or 'all'" }, { status: 400 });
  }
  // Sets a collection needs in any-set mode (lib/collectionSets setsRequired). Null = one set.
  if (setsRequired !== undefined && setsRequired !== null) {
    if (!Number.isInteger(setsRequired) || setsRequired < 1 || setsRequired > 50) {
      return NextResponse.json({ error: 'setsRequired must be an integer between 1 and 50 (or null for one set)' }, { status: 400 });
    }
  }
  // 'slots' / 'complete' are collection-log tiles' own modes (lib/clogTiles), checked against the kind below.
  if (countMode !== undefined && countMode !== null && countMode !== 'total' && countMode !== 'distinct' && countMode !== 'slots' && countMode !== 'complete') {
    return NextResponse.json({ error: "countMode must be 'total' or 'distinct'" }, { status: 400 });
  }

  // Most credits one kill can give this tile. Small ceiling: this exists to count rolls (1) or the
  // odd "a double still counts as two, but no more" case, not to express a requirement.
  // Shared-kill settings. 'per-kill' collapses a kill several members were in; coopMinMembers gates
  // it on how many of the team were there.
  if (coopCredit !== undefined && coopCredit !== null && coopCredit !== 'per-member' && coopCredit !== 'per-kill') {
    return NextResponse.json({ error: "coopCredit must be 'per-member' or 'per-kill'" }, { status: 400 });
  }
  if (coopMinMembers !== undefined && coopMinMembers !== null) {
    if (!Number.isInteger(coopMinMembers) || coopMinMembers < 2 || coopMinMembers > 50) {
      return NextResponse.json({ error: 'coopMinMembers must be an integer between 2 and 50 (or null for no requirement)' }, { status: 400 });
    }
  }

  // ToA raid level the run must end at. 0..600 in steps the game uses, but any integer in range is
  // accepted — the check is "at least", so an odd number only means "the next step up".
  if (minRaidLevel !== undefined && minRaidLevel !== null) {
    if (!Number.isInteger(minRaidLevel) || minRaidLevel < 1 || minRaidLevel > 600) {
      return NextResponse.json({ error: 'minRaidLevel must be an integer between 1 and 600 (or null for any level)' }, { status: 400 });
    }
  }

  // Per-member counter caps (lib/tileCaps): validated whole; null/''/[] clears.
  let capByJson: string | null | undefined;
  if (capBy !== undefined) {
    const parsed = validateCapBy(capBy);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    capByJson = serializeCapBy(parsed.value);
  }
  // A part's weight in a 'mix' combo (lib/combo) — only a part carries one.
  let comboWeightValue: number | null | undefined;
  if (comboWeight !== undefined) {
    const parsed = validateComboWeight(comboWeight);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    comboWeightValue = opts.asPart || tile.parentTileId != null ? parsed.value : null;
  }
  // Combo rule (lib/combo): validated against the part count the combo will have.
  let comboRuleJson: string | null | undefined;
  if (comboRule !== undefined) {
    if (comboRule === null || comboRule === '') {
      comboRuleJson = null;
    } else {
      const parsed = validateComboRule(comboRule, opts.partCount);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      comboRuleJson = serializeComboRule(parsed.value);
    }
  }

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

  // revealState: the host's manual override of what the engine decided — force a hidden tile OPEN
  // now, or pull an open one back to hidden. Every non-'scheduled' policy (interval, rotating,
  // bounty) picks its own tiles, which left hosts with no way to open a specific one; on those
  // boards this is the only per-tile reveal control there is. Admin-only: it changes what members
  // can score right now, which is a game decision rather than tile authoring.
  //   'live'   → revealedAt = now, closedAt cleared (a re-opened bounty/expired task is playable).
  //   'hidden' → revealedAt + closedAt cleared, so the engine may draw it again later.
  // On interval/rotating boards a manual reveal counts as a draw: the next one lands an interval
  // after it (lib/eventRules drawClock).
  if (revealState !== undefined) {
    if (revealState !== 'live' && revealState !== 'hidden') {
      return NextResponse.json({ error: "revealState must be 'live' or 'hidden'" }, { status: 400 });
    }
    if (!atLeast(editor.role, 'admin')) {
      return NextResponse.json({ error: 'Revealing or hiding a tile is admin-only.' }, { status: 403 });
    }
    if (opts.dryRun) return NextResponse.json({ ok: true });
    const [updated] = await db
      .update(tiles)
      .set(
        revealState === 'live'
          ? { revealedAt: new Date().toISOString(), closedAt: null, updatedAt: new Date().toISOString() }
          : { revealedAt: null, closedAt: null, revealStats: null, updatedAt: new Date().toISOString() },
      )
      .where(and(eq(tiles.id, tileId), eq(tiles.eventId, eId)))
      .returning();
    // A mission opened by hand counts from now, same as one the engine announces.
    if (revealState === 'live' && updated) await captureRevealStats([updated.id]);
    // A combo's parts follow it (lib/comboSql).
    await syncPartRevealState(eId);
    return NextResponse.json(updated);
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
    // Whether statGoal is an in-event gain or a lifetime threshold. Anything but the explicit
    // opt-in falls back to 'gain', so a malformed value can never silently re-interpret a live
    // tile's scoring.
    statBasis: statBasis !== undefined ? (statBasis === 'milestone' ? 'milestone' : 'gain') : tile.statBasis,
    trackingMode: trackingMode !== undefined ? trackingMode : tile.trackingMode,
    // optional is always editable
    optional: optional !== undefined ? (optional ? 1 : 0) : tile.optional,
    // lottery-ticket flag is cosmetic (recap award only), so always editable, even mid-event
    lottery: lottery !== undefined ? !!lottery : tile.lottery,
    // auto-tracking kill-switch — always editable, deliberately even after event start, so a
    // broken tile can be flipped to manual on a live board without waiting on a plugin release.
    autoTrackDisabled: autoTrackDisabled !== undefined ? (autoTrackDisabled ? 1 : 0) : tile.autoTrackDisabled,
    // point weight is always editable (admin can tune standings even mid-event)
    points: points !== undefined && points !== null ? points : tile.points,
    ...(effortConfigJson !== undefined ? { effortConfig: effortConfigJson } : {}),
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
  // Both stored as null for the default, like groupMode: one set, every drop counts.
  if (setsRequired !== undefined) {
    updateSet.setsRequired = setsRequired != null && setsRequired > 1 ? setsRequired : null;
  }
  if (countMode !== undefined) {
    updateSet.countMode = countMode === 'distinct' || countMode === 'slots' || countMode === 'complete' ? countMode : null;
  }

  if (perKillCap !== undefined) {
    updateSet.perKillCap = perKillCap ?? null;
  }

  if (coopCredit !== undefined) {
    updateSet.coopCredit = coopCredit === 'per-kill' ? 'per-kill' : null;
  }
  if (coopMinMembers !== undefined) {
    updateSet.coopMinMembers = coopMinMembers ?? null;
  }
  if (minRaidLevel !== undefined) {
    updateSet.minRaidLevel = minRaidLevel ?? null;
  }
  if (partyTeamOnly !== undefined) {
    updateSet.partyTeamOnly = partyTeamOnly ? 1 : null;
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
        setsRequired !== undefined ? setsRequired : tile.setsRequired,
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
    // A counter's cap and a combo's rule are part of the tile's rules, frozen with them once it runs.
    if (capByJson !== undefined) updateSet.capBy = capByJson;
    if (comboRuleJson !== undefined) updateSet.comboRule = comboRuleJson;
    if (comboWeightValue !== undefined) updateSet.comboWeight = comboWeightValue;
  }

  // Cross-validate the FINAL persisted state so a tile is always exactly one kind.
  // Prevents nonsense like a 10M-XP goal on a drop tile (stat tracking + drop tracking
  // on the same row), which downstream submission/cron logic would otherwise fight over.
  const merged = { ...tile, ...updateSet } as typeof tile;
  // A kills tile's counting engine (hiscores boss-stat vs plugin kill — lib/killSource) is frozen once
  // the event has started, live override or not: converting it mid-event would change how a running
  // board scores. The editor never sends one; this is the guard for anything else that might.
  if (eventStarted) {
    const sourceBefore = killSourceOf(tile);
    const sourceAfter = killSourceOf(merged);
    if (sourceBefore && sourceAfter && sourceBefore !== sourceAfter) {
      return NextResponse.json(
        { error: 'This tile’s kills are counted from the ' + (sourceBefore === 'hiscores' ? 'hiscores' : 'plugin') + ', and that can’t change once the event has started.' },
        { status: 400 },
      );
    }
  }
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
  // Agility-lap tiles reuse targetNpcs as the course list (verbatim lap-counter names from
  // AGILITY_COURSES) and requiredAmount as laps needed — the plugin counts them off the same
  // "Your <course> lap count is: N" line that drives boss KC.
  const isLap = merged.tileType === 'lap';
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
  // Collection-log tiles (lib/clogTiles): page names in targetNpcs, the chosen items in trackedItemIds,
  // countMode 'slots' | 'complete', requiredAmount = new slots (or pages) needed.
  const isClog = merged.tileType === 'clog';
  // requiredAmount is shared by drop (item count), kill (kill count), gain (items gained),
  // diary (completions), lms (qualifying games), value (gp threshold) and deathless (runs).
  const hasRequiredAmount = merged.requiredAmount != null;
  const hasDropItems = parseLen(merged.trackedItemIds) > 0 || parseLen(merged.itemRequirements) > 0;
  const hasSourceNpcs = parseLen(merged.sourceNpcs) > 0;

  // A tile is exactly one kind — stat tiles can't carry any submission-kind fields.
  if (hasStat && (isDrop || isKill || isLap || isPvp || isTimed || isDiary || isCa || isLms || isValue || isGain || isDeathless || isClog || dropItemFields || hasKillFields || hasTimedFields || hasRequiredAmount)) {
    return NextResponse.json(
      { error: 'A stat-tracked tile (skill/boss) cannot also be a drop, kill, lap, PvP, gain, timed, deathless, diary, CA, LMS, or value tile. Pick one kind.' },
      { status: 400 },
    );
  }
  // A cap limits a counted kill tile; nothing else has a count it could cap.
  if (merged.capBy && !capEligible(merged)) {
    return NextResponse.json({ error: 'Only kill / counter tiles can be capped by other counters.' }, { status: 400 });
  }
  // COMBO tiles (lib/combo). A combo has no engine of its own — just its rule and its parts — so it
  // carries no tracking fields; it can't be a mission (missions announce, expire and pay on their own
  // terms, which a combo's parts would have to follow) and it can't sit inside another combo.
  const isCombo = merged.tileType === COMBO_TILE_TYPE;
  if (isCombo) {
    if (tile.parentTileId != null || opts.asPart) {
      return NextResponse.json({ error: 'A combo’s part can’t be a combo itself.' }, { status: 400 });
    }
    if (merged.mission === 1 || mission === true) {
      return NextResponse.json({ error: 'A combo tile can’t be a mission.' }, { status: 400 });
    }
    if (!merged.comboRule) {
      return NextResponse.json({ error: "A combo needs a rule: any one, all, or at least N of its parts." }, { status: 400 });
    }
    if (opts.partCount == null) {
      return NextResponse.json({ error: 'Save a combo together with its parts.' }, { status: 400 });
    }
    if (hasStat || dropItemFields || hasKillFields || hasTimedFields || merged.requiredAmount != null) {
      return NextResponse.json({ error: 'A combo tracks nothing itself — its parts do. Clear its own tracking fields.' }, { status: 400 });
    }
  } else if (merged.comboRule) {
    updateSet.comboRule = null;
    merged.comboRule = null;
  }
  if ((opts.asPart || tile.parentTileId != null) && (mission === true || merged.mission === 1)) {
    return NextResponse.json({ error: 'A combo’s part can’t be a mission.' }, { status: 400 });
  }
  if (hasStat && merged.statType !== 'skill' && merged.statType !== 'boss') {
    return NextResponse.json({ error: "Stat tracking requires statType 'skill' or 'boss'." }, { status: 400 });
  }
  // Field/kind coherence for the submission-backed kinds.
  if (parseLen(merged.itemRequirements) > 0 && isClog) {
    return NextResponse.json({ error: 'A collection log tile lists its items plainly — per-item amounts are for drop collections.' }, { status: 400 });
  }
  if (hasDropItems && !isDrop && !isGain && !isClog) {
    return NextResponse.json({ error: 'Only drop or gain tiles can carry tracked items.' }, { status: 400 });
  }
  if (parseLen(merged.itemRequirements) > 0 && isGain) {
    return NextResponse.json({ error: 'Gain tiles track a flat item list — per-item requirements are for drop collections.' }, { status: 400 });
  }
  if (hasSourceNpcs && !isDrop && !isValue) {
    return NextResponse.json({ error: 'Only drop or value tiles can restrict loot sources.' }, { status: 400 });
  }
  if (hasKillFields && !isKill && !isLap && !isDiary && !isCa && !isPvp && !isClog) {
    return NextResponse.json({ error: 'Only kill tiles can target NPCs (or lap/diary/CA/PvP tiles, their selectors).' }, { status: 400 });
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
  // Timed tiles carry one only as a Barracuda Trials rank tile's runs-needed (lib/submissions).
  if (isClog) {
    const clogError = clogTileError(merged.countMode, parseJsonArray<string>(merged.targetNpcs), parseJsonArray<number>(merged.trackedItemIds), merged.requiredAmount);
    if (clogError) return NextResponse.json({ error: clogError }, { status: 400 });
  } else if (merged.countMode === 'slots' || merged.countMode === 'complete') {
    return NextResponse.json({ error: "countMode 'slots' / 'complete' is for collection log tiles." }, { status: 400 });
  }
  if (hasRequiredAmount && !isDrop && !isKill && !isLap && !isPvp && !isGain && !isDiary && !isCa && !isLms && !isValue && !isDeathless && !isTimed && !isClog) {
    return NextResponse.json({ error: 'Only drop, kill, lap, PvP, gain, diary, CA, LMS, value, deathless, or timed (trial runs) tiles can have a required amount.' }, { status: 400 });
  }

  // CONVERTING an existing board tile into a mission.
  //
  // On a classic N×N grid this is refused outright. The grid renders tiles in sorted-position ARRAY
  // order (components/BingoBoard) while the line maths reads ABSOLUTE row-major positions
  // (lib/bingoLines: r * size + c) — the two agree only while positions run 0..N²-1 with no gaps.
  // Pulling a tile out of the board (which is what the mission flag does, via boardTiles) leaves 24
  // tiles in a 25-cell square however the positions are then juggled: either a hole, or every later
  // tile shifted a cell while the line maths still points at the old geometry. Neither is a square
  // board. Adding a mission is the supported move, and now works on a grid (see POST).
  //
  // Everywhere else — points lists, tile races, ladders — position is just order, so the tile moves
  // to the end and nothing is disturbed.
  if (opts.dryRun) return NextResponse.json({ ok: true });

  if (mission === true && !isMissionTile(tile)) {
    const isClassicGrid = (event?.format ?? 'bingo') === 'bingo' && (event?.scoringMode ?? 'tiles') === 'tiles';
    if (isClassicGrid) {
      return NextResponse.json(
        {
          error:
            'A tile already on the grid cannot become a mission — it would leave a hole in the square. Add a mission instead; missions live outside the board.',
        },
        { status: 400 },
      );
    }
    const [furthest] = await db
      .select({ position: sql<number>`max(${tiles.position})` })
      .from(tiles)
      .where(eq(tiles.eventId, eId));
    const maxPosition = furthest?.position ?? tile.position;
    if (maxPosition > tile.position) updateSet.position = maxPosition + 1;
  }

  const [updated] = await db
    .update(tiles)
    .set(updateSet)
    .where(eq(tiles.id, tileId))
    .returning();

  // A combo's parts carry its reveal time (lib/comboSql).
  if (revealAtValue !== undefined && updated.tileType === COMBO_TILE_TYPE) await syncPartRevealState(eId);

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
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, eId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const editor = await verifyTileEditorForEvent(eId, 'create');
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

  // Read the body up front: whether this is a MISSION changes which guards apply.
  let body: Record<string, unknown> = {};
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
  } catch {
    /* empty body is fine — a blank tile with a placeholder label */
  }
  const asMission = body.mission === true;

  const isClassicGrid = (event.format ?? 'bingo') === 'bingo' && (event.scoringMode ?? 'tiles') === 'tiles';
  // A classic grid is a fixed N×N board, so its board tiles can't be added one at a time. A MISSION
  // isn't a board tile — it lives outside the grid, scores as a bonus and never enters the N×N (see
  // lib/boardScoring) — so this is the one add a square board accepts. Without the exemption, the
  // format missions were designed for is the only format that can't have them.
  if (isClassicGrid && !asMission) {
    return NextResponse.json(
      { error: 'A classic bingo grid is a fixed N×N board — tiles cannot be added individually.' },
      { status: 400 },
    );
  }
  if (event.startDate && new Date(event.startDate) <= new Date()) {
    return NextResponse.json({ error: 'Tiles cannot be added after the event has started.' }, { status: 400 });
  }

  // Board tiles only: a combo's parts (lib/combo) are neither cells nor positions.
  const existing = await db.select({ position: tiles.position }).from(tiles).where(and(eq(tiles.eventId, eId), isNull(tiles.parentTileId)));
  if (existing.length >= MAX_TILES) {
    return NextResponse.json({ error: `Events are capped at ${MAX_TILES} tiles.` }, { status: 400 });
  }
  const nextPosition = existing.length === 0 ? 0 : Math.max(...existing.map((t) => t.position)) + 1;

  let label = asMission ? `Mission ${nextPosition + 1}` : `Tile ${nextPosition + 1}`;
  let duplicateOf: number | null = null;
  if (typeof body.label === 'string' && body.label.trim()) label = body.label.trim().slice(0, 200);
  if (Number.isInteger(body.duplicateOf)) duplicateOf = body.duplicateOf as number;

  // Duplicating copies the whole row rather than a list of fields the client knows about. A tile has
  // ~30 configurable columns and gains more with every tile kind; enumerating them anywhere but here
  // guarantees that the next one silently fails to copy.
  let source: typeof tiles.$inferSelect | null = null;
  if (duplicateOf !== null) {
    source = (await db.query.tiles.findFirst({ where: eq(tiles.id, duplicateOf) })) ?? null;
    // Scoped to this event: a tile id from another board is not this editor's to read.
    if (!source || source.eventId !== eId || source.parentTileId != null) {
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
            revealStats: _revealStats,
            updatedAt: _updatedAt,
            // A copy joins no route until the host places it (the Route view).
            raceStep: _raceStep,
            raceNext: _raceNext,
            ...config
          } = source;
          return { ...config, eventId: eId, position: nextPosition, label, mission: asMission ? 1 : config.mission };
        })()
      : { eventId: eId, position: nextPosition, label, mission: asMission ? 1 : 0 };
    const [tile] = await tx.insert(tiles).values(values).returning();
    // Duplicating a combo copies its parts under the copy (lib/combo).
    if (source && source.tileType === COMBO_TILE_TYPE) {
      const parts = await tx.select().from(tiles).where(eq(tiles.parentTileId, source.id));
      for (const part of parts) {
        const { id: _pid, revealedAt: _r, closedAt: _c, revealStats: _s, updatedAt: _u, ...partConfig } = part;
        await tx.insert(tiles).values({ ...partConfig, parentTileId: tile.id, position: tile.position, revealAt: tile.revealAt });
      }
    }
    // Keep boardSize == BOARD tile count so the display helpers (eventTileCount / eventShapeBadge)
    // stay accurate. A mission is not a board tile, so it must not grow the board — on a 5×5 that
    // would turn the grid into a 26-tile board with a hole in it.
    if (!asMission) {
      await tx.update(events).set({ boardSize: existing.length + 1 }).where(eq(events.id, eId));
    }
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

  track('tile.created', { clanId: event.clanId, userId: editor.userId, props: { duplicate: !!source, mission: !!asMission } });

  return NextResponse.json(created, { status: 201 });
}
