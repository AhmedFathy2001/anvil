// The community side of guides: setups people submit, "used it" votes, reports and the curator
// queue, tips, the Wanted board, route follows and step suggestions, recent views, credit and the
// monthly featured writers.
//
// WHO OWNS WHAT. Community setups, votes and tips belong to the LIBRARY guide (guides.clan_id NULL),
// so every clan copy of it shows them too. A clan's own pinned setup is a row with clan_id set,
// shown on that clan's copy only. A clan guide written from scratch (no source) owns its own rows.

import { and, desc, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import {
  accounts,
  clanMemberships,
  guideContributions,
  guideEditCredits,
  guideReports,
  guideRevisions,
  guideRouteFollows,
  guides,
  guideSetupVotes,
  guideTips,
  guideTipVotes,
  guideViews,
  guideWanted,
  guideWriterAwards,
  guideProposals,
  users,
  type Guide,
  type GuideContribution,
} from '@/db/schema';
import { hasPlatformRole } from '@/lib/clanRoles';
import { getGuide, saveGuide } from '@/lib/guides';
import { cleanSetupInput, plainText, setupKey } from '@/lib/guideSetups';
import { firstGearBlock, splitSegments, upsertFencedBlock, upsertGearBlock, type GearSetup, type TierKey, tierOf } from '@/lib/guideTiers';
import { parseRouteBlock, serializeRouteBlock, type RouteStep } from '@/lib/guideRoutes';
import {
  EDIT_TAGS,
  canCurate,
  contributors,
  featuredWriters,
  monthlyCredit,
  rankByVotes,
  voteWeight,
  writerRank,
  type Contribution,
  type Contributor,
  type Edit,
  type EditTag,
  type Piece,
  type Reach,
} from '@/lib/guideCredit';
import { guideViewer, kcKeyOf, userNames } from '@/lib/guideViewer';
import { clanSeat } from '@/lib/seatScope';
import { log } from '@/lib/logger';

const nowIso = () => new Date().toISOString();
export const monthOf = (iso: string) => iso.slice(0, 7);

export class CommunityError extends Error {}

/** The guide community rows hang on: the library original of a copy, else the guide itself. */
export function libraryIdOf(g: Pick<Guide, 'id' | 'clanId' | 'sourceGuideId'>): number {
  return g.clanId != null && g.sourceGuideId ? g.sourceGuideId : g.id;
}

/** The clans a person sits in (member seats), for the own-clan vote weighting. */
async function clansOfPlayer(playerId: number | null | undefined): Promise<number[]> {
  if (!playerId) return [];
  // clan-scope: global -- which clans one person is in.
  const rows = await db
    .selectDistinct({ clanId: clanMemberships.clanId })
    .from(clanMemberships)
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .where(and(eq(accounts.playerId, playerId), isNull(clanMemberships.leftAt), clanSeat()));
  return rows.map((r) => r.clanId);
}

async function playerOfUser(userId: number | null | undefined): Promise<number | null> {
  if (!userId) return null;
  const row = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { playerId: true } });
  return row?.playerId ?? null;
}

// ── Community setups ─────────────────────────────────────────────────────────────────────────

const DAILY_LIMIT = 10;

/**
 * Submit a setup to a guide level. Live at once as "community". If it fills an open Wanted request
 * for that guide and level (and account type / build, when the request names them), it is marked
 * first to write it.
 */
export async function submitSetup(input: {
  guideId: number;
  userId: number;
  tier: string;
  setup: unknown;
  notes?: string | null;
  /** Set = a clan staff pin on its own copy. */
  clanId?: number | null;
}): Promise<GuideContribution> {
  const tier = tierOf(input.tier)?.key;
  if (!tier) throw new CommunityError('Pick a level.');
  const guide = await getGuide(input.guideId);
  if (!guide || guide.status !== 'published') throw new CommunityError('That guide is not available.');
  let setup: GearSetup;
  try {
    setup = cleanSetupInput(input.setup, tier);
  } catch (err) {
    throw new CommunityError(err instanceof Error ? err.message : 'That setup could not be read.');
  }
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(guideContributions)
    .where(and(eq(guideContributions.authorUserId, input.userId), gte(guideContributions.createdAt, since)));
  if (n >= DAILY_LIMIT) throw new CommunityError(`At most ${DAILY_LIMIT} submissions a day.`);

  const at = nowIso();
  const target = input.clanId != null ? guide.id : libraryIdOf(guide);
  const [row] = await db
    .insert(guideContributions)
    .values({
      guideId: target,
      clanId: input.clanId ?? null,
      kind: 'setup',
      tier,
      data: setup as unknown as Record<string, unknown>,
      name: setup.name,
      notes: plainText(input.notes, 280) || null,
      authorUserId: input.userId,
      status: 'live',
      createdAt: at,
      updatedAt: at,
    })
    .returning();
  if (input.clanId == null) await fillWanted(row, setup);
  return row;
}

/** Mark the first open Wanted request this setup answers as filled by it. */
async function fillWanted(row: GuideContribution, setup: GearSetup): Promise<void> {
  const open = await db
    .select()
    .from(guideWanted)
    .where(and(eq(guideWanted.guideId, row.guideId), eq(guideWanted.status, 'open'), eq(guideWanted.reason, 'request')));
  const hit = open.find(
    (w) =>
      (!w.tier || w.tier === row.tier) &&
      (!w.accountType || !(setup.accounts?.length) || setup.accounts.includes(w.accountType)) &&
      (!w.build || w.build === 'any' || !(setup.builds?.length) || setup.builds.includes(w.build)),
  );
  if (!hit) return;
  const at = nowIso();
  await db.update(guideWanted).set({ status: 'filled', filledByContributionId: row.id, filledByUserId: row.authorUserId, filledAt: at }).where(eq(guideWanted.id, hit.id));
  await db.update(guideContributions).set({ wantedId: hit.id, firstToWrite: true }).where(eq(guideContributions.id, row.id));
}

export interface CommunitySetup {
  id: number;
  key: string;
  tier: TierKey;
  setup: GearSetup;
  notes: string | null;
  author: string;
  authorUserId: number | null;
  status: string;
  clanOnly: boolean;
  createdAt: string;
  score: number;
  voters: number;
  avgKc: number;
  mine: boolean;
}

