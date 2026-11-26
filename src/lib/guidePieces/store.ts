// Guide pieces against the database: reading a guide as a clan sees it, and every write, each one
// authorised here and not only by the route in front of it.
//
// WHO WRITES WHAT
//   Anvil pieces       — platform guide editors only (users.platform_guide_editor, or staff+).
//   A clan's overrides — that clan's guide editors only (clan_staff.can_edit_guides, admins
//                        implicitly; an operator only under a live act-as grant at admin).
// A write takes an ACTOR, which only libraryPieceActorFor / clanPieceActorFor mint (lib/guidePieces/
// access builds them from the session). The clan an override belongs to is the actor's — never a
// field of the input, which the input schemas would refuse anyway — and every write checks the
// grant again, live, before it touches a row: an actor held across a demotion is worth nothing.
//
// Every saved state goes to guide_piece_revisions, so history and one-click revert work the same
// for Anvil's pieces and a clan's.

import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { guidePieceOverrides, guidePieceRevisions, guidePieces, guides, users, type GuidePieceOverrideRow, type GuidePieceRow } from '@/db/schema';
import { liveActAs } from '@/lib/actAs';
import { isBannedFromClan } from '@/lib/clanBans';
import { clanGrant } from '@/lib/clanGrants';
import { atLeast, hasPlatformRole } from '@/lib/clanRoles';

import { anvilPieceEdit, anvilPieceInput, BASE_ROLE, checkBody, clanPieceInput, DEFAULT_SECTION, overrideInput, type PieceKind, type Variant } from './schema';
import { resolvePieces, type AnvilPieceRow, type OverrideRow, type ResolvedPiece, type ResolveFilters } from './resolve';

const nowIso = () => new Date().toISOString();

export class PieceError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

// ── Actors ───────────────────────────────────────────────────────────────────────────────────

export interface LibraryPieceActor {
  readonly scope: 'library';
  readonly userId: number;
}
export interface ClanPieceActor {
  readonly scope: 'clan';
  readonly userId: number;
  readonly clanId: number;
}

/** Only actors minted below count: a route can't hand a write an object it built from a request. */
const minted = new WeakSet<object>();

/** Pure: may this user row write the Anvil library? (lib/guideAccess canEditLibrary, without next/headers.) */
export function canWriteLibrary(row: { platformRole?: string | null; platformGuideEditor?: boolean | null } | null | undefined): boolean {
  return !!row && (row.platformGuideEditor === true || hasPlatformRole(row.platformRole ?? 'none', 'staff'));
}

async function libraryAllowed(userId: number): Promise<boolean> {
  const row = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { platformRole: true, platformGuideEditor: true } });
  return canWriteLibrary(row);
}

/** May this user edit this clan's guide pieces? Their own grant (not banned here), or an operator's live act-as at admin. */
async function clanAllowed(userId: number, clanId: number): Promise<boolean> {
  const grant = await clanGrant(clanId, userId);
  if (grant?.canEditGuides) {
    const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { playerId: true } });
    return !(await isBannedFromClan(clanId, u?.playerId ?? null));
  }
  if (grant) return false;
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { platformRole: true } });
  if (!u || (u.platformRole ?? 'none') === 'none') return false;
  const borrowed = await liveActAs(clanId, userId);
  return borrowed != null && atLeast(borrowed.role, 'admin');
}

export async function libraryPieceActorFor(userId: number): Promise<LibraryPieceActor | null> {
  if (!Number.isInteger(userId) || !(await libraryAllowed(userId))) return null;
  const a: LibraryPieceActor = Object.freeze({ scope: 'library', userId });
  minted.add(a);
  return a;
}

/** `clanId` must come from the session's clan (lib/guidePieces/access), never from a request. */
export async function clanPieceActorFor(userId: number, clanId: number): Promise<ClanPieceActor | null> {
  if (!Number.isInteger(userId) || !Number.isInteger(clanId) || !(await clanAllowed(userId, clanId))) return null;
  const a: ClanPieceActor = Object.freeze({ scope: 'clan', userId, clanId });
  minted.add(a);
  return a;
}

