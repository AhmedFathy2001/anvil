// The guides store: the Anvil library, clan guides, copies, and keeping copies in step.
//
// THE COPY RULE, which everything here serves:
//
//   A copy that nobody in the clan has edited FOLLOWS its library guide (`follows_source`). When the
//   library guide is saved, the copy is rewritten to match, and so are the Discord messages it was
//   posted as. The clan never has to think about it.
//
//   The first edit a clan makes to its copy stops that. From then on the copy is theirs, and a
//   library update is an OFFER — counted on the dashboard, shown on the guide with what changed — to
//   take ("sync", which overwrites their edits, and says so) or to wave off ("keep mine").
//
// Overwriting somebody's edits silently is the one outcome this must never produce, and following a
// guide nobody touched should never need a click. Everything else is detail.

import { and, asc, count, desc, eq, gt, inArray, like, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { db } from '@/db';
import { guidePosts, guideRevisions, guides, type Guide } from '@/db/schema';
import { getSetting } from '@/lib/settings';
import { log } from '@/lib/logger';
import { GUIDE_LIMITS, isGuideCategory, slugify } from '@/lib/guideCategories';

export const SHOW_LIBRARY_SETTING = 'guides_show_library';

const nowIso = () => new Date().toISOString();

// ── Reads ────────────────────────────────────────────────────────────────────────────────────

export async function getGuide(id: number): Promise<Guide | null> {
  return (await db.query.guides.findFirst({ where: eq(guides.id, id) })) ?? null;
}

/** A guide the caller may address in this scope: a library guide (clanId null) or one of this clan's. */
export async function getScopedGuide(id: number, clanId: number | null): Promise<Guide | null> {
  const g = await getGuide(id);
  if (!g) return null;
  return (g.clanId ?? null) === clanId ? g : null;
}

export async function listLibrary(opts: { includeDrafts?: boolean } = {}): Promise<Guide[]> {
  return db
    .select()
    .from(guides)
    .where(and(isNull(guides.clanId), opts.includeDrafts ? undefined : eq(guides.status, 'published')))
    .orderBy(asc(guides.sortOrder), asc(guides.title));
}

export async function listClanGuides(clanId: number): Promise<Guide[]> {
  return db.select().from(guides).where(eq(guides.clanId, clanId)).orderBy(asc(guides.sortOrder), asc(guides.title));
}

export async function listRevisions(guideId: number, limit = 20) {
  return db
    .select()
    .from(guideRevisions)
    .where(eq(guideRevisions.guideId, guideId))
    .orderBy(desc(guideRevisions.version))
    .limit(limit);
}

export async function getRevision(guideId: number, version: number) {
  return (
    (await db.query.guideRevisions.findFirst({
      where: and(eq(guideRevisions.guideId, guideId), eq(guideRevisions.version, version)),
    })) ?? null
  );
}

export async function showsLibrary(clanId: number): Promise<boolean> {
  return (await getSetting(clanId, SHOW_LIBRARY_SETTING)) !== '0';
}

export interface PublicGuide {
  guide: Guide;
  /** 'clan' = the clan's own (or its copy); 'library' = the Anvil library guide itself. */
  origin: 'clan' | 'library';
  /** For a clan copy: it still matches the library. */
  following: boolean;
}

/**
 * What a reader sees on /guides. The apex: the library. A clan: its own published guides, plus the
 * library guides it has NOT copied (a copy replaces its original — the clan's word is the one that
 * counts on its own site), unless the clan switched the library off.
 */
export async function publicGuides(clanId: number | null): Promise<PublicGuide[]> {
  const library = await listLibrary();
  if (clanId == null) return library.map((guide) => ({ guide, origin: 'library', following: false }));

  const [own, withLibrary] = await Promise.all([
    db
      .select()
      .from(guides)
      .where(and(eq(guides.clanId, clanId), eq(guides.status, 'published')))
      .orderBy(asc(guides.sortOrder), asc(guides.title)),
    showsLibrary(clanId),
  ]);
  // Every copy shadows its source, published or not: a clan that unpublished its copy meant "not this
  // guide", and the original reappearing in its place would undo that.
  const copied = new Set(
    (
      await db
        .select({ src: guides.sourceGuideId })
        .from(guides)
        .where(and(eq(guides.clanId, clanId), isNotNull(guides.sourceGuideId)))
    ).map((r) => r.src),
  );
  const out: PublicGuide[] = own.map((guide) => ({ guide, origin: 'clan', following: guide.followsSource }));
  if (withLibrary) {
    for (const guide of library) {
      if (!copied.has(guide.id)) out.push({ guide, origin: 'library', following: false });
    }
  }
  return out;
}

/** One guide by slug for a reader: the clan's own first, then the library (unless shadowed/hidden). */
export async function publicGuideBySlug(clanId: number | null, slug: string): Promise<PublicGuide | null> {
  if (clanId != null) {
    const own = await db.query.guides.findFirst({
      where: and(eq(guides.clanId, clanId), eq(guides.slug, slug), eq(guides.status, 'published')),
    });
    if (own) return { guide: own, origin: 'clan', following: own.followsSource };
  }
  const lib = await db.query.guides.findFirst({
    where: and(isNull(guides.clanId), eq(guides.slug, slug), eq(guides.status, 'published')),
  });
  if (!lib) return null;
  if (clanId != null) {
    const copy = await db.query.guides.findFirst({
      where: and(eq(guides.clanId, clanId), eq(guides.sourceGuideId, lib.id)),
    });
    // The clan's copy lives at its own slug (it may have been renamed); send readers there.
    if (copy) return copy.status === 'published' ? { guide: copy, origin: 'clan', following: copy.followsSource } : null;
    if (!(await showsLibrary(clanId))) return null;
  }
  return { guide: lib, origin: 'library', following: false };
}

// ── Library update offers ────────────────────────────────────────────────────────────────────

export interface UpdateOffer {
  copyId: number;
  copyTitle: string;
  sourceId: number;
  fromVersion: number;
  toVersion: number;
  /** Editor notes for every library version the copy has not seen, newest first. */
  notes: { version: number; note: string | null; at: string }[];
}

// The library guide a copy came from, as a second name for the same table. A real alias rather than
// a raw `guides as src` fragment: drizzle renders an interpolated column UNQUALIFIED inside raw sql,
// and in a self-join an unqualified column is ambiguous.
const src = alias(guides, 'src');

/** The shared filter: this clan's edited copies whose published library guide has moved on. */
function offerWhere(clanId: number) {
  return and(
    eq(guides.clanId, clanId),
    eq(guides.followsSource, false),
    eq(src.status, 'published'),
    // Written out: an interpolated column renders bare in raw sql, and bare is ambiguous here.
    gt(src.version, sql`coalesce("guides"."source_version", 0)`),
  );
}

/** Copies this clan has edited whose library guide has moved on since. */
export async function pendingUpdates(clanId: number): Promise<UpdateOffer[]> {
  const rows = await db
    .select({
      copyId: guides.id,
      copyTitle: guides.title,
      sourceId: src.id,
      fromVersion: guides.sourceVersion,
      toVersion: src.version,
    })
    .from(guides)
    .innerJoin(src, eq(src.id, guides.sourceGuideId))
    .where(offerWhere(clanId));
  if (!rows.length) return [];
  const notes = await db
    .select({ guideId: guideRevisions.guideId, version: guideRevisions.version, note: guideRevisions.note, at: guideRevisions.createdAt })
    .from(guideRevisions)
    .where(inArray(guideRevisions.guideId, rows.map((r) => r.sourceId)))
    .orderBy(desc(guideRevisions.version));
  return rows.map((r) => ({
    copyId: r.copyId,
    copyTitle: r.copyTitle,
    sourceId: r.sourceId,
    fromVersion: r.fromVersion ?? 0,
    toVersion: r.toVersion,
    notes: notes
      .filter((n) => n.guideId === r.sourceId && n.version > (r.fromVersion ?? 0))
      .map((n) => ({ version: n.version, note: n.note, at: n.at })),
  }));
}

export async function pendingUpdateCount(clanId: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(guides)
    .innerJoin(src, eq(src.id, guides.sourceGuideId))
    .where(offerWhere(clanId));
  return row?.n ?? 0;
}

// ── Writes ───────────────────────────────────────────────────────────────────────────────────

export interface GuideInput {
  title?: string;
  summary?: string;
  body?: string;
  category?: string;
  coverUrl?: string | null;
  status?: string;
  slug?: string;
  sortOrder?: number;
}

export class GuideInputError extends Error {}

/** Validate and normalise an input patch. Throws GuideInputError with a human message. */
export function cleanInput(input: GuideInput, partial: boolean): GuideInput {
  const out: GuideInput = {};
  if (input.title !== undefined || !partial) {
    const title = String(input.title ?? '').trim();
    if (!title) throw new GuideInputError('Give the guide a title.');
    if (title.length > GUIDE_LIMITS.title) throw new GuideInputError(`Titles are capped at ${GUIDE_LIMITS.title} characters (Discord's forum limit).`);
    out.title = title;
  }
  if (input.summary !== undefined) {
    const summary = String(input.summary).trim();
    if (summary.length > GUIDE_LIMITS.summary) throw new GuideInputError(`Keep the summary under ${GUIDE_LIMITS.summary} characters.`);
    out.summary = summary;
  }
  if (input.body !== undefined) {
    const body = String(input.body).replace(/\r\n?/g, '\n');
    if (body.length > GUIDE_LIMITS.body) throw new GuideInputError('That guide is too long — split it into two.');
    out.body = body;
  }
  if (input.category !== undefined) {
    if (!isGuideCategory(input.category)) throw new GuideInputError('Unknown category.');
    out.category = input.category;
  }
  if (input.coverUrl !== undefined) {
    const c = input.coverUrl ? String(input.coverUrl).trim() : '';
    if (c && !/^https:\/\//i.test(c) && !c.startsWith('/')) throw new GuideInputError('The cover must be an https:// image link.');
    out.coverUrl = c || null;
  }
  if (input.status !== undefined) {
    if (input.status !== 'draft' && input.status !== 'published') throw new GuideInputError('Bad status.');
    out.status = input.status;
  }
  if (input.slug !== undefined) {
    const slug = slugify(String(input.slug));
    out.slug = slug;
  }
  if (input.sortOrder !== undefined && Number.isFinite(Number(input.sortOrder))) {
    out.sortOrder = Math.trunc(Number(input.sortOrder));
  }
  return out;
}

/** A slug free in this scope, suffixing -2, -3… as needed. */
async function freeSlug(clanId: number | null, wanted: string, exceptId?: number): Promise<string> {
  const base = slugify(wanted);
  const taken = new Set(
    (
      await db
        .select({ slug: guides.slug })
        .from(guides)
        .where(
          and(
            clanId == null ? isNull(guides.clanId) : eq(guides.clanId, clanId),
            like(guides.slug, `${base}%`),
            exceptId ? ne(guides.id, exceptId) : undefined,
          ),
        )
    ).map((r) => r.slug),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

async function writeRevision(g: Guide, userId: number | null, note: string | null) {
  await db
    .insert(guideRevisions)
    .values({
      guideId: g.id,
      version: g.version,
      title: g.title,
      summary: g.summary,
      body: g.body,
      note: note ? note.slice(0, GUIDE_LIMITS.note) : null,
      editedByUserId: userId,
      createdAt: nowIso(),
    })
    .onConflictDoNothing();
}

export async function createGuide(clanId: number | null, input: GuideInput, userId: number | null): Promise<Guide> {
  const clean = cleanInput(input, false);
  const at = nowIso();
  const status = clean.status ?? 'draft';
  const [row] = await db
    .insert(guides)
    .values({
      clanId,
      slug: await freeSlug(clanId, clean.slug || clean.title!),
      title: clean.title!,
      summary: clean.summary ?? '',
      body: clean.body ?? '',
      category: clean.category ?? 'general',
      coverUrl: clean.coverUrl ?? null,
      status,
      sortOrder: clean.sortOrder ?? 0,
      version: 1,
      createdByUserId: userId,
      updatedByUserId: userId,
      createdAt: at,
      updatedAt: at,
      publishedAt: status === 'published' ? at : null,
    })
    .returning();
  await writeRevision(row, userId, 'Created');
  return row;
}

const CONTENT_KEYS = ['title', 'summary', 'body', 'category', 'coverUrl'] as const;

/**
 * Save a guide. A change to what the guide SAYS bumps its version and records a revision; a change
 * to only its status/slug/order does not. Then the consequences: a library guide pushes to the copies
 * that follow it, and any guide re-syncs the Discord messages it was posted as.
 */
export async function saveGuide(
  g: Guide,
  input: GuideInput,
  userId: number | null,
  note: string | null,
): Promise<Guide> {
  const clean = cleanInput(input, true);
  const contentChanged = CONTENT_KEYS.some((k) => clean[k] !== undefined && clean[k] !== g[k]);
  const at = nowIso();
  const becamePublished = clean.status === 'published' && g.status !== 'published';

  const patch: Partial<Guide> = {
    ...clean,
    slug: clean.slug && clean.slug !== g.slug ? await freeSlug(g.clanId, clean.slug, g.id) : g.slug,
    updatedAt: at,
    updatedByUserId: userId,
  };
  if (becamePublished) patch.publishedAt = at;
  if (contentChanged) {
    patch.version = g.version + 1;
    // THE COPY RULE: the first edit makes a copy the clan's own.
    if (g.clanId != null && g.followsSource) patch.followsSource = false;
  }

  const [row] = await db.update(guides).set(patch).where(eq(guides.id, g.id)).returning();
  if (contentChanged) await writeRevision(row, userId, note);

  if (row.clanId == null && row.status === 'published' && (contentChanged || becamePublished)) {
    await propagateLibraryUpdate(row);
  }
  if (contentChanged || becamePublished) queuePostResync(row.id);
  return row;
}

/** Copy a library guide into a clan. Copying twice returns the copy it already has. */
export async function copyFromLibrary(clanId: number, sourceId: number, userId: number | null): Promise<Guide> {
  const src = await getScopedGuide(sourceId, null);
  if (!src || src.status !== 'published') throw new GuideInputError('That library guide is not available.');
  const existing = await db.query.guides.findFirst({
    where: and(eq(guides.clanId, clanId), eq(guides.sourceGuideId, src.id)),
  });
  if (existing) return existing;
  const at = nowIso();
  const [row] = await db
    .insert(guides)
    .values({
      clanId,
      slug: await freeSlug(clanId, src.slug),
      title: src.title,
      summary: src.summary,
      body: src.body,
      category: src.category,
      coverUrl: src.coverUrl,
      status: 'published',
      sortOrder: src.sortOrder,
      version: 1,
      sourceGuideId: src.id,
      sourceVersion: src.version,
      followsSource: true,
      createdByUserId: userId,
      updatedByUserId: userId,
      createdAt: at,
      updatedAt: at,
      publishedAt: at,
    })
    .returning();
  await writeRevision(row, userId, `Copied from the Anvil library (v${src.version})`);
  return row;
}

/**
 * Bring a copy to its library guide's current text. `follow` = keep following afterwards (the
 * default: taking the library's version is usually saying "I want theirs").
 */
export async function syncFromSource(copy: Guide, userId: number | null, follow = true): Promise<Guide> {
  if (!copy.sourceGuideId) throw new GuideInputError('This guide was not copied from the library.');
  const src = await getScopedGuide(copy.sourceGuideId, null);
  if (!src) throw new GuideInputError('The library guide this was copied from no longer exists.');
  const changed = CONTENT_KEYS.some((k) => src[k] !== copy[k]);
  const [row] = await db
    .update(guides)
    .set({
      title: src.title,
      summary: src.summary,
      body: src.body,
      category: src.category,
      coverUrl: src.coverUrl,
      sourceVersion: src.version,
      followsSource: follow,
      version: changed ? copy.version + 1 : copy.version,
      updatedAt: nowIso(),
      updatedByUserId: userId,
    })
    .where(eq(guides.id, copy.id))
    .returning();
  if (changed) {
    await writeRevision(row, userId, `Synced with the Anvil library (v${src.version})`);
    queuePostResync(row.id);
  }
  return row;
}

/** "Keep mine": acknowledge the library's current version without taking it. */
export async function dismissUpdate(copy: Guide): Promise<void> {
  if (!copy.sourceGuideId) return;
  const src = await getScopedGuide(copy.sourceGuideId, null);
  if (!src) return;
  await db.update(guides).set({ sourceVersion: src.version }).where(eq(guides.id, copy.id));
}

/** Rewrite every copy that follows this library guide, and re-sync their Discord posts. */
async function propagateLibraryUpdate(src: Guide): Promise<void> {
  const followers = await db
    .select()
    .from(guides)
    .where(and(eq(guides.sourceGuideId, src.id), eq(guides.followsSource, true)));
  for (const copy of followers) {
    try {
      await syncFromSource(copy, null, true);
    } catch (err) {
      log.warn('guides.propagate-fail', { sourceId: src.id, copyId: copy.id, err: String(err) });
    }
  }
  if (followers.length) log.info('guides.propagated', { sourceId: src.id, version: src.version, copies: followers.length });
}

export async function deleteGuide(g: Guide): Promise<void> {
  await db.delete(guides).where(eq(guides.id, g.id));
}

// ── Discord re-sync, off the request path ────────────────────────────────────────────────────

/**
 * Re-sync a guide's Discord posts after the response. Fire-and-forget like every Discord notify in
 * the app: a slow or failing Discord must never fail the save. Failures land on the post row
 * (`last_error`), where the editor shows them.
 */
function queuePostResync(guideId: number): void {
  void (async () => {
    try {
      const has = await db.select({ id: guidePosts.id }).from(guidePosts).where(eq(guidePosts.guideId, guideId)).limit(1);
      if (!has.length) return;
      const { resyncGuidePosts } = await import('@/lib/guidePosting');
      await resyncGuidePosts(guideId);
    } catch (err) {
      log.warn('guides.resync-fail', { guideId, err: String(err) });
    }
  })();
}

// ── Wire shapes ──────────────────────────────────────────────────────────────────────────────

/** A guide without its body — for lists. */
export function guideCard(g: Guide) {
  return {
    id: g.id,
    clanId: g.clanId,
    slug: g.slug,
    title: g.title,
    summary: g.summary,
    category: g.category,
    coverUrl: g.coverUrl,
    status: g.status,
    version: g.version,
    sortOrder: g.sortOrder,
    sourceGuideId: g.sourceGuideId,
    sourceVersion: g.sourceVersion,
    followsSource: g.followsSource,
    updatedAt: g.updatedAt,
  };
}
export type GuideCard = ReturnType<typeof guideCard>;