/** The community setups a reader of this guide sees: the library's plus this clan's own pins. */
export async function communitySetups(guide: Pick<Guide, 'id' | 'clanId' | 'sourceGuideId'>, viewerUserId: number | null): Promise<CommunitySetup[]> {
  const lib = libraryIdOf(guide);
  const rows = await db
    .select()
    .from(guideContributions)
    .where(
      and(
        eq(guideContributions.kind, 'setup'),
        inArray(guideContributions.status, ['live', 'kept', 'promoted']),
        or(and(eq(guideContributions.guideId, lib), isNull(guideContributions.clanId)), guide.clanId != null ? and(eq(guideContributions.guideId, guide.id), eq(guideContributions.clanId, guide.clanId)) : sql`false`),
      ),
    );
  if (!rows.length) return [];
  const keys = rows.map((r) => `c${r.id}`);
  const votes = await db
    .select({ key: guideSetupVotes.setupKey, userId: guideSetupVotes.userId, weight: guideSetupVotes.weight, kc: guideSetupVotes.kc })
    .from(guideSetupVotes)
    .where(and(eq(guideSetupVotes.guideId, lib), inArray(guideSetupVotes.setupKey, keys)));
  const names = await userNames(rows.map((r) => r.authorUserId ?? 0));
  const ranked = rankByVotes(
    rows.map((r) => ({ ...r, createdAt: r.createdAt })),
    votes.map((v) => ({ itemId: Number(v.key.slice(1)), userId: v.userId, weight: v.weight })),
  );
  return ranked.map((r) => {
    const mine = votes.filter((v) => v.key === `c${r.id}`);
    return {
      id: r.id,
      key: `c${r.id}`,
      tier: (tierOf(r.tier)?.key ?? 'beginner') as TierKey,
      setup: { ...(r.data as unknown as GearSetup), id: `c${r.id}`, communityId: r.id, by: r.authorUserId ? { userId: r.authorUserId, name: names.get(r.authorUserId) ?? 'A player' } : null },
      notes: r.notes,
      author: names.get(r.authorUserId ?? 0) ?? 'A player',
      authorUserId: r.authorUserId,
      status: r.status,
      clanOnly: r.clanId != null,
      createdAt: r.createdAt,
      score: r.score,
      voters: r.voters,
      avgKc: mine.length ? Math.round(mine.reduce((a, v) => a + v.kc, 0) / mine.length) : 0,
      mine: viewerUserId != null && mine.some((v) => v.userId === viewerUserId),
    };
  });
}

export type VoteResult = { ok: true; weight: number; kc: number } | { ok: false; error: string };

/**
 * "Used it", one per person per setup. Counts only with real kc on the guide's boss (from the
 * hiscores snapshot); a vote from the setup author's own clan counts half; the author can't vote on
 * their own. source 'auto' is the plugin's sighting (phase 2): it needs no kc, and moves last_used_at.
 */
export async function voteUsed(input: { guideId: number; setupKey: string; userId: number; source?: 'manual' | 'auto' }): Promise<VoteResult> {
  if (!/^[a-z0-9-]{1,60}$/.test(input.setupKey)) return { ok: false, error: 'Unknown setup.' };
  const guide = await getGuide(input.guideId);
  if (!guide) return { ok: false, error: 'Unknown guide.' };
  const lib = libraryIdOf(guide);
  const libGuide = lib === guide.id ? guide : await getGuide(lib);
  const block = libGuide ? firstGearBlock(libGuide.body) : null;
  let authorUserId: number | null = null;
  if (input.setupKey.startsWith('c')) {
    const c = await db.query.guideContributions.findFirst({ where: eq(guideContributions.id, Number(input.setupKey.slice(1))) });
    if (!c || (c.guideId !== lib && c.guideId !== guide.id)) return { ok: false, error: 'Unknown setup.' };
    authorUserId = c.authorUserId;
  } else if (!block?.setups.some((s, i) => setupKey(s, i) === input.setupKey)) {
    return { ok: false, error: 'Unknown setup.' };
  }
  if (authorUserId === input.userId) return { ok: false, error: 'You can’t vote on your own setup.' };
  const viewer = await guideViewer({ userId: input.userId, playerId: (await playerOfUser(input.userId)) ?? 0 });
  const key = kcKeyOf(block);
  const kc = key ? viewer.kc[key] ?? 0 : 0;
  const source = input.source ?? 'manual';
  if (source === 'manual' && key && kc < 1) return { ok: false, error: 'Kill it at least once first: "used it" needs kc on the boss.' };
  const [mine, theirs] = await Promise.all([clansOfPlayer(viewer.playerId), clansOfPlayer(await playerOfUser(authorUserId))]);
  const sameClan = mine.some((c) => theirs.includes(c));
  // No boss to check (a skilling guide): the vote counts, at the smallest weight.
  const weight = voteWeight({ kc: key ? kc : 1, sameClan, source });
  const at = nowIso();
  await db
    .insert(guideSetupVotes)
    .values({ guideId: lib, setupKey: input.setupKey, userId: input.userId, accountId: viewer.accountId, source, kc, voterClanId: mine[0] ?? null, weight, createdAt: at, lastUsedAt: at })
    .onConflictDoUpdate({
      target: [guideSetupVotes.guideId, guideSetupVotes.setupKey, guideSetupVotes.userId],
      set: { kc, weight: sql`greatest(${guideSetupVotes.weight}, ${weight})`, lastUsedAt: at, ...(source === 'auto' ? { source: 'auto' } : {}) },
    });
  return { ok: true, weight, kc };
}

export async function unvote(guideId: number, setupKey: string, userId: number): Promise<void> {
  const guide = await getGuide(guideId);
  if (!guide) return;
  await db
    .delete(guideSetupVotes)
    .where(and(eq(guideSetupVotes.guideId, libraryIdOf(guide)), eq(guideSetupVotes.setupKey, setupKey), eq(guideSetupVotes.userId, userId), eq(guideSetupVotes.source, 'manual')));
}

export async function reportContribution(contributionId: number, userId: number, reason: string): Promise<void> {
  const c = await db.query.guideContributions.findFirst({ where: eq(guideContributions.id, contributionId), columns: { status: true } });
  if (!c || c.status === 'hidden') return;
  const text = plainText(reason, 200) || 'Reported';
  await db.insert(guideReports).values({ contributionId, userId, reason: text, createdAt: nowIso() }).onConflictDoNothing();
}

export async function reportTip(tipId: number, userId: number, reason: string): Promise<void> {
  const t = await db.query.guideTips.findFirst({ where: eq(guideTips.id, tipId), columns: { status: true } });
  if (!t || t.status !== 'live') return;
  await db.insert(guideReports).values({ tipId, userId, reason: plainText(reason, 200) || 'Reported', createdAt: nowIso() }).onConflictDoNothing();
}

