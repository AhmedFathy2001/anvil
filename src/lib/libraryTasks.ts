// The Anvil task library: tasks every clan can browse and import (schema `library_tasks`).
//
// Same copy rule as guides (lib/guides). An imported task is a row in the clan's own library
// (`tile_library`) that FOLLOWS its Anvil task while untouched — every Anvil save rewrites it, so a
// fix made here reaches every clan that hasn't changed the task. The clan's first edit forks it
// (lib/tileLibrary.updateTask). After that, a newer Anvil version is an OFFER the clan takes (and
// goes back to following) or keeps (and stays on its own version).
//
// Authority lives in the routes: writing the library is lib/guideAccess.canEditLibrary (Anvil staff
// or a library editor), importing is a clan's tile authors.

import { and, asc, eq, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { libraryTasks, tileLibrary } from '@/db/schema';
import type { TileCsvRow } from '@/lib/csvTiles';
import { sanitizeRow } from '@/lib/libraryBoards';

export interface AnvilTask {
  id: number;
  key: string;
  label: string;
  description: string | null;
  category: string | null;
  tileType: string;
  points: number;
  config: TileCsvRow;
  version: number;
  archived: boolean;
  updatedAt: string;
}

export interface AnvilTaskInput {
  label: string;
  description?: string | null;
  category?: string | null;
  points: number;
  config: TileCsvRow;
}

const nowIso = () => new Date().toISOString();

function parse(raw: string): TileCsvRow {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? (v as TileCsvRow) : {};
  } catch {
    return {};
  }
}

function toTask(r: typeof libraryTasks.$inferSelect): AnvilTask {
  return {
    id: r.id,
    key: r.key,
    label: r.label,
    description: r.description,
    category: r.category,
    tileType: r.tileType,
    points: r.points,
    config: parse(r.config),
    version: r.version,
    archived: r.archived,
    updatedAt: r.updatedAt,
  };
}

/** The stored config always mirrors label/points/category/description — the importer reads them off it. */
function storedConfig(input: AnvilTaskInput): string {
  // Only real tile fields, type-checked — the same cleaning a board suggestion gets (libraryBoards).
  input = { ...input, config: sanitizeRow({ ...input.config, label: input.label || 'task' }) };
  const tileType = (input.config.tileType as string | undefined) === 'stat' ? 'standard' : input.config.tileType;
  return JSON.stringify({
    ...input.config,
    ...(tileType ? { tileType } : {}),
    label: input.label,
    points: input.points,
    category: input.category ?? null,
    description: input.description ?? input.config.description ?? null,
  });
}

/** A url-safe key from a label, made unique against what exists. */
async function freshKey(label: string): Promise<string> {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'task';
  for (let n = 0; n < 50; n++) {
    const key = n === 0 ? base : `${base}-${n + 1}`;
    const hit = await db.query.libraryTasks.findFirst({ where: eq(libraryTasks.key, key), columns: { id: true } });
    if (!hit) return key;
  }
  return `${base}-${Date.now()}`;
}

/** Every live Anvil task (archived ones too, for staff), cheapest first. */
export async function listAnvilTasks(opts: { includeArchived?: boolean } = {}): Promise<AnvilTask[]> {
  const rows = await db
    .select()
    .from(libraryTasks)
    .where(opts.includeArchived ? undefined : eq(libraryTasks.archived, false))
    .orderBy(asc(libraryTasks.points), asc(libraryTasks.label));
  return rows.map(toTask);
}

export async function getAnvilTask(id: number): Promise<AnvilTask | null> {
  const row = await db.query.libraryTasks.findFirst({ where: eq(libraryTasks.id, id) });
  return row ? toTask(row) : null;
}

export async function anvilCategories(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ c: libraryTasks.category })
    .from(libraryTasks)
    .where(and(eq(libraryTasks.archived, false), isNotNull(libraryTasks.category)));
  return rows.map((r) => r.c!).sort((a, b) => a.localeCompare(b));
}

/**
 * Create (id null) or update an Anvil task. An update bumps the version and rewrites every clan copy
 * that still follows it, in the same transaction — a following copy is never seen half-updated.
 */
