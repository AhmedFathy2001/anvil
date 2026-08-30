import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { tileLibrary } from '@/db/schema';
import { getTierBands } from '@/lib/pluginConfig';
import { tileTierKey, type TierBand } from '@/lib/tileFilter';
import type { TileCsvRow } from '@/lib/csvTiles';
import seed from '@/data/tileLibrarySeed.json';

// The clan's reusable task catalogue. Rows are owned by the clan (editable, deletable); the seed
// file is only ever a starting point, copied in on demand and diffable when a later release adds
// more. Tier is derived from points through the clan's own bands, never stored — see schema.

export interface SeedTask {
  key: string;
  label: string;
  category?: string;
  points: number;
  config: TileCsvRow;
}

export interface LibraryTask {
  id: number;
  label: string;
  description: string | null;
  tileType: string;
  points: number;
  category: string | null;
  /** Derived from `points` via the clan's tier bands — recomputed on read, never persisted. */
  tier: string | null;
  seedKey: string | null;
  sourceEventId: number | null;
  config: TileCsvRow;
}

export const SEED_TASKS: SeedTask[] = (seed as { tasks: SeedTask[] }).tasks;

function parseConfig(raw: string): TileCsvRow {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as TileCsvRow) : {};
  } catch {
    return {};
  }
}

function toTask(
  row: typeof tileLibrary.$inferSelect,
  bands: TierBand[],
): LibraryTask {
  return {
    id: row.id,
    label: row.label,
    description: row.description,
    tileType: row.tileType,
    points: row.points,
    category: row.category,
    tier: tileTierKey(row.points, bands),
    seedKey: row.seedKey,
    sourceEventId: row.sourceEventId,
    config: parseConfig(row.config),
  };
}

/** Every task in the catalogue, tier-annotated with the clan's current bands. */
export async function listLibrary(clanId: number): Promise<LibraryTask[]> {
  const [rows, bands] = await Promise.all([
    db.select().from(tileLibrary).where(eq(tileLibrary.clanId, clanId)).orderBy(tileLibrary.points, tileLibrary.label),
    getTierBands(clanId),
  ]);
  return rows.map((r) => toTask(r, bands));
}

/** Seed keys this clan already has — the basis for "N new starter tasks available". */
export async function seededKeys(clanId: number): Promise<Set<string>> {
  const rows = await db
    .select({ seedKey: tileLibrary.seedKey })
    .from(tileLibrary)
    .where(and(eq(tileLibrary.clanId, clanId), isNotNull(tileLibrary.seedKey)));
  return new Set(rows.map((r) => r.seedKey).filter((k): k is string => !!k));
}

/** Starter tasks this clan has never had. Excludes ones they imported and then deleted? No — a
 *  deleted row frees its key, so a delete is a "give it back later" rather than a permanent no.
 *  That's the honest reading of a catalogue the clan owns: nothing is hidden from them forever. */
export async function pendingSeedTasks(clanId: number): Promise<SeedTask[]> {
  const have = await seededKeys(clanId);
  return SEED_TASKS.filter((t) => !have.has(t.key));
}

/**
 * Copy the given starter tasks in (all pending ones when `keys` is omitted). Idempotent: the unique
 * index on seed_key means a double-click can't duplicate anything, and we skip what's already there.
 */
export async function importSeedTasks(clanId: number, keys?: string[], userId?: number | null): Promise<number> {
  const pending = await pendingSeedTasks(clanId);
  const wanted = keys?.length ? pending.filter((t) => keys.includes(t.key)) : pending;
  if (wanted.length === 0) return 0;

  await db.insert(tileLibrary).values(
    wanted.map((t) => ({
      clanId,
      label: t.label,
      description: t.config.description ?? null,
      tileType: t.config.tileType || 'standard',
      points: t.points,
      category: t.category ?? null,
      config: JSON.stringify({ ...t.config, label: t.label, points: t.points, category: t.category ?? null }),
      seedKey: t.key,
      createdByUserId: userId ?? null,
    })),
  ).onConflictDoNothing();
  return wanted.length;
}

export interface DrawRequest {
  /** How many tasks to draw per tier key ({ easy: 8, medium: 10, hard: 5 }). */
  counts: Record<string, number>;
  /** Restrict the pool to these categories (empty/omitted = all). */
  categories?: string[];
  /** Exclude these library ids — lets "reroll" avoid handing back the same draw. */
  exclude?: number[];
}

export interface DrawResult {
  tasks: LibraryTask[];
  /** Tiers that couldn't be filled: { tier, asked, got } — surfaced rather than silently short. */
  shortfalls: { tier: string; asked: number; got: number }[];
}

/**
 * Draw N random tasks per tier. Randomness is server-side so a client can't bias it, and each tier
 * is drawn from its own bucket so asking for 5 hard never quietly returns 5 easy. A tier with too
 * few tasks returns what it has and reports the shortfall — the caller shows it rather than
 * pretending the board is full.
 */