// ── Curators ─────────────────────────────────────────────────────────────────────────────────

/** Staff, a platform guide editor, or a writer who earned it (lib/guideCredit canCurate). */
export async function canCurateUser(userId: number | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const row = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { platformRole: true, platformGuideEditor: true } });
  if (!row) return false;
  if (hasPlatformRole(row.platformRole, 'staff') || row.platformGuideEditor) return true;
  return canCurate({ lifetime: (await writerStats(userId)).lifetime });
}

/**
 * May this person moderate a row that belongs to `clanId`? THE TWO AXES STAY APART (lib/guideAccess):
 * a library row (clanId null) is for curators; a clan's row is for that clan's guide editors and
 * platform staff only — earned curator rights never reach into a clan.
 */
export async function mayModerate(userId: number, clanId: number | null): Promise<boolean> {
  if (clanId == null) return canCurateUser(userId);
  const row = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { platformRole: true } });
  if (row && hasPlatformRole(row.platformRole, 'staff')) return true;
  const { clanGrant } = await import('@/lib/clanGrants');
  return (await clanGrant(clanId, userId))?.canEditGuides === true;
}

/** The clan a row really belongs to: its own clan_id, else its guide's (a clan-original guide). */
async function effectiveClan(rowClanId: number | null, guideId: number): Promise<number | null> {
  if (rowClanId != null) return rowClanId;
  const g = await db.query.guides.findFirst({ where: eq(guides.id, guideId), columns: { clanId: true } });
  return g?.clanId ?? null;
}

/** May this person review this contribution? Loads it and scopes it first. */
export async function mayReviewContribution(userId: number, contributionId: number): Promise<boolean> {
  const c = await db.query.guideContributions.findFirst({ where: eq(guideContributions.id, contributionId), columns: { clanId: true, guideId: true } });
  if (!c) return false;
  return mayModerate(userId, await effectiveClan(c.clanId, c.guideId));
}

export async function mayModerateTip(userId: number, tipId: number): Promise<boolean> {
  const t = await db.query.guideTips.findFirst({ where: eq(guideTips.id, tipId), columns: { clanId: true, guideId: true } });
  if (!t) return false;
  return mayModerate(userId, await effectiveClan(t.clanId, t.guideId));
}

export async function mayModerateWanted(userId: number, wantedId: number): Promise<boolean> {
  const w = await db.query.guideWanted.findFirst({ where: eq(guideWanted.id, wantedId), columns: { guideId: true } });
  if (!w) return false;
  return mayModerate(userId, w.guideId != null ? await effectiveClan(null, w.guideId) : null);
}

export interface QueueRow {
  id: number;
  kind: string;
  name: string;
  guideTitle: string;
  guideSlug: string;
  tier: string | null;
  author: string;
  createdAt: string;
  status: string;
  voters: number;
  avgKc: number;
  reports: { reason: string; at: string }[];
  data: Record<string, unknown>;
}

/** The queue: New (live/pending, not yet reviewed), Reported (open reports), Promoted. Oldest first. */
export async function curatorQueue(tab: 'new' | 'reported' | 'promoted', limit = 50): Promise<QueueRow[]> {
  const reported = await db.select({ id: guideReports.contributionId, reason: guideReports.reason, at: guideReports.createdAt }).from(guideReports).where(isNull(guideReports.resolvedAt));
  const reportedIds = [...new Set(reported.map((r) => r.id).filter((x): x is number => x != null))];
  const where =
    tab === 'promoted'
      ? eq(guideContributions.status, 'promoted')
      : tab === 'reported'
        ? reportedIds.length
          ? and(inArray(guideContributions.id, reportedIds), inArray(guideContributions.status, ['live', 'kept', 'pending', 'promoted']))
          : sql`false`
        : and(inArray(guideContributions.status, ['live', 'pending']), isNull(guideContributions.reviewedAt));
  const rows = await db
    .select({ c: guideContributions, title: guides.title, slug: guides.slug })
    .from(guideContributions)
    .innerJoin(guides, eq(guides.id, guideContributions.guideId))
    // The curator queue is the LIBRARY's: clan pins and clan guides' rows are their clan's to review.
    .where(and(where, isNull(guideContributions.clanId), isNull(guides.clanId)))
    .orderBy(tab === 'promoted' ? desc(guideContributions.reviewedAt) : guideContributions.createdAt)
    .limit(limit);
  const names = await userNames(rows.map((r) => r.c.authorUserId ?? 0));
  const votes = rows.length
    ? await db
        .select({ key: guideSetupVotes.setupKey, kc: guideSetupVotes.kc })
        .from(guideSetupVotes)
        .where(inArray(guideSetupVotes.setupKey, rows.map((r) => `c${r.c.id}`)))
    : [];
  return rows.map(({ c, title, slug }) => {
    const v = votes.filter((x) => x.key === `c${c.id}`);
    return {
      id: c.id,
      kind: c.kind,
      name: c.name,
      guideTitle: title,
      guideSlug: slug,
      tier: c.tier,
      author: names.get(c.authorUserId ?? 0) ?? 'A player',
      createdAt: c.createdAt,
      status: c.status,
      voters: v.length,
      avgKc: v.length ? Math.round(v.reduce((a, x) => a + x.kc, 0) / v.length) : 0,
      reports: reported.filter((r) => r.id === c.id).map((r) => ({ reason: r.reason, at: r.at })),
      data: c.data,
    };
  });
}

export const isEditTag = (v: unknown): v is EditTag => EDIT_TAGS.some((t) => t.key === v);

/**
 * Promote / hide / keep. Promote puts a setup into the library guide's gear block as a main pill
 * (keeping communityId so its votes stay with it), a suggested step into the route, or a suggested
 * edit into its step — each a normal library save, so copies that follow get it and forked copies
 * get the usual "library changed" offer. Steps and edits are credited with the reviewer's tag.
 */