async function assertLibrary(actor: LibraryPieceActor): Promise<void> {
  if (!actor || !minted.has(actor) || actor.scope !== 'library' || !(await libraryAllowed(actor.userId))) throw new PieceError('Not found', 404);
}
async function assertClan(actor: ClanPieceActor): Promise<void> {
  if (!actor || !minted.has(actor) || actor.scope !== 'clan' || !(await clanAllowed(actor.userId, actor.clanId))) throw new PieceError('You need guide editing rights in this clan.', 403);
}

// ── Reads ────────────────────────────────────────────────────────────────────────────────────

const toAnvil = (r: GuidePieceRow): AnvilPieceRow => ({
  id: r.id, guideId: r.guideId, sectionKey: r.sectionKey, roleKey: r.roleKey, variant: (r.variant ?? {}) as Variant, kind: r.kind as PieceKind, body: r.body, position: r.position, version: r.version, status: r.status,
});
const toOverride = (r: GuidePieceOverrideRow): OverrideRow => ({
  id: r.id, clanId: r.clanId, pieceId: r.pieceId, guideId: r.guideId, sectionKey: r.sectionKey, roleKey: r.roleKey, variant: (r.variant ?? {}) as Variant, kind: r.kind as PieceKind,
  body: r.body ?? null, hidden: r.hidden, position: r.position, basedOnVersion: r.basedOnVersion, version: r.version,
});

async function libraryGuide(guideId: number) {
  const g = await db.query.guides.findFirst({ where: and(eq(guides.id, guideId), isNull(guides.clanId)), columns: { id: true, slug: true, title: true, status: true, version: true } });
  return g ?? null;
}

export interface ResolvedGuide {
  guide: { id: number; slug: string; title: string };
  pieces: ResolvedPiece[];
}

/**
 * A library guide's pieces as this clan has them (clanId null = Anvil's own). A draft guide, and
 * draft pieces, only with `drafts` — the library editor's view; never pass it for a clan. The clan id is the caller's to vouch for: the reader's clan context, or
 * the actor's clan in an editor — reading is not a privilege here, the guide is public either way.
 */
export async function resolveGuide(guideId: number, clanId: number | null, filters: ResolveFilters = {}): Promise<ResolvedGuide | null> {
  const g = await libraryGuide(guideId);
  // Drafts are the library's; a clan's view never carries them, whatever the caller asked.
  if (clanId != null && filters.drafts) filters = { ...filters, drafts: false };
  if (!g || (g.status !== 'published' && !filters.drafts)) return null;
  const [anvil, overrides] = await Promise.all([
    db.select().from(guidePieces).where(eq(guidePieces.guideId, guideId)).orderBy(asc(guidePieces.position), asc(guidePieces.id)),
    clanId == null ? Promise.resolve([] as GuidePieceOverrideRow[]) : db.select().from(guidePieceOverrides).where(and(eq(guidePieceOverrides.clanId, clanId), eq(guidePieceOverrides.guideId, guideId))),
  ]);
  return { guide: { id: g.id, slug: g.slug, title: g.title }, pieces: resolvePieces(anvil.map(toAnvil), overrides.map(toOverride), filters) };
}

export async function getAnvilPiece(pieceId: number): Promise<GuidePieceRow | null> {
  return (await db.query.guidePieces.findFirst({ where: eq(guidePieces.id, pieceId) })) ?? null;
}

/** The history of an Anvil piece (clan null) or of one clan's version of it / own piece. */
export async function pieceHistory(target: { pieceId: number; clanId?: null } | { overrideId: number; clanId: number } | { pieceId: number; clanId: number }, limit = 50) {
  const where =
    'overrideId' in target
      ? and(eq(guidePieceRevisions.overrideId, target.overrideId), eq(guidePieceRevisions.clanId, target.clanId))
      : target.clanId == null
        ? and(eq(guidePieceRevisions.pieceId, target.pieceId), isNull(guidePieceRevisions.clanId))
        : and(eq(guidePieceRevisions.pieceId, target.pieceId), eq(guidePieceRevisions.clanId, target.clanId));
  return db.select().from(guidePieceRevisions).where(where).orderBy(desc(guidePieceRevisions.id)).limit(Math.min(Math.max(limit, 1), 200));
}

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────