export async function saveAnvilTask(id: number | null, input: AnvilTaskInput, actorUserId: number | null): Promise<AnvilTask> {
  const label = input.label.trim().slice(0, 200);
  if (!label) throw new Error('A task needs a name.');
  const clean: AnvilTaskInput = {
    ...input,
    label,
    points: Math.max(0, Math.round(input.points)),
    category: input.category?.trim().slice(0, 120) || null,
    description: input.description?.trim() || null,
  };
  const config = storedConfig(clean);
  const tileType = (parse(config).tileType as string | undefined) || 'standard';
  const now = nowIso();

  if (id == null) {
    const [row] = await db
      .insert(libraryTasks)
      .values({
        key: await freshKey(label),
        label,
        description: clean.description,
        category: clean.category,
        tileType,
        points: clean.points,
        config,
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return toTask(row);
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(libraryTasks)
      .set({
        label,
        description: clean.description,
        category: clean.category,
        tileType,
        points: clean.points,
        config,
        version: sql`${libraryTasks.version} + 1`,
        updatedByUserId: actorUserId,
        updatedAt: now,
      })
      .where(eq(libraryTasks.id, id))
      .returning();
    if (!row) throw new Error('Task not found.');
    // clan-scope: global -- the Anvil library is platform-wide by design; this rewrites exactly the
    // copies that chose to follow this task, in every clan, which is the whole point of following.
    await tx
      .update(tileLibrary)
      .set({
        label,
        description: clean.description,
        category: clean.category,
        tileType,
        points: clean.points,
        config,
        sourceVersion: row.version,
      })
      .where(and(eq(tileLibrary.sourceTaskId, id), eq(tileLibrary.followsSource, true)));
    return toTask(row);
  });
}

/** Archive hides a task from browsing; clan copies keep it. Never deleted — copies point at it. */
export async function setAnvilTaskArchived(id: number, archived: boolean, actorUserId: number | null): Promise<void> {
  await db
    .update(libraryTasks)
    .set({ archived, updatedByUserId: actorUserId, updatedAt: nowIso() })
    .where(eq(libraryTasks.id, id));
}

/** Which Anvil tasks this clan already has a copy of (followed or forked). */
export async function importedTaskIds(clanId: number): Promise<Set<number>> {
  const rows = await db
    .select({ id: tileLibrary.sourceTaskId })
    .from(tileLibrary)
    .where(and(eq(tileLibrary.clanId, clanId), isNotNull(tileLibrary.sourceTaskId)));
  return new Set(rows.map((r) => r.id!));
}

/**
 * Copy Anvil tasks into a clan's library (all not-yet-imported ones when `ids` is omitted). Each copy
 * follows its task. Skips anything the clan already has — a double click never duplicates.
 */
export async function importAnvilTasks(clanId: number, ids: number[] | undefined, userId: number | null): Promise<number> {
  const have = await importedTaskIds(clanId);
  const pool = (await listAnvilTasks()).filter((t) => !have.has(t.id));
  const wanted = ids?.length ? pool.filter((t) => ids.includes(t.id)) : pool;
  if (wanted.length === 0) return 0;
  const added = await db
    .insert(tileLibrary)
    .values(
      wanted.map((t) => ({
        clanId,
        label: t.label,
        description: t.description,
        tileType: t.tileType,
        points: t.points,
        category: t.category,
        config: JSON.stringify(t.config),
        // The task's key doubles as the old seed key, so the (clan, seed_key) unique index keeps
        // this idempotent across both the old import path and this one.
        seedKey: t.key,
        sourceTaskId: t.id,
        sourceVersion: t.version,
        followsSource: true,
        createdByUserId: userId,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: tileLibrary.id });
  return added.length;
}

export interface TaskOffer {
  /** The clan's own (forked) copy. */
  rowId: number;
  label: string;
  /** What Anvil's task looks like now. */
  task: AnvilTask;
}

/** Forked copies whose Anvil task has moved on since — what "Anvil updated N of your tasks" lists. */
export async function taskOffers(clanId: number): Promise<TaskOffer[]> {
  const rows = await db
    .select({ rowId: tileLibrary.id, label: tileLibrary.label, task: libraryTasks })
    .from(tileLibrary)
    .innerJoin(libraryTasks, eq(tileLibrary.sourceTaskId, libraryTasks.id))
    .where(
      and(
        eq(tileLibrary.clanId, clanId),
        eq(tileLibrary.followsSource, false),
        eq(libraryTasks.archived, false),
        lt(tileLibrary.sourceVersion, libraryTasks.version),
      ),
    );
  return rows.map((r) => ({ rowId: r.rowId, label: r.label, task: toTask(r.task) }));
}

/**
 * Answer an offer. 'take' replaces the clan's copy with Anvil's and follows again; 'keep' records
 * that this version was seen, so it stops asking until Anvil changes the task again.
 */
export async function answerOffer(clanId: number, rowId: number, answer: 'take' | 'keep'): Promise<boolean> {
  const row = await db.query.tileLibrary.findFirst({
    where: and(eq(tileLibrary.id, rowId), eq(tileLibrary.clanId, clanId)),
    columns: { id: true, sourceTaskId: true },
  });
  if (!row?.sourceTaskId) return false;
  const task = await getAnvilTask(row.sourceTaskId);
  if (!task) return false;
  const scope = and(eq(tileLibrary.id, rowId), eq(tileLibrary.clanId, clanId));
  if (answer === 'keep') {
    await db.update(tileLibrary).set({ sourceVersion: task.version }).where(scope);
    return true;
  }
  await db
    .update(tileLibrary)
    .set({
      label: task.label,
      description: task.description,
      category: task.category,
      tileType: task.tileType,
      points: task.points,
      config: JSON.stringify(task.config),
      sourceVersion: task.version,
      followsSource: true,
    })
    .where(scope);
  return true;
}

/** Many at once, for "take all" — the ids are matched against this clan only. */
export async function answerOffers(clanId: number, rowIds: number[], answer: 'take' | 'keep'): Promise<number> {
  if (rowIds.length === 0) return 0;
  const mine = await db
    .select({ id: tileLibrary.id })
    .from(tileLibrary)
    .where(and(eq(tileLibrary.clanId, clanId), inArray(tileLibrary.id, rowIds)));
  let n = 0;
  for (const r of mine) if (await answerOffer(clanId, r.id, answer)) n++;
  return n;
}