export async function reviewContribution(input: { id: number; action: 'promote' | 'hide' | 'keep'; userId: number; tag?: EditTag | null }): Promise<{ ok: true } | { ok: false; error: string }> {
  const c = await db.query.guideContributions.findFirst({ where: eq(guideContributions.id, input.id) });
  if (!c) return { ok: false, error: 'Not found.' };
  const at = nowIso();
  if (input.action !== 'promote') {
    await db.update(guideContributions).set({ status: input.action === 'hide' ? 'hidden' : 'kept', reviewedByUserId: input.userId, reviewedAt: at, updatedAt: at }).where(eq(guideContributions.id, c.id));
    await db.update(guideReports).set({ resolvedAt: at }).where(and(eq(guideReports.contributionId, c.id), isNull(guideReports.resolvedAt)));
    return { ok: true };
  }
  const guide = await getGuide(c.guideId);
  if (!guide) return { ok: false, error: 'The guide is gone.' };
  const names = await userNames([c.authorUserId ?? 0]);
  const by = c.authorUserId ? { userId: c.authorUserId, name: names.get(c.authorUserId) ?? 'A player' } : null;
  let body = guide.body;
  let pieceKey = 'guide';
  if (c.kind === 'setup') {
    const block = firstGearBlock(body);
    if (!block) return { ok: false, error: 'This guide has no gear block to promote into.' };
    const setup = { ...(c.data as unknown as GearSetup), tier: (tierOf(c.tier)?.key ?? 'beginner') as TierKey, id: `c${c.id}`, communityId: c.id, by };
    if (block.setups.some((s) => s.communityId === c.id)) return { ok: false, error: 'Already promoted.' };
    body = upsertGearBlock(body, { ...block, setups: [...block.setups, setup] });
    pieceKey = `c${c.id}`;
  } else {
    const seg = splitSegments(body).find((s) => s.kind === 'route');
    const route = seg ? parseRouteBlock(seg.text) : null;
    if (!route) return { ok: false, error: 'This guide has no route to add to.' };
    const d = c.data as { chapter?: number; step?: RouteStep; stepId?: string; title?: string; why?: string };
    if (c.kind === 'step' && d.step) {
      const ch = route.chapters[Math.max(0, Math.min(route.chapters.length - 1, d.chapter ?? route.chapters.length - 1))];
      ch.steps.push({ ...d.step, id: `s${c.id}`, by });
      pieceKey = `s${c.id}`;
    } else if (c.kind === 'edit' && d.stepId) {
      const st = route.chapters.flatMap((x) => x.steps).find((x) => x.id === d.stepId);
      if (!st) return { ok: false, error: 'That step is gone.' };
      if (d.title) st.title = plainText(d.title, 80);
      if (d.why != null) st.why = plainText(d.why, 200);
      pieceKey = d.stepId;
    } else return { ok: false, error: 'Nothing to promote.' };
    body = upsertFencedBlock(body, 'route', serializeRouteBlock(parseRouteBlock(serializeRouteBlock(route))!));
  }
  const saved = await saveGuide(guide, { body }, input.userId, `Promoted from the community: ${c.name}${by ? ` by ${by.name}` : ''}`);
  await db.update(guideContributions).set({ status: 'promoted', reviewTag: input.tag ?? null, reviewedByUserId: input.userId, reviewedAt: at, updatedAt: at }).where(eq(guideContributions.id, c.id));
  await db.update(guideReports).set({ resolvedAt: at }).where(and(eq(guideReports.contributionId, c.id), isNull(guideReports.resolvedAt)));
  if (c.kind !== 'setup' && c.authorUserId) {
    await db.insert(guideEditCredits).values({ guideId: guide.id, pieceKey, userId: c.authorUserId, tag: input.tag && isEditTag(input.tag) ? input.tag : 'substantive', month: monthOf(at), version: saved.version, createdAt: at });
  }
  // A promotion may make another setup the old way of doing the same thing; curators hide that one
  // by hand, which stops its credit (clawback).
  return { ok: true };
}

/** Suggest a route step (or an edit to one): reviewed before it shows. */
export async function suggestStep(input: { guideId: number; userId: number; chapter: number; step?: unknown; edit?: { stepId: string; title?: string; why?: string; reason?: string } }): Promise<GuideContribution> {
  const guide = await getGuide(input.guideId);
  if (!guide || guide.kind !== 'route') throw new CommunityError('That route is not available.');
  const at = nowIso();
  if (input.edit) {
    if (!/^[a-z0-9-]{1,40}$/.test(input.edit.stepId)) throw new CommunityError('Unknown step.');
    const [row] = await db
      .insert(guideContributions)
      .values({ guideId: libraryIdOf(guide), kind: 'edit', data: { stepId: input.edit.stepId, title: plainText(input.edit.title, 80), why: plainText(input.edit.why, 200) }, name: plainText(input.edit.title, 80) || 'Edit to a step', notes: plainText(input.edit.reason, 200) || null, authorUserId: input.userId, status: 'pending', createdAt: at, updatedAt: at })
      .returning();
    return row;
  }
  const parsed = parseRouteBlock(JSON.stringify({ chapters: [{ name: 'x', steps: [input.step] }] }));
  const step = parsed?.chapters[0]?.steps[0];
  if (!step) throw new CommunityError('That step is missing its goal or title.');
  const [row] = await db
    .insert(guideContributions)
    .values({ guideId: libraryIdOf(guide), kind: 'step', data: { chapter: Math.max(0, Math.floor(input.chapter || 0)), step } as unknown as Record<string, unknown>, name: step.title, authorUserId: input.userId, status: 'pending', createdAt: at, updatedAt: at })
    .returning();
  return row;
}

// ── Tips and common mistakes ─────────────────────────────────────────────────────────────────

export interface TipView {
  id: number;
  kind: 'tip' | 'mistake';
  tier: string | null;
  text: string;
  author: string;
  authorUserId: number | null;
  useful: number;
  mine: boolean;
}

export async function addTip(input: { guideId: number; userId: number; kind: string; tier?: string | null; text: string; clanId?: number | null }): Promise<void> {
  const guide = await getGuide(input.guideId);
  if (!guide) throw new CommunityError('That guide is not available.');
  const text = plainText(input.text, 280);
  if (text.length < 8) throw new CommunityError('A tip needs a few words.');
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(guideTips).where(and(eq(guideTips.authorUserId, input.userId), gte(guideTips.createdAt, since)));
  if (n >= DAILY_LIMIT) throw new CommunityError(`At most ${DAILY_LIMIT} tips a day.`);
  await db.insert(guideTips).values({
    guideId: input.clanId != null ? guide.id : libraryIdOf(guide),
    clanId: input.clanId ?? null,
    tier: tierOf(input.tier ?? null)?.key ?? null,
    kind: input.kind === 'mistake' ? 'mistake' : 'tip',
    text,
    authorUserId: input.userId,
    createdAt: nowIso(),
  });
}