function parse<T>(schema: (v: unknown, p: string) => { ok: true; value: T } | { ok: false; error: string }, v: unknown): T {
  const r = schema(v, '');
  if (!r.ok) throw new PieceError(r.error);
  return r.value;
}
function body(kind: string, v: unknown): unknown {
  const r = checkBody(kind, v);
  if (!r.ok) throw new PieceError(r.error);
  return r.value;
}
const id = (v: unknown): number => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 2_147_483_647) throw new PieceError('Not found', 404);
  return v;
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function revision(tx: Tx, r: { clanId: number | null; guideId: number; pieceId: number | null; overrideId: number | null; version: number; kind: string; body: unknown; hidden?: boolean; meta: Record<string, unknown>; action: string; userId: number }) {
  await tx.insert(guidePieceRevisions).values({
    clanId: r.clanId, guideId: r.guideId, pieceId: r.pieceId, overrideId: r.overrideId, version: r.version, kind: r.kind, body: r.body ?? null, hidden: r.hidden ?? false,
    meta: r.meta, action: r.action, editedByUserId: r.userId, createdAt: nowIso(),
  });
}
const pieceMeta = (p: GuidePieceRow) => ({ section: p.sectionKey, role: p.roleKey, variant: p.variant, position: p.position, status: p.status });
const overrideMeta = (o: GuidePieceOverrideRow) => ({ section: o.sectionKey, role: o.roleKey, variant: o.variant, position: o.position, basedOnVersion: o.basedOnVersion });

// ── Anvil writes ─────────────────────────────────────────────────────────────────────────────

export async function createAnvilPiece(actor: LibraryPieceActor, input: unknown): Promise<GuidePieceRow> {
  await assertLibrary(actor);
  const i = parse(anvilPieceInput, input);
  if (!(await libraryGuide(i.guideId))) throw new PieceError('That library guide does not exist.', 404);
  const b = body(i.kind, i.body);
  const at = nowIso();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(guidePieces)
      .values({
        guideId: i.guideId, sectionKey: i.section ?? DEFAULT_SECTION, roleKey: i.role ?? BASE_ROLE, variant: (i.variant ?? {}) as Record<string, unknown>, kind: i.kind, body: b,
        position: i.position ?? 0, status: i.status ?? 'draft', version: 1, createdByUserId: actor.userId, updatedByUserId: actor.userId, createdAt: at, updatedAt: at,
      })
      .returning();
    await revision(tx, { clanId: null, guideId: row.guideId, pieceId: row.id, overrideId: null, version: 1, kind: row.kind, body: row.body, meta: pieceMeta(row), action: 'create', userId: actor.userId });
    return row;
  });
}

/** A change to what the piece says or where it sits bumps its version; status alone does not. */
export async function updateAnvilPiece(actor: LibraryPieceActor, pieceId: number, edit: unknown, action = 'update'): Promise<GuidePieceRow> {
  await assertLibrary(actor);
  const p = await getAnvilPiece(id(pieceId));
  if (!p) throw new PieceError('Not found', 404);
  const e = parse(anvilPieceEdit, edit);
  const b = e.body !== undefined ? body(p.kind, e.body) : undefined;
  const changed =
    (b !== undefined && JSON.stringify(b) !== JSON.stringify(p.body)) ||
    (e.section !== undefined && e.section !== p.sectionKey) ||
    (e.role !== undefined && e.role !== p.roleKey) ||
    (e.variant !== undefined && JSON.stringify(e.variant) !== JSON.stringify(p.variant));
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(guidePieces)
      .set({
        ...(b !== undefined ? { body: b } : {}),
        ...(e.section !== undefined ? { sectionKey: e.section } : {}),
        ...(e.role !== undefined ? { roleKey: e.role } : {}),
        ...(e.variant !== undefined ? { variant: e.variant as Record<string, unknown> } : {}),
        ...(e.position !== undefined ? { position: e.position } : {}),
        ...(e.status !== undefined ? { status: e.status } : {}),
        ...(changed ? { version: sql`${guidePieces.version} + 1` } : {}),
        updatedByUserId: actor.userId,
        updatedAt: nowIso(),
      })
      .where(eq(guidePieces.id, p.id))
      .returning();
    if (changed || e.status !== undefined) await revision(tx, { clanId: null, guideId: row.guideId, pieceId: row.id, overrideId: null, version: row.version, kind: row.kind, body: row.body, meta: pieceMeta(row), action, userId: actor.userId });
    return row;
  });
}