export async function drawTasks(clanId: number, req: DrawRequest): Promise<DrawResult> {
  const all = await listLibrary(clanId);
  const exclude = new Set(req.exclude ?? []);
  const cats = (req.categories ?? []).map((c) => c.toLowerCase()).filter(Boolean);

  const pool = all.filter((t) => {
    if (exclude.has(t.id)) return false;
    if (cats.length && !cats.includes((t.category ?? '').toLowerCase())) return false;
    return true;
  });

  const picked: LibraryTask[] = [];
  const shortfalls: DrawResult['shortfalls'] = [];

  for (const [tier, rawCount] of Object.entries(req.counts)) {
    const want = Math.max(0, Math.floor(rawCount));
    if (want === 0) continue;
    const bucket = pool.filter((t) => t.tier === tier && !picked.some((p) => p.id === t.id));
    // Fisher-Yates on a copy — shuffling then slicing keeps the draw uniform.
    for (let i = bucket.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bucket[i], bucket[j]] = [bucket[j], bucket[i]];
    }
    const take = bucket.slice(0, want);
    picked.push(...take);
    if (take.length < want) shortfalls.push({ tier, asked: want, got: take.length });
  }

  return { tasks: picked, shortfalls };
}

/** Harvest: add tiles from an existing board to the catalogue. Returns how many were added. */
export async function addTasksFromRows(
  clanId: number,
  rows: { label: string; points?: number | null; category?: string | null; description?: string | null; tileType?: string | null; config: TileCsvRow }[],
  opts: { sourceEventId?: number | null; userId?: number | null } = {},
): Promise<number> {
  const valid = rows.filter((r) => r.label?.trim());
  if (valid.length === 0) return 0;
  await db.insert(tileLibrary).values(
    valid.map((r) => ({
      clanId,
      label: r.label.trim().slice(0, 200),
      description: r.description ?? null,
      tileType: r.tileType || r.config.tileType || 'standard',
      points: Math.max(0, Math.round(r.points ?? r.config.points ?? 0)),
      category: r.category ?? r.config.category ?? null,
      config: JSON.stringify(r.config),
      seedKey: null,
      sourceEventId: opts.sourceEventId ?? null,
      createdByUserId: opts.userId ?? null,
    })),
  );
  return valid.length;
}

/** Distinct categories present in the catalogue — drives the generator's filter. */
export async function libraryCategories(clanId: number): Promise<string[]> {
  const rows = await db
    .selectDistinct({ category: tileLibrary.category })
    .from(tileLibrary)
    .where(and(eq(tileLibrary.clanId, clanId), isNotNull(tileLibrary.category)));
  return rows.map((r) => r.category).filter((c): c is string => !!c).sort();
}

/** Per-tier counts for the whole catalogue — shown beside each spinner so admins know the ceiling. */
export async function libraryTierCounts(clanId: number): Promise<Record<string, number>> {
  const all = await listLibrary(clanId);
  const out: Record<string, number> = {};
  all.forEach((t) => {
    if (!t.tier) return;
    out[t.tier] = (out[t.tier] ?? 0) + 1;
  });
  return out;
}

/**
 * Edit a task in place. Only the fields the library page exposes — the rich per-kind config keeps
 * living in `config` and is replaced wholesale when it changes, so this can never half-write a
 * tile kind (a 10M-XP goal stranded on a drop task, say).
 */
export async function updateTask(
  id: number,
  patch: { label?: string; description?: string | null; points?: number; category?: string | null; config?: TileCsvRow },
): Promise<void> {
  const set: Record<string, unknown> = {};
  if (patch.label !== undefined) set.label = patch.label.trim().slice(0, 200);
  if (patch.description !== undefined) set.description = patch.description || null;
  if (patch.points !== undefined) set.points = Math.max(0, Math.round(patch.points));
  if (patch.category !== undefined) set.category = patch.category || null;
  if (patch.config !== undefined) {
    set.config = JSON.stringify(patch.config);
    if (patch.config.tileType) set.tileType = patch.config.tileType;
  }
  // Keep the stored mirror of label/points/category inside `config` honest — the importer reads
  // those from the row it's handed, so a drifted copy would resurrect the old values on a draw.
  if (Object.keys(set).length === 0) return;
  // clan-scope: global -- takes an entity id whose caller has already settled the clan — the 'one hop, never a copy' rule in lib/eventScope. Every route and page that reaches this is verified scoped.
  const existing = await db.query.tileLibrary.findFirst({ where: eq(tileLibrary.id, id) });
  if (!existing) return;
  if (patch.config === undefined) {
    const cfg = parseConfig(existing.config);
    const merged: TileCsvRow = {
      ...cfg,
      ...(patch.label !== undefined ? { label: (set.label as string) } : {}),
      ...(patch.points !== undefined ? { points: (set.points as number) } : {}),
      ...(patch.category !== undefined ? { category: (set.category as string | null) } : {}),
      ...(patch.description !== undefined ? { description: (set.description as string | null) } : {}),
    };
    set.config = JSON.stringify(merged);
  }
  await db.update(tileLibrary).set(set).where(eq(tileLibrary.id, id));
}

// Re-exported so routes can delete/update without importing the table directly.
export async function deleteTask(id: number): Promise<void> {
  await db.delete(tileLibrary).where(eq(tileLibrary.id, id));
}

export async function deleteTasks(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(tileLibrary).where(inArray(tileLibrary.id, ids));
}

export async function countLibrary(): Promise<number> {
  // clan-scope: global -- takes an entity id whose caller has already settled the clan — the 'one hop, never a copy' rule in lib/eventScope. Every route and page that reaches this is verified scoped.
  const [row] = await db.select({ c: sql<number>`count(*)` }).from(tileLibrary);
  return row?.c ?? 0;
}
