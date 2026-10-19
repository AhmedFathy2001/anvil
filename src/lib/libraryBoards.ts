// The board library: ready-made boards any clan can start an event from (schema `library_boards`).
//
// Two kinds, told apart by `origin`:
//   'anvil'     — curated by Anvil staff and library editors. Anyone can suggest a change to one
//                 (lib/libraryProposals, kind 'board-edit'); staff approve or reject it.
//   'community' — published straight from a clan's event, no review. The publishing clan can edit
//                 its details, unpublish it or delete it; staff can hide one that shouldn't be there.
//
// A board is copied into an event when one is created from it and never followed afterwards — an
// event's tiles are its own (events.library_board_id only remembers where it came from).

import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { clans, events, libraryBoards, tiles } from '@/db/schema';
import { tileToCsvRow, type TileCsvRow } from '@/lib/csvTiles';
import { modeKeyFor, type EventMode } from '@/lib/eventModes';
import { isPlaceholderTile } from '@/lib/placeholderTile';
import { parseTileEffortConfig } from '@/lib/tileEffortConfig';
import type { Tile } from '@/lib/types';

export const BOARD_AUDIENCES = ['casual', 'mid', 'endgame', 'mixed'] as const;
export type BoardAudience = (typeof BOARD_AUDIENCES)[number];

/** What a board is about — the filter chips. Free text is not allowed so the filter stays useful. */
export const BOARD_TAGS = [
  'pvm',
  'raids',
  'skilling',
  'slayer',
  'clues',
  'pets',
  'collection-log',
  'wilderness',
  'minigames',
  'ironman',
  'f2p',
  'fun',
] as const;

export interface LibraryBoard {
  id: number;
  title: string;
  description: string;
  origin: 'anvil' | 'community';
  clanId: number | null;
  clanName: string | null;
  mode: EventMode;
  boardSize: number;
  tiles: TileCsvRow[];
  audience: BoardAudience;
  tags: string[];
  suggestedDays: number | null;
  teamsMin: number | null;
  teamsMax: number | null;
  /** 'hidden' = the clan unpublished it; 'removed' = Anvil staff took it down, which only staff can undo. */
  status: 'published' | 'hidden' | 'removed';
  version: number;
  useCount: number;
  updatedAt: string;
}

export interface BoardMeta {
  title: string;
  description?: string;
  audience?: string;
  tags?: string[];
  suggestedDays?: number | null;
  teamsMin?: number | null;
  teamsMax?: number | null;
}

const nowIso = () => new Date().toISOString();

function parseTiles(raw: string): TileCsvRow[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as TileCsvRow[]) : [];
  } catch {
    return [];
  }
}

function toBoard(r: typeof libraryBoards.$inferSelect, clanName: string | null): LibraryBoard {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    origin: r.origin === 'anvil' ? 'anvil' : 'community',
    clanId: r.clanId,
    clanName,
    mode: r.mode as EventMode,
    boardSize: r.boardSize,
    tiles: parseTiles(r.tiles),
    audience: (BOARD_AUDIENCES as readonly string[]).includes(r.audience) ? (r.audience as BoardAudience) : 'mixed',
    tags: r.tags ?? [],
    suggestedDays: r.suggestedDays,
    teamsMin: r.teamsMin,
    teamsMax: r.teamsMax,
    status: r.status === 'removed' ? 'removed' : r.status === 'hidden' ? 'hidden' : 'published',
    version: r.version,
    useCount: r.useCount,
    updatedAt: r.updatedAt,
  };
}

/** Clean meta from a request: bounded text, known audience/tags only, sane numbers. */
export function cleanMeta(m: BoardMeta): Required<BoardMeta> {
  const n = (v: unknown, lo: number, hi: number) => {
    const x = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null;
    return x == null ? null : Math.min(hi, Math.max(lo, x));
  };
  const teamsMin = n(m.teamsMin, 1, 50);
  const teamsMax = n(m.teamsMax, 1, 50);
  return {
    title: (m.title ?? '').trim().slice(0, 80),
    description: (m.description ?? '').trim().slice(0, 1000),
    audience: (BOARD_AUDIENCES as readonly string[]).includes(m.audience ?? '') ? m.audience! : 'mixed',
    tags: [...new Set((m.tags ?? []).filter((t) => (BOARD_TAGS as readonly string[]).includes(t)))],
    suggestedDays: n(m.suggestedDays, 1, 120),
    teamsMin,
    teamsMax: teamsMin != null && teamsMax != null && teamsMax < teamsMin ? teamsMin : teamsMax,
  };
}

/**
 * A board's tiles as library rows: board order, placeholders dropped, and the per-event parts left
 * behind — reveal times and mission ladders belong to the event they were set for.
 */