export async function deleteAnvilPiece(actor: LibraryPieceActor, pieceId: number): Promise<void> {
  await assertLibrary(actor);
  const p = await getAnvilPiece(id(pieceId));
  if (!p) throw new PieceError('Not found', 404);
  await db.transaction(async (tx) => {
    await revision(tx, { clanId: null, guideId: p.guideId, pieceId: p.id, overrideId: null, version: p.version, kind: p.kind, body: p.body, meta: pieceMeta(p), action: 'delete', userId: actor.userId });
    // Clans' overrides of it keep their bodies and become their own pieces (FK set null); a clan
    // that only HID it has nothing left to hide.
    await tx.delete(guidePieceOverrides).where(and(eq(guidePieceOverrides.pieceId, p.id), eq(guidePieceOverrides.hidden, true)));
    await tx.delete(guidePieces).where(eq(guidePieces.id, p.id));
  });
}

/** Put an Anvil piece back to one of its saved versions (as a new version). */
export async function revertAnvilPiece(actor: LibraryPieceActor, pieceId: number, version: number): Promise<GuidePieceRow> {
  await assertLibrary(actor);
  const p = await getAnvilPiece(id(pieceId));
  if (!p) throw new PieceError('Not found', 404);
  const rev = await db.query.guidePieceRevisions.findFirst({
    where: and(eq(guidePieceRevisions.pieceId, p.id), isNull(guidePieceRevisions.clanId), eq(guidePieceRevisions.version, id(version))),
    orderBy: desc(guidePieceRevisions.id),
  });
  if (!rev || rev.body == null) throw new PieceError('That version is not in this piece’s history.', 404);
  const m = (rev.meta ?? {}) as { section?: string; role?: string; variant?: unknown };
  // Through the same checks as any edit: a revision written under older rules is re-validated.
  return updateAnvilPiece(actor, p.id, { body: rev.body, ...(m.section ? { section: m.section } : {}), ...(m.role ? { role: m.role } : {}), ...(m.variant ? { variant: m.variant } : {}) }, 'revert');
}

// ── Clan writes ──────────────────────────────────────────────────────────────────────────────

/** An Anvil piece a clan may override: on a published library guide, and published itself. */
async function overridablePiece(pieceId: number): Promise<GuidePieceRow> {
  const p = await getAnvilPiece(id(pieceId));
  if (!p || p.status !== 'published') throw new PieceError('Not found', 404);
  const g = await libraryGuide(p.guideId);
  if (!g || g.status !== 'published') throw new PieceError('Not found', 404);
  return p;
}

async function ownOverride(actor: ClanPieceActor, where: { pieceId: number } | { overrideId: number }): Promise<GuidePieceOverrideRow | null> {
  const cond = 'pieceId' in where ? eq(guidePieceOverrides.pieceId, where.pieceId) : eq(guidePieceOverrides.id, where.overrideId);
  // Scoped to the actor's clan in the query itself: another clan's row is simply not found.
  return (await db.query.guidePieceOverrides.findFirst({ where: and(cond, eq(guidePieceOverrides.clanId, actor.clanId)) })) ?? null;
}

/**
 * This clan's version of an Anvil piece: a new body, hidden, or moved. The first save records which
 * Anvil version it was written against; later saves keep that (only keepOurs/takeAnvil answer an
 * Anvil update).
 */
