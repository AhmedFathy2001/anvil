// Guide categories as data: the platform's list (staff manage it at /staff/guides/categories) plus
// each clan's own extras (managed on /admin/guides). A library guide may use only platform categories;
// a clan guide may use either.

import { and, asc, count, eq, isNull, or } from 'drizzle-orm';

import { db } from '@/db';
import { guideCategories, guides, type GuideCategoryRow } from '@/db/schema';
import type { CategoryView } from '@/lib/guideCategories';

export function toView(r: GuideCategoryRow): CategoryView & { id: number; sortOrder: number } {
  return {
    id: r.id,
    key: r.key,
    label: r.label,
    icon: r.icon,
    requiresLevels: r.requiresLevels,
    archived: r.archived,
    clanId: r.clanId,
    sortOrder: r.sortOrder,
  };
}

/**
 * The categories a scope sees: the platform's, then the clan's own (when a clan is given). Archived
 * ones are included — callers need them to label old guides — flagged so pickers can skip them.
 */
export async function listCategories(clanId: number | null): Promise<(CategoryView & { id: number; sortOrder: number })[]> {
  const rows = await db
    .select()
    .from(guideCategories)
    .where(clanId == null ? isNull(guideCategories.clanId) : or(isNull(guideCategories.clanId), eq(guideCategories.clanId, clanId)))
    .orderBy(asc(guideCategories.sortOrder), asc(guideCategories.label));
  // Platform first, then the clan's extras.
  return [...rows.filter((r) => r.clanId == null), ...rows.filter((r) => r.clanId != null)].map(toView);
}

/** May a guide in this scope be filed under `key`? Keeping an archived one it already has is fine. */
export async function categoryUsable(clanId: number | null, key: string, current?: string): Promise<boolean> {
  if (key === current) return true;
  const row = await db.query.guideCategories.findFirst({
    where: and(
      eq(guideCategories.key, key),
      eq(guideCategories.archived, false),
      clanId == null ? isNull(guideCategories.clanId) : or(isNull(guideCategories.clanId), eq(guideCategories.clanId, clanId)),
    ),
  });
  return !!row;
}

/** Whether library guides in this category must cover every level. Unknown categories: yes. */
export async function categoryRequiresLevels(key: string): Promise<boolean> {
  const row = await db.query.guideCategories.findFirst({
    where: and(eq(guideCategories.key, key), isNull(guideCategories.clanId)),
  });
  return row ? row.requiresLevels : true;
}

// ── Writes ───────────────────────────────────────────────────────────────────────────────────

export class CategoryError extends Error {}

export interface CategoryInput {
  key?: string;
  label?: string;
  icon?: string;
  sortOrder?: number;
  requiresLevels?: boolean;
  archived?: boolean;
}

function clean(input: CategoryInput, creating: boolean) {
  const out: Partial<GuideCategoryRow> = {};
  if (creating) {
    const key = String(input.key ?? input.label ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32);
    if (!key) throw new CategoryError('Give the category a name.');
    out.key = key;
  }
  if (input.label !== undefined || creating) {
    const label = String(input.label ?? '').trim().slice(0, 40);
    if (!label) throw new CategoryError('Give the category a name.');
    out.label = label;
  }
  if (input.icon !== undefined) out.icon = [...String(input.icon).trim()].slice(0, 2).join('') || '📖';
  if (input.sortOrder !== undefined && Number.isFinite(Number(input.sortOrder))) out.sortOrder = Math.trunc(Number(input.sortOrder));
  if (input.requiresLevels !== undefined) out.requiresLevels = input.requiresLevels === true;
  if (input.archived !== undefined) out.archived = input.archived === true;
  return out;
}

export async function createCategory(clanId: number | null, input: CategoryInput): Promise<GuideCategoryRow> {
  const c = clean(input, true);
  // One key means one category wherever a guide can see it: a clan can't shadow a platform category,
  // and the platform can't take a key a clan already uses for its own.
  const clash = await db.query.guideCategories.findFirst({
    where: clanId == null ? eq(guideCategories.key, c.key!) : and(eq(guideCategories.key, c.key!), or(isNull(guideCategories.clanId), eq(guideCategories.clanId, clanId))),
  });
  if (clash) {
    throw new CategoryError(
      clash.clanId == null ? `"${clash.label}" already exists on the platform.` : clanId == null ? 'A clan already uses that name for its own category.' : `You already have "${clash.label}".`,
    );
  }
  const at = new Date().toISOString();
  const [row] = await db
    .insert(guideCategories)
    .values({
      clanId,
      key: c.key!,
      label: c.label!,
      icon: c.icon ?? '📖',
      sortOrder: c.sortOrder ?? 100,
      // A clan's categories never gate publishing (clan guides are never blocked) — stored off.
      requiresLevels: clanId == null ? (c.requiresLevels ?? true) : false,
      createdAt: at,
      updatedAt: at,
    })
    .returning();
  return row;
}

export async function updateCategory(row: GuideCategoryRow, input: CategoryInput): Promise<GuideCategoryRow> {
  const c = clean(input, false);
  if (row.clanId != null) delete c.requiresLevels;
  const [next] = await db
    .update(guideCategories)
    .set({ ...c, updatedAt: new Date().toISOString() })
    .where(eq(guideCategories.id, row.id))
    .returning();
  return next;
}

/** Delete, only when nothing is filed under it — otherwise archive it, which hides it from pickers. */
export async function deleteCategory(row: GuideCategoryRow): Promise<void> {
  const [used] = await db
    .select({ n: count() })
    .from(guides)
    .where(and(eq(guides.category, row.key), row.clanId == null ? undefined : eq(guides.clanId, row.clanId)));
  if ((used?.n ?? 0) > 0) {
    throw new CategoryError(`${used.n} guide${used.n === 1 ? ' is' : 's are'} filed under it — archive it instead, or move them first.`);
  }
  await db.delete(guideCategories).where(eq(guideCategories.id, row.id));
}

export async function getCategory(id: number): Promise<GuideCategoryRow | null> {
  return (await db.query.guideCategories.findFirst({ where: eq(guideCategories.id, id) })) ?? null;
}