export function rowsForLibrary(eventTiles: Tile[]): TileCsvRow[] {
  return [...eventTiles]
    .filter((t) => !isPlaceholderTile(t))
    .sort((a, b) => a.position - b.position)
    .map((t) => {
      const row = tileToCsvRow(t) as Record<string, unknown>;
      for (const k of ['revealAt', 'mission', 'missionPrizes', 'missionPoints', 'missionMaxClaims', 'missionExpiryHours', 'missionRules']) delete row[k];
      return row as TileCsvRow;
    });
}

/**
 * Tiles from outside (a board-change suggestion) reduced to what a library tile may carry, with each
 * field type-checked. Unknown keys — mission ladders, reveal times, anything else — are dropped, and
 * a row that isn't a usable tile throws. Run when a suggestion is filed AND when it's approved, so
 * what staff review is exactly what gets written.
 */
const NUM_KEYS = ['requiredAmount', 'points', 'statGoal', 'timeThresholdSeconds', 'setsRequired', 'perKillCap', 'coopMinMembers'] as const;
const STR_KEYS = ['description', 'tileType', 'category', 'trackedStat', 'statType', 'statBasis', 'timedActivity', 'groupMode', 'countMode', 'coopCredit'] as const;
export function sanitizeRows(input: unknown, opts: { mode: EventMode; boardSize: number }): TileCsvRow[] {
  if (!Array.isArray(input)) throw new Error('Tiles must be a list.');
  if (opts.mode === 'classic' ? input.length !== opts.boardSize * opts.boardSize : input.length < 1 || input.length > 200) {
    throw new Error(
      opts.mode === 'classic'
        ? `A ${opts.boardSize}×${opts.boardSize} board needs exactly ${opts.boardSize * opts.boardSize} tiles.`
        : 'A board needs between 1 and 200 tiles.',
    );
  }
  return input.map((raw, i) => sanitizeRow(raw, i));
}

/** One tile, cleaned the same way (sanitizeRows). `i` only numbers the error message. */
export function sanitizeRow(raw: unknown, i = 0): TileCsvRow {
  {
    const r = (raw ?? {}) as Record<string, unknown>;
    const label = typeof r.label === 'string' ? r.label.trim().slice(0, 200) : '';
    if (!label) throw new Error(`Tile ${i + 1} needs a name.`);
    const out: Record<string, unknown> = { label };
    for (const k of NUM_KEYS) {
      const v = r[k];
      if (v == null) continue;
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1e12) throw new Error(`Tile ${i + 1}: ${k} must be a number.`);
      out[k] = v;
    }
    for (const k of STR_KEYS) {
      const v = r[k];
      if (v == null) continue;
      if (typeof v !== 'string') throw new Error(`Tile ${i + 1}: ${k} must be text.`);
      out[k] = v.slice(0, k === 'description' ? 1000 : 120);
    }
    if (r.optional != null) out.optional = r.optional === true;
    // Balance-only assumptions; parsed the same way the importer parses them, so junk can't ride in.
    const effort = parseTileEffortConfig(r.effortConfig as never);
    if (effort) out.effortConfig = effort;
    if (r.targetNpcs != null) {
      if (!Array.isArray(r.targetNpcs) || r.targetNpcs.some((n) => typeof n !== 'string')) throw new Error(`Tile ${i + 1}: targets must be names.`);
      out.targetNpcs = (r.targetNpcs as string[]).slice(0, 50).map((n) => n.slice(0, 120));
    }
    if (r.items != null) {
      if (!Array.isArray(r.items)) throw new Error(`Tile ${i + 1}: items must be a list.`);
      out.items = (r.items as Record<string, unknown>[]).slice(0, 100).map((it) => {
        const count = typeof it?.count === 'number' && Number.isInteger(it.count) && it.count > 0 ? it.count : 1;
        const item: Record<string, unknown> = { name: typeof it?.name === 'string' ? it.name.slice(0, 120) : '', count };
        if (typeof it?.id === 'number' && Number.isInteger(it.id) && it.id > 0) item.id = it.id;
        if (typeof it?.group === 'string' && it.group) item.group = it.group.slice(0, 30);
        if (typeof it?.groupRequire === 'number' && Number.isInteger(it.groupRequire) && it.groupRequire > 0) item.groupRequire = it.groupRequire;
        if (!item.id && !item.name) throw new Error(`Tile ${i + 1}: an item needs a name or id.`);
        return item;
      });
    }
    return out as TileCsvRow;
  }
}

/** Published boards (or every board, for staff), most used first within each origin. */
export async function listBoards(opts: { includeHidden?: boolean; clanId?: number } = {}): Promise<LibraryBoard[]> {
  const where = and(
    opts.includeHidden ? undefined : eq(libraryBoards.status, 'published'),
    opts.clanId != null ? eq(libraryBoards.clanId, opts.clanId) : undefined,
  );
  const rows = await db
    .select({ b: libraryBoards, clanName: clans.name })
    .from(libraryBoards)
    .leftJoin(clans, eq(libraryBoards.clanId, clans.id))
    .where(where)
    .orderBy(asc(libraryBoards.origin), desc(libraryBoards.useCount), desc(libraryBoards.updatedAt));
  return rows.map((r) => toBoard(r.b, r.clanName));
}