export async function saveOverride(actor: ClanPieceActor, pieceId: number, input: unknown): Promise<GuidePieceOverrideRow> {
  await assertClan(actor);
  const p = await overridablePiece(pieceId);
  const i = parse(overrideInput, input);
  const existing = await ownOverride(actor, { pieceId: p.id });
  const hidden = i.hidden ?? existing?.hidden ?? false;
  const b = i.body !== undefined ? body(p.kind, i.body) : (existing?.body ?? (hidden ? null : undefined));
  if (b === undefined) throw new PieceError('Give the piece a body, or hide it.');
  const at = nowIso();
  return db.transaction(async (tx) => {
    let row: GuidePieceOverrideRow;
    if (existing) {
      [row] = await tx
        .update(guidePieceOverrides)
        .set({ body: b, hidden, ...(i.position !== undefined ? { position: i.position } : {}), version: sql`${guidePieceOverrides.version} + 1`, updatedByUserId: actor.userId, updatedAt: at })
        .where(and(eq(guidePieceOverrides.id, existing.id), eq(guidePieceOverrides.clanId, actor.clanId)))
        .returning();
    } else {
      [row] = await tx
        .insert(guidePieceOverrides)
        .values({
          clanId: actor.clanId, pieceId: p.id, guideId: p.guideId, sectionKey: p.sectionKey, roleKey: p.roleKey, variant: p.variant, kind: p.kind, body: b, hidden,
          position: i.position ?? null, basedOnVersion: p.version, version: 1, createdByUserId: actor.userId, updatedByUserId: actor.userId, createdAt: at, updatedAt: at,
        })
        .returning();
    }
    const action = i.hidden === true && !existing?.hidden ? 'hide' : i.hidden === false && existing?.hidden ? 'show' : existing ? 'update' : 'create';
    await revision(tx, { clanId: actor.clanId, guideId: row.guideId, pieceId: p.id, overrideId: row.id, version: row.version, kind: row.kind, body: row.body, hidden: row.hidden, meta: overrideMeta(row), action, userId: actor.userId });
    return row;
  });
}

/** A piece of the clan's own on a published library guide. */
export async function addClanPiece(actor: ClanPieceActor, input: unknown): Promise<GuidePieceOverrideRow> {
  await assertClan(actor);
  const i = parse(clanPieceInput, input);
  const g = await libraryGuide(i.guideId);
  if (!g || g.status !== 'published') throw new PieceError('Not found', 404);
  const b = body(i.kind, i.body);
  const at = nowIso();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(guidePieceOverrides)
      .values({
        clanId: actor.clanId, pieceId: null, guideId: g.id, sectionKey: i.section ?? DEFAULT_SECTION, roleKey: i.role ?? BASE_ROLE, variant: (i.variant ?? {}) as Record<string, unknown>, kind: i.kind, body: b,
        hidden: false, position: i.position ?? 0, basedOnVersion: null, version: 1, createdByUserId: actor.userId, updatedByUserId: actor.userId, createdAt: at, updatedAt: at,
      })
      .returning();
    await revision(tx, { clanId: actor.clanId, guideId: row.guideId, pieceId: null, overrideId: row.id, version: 1, kind: row.kind, body: row.body, meta: overrideMeta(row), action: 'create', userId: actor.userId });
    return row;
  });
}

/** Edit one of the clan's own pieces (piece_id null). */
export async function updateClanPiece(actor: ClanPieceActor, overrideId: number, edit: unknown): Promise<GuidePieceOverrideRow> {
  await assertClan(actor);
  const o = await ownOverride(actor, { overrideId: id(overrideId) });
  if (!o || o.pieceId != null) throw new PieceError('Not found', 404);
  const e = parse(anvilPieceEdit, edit);
  if (e.status !== undefined) throw new PieceError('A clan piece has no draft state.');
  const b = e.body !== undefined ? body(o.kind, e.body) : o.body;
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(guidePieceOverrides)
      .set({
        body: b,
        ...(e.section !== undefined ? { sectionKey: e.section } : {}),
        ...(e.role !== undefined ? { roleKey: e.role } : {}),
        ...(e.variant !== undefined ? { variant: e.variant as Record<string, unknown> } : {}),
        ...(e.position !== undefined ? { position: e.position } : {}),
        version: sql`${guidePieceOverrides.version} + 1`,
        updatedByUserId: actor.userId,
        updatedAt: nowIso(),
      })
      .where(and(eq(guidePieceOverrides.id, o.id), eq(guidePieceOverrides.clanId, actor.clanId)))
      .returning();
    await revision(tx, { clanId: actor.clanId, guideId: row.guideId, pieceId: null, overrideId: row.id, version: row.version, kind: row.kind, body: row.body, meta: overrideMeta(row), action: 'update', userId: actor.userId });
    return row;
  });
}