export async function tipsFor(guide: Pick<Guide, 'id' | 'clanId' | 'sourceGuideId'>, viewerUserId: number | null): Promise<TipView[]> {
  const lib = libraryIdOf(guide);
  const rows = await db
    .select()
    .from(guideTips)
    .where(and(eq(guideTips.status, 'live'), or(and(eq(guideTips.guideId, lib), isNull(guideTips.clanId)), guide.clanId != null ? and(eq(guideTips.guideId, guide.id), eq(guideTips.clanId, guide.clanId)) : sql`false`)));
  if (!rows.length) return [];
  const votes = await db.select({ tipId: guideTipVotes.tipId, userId: guideTipVotes.userId }).from(guideTipVotes).where(inArray(guideTipVotes.tipId, rows.map((r) => r.id)));
  const names = await userNames(rows.map((r) => r.authorUserId ?? 0));
  return rows
    .map((r) => ({
      id: r.id,
      kind: (r.kind === 'mistake' ? 'mistake' : 'tip') as 'tip' | 'mistake',
      tier: r.tier,
      text: r.text,
      author: names.get(r.authorUserId ?? 0) ?? 'A player',
      authorUserId: r.authorUserId,
      useful: votes.filter((v) => v.tipId === r.id).length,
      mine: viewerUserId != null && votes.some((v) => v.tipId === r.id && v.userId === viewerUserId),
    }))
    .sort((a, b) => b.useful - a.useful || a.id - b.id);
}

export async function toggleTipUseful(tipId: number, userId: number): Promise<boolean> {
  const tip = await db.query.guideTips.findFirst({ where: eq(guideTips.id, tipId) });
  if (!tip || tip.status !== 'live' || tip.authorUserId === userId) return false;
  const gone = await db.delete(guideTipVotes).where(and(eq(guideTipVotes.tipId, tipId), eq(guideTipVotes.userId, userId))).returning();
  if (gone.length) return false;
  await db.insert(guideTipVotes).values({ tipId, userId, createdAt: nowIso() }).onConflictDoNothing();
  return true;
}

export async function hideTip(tipId: number): Promise<void> {
  await db.update(guideTips).set({ status: 'hidden' }).where(eq(guideTips.id, tipId));
  await db.update(guideReports).set({ resolvedAt: nowIso() }).where(and(eq(guideReports.tipId, tipId), isNull(guideReports.resolvedAt)));
}

// ── Wanted ───────────────────────────────────────────────────────────────────────────────────

export interface WantedView {
  id: number;
  guideId: number | null;
  guideTitle: string | null;
  guideSlug: string | null;
  topic: string | null;
  tier: string | null;
  accountType: string | null;
  build: string | null;
  note: string | null;
  reason: string;
  requesters: number;
  status: string;
  filledBy: string | null;
}

/** Ask for a gap. Asking for one already open adds a requester rather than a duplicate. */
export async function requestWanted(input: { userId: number; guideId?: number | null; topic?: string | null; tier?: string | null; accountType?: string | null; build?: string | null; note?: string | null }): Promise<void> {
  const tier = tierOf(input.tier ?? null)?.key ?? null;
  const acct = input.accountType && /^[a-z]{2,8}$/.test(input.accountType) ? input.accountType : null;
  const build = input.build && /^[a-z]{2,8}$/.test(input.build) ? input.build : null;
  const topic = input.guideId ? null : plainText(input.topic, 80) || null;
  if (!input.guideId && !topic) throw new CommunityError('Name the guide you want.');
  let libId: number | null = null;
  if (input.guideId) {
    const g = await getGuide(input.guideId);
    if (!g) throw new CommunityError('That guide is not available.');
    libId = libraryIdOf(g);
  }
  const same = await db
    .select({ id: guideWanted.id })
    .from(guideWanted)
    .where(
      and(
        eq(guideWanted.status, 'open'),
        libId != null ? eq(guideWanted.guideId, libId) : sql`lower(${guideWanted.topic}) = lower(${topic})`,
        tier ? eq(guideWanted.tier, tier) : isNull(guideWanted.tier),
        acct ? eq(guideWanted.accountType, acct) : isNull(guideWanted.accountType),
        build ? eq(guideWanted.build, build) : isNull(guideWanted.build),
      ),
    )
    .limit(1);
  if (same.length) {
    await db.update(guideWanted).set({ requesters: sql`${guideWanted.requesters} + 1` }).where(eq(guideWanted.id, same[0].id));
    return;
  }
  await db.insert(guideWanted).values({ guideId: libId, topic, tier, accountType: acct, build, note: plainText(input.note, 200) || null, requestedByUserId: input.userId, createdAt: nowIso() });
}

export async function listWanted(opts: { guideId?: number | null; status?: 'open' | 'filled'; limit?: number } = {}): Promise<WantedView[]> {
  const rows = await db
    .select({ w: guideWanted, title: guides.title, slug: guides.slug })
    .from(guideWanted)
    .leftJoin(guides, eq(guides.id, guideWanted.guideId))
    .where(and(eq(guideWanted.status, opts.status ?? 'open'), opts.guideId ? eq(guideWanted.guideId, opts.guideId) : undefined))
    .orderBy(desc(guideWanted.requesters), guideWanted.createdAt)
    .limit(opts.limit ?? 60);
  const names = await userNames(rows.map((r) => r.w.filledByUserId ?? 0));
  return rows.map(({ w, title, slug }) => ({
    id: w.id,
    guideId: w.guideId,
    guideTitle: title,
    guideSlug: slug,
    topic: w.topic,
    tier: w.tier,
    accountType: w.accountType,
    build: w.build,
    note: w.note,
    reason: w.reason,
    requesters: w.requesters,
    status: w.status,
    filledBy: w.filledByUserId ? names.get(w.filledByUserId) ?? null : null,
  }));
}

export async function closeWanted(id: number): Promise<void> {
  await db.update(guideWanted).set({ status: 'closed' }).where(eq(guideWanted.id, id));
}

/**
 * Upkeep: a game update made a guide (or part of it) stale. The guide says so, and the gap goes on
 * Wanted; the next accepted 'upkeep' edit clears it (and earns like a substantive one).
 */
export async function markStale(guideId: number, note: string, userId: number): Promise<void> {
  const text = plainText(note, 200) || 'A game update may have changed this.';
  await db.update(guides).set({ staleNote: text, staleAt: nowIso() }).where(eq(guides.id, guideId));
  const open = await db.select({ id: guideWanted.id }).from(guideWanted).where(and(eq(guideWanted.guideId, guideId), eq(guideWanted.reason, 'stale'), eq(guideWanted.status, 'open'))).limit(1);
  if (!open.length) await db.insert(guideWanted).values({ guideId, reason: 'stale', note: text, requestedByUserId: userId, createdAt: nowIso() });
}