export async function getBoard(id: number): Promise<LibraryBoard | null> {
  const [row] = await db
    .select({ b: libraryBoards, clanName: clans.name })
    .from(libraryBoards)
    .leftJoin(clans, eq(libraryBoards.clanId, clans.id))
    .where(eq(libraryBoards.id, id));
  return row ? toBoard(row.b, row.clanName) : null;
}

/**
 * Publish an event's board to the community library. The caller has already checked the event is
 * this clan's and that the person is its admin. Needs a real board — at least four written tiles.
 */
export async function publishFromEvent(
  clanId: number,
  userId: number | null,
  eventId: number,
  meta: BoardMeta,
): Promise<LibraryBoard> {
  const event = await db.query.events.findFirst({ where: and(eq(events.id, eventId), eq(events.clanId, clanId)) });
  if (!event) throw new Error('Event not found.');
  const eventTiles = (await db.select().from(tiles).where(eq(tiles.eventId, eventId))) as unknown as Tile[];
  const rows = rowsForLibrary(eventTiles);
  if (rows.length < 4) throw new Error('Write at least four tiles before sharing a board.');
  const m = cleanMeta(meta);
  if (!m.title) throw new Error('Give the board a name.');
  const mode = modeKeyFor(event.format, event.scoringMode, event.rules);
  const now = nowIso();
  const [row] = await db
    .insert(libraryBoards)
    .values({
      ...m,
      origin: 'community',
      clanId,
      publishedByUserId: userId,
      mode,
      // A classic grid keeps its N; a list board's size is its tile count.
      boardSize: mode === 'classic' ? event.boardSize : rows.length,
      tiles: JSON.stringify(rows),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return (await getBoard(row.id))!;
}

/** Edit a board's details. Community boards: the publishing clan. Anvil boards: staff (the route decides). */
export async function updateBoardMeta(id: number, meta: BoardMeta): Promise<void> {
  const m = cleanMeta(meta);
  if (!m.title) throw new Error('Give the board a name.');
  await db.update(libraryBoards).set({ ...m, updatedAt: nowIso() }).where(eq(libraryBoards.id, id));
}

/** Replace a board's tiles (an approved suggestion, or staff editing an Anvil board). Bumps the version. */
export async function replaceBoardTiles(id: number, rows: TileCsvRow[], boardSize?: number): Promise<void> {
  await db
    .update(libraryBoards)
    .set({
      tiles: JSON.stringify(rows),
      ...(boardSize ? { boardSize } : {}),
      version: sql`${libraryBoards.version} + 1`,
      updatedAt: nowIso(),
    })
    .where(eq(libraryBoards.id, id));
}

export async function setBoardStatus(id: number, status: 'published' | 'hidden' | 'removed'): Promise<void> {
  await db.update(libraryBoards).set({ status, updatedAt: nowIso() }).where(eq(libraryBoards.id, id));
}

/** Delete a community board for good. Events made from it keep their tiles (the link goes null). */
export async function deleteBoard(id: number): Promise<void> {
  await db.delete(libraryBoards).where(and(eq(libraryBoards.id, id), eq(libraryBoards.origin, 'community')));
}

/** Create an Anvil board (staff), from rows already in library shape. */
export async function createAnvilBoard(
  userId: number | null,
  input: BoardMeta & { mode: EventMode; boardSize: number; tiles: TileCsvRow[] },
): Promise<LibraryBoard> {
  const m = cleanMeta(input);
  if (!m.title) throw new Error('Give the board a name.');
  const now = nowIso();
  const [row] = await db
    .insert(libraryBoards)
    .values({
      ...m,
      origin: 'anvil',
      clanId: null,
      publishedByUserId: userId,
      mode: input.mode,
      boardSize: input.boardSize,
      tiles: JSON.stringify(input.tiles),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return (await getBoard(row.id))!;
}

/** Remember which board an event came from, and count the use. Best-effort bookkeeping. */
export async function recordBoardUse(boardId: number, eventId: number, clanId: number): Promise<void> {
  const board = await db.query.libraryBoards.findFirst({ where: eq(libraryBoards.id, boardId), columns: { id: true } });
  if (!board) return;
  const updated = await db
    .update(events)
    .set({ libraryBoardId: boardId })
    .where(and(eq(events.id, eventId), eq(events.clanId, clanId)))
    .returning({ id: events.id });
  if (updated.length) {
    await db.update(libraryBoards).set({ useCount: sql`${libraryBoards.useCount} + 1` }).where(eq(libraryBoards.id, boardId));
  }
}