/** Remove one of the clan's own pieces, or drop its version of an Anvil piece (= takeAnvil). */
export async function deleteClanPiece(actor: ClanPieceActor, overrideId: number): Promise<void> {
  await assertClan(actor);
  const o = await ownOverride(actor, { overrideId: id(overrideId) });
  if (!o) throw new PieceError('Not found', 404);
  await db.transaction(async (tx) => {
    await revision(tx, { clanId: actor.clanId, guideId: o.guideId, pieceId: o.pieceId, overrideId: o.id, version: o.version, kind: o.kind, body: o.body, hidden: o.hidden, meta: overrideMeta(o), action: o.pieceId != null ? 'take-anvil' : 'delete', userId: actor.userId });
    await tx.delete(guidePieceOverrides).where(and(eq(guidePieceOverrides.id, o.id), eq(guidePieceOverrides.clanId, actor.clanId)));
  });
}

/** "Anvil updated this · take theirs": the clan's version goes, Anvil's shows again (and follows). */
export async function takeAnvil(actor: ClanPieceActor, pieceId: number): Promise<void> {
  await assertClan(actor);
  const o = await ownOverride(actor, { pieceId: id(pieceId) });
  if (!o) return;
  await deleteClanPiece(actor, o.id);
}

/** "… keep ours": the clan's version stays and stops being flagged until Anvil changes it again. */
export async function keepOurs(actor: ClanPieceActor, pieceId: number): Promise<GuidePieceOverrideRow> {
  await assertClan(actor);
  const p = await overridablePiece(pieceId);
  const o = await ownOverride(actor, { pieceId: p.id });
  if (!o) throw new PieceError('Not found', 404);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(guidePieceOverrides)
      .set({ basedOnVersion: p.version, updatedByUserId: actor.userId, updatedAt: nowIso() })
      .where(and(eq(guidePieceOverrides.id, o.id), eq(guidePieceOverrides.clanId, actor.clanId)))
      .returning();
    await revision(tx, { clanId: actor.clanId, guideId: row.guideId, pieceId: p.id, overrideId: row.id, version: row.version, kind: row.kind, body: row.body, hidden: row.hidden, meta: overrideMeta(row), action: 'keep-ours', userId: actor.userId });
    return row;
  });
}

/**
 * Put the clan's version back to one of its saved states. The revision must be this clan's; if it
 * was of an Anvil piece the clan has since dropped, the override is made again.
 */
export async function revertClanPiece(actor: ClanPieceActor, revisionId: number): Promise<GuidePieceOverrideRow> {
  await assertClan(actor);
  const rev = await db.query.guidePieceRevisions.findFirst({ where: and(eq(guidePieceRevisions.id, id(revisionId)), eq(guidePieceRevisions.clanId, actor.clanId)) });
  if (!rev) throw new PieceError('Not found', 404);
  if (rev.pieceId != null) {
    return saveOverride(actor, rev.pieceId, rev.hidden ? { hidden: true } : { body: rev.body, hidden: false });
  }
  if (rev.overrideId == null) throw new PieceError('That piece is gone.', 404);
  return updateClanPiece(actor, rev.overrideId, { body: rev.body });
}

/** The Anvil pieces a clan's versions are behind on, for the editor's "Anvil updated" count. */
export async function anvilUpdatesFor(clanId: number, guideIds?: number[]): Promise<{ overrideId: number; pieceId: number; guideId: number; basedOnVersion: number | null; anvilVersion: number }[]> {
  const rows = await db
    .select({ overrideId: guidePieceOverrides.id, pieceId: guidePieces.id, guideId: guidePieces.guideId, basedOnVersion: guidePieceOverrides.basedOnVersion, anvilVersion: guidePieces.version })
    .from(guidePieceOverrides)
    .innerJoin(guidePieces, eq(guidePieces.id, guidePieceOverrides.pieceId))
    .where(and(eq(guidePieceOverrides.clanId, clanId), eq(guidePieces.status, 'published'), sql`coalesce(${guidePieceOverrides.basedOnVersion}, 0) < ${guidePieces.version}`, ...(guideIds?.length ? [inArray(guidePieces.guideId, guideIds)] : [])));
  return rows;
}