/** The guide an upkeep flag may touch: published LIBRARY guides only; anything else is null (404). */
export async function upkeepTarget(id: number | null): Promise<Guide | null> {
  if (!id) return null;
  const g = await getGuide(id);
  return g && g.clanId == null && g.status === 'published' ? g : null;
}

export async function clearStale(guideId: number): Promise<void> {
  await db.update(guides).set({ staleNote: null, staleAt: null }).where(eq(guides.id, guideId));
  await db.update(guideWanted).set({ status: 'filled', filledAt: nowIso() }).where(and(eq(guideWanted.guideId, guideId), eq(guideWanted.reason, 'stale'), eq(guideWanted.status, 'open')));
}

// ── Routes: follows and ticks; views ─────────────────────────────────────────────────────────

export async function setFollow(userId: number, guideId: number, on: boolean): Promise<void> {
  if (!on) {
    await db.delete(guideRouteFollows).where(and(eq(guideRouteFollows.userId, userId), eq(guideRouteFollows.guideId, guideId)));
    return;
  }
  const at = nowIso();
  await db.insert(guideRouteFollows).values({ userId, guideId, createdAt: at, updatedAt: at }).onConflictDoNothing();
}

export async function tickStep(userId: number, guideId: number, stepId: string, done: boolean): Promise<string[]> {
  if (!/^[a-z0-9-]{1,40}$/.test(stepId)) return [];
  const row = await db.query.guideRouteFollows.findFirst({ where: and(eq(guideRouteFollows.userId, userId), eq(guideRouteFollows.guideId, guideId)) });
  const at = nowIso();
  const set = new Set(row?.manualDone ?? []);
  if (done) set.add(stepId);
  else set.delete(stepId);
  const manualDone = [...set].slice(0, 500);
  if (row) await db.update(guideRouteFollows).set({ manualDone, updatedAt: at }).where(eq(guideRouteFollows.id, row.id));
  else await db.insert(guideRouteFollows).values({ userId, guideId, manualDone, createdAt: at, updatedAt: at });
  return manualDone;
}

export async function followsOf(userId: number) {
  return db
    .select({ guideId: guideRouteFollows.guideId, manualDone: guideRouteFollows.manualDone, title: guides.title, slug: guides.slug, body: guides.body, updatedAt: guideRouteFollows.updatedAt })
    .from(guideRouteFollows)
    .innerJoin(guides, eq(guides.id, guideRouteFollows.guideId))
    .where(eq(guideRouteFollows.userId, userId))
    .orderBy(desc(guideRouteFollows.updatedAt));
}

export async function followerCount(guideId: number): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(guideRouteFollows).where(eq(guideRouteFollows.guideId, guideId));
  return r?.n ?? 0;
}

export async function recordView(userId: number, guideId: number): Promise<void> {
  await db
    .insert(guideViews)
    .values({ userId, guideId, viewedAt: nowIso() })
    .onConflictDoUpdate({ target: [guideViews.userId, guideViews.guideId], set: { viewedAt: nowIso() } })
    .catch((err) => log.warn('guides.view-fail', { err: String(err) }));
}

export async function recentGuides(userId: number, limit = 5) {
  return db
    .select({ id: guides.id, slug: guides.slug, title: guides.title, kind: guides.kind, category: guides.category, body: guides.body, clanId: guides.clanId, viewedAt: guideViews.viewedAt })
    .from(guideViews)
    .innerJoin(guides, eq(guides.id, guideViews.guideId))
    .where(and(eq(guideViews.userId, userId), eq(guides.status, 'published')))
    .orderBy(desc(guideViews.viewedAt))
    .limit(limit);
}

// ── Credit ───────────────────────────────────────────────────────────────────────────────────

const monthRange = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const end = new Date(Date.UTC(y, m, 1)).toISOString();
  return { start, end };
};

/** The pieces, edits and reach of one month, gathered for lib/guideCredit. */
async function creditInputs(month: string): Promise<{ pieces: Piece[]; edits: Edit[]; reach: Reach[] }> {
  const { start, end } = monthRange(month);
  const [contribs, lib, votes, edits, tipRows] = await Promise.all([
    db.select({ id: guideContributions.id, guideId: guideContributions.guideId, author: guideContributions.authorUserId, status: guideContributions.status, kind: guideContributions.kind, first: guideContributions.firstToWrite, createdAt: guideContributions.createdAt }).from(guideContributions),
    db.select({ id: guides.id, author: guides.createdByUserId, body: guides.body }).from(guides).where(and(isNull(guides.clanId), eq(guides.status, 'published'))),
    db
      .select({ guideId: guideSetupVotes.guideId, key: guideSetupVotes.setupKey, accountId: guideSetupVotes.accountId, userId: guideSetupVotes.userId, source: guideSetupVotes.source, clanId: guideSetupVotes.voterClanId, playerId: users.playerId, accCreated: accounts.createdAt })
      .from(guideSetupVotes)
      .innerJoin(users, eq(users.id, guideSetupVotes.userId))
      .leftJoin(accounts, eq(accounts.id, guideSetupVotes.accountId))
      .where(and(gte(guideSetupVotes.lastUsedAt, start), lt(guideSetupVotes.lastUsedAt, end))),
    db.select().from(guideEditCredits),
    db.select({ id: guideTips.id, author: guideTips.authorUserId, status: guideTips.status }).from(guideTips),
  ]);
  const authorPlayers = new Map<number, number | null>();
  const uids = [...new Set([...contribs.map((c) => c.author), ...lib.map((g) => g.author), ...tipRows.map((t) => t.author)].filter((x): x is number => x != null))];
  if (uids.length) for (const r of await db.select({ id: users.id, playerId: users.playerId }).from(users).where(inArray(users.id, uids))) authorPlayers.set(r.id, r.playerId);

  const pieces: Piece[] = [];
  for (const c of contribs) {
    if (c.kind !== 'setup') continue;
    pieces.push({ id: `${c.guideId}:c${c.id}`, authorUserId: c.author, authorPlayerId: authorPlayers.get(c.author ?? 0) ?? null, live: ['live', 'kept', 'promoted'].includes(c.status), firstToWrite: c.first, createdMonth: monthOf(c.createdAt) });
  }
  for (const g of lib) {
    const block = firstGearBlock(g.body);
    block?.setups.forEach((s, i) => {
      if (s.communityId) return; // credited through its contribution
      pieces.push({ id: `${g.id}:${setupKey(s, i)}`, authorUserId: g.author, authorPlayerId: authorPlayers.get(g.author ?? 0) ?? null, live: true });
    });
  }
  const reach: Reach[] = votes.map((v) => ({
    pieceId: `${v.guideId}:${v.key}`,
    accountId: v.accountId ?? -v.userId,
    playerId: v.playerId,
    clanId: v.clanId,
    ageDays: v.accCreated ? (Date.now() - Date.parse(v.accCreated.includes('T') ? v.accCreated : `${v.accCreated.replace(' ', 'T')}Z`)) / 86_400_000 : 0,
    confirmed: v.source === 'auto',
    voted: v.source === 'manual',
  }));
  // An edit on the whole guide touches each of its pieces.
  const piecesOf = new Map<number, string[]>();
  for (const p of pieces) {
    const gid = Number(p.id.split(':')[0]);
    piecesOf.set(gid, [...(piecesOf.get(gid) ?? []), p.id]);
  }
  const editRows: Edit[] = [];
  for (const e of edits) {
    if (!isEditTag(e.tag)) continue;
    const targets = e.pieceKey === 'guide' ? piecesOf.get(e.guideId) ?? [] : [`${e.guideId}:${e.pieceKey}`];
    for (const pieceId of targets) editRows.push({ pieceId, userId: e.userId, tag: e.tag, reverted: e.reverted, month: e.month });
  }
  return { pieces, edits: editRows, reach };
}

export async function monthCredits(month: string): Promise<Map<number, number>> {
  const { pieces, edits, reach } = await creditInputs(month);
  return monthlyCredit(month, pieces, edits, reach);
}

export interface WriterStats {
  lifetime: number;
  month: number;
  rank: ReturnType<typeof writerRank>;
}

/** A writer's own numbers: this month's credit and the lifetime sum of recorded months + this one. */
export async function writerStats(userId: number, month = monthOf(nowIso())): Promise<WriterStats> {
  const current = (await monthCredits(month)).get(userId) ?? 0;
  const [past] = await db
    .select({ n: sql<number>`coalesce(sum(${guideWriterAwards.credit}), 0)::float` })
    .from(guideWriterAwards)
    .where(and(eq(guideWriterAwards.userId, userId), sql`${guideWriterAwards.month} <> ${month}`));
  const lifetime = (past?.n ?? 0) + current;
  return { lifetime, month: current, rank: writerRank(lifetime) };
}

/**
 * Record a month: every writer's credit (so lifetime sums stay cheap), and the featured group of
 * about ten. Re-running a month refreshes it. Nothing is granted here.
 */
export async function recordMonth(month: string): Promise<number[]> {
  const credit = await monthCredits(month);
  const names = await userNames([...credit.keys()]);
  const featured = new Set(featuredWriters(credit, names));
  const at = nowIso();
  for (const [userId, c] of credit) {
    await db
      .insert(guideWriterAwards)
      .values({ month, userId, credit: c, featured: featured.has(userId), createdAt: at })
      .onConflictDoUpdate({ target: [guideWriterAwards.month, guideWriterAwards.userId], set: { credit: c, featured: featured.has(userId) } });
  }
  return [...featured];
}

/** The featured group for a month (computed live for the current month), in name order. */
export async function featuredFor(month: string): Promise<{ userId: number; name: string; picked: boolean; granted: boolean }[]> {
  const rows = await db.select().from(guideWriterAwards).where(and(eq(guideWriterAwards.month, month), eq(guideWriterAwards.featured, true)));
  let ids = rows.map((r) => r.userId);
  if (!rows.length) {
    const credit = await monthCredits(month);
    ids = featuredWriters(credit, await userNames([...credit.keys()]));
  }
  const names = await userNames(ids);
  return ids
    .map((userId) => {
      const r = rows.find((x) => x.userId === userId);
      return { userId, name: names.get(userId) ?? 'A player', picked: !!r?.picked, granted: !!r?.rewardGrantedAt };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** A curator picks the month's reward from the featured group. */
export async function pickReward(month: string, userId: number): Promise<boolean> {
  const r = await db.update(guideWriterAwards).set({ picked: true }).where(and(eq(guideWriterAwards.month, month), eq(guideWriterAwards.userId, userId), eq(guideWriterAwards.featured, true))).returning();
  return r.length > 0;
}

/** Staff grant a picked writer a month of Supporter through the existing gift mechanism. */
export async function grantReward(month: string, userId: number, staffUserId: number): Promise<{ ok: boolean; error?: string }> {
  const row = await db.query.guideWriterAwards.findFirst({ where: and(eq(guideWriterAwards.month, month), eq(guideWriterAwards.userId, userId)) });
  if (!row?.picked) return { ok: false, error: 'Pick the writer first.' };
  if (row.rewardGrantedAt) return { ok: false, error: 'Already granted.' };
  const { giveGift } = await import('@/lib/supporterGifts');
  await giveGift({ userId, tier: 'supporter', days: 31, actorUserId: staffUserId, note: `Featured guide writer, ${month}`, mode: 'add' });
  await db.update(guideWriterAwards).set({ rewardGrantedAt: nowIso(), grantedByUserId: staffUserId }).where(eq(guideWriterAwards.id, row.id));
  return { ok: true };
}

// ── Contributors on a byline ─────────────────────────────────────────────────────────────────

export interface GuideCredits {
  /** The library guide's contributors (for a library guide: everyone). */
  library: Contributor[];
  /** A forked copy's own editors (empty for the library and for copies that follow). */
  clan: Contributor[];
}

async function contributionsOf(guideId: number): Promise<Contribution[]> {
  const [g, revs, props, contribs, tips, edits] = await Promise.all([
    db.query.guides.findFirst({ where: eq(guides.id, guideId), columns: { createdByUserId: true, createdAt: true } }),
    db.select({ userId: guideRevisions.editedByUserId, at: guideRevisions.createdAt }).from(guideRevisions).where(eq(guideRevisions.guideId, guideId)),
    db.select({ userId: guideProposals.proposerUserId, at: guideProposals.createdAt }).from(guideProposals).where(and(eq(guideProposals.resultGuideId, guideId), eq(guideProposals.status, 'approved'))),
    db.select({ userId: guideContributions.authorUserId, id: guideContributions.id, kind: guideContributions.kind, at: guideContributions.createdAt }).from(guideContributions).where(and(eq(guideContributions.guideId, guideId), eq(guideContributions.status, 'promoted'))),
    db.select({ userId: guideTips.authorUserId, id: guideTips.id, at: guideTips.createdAt }).from(guideTips).where(and(eq(guideTips.guideId, guideId), eq(guideTips.status, 'live'))),
    db.select({ userId: guideEditCredits.userId, tag: guideEditCredits.tag, at: guideEditCredits.createdAt, reverted: guideEditCredits.reverted }).from(guideEditCredits).where(eq(guideEditCredits.guideId, guideId)),
  ]);
  const reachRows = contribs.length
    ? await db
        .select({ key: guideSetupVotes.setupKey, n: sql<number>`sum(${guideSetupVotes.weight})::float` })
        .from(guideSetupVotes)
        .where(and(eq(guideSetupVotes.guideId, guideId), inArray(guideSetupVotes.setupKey, contribs.map((c) => `c${c.id}`))))
        .groupBy(guideSetupVotes.setupKey)
    : [];
  const ids = [g?.createdByUserId, ...revs.map((r) => r.userId), ...props.map((p) => p.userId), ...contribs.map((c) => c.userId), ...tips.map((t) => t.userId), ...edits.map((e) => e.userId)].filter((x): x is number => x != null);
  const names = await userNames(ids);
  const nm = (id: number) => names.get(id) ?? 'A player';
  const out: Contribution[] = [];
  if (g?.createdByUserId) out.push({ userId: g.createdByUserId, name: nm(g.createdByUserId), kind: 'author', at: g.createdAt });
  for (const r of revs) if (r.userId && r.userId !== g?.createdByUserId) out.push({ userId: r.userId, name: nm(r.userId), kind: 'revision', at: r.at });
  for (const p of props) out.push({ userId: p.userId, name: nm(p.userId), kind: 'edit', tag: 'substantive', at: p.at });
  for (const c of contribs) if (c.userId) out.push({ userId: c.userId, name: nm(c.userId), kind: c.kind === 'setup' ? 'setup' : 'step', reach: reachRows.find((r) => r.key === `c${c.id}`)?.n ?? 0, at: c.at });
  for (const t of tips) if (t.userId) out.push({ userId: t.userId, name: nm(t.userId), kind: 'tip', at: t.at });
  for (const e of edits) if (!e.reverted && isEditTag(e.tag)) out.push({ userId: e.userId, name: nm(e.userId), kind: 'edit', tag: e.tag, at: e.at });
  return out;
}

/** Everyone credited on a guide: derived from accepted pieces, never typed by hand. */
export async function guideCredits(g: Pick<Guide, 'id' | 'clanId' | 'sourceGuideId' | 'followsSource'>): Promise<GuideCredits> {
  const lib = libraryIdOf(g);
  const library = contributors(await contributionsOf(lib));
  if (lib === g.id || g.followsSource) return { library, clan: [] };
  // A forked copy: the clan's own revisions on it (its first revision is the copy itself).
  const own = (await contributionsOf(g.id)).filter((c) => c.kind === 'revision' || c.kind === 'edit' || c.kind === 'tip' || c.kind === 'setup');
  return { library, clan: contributors(own) };
}

/** Byline counts for many guides at once (the home page cards): first contributor + how many. */
export async function bylines(guideIds: number[]): Promise<Map<number, { first: string | null; count: number }>> {
  const out = new Map<number, { first: string | null; count: number }>();
  if (!guideIds.length) return out;
  const rows = await db
    .select({ guideId: guideRevisions.guideId, userId: guideRevisions.editedByUserId })
    .from(guideRevisions)
    .where(inArray(guideRevisions.guideId, guideIds));
  const creators = await db.select({ id: guides.id, userId: guides.createdByUserId }).from(guides).where(inArray(guides.id, guideIds));
  const promoted = await db.select({ guideId: guideContributions.guideId, userId: guideContributions.authorUserId }).from(guideContributions).where(and(inArray(guideContributions.guideId, guideIds), eq(guideContributions.status, 'promoted')));
  const names = await userNames([...rows.map((r) => r.userId ?? 0), ...creators.map((c) => c.userId ?? 0), ...promoted.map((p) => p.userId ?? 0)]);
  for (const id of guideIds) {
    const creator = creators.find((c) => c.id === id)?.userId ?? null;
    const people = new Set([creator, ...rows.filter((r) => r.guideId === id).map((r) => r.userId), ...promoted.filter((p) => p.guideId === id).map((p) => p.userId)].filter((x): x is number => x != null));
    out.set(id, { first: creator ? names.get(creator) ?? null : names.get([...people][0] ?? 0) ?? null, count: people.size });
  }
  return out;
}

/** Community setup counts per library guide (home cards: "3 community setups"). */
export async function communityCounts(guideIds: number[]): Promise<Map<number, number>> {
  if (!guideIds.length) return new Map();
  const rows = await db
    .select({ guideId: guideContributions.guideId, n: sql<number>`count(*)::int` })
    .from(guideContributions)
    .where(and(inArray(guideContributions.guideId, guideIds), eq(guideContributions.kind, 'setup'), inArray(guideContributions.status, ['live', 'kept']), isNull(guideContributions.clanId)))
    .groupBy(guideContributions.guideId);
  return new Map(rows.map((r) => [r.guideId, r.n]));
}

/** Pieces a writer authored that are live, with this month's reach (their own "Your impact" list). */
export async function myPieces(userId: number): Promise<{ id: number; name: string; guideTitle: string; guideSlug: string; status: string; voters: number }[]> {
  const rows = await db
    .select({ c: guideContributions, title: guides.title, slug: guides.slug })
    .from(guideContributions)
    .innerJoin(guides, eq(guides.id, guideContributions.guideId))
    .where(eq(guideContributions.authorUserId, userId))
    .orderBy(desc(guideContributions.createdAt))
    .limit(50);
  const votes = rows.length
    ? await db.select({ key: guideSetupVotes.setupKey, n: sql<number>`count(*)::int` }).from(guideSetupVotes).where(inArray(guideSetupVotes.setupKey, rows.map((r) => `c${r.c.id}`))).groupBy(guideSetupVotes.setupKey)
    : [];
  return rows.map(({ c, title, slug }) => ({ id: c.id, name: c.name, guideTitle: title, guideSlug: slug, status: c.status, voters: votes.find((v) => v.key === `c${c.id}`)?.n ?? 0 }));
}
