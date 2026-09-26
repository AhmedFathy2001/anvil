// Guide proposals: the way somebody who is not a library editor gets a guide into the Anvil library.
//
// Anyone signed in may propose a NEW guide, or an EDIT to a library guide. A platform guide editor
// reviews it: approve, and it goes through the same doors a library editor's own save does —
// createGuide for a new one, saveGuide for an edit, which rewrites following clan copies and offers
// the update to edited ones. Nothing about a proposal reaches a clan until a human said yes.
//
// Bounded per person (MAX_PENDING) so the queue cannot be flooded by one account.

import { and, count, desc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { guideProposals, users, type GuideProposal } from '@/db/schema';
import { GuideInputError, assertLibraryCoverage, cleanInput, createGuide, getScopedGuide, saveGuide, type GuideInput } from '@/lib/guides';
import { GUIDE_LIMITS } from '@/lib/guideCategories';

export const MAX_PENDING = 5;

const nowIso = () => new Date().toISOString();

export interface ProposalInput extends GuideInput {
  note?: string | null;
}

function fields(input: ProposalInput, partial: boolean) {
  const clean = cleanInput(
    { title: input.title, summary: input.summary, body: input.body, category: input.category, coverUrl: input.coverUrl },
    partial,
  );
  const note = input.note === undefined ? undefined : input.note ? String(input.note).trim().slice(0, 500) || null : null;
  return { ...clean, ...(note !== undefined ? { note } : {}) };
}

export async function pendingCount(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(guideProposals).where(eq(guideProposals.status, 'pending'));
  return row?.n ?? 0;
}

export async function createProposal(userId: number, input: ProposalInput & { targetGuideId?: number | null }): Promise<GuideProposal> {
  const [mine] = await db
    .select({ n: count() })
    .from(guideProposals)
    .where(and(eq(guideProposals.proposerUserId, userId), eq(guideProposals.status, 'pending')));
  if ((mine?.n ?? 0) >= MAX_PENDING) {
    throw new GuideInputError(`You have ${MAX_PENDING} proposals waiting already — wait for a review, or withdraw one.`);
  }
  let baseVersion: number | null = null;
  let targetGuideId: number | null = null;
  if (input.targetGuideId) {
    const target = await getScopedGuide(Number(input.targetGuideId), null);
    if (!target || target.status !== 'published') throw new GuideInputError('That library guide is not available to edit.');
    targetGuideId = target.id;
    baseVersion = target.version;
  }
  const f = fields(input, false);
  if (!f.body?.trim()) throw new GuideInputError('Write the guide before sending it.');
  // A proposal is for the library, so it has to meet the library's bar before a reviewer sees it.
  assertLibraryCoverage({ clanId: null, status: 'published', category: f.category ?? 'general', body: f.body });
  const at = nowIso();
  const [row] = await db
    .insert(guideProposals)
    .values({
      proposerUserId: userId,
      targetGuideId,
      baseVersion,
      title: f.title!,
      summary: f.summary ?? '',
      category: f.category ?? 'general',
      coverUrl: f.coverUrl ?? null,
      body: f.body ?? '',
      note: f.note ?? null,
      status: 'pending',
      createdAt: at,
      updatedAt: at,
    })
    .returning();
  return row;
}

export async function getProposal(id: number): Promise<GuideProposal | null> {
  return (await db.query.guideProposals.findFirst({ where: eq(guideProposals.id, id) })) ?? null;
}

export async function updateProposal(p: GuideProposal, input: ProposalInput): Promise<GuideProposal> {
  if (p.status !== 'pending') throw new GuideInputError('Only a proposal still waiting for review can be edited.');
  const f = fields(input, true);
  const [row] = await db
    .update(guideProposals)
    .set({ ...f, updatedAt: nowIso() })
    .where(eq(guideProposals.id, p.id))
    .returning();
  return row;
}

export async function withdrawProposal(p: GuideProposal): Promise<void> {
  if (p.status !== 'pending') throw new GuideInputError('Only a waiting proposal can be withdrawn.');
  await db.update(guideProposals).set({ status: 'withdrawn', updatedAt: nowIso() }).where(eq(guideProposals.id, p.id));
}

/** A proposer's own, newest first. */
export async function listMine(userId: number) {
  return db
    .select()
    .from(guideProposals)
    .where(eq(guideProposals.proposerUserId, userId))
    .orderBy(desc(guideProposals.updatedAt))
    .limit(50);
}

/** The review queue: waiting first, then the recent decisions. */
export async function listForReview(status: 'pending' | 'reviewed') {
  const rows = await db
    .select({ p: guideProposals, proposer: users.displayName })
    .from(guideProposals)
    .innerJoin(users, eq(users.id, guideProposals.proposerUserId))
    .where(status === 'pending' ? eq(guideProposals.status, 'pending') : undefined)
    .orderBy(desc(guideProposals.updatedAt))
    .limit(100);
  return rows
    .filter((r) => status === 'pending' || (r.p.status !== 'pending' && r.p.status !== 'withdrawn'))
    .map((r) => ({ ...r.p, proposer: r.proposer }));
}

async function proposerName(userId: number): Promise<string> {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { displayName: true } });
  return u?.displayName ?? 'a member';
}

/**
 * Approve. A new guide lands in the library (published, or as a draft for the reviewer to finish);
 * an edit becomes the library guide's next version, credited in its history. The reviewer's note is
 * what the proposer sees; for an edit it is also the "what changed" clans are shown.
 */
export async function approveProposal(
  p: GuideProposal,
  reviewerId: number,
  opts: { reviewNote?: string | null; publish?: boolean },
): Promise<GuideProposal> {
  if (p.status !== 'pending') throw new GuideInputError('This proposal has already been answered.');
  const by = await proposerName(p.proposerUserId);
  const reviewNote = opts.reviewNote?.trim().slice(0, 500) || null;
  const content = { title: p.title, summary: p.summary, category: p.category, coverUrl: p.coverUrl, body: p.body };

  let resultId: number;
  if (p.targetGuideId) {
    const target = await getScopedGuide(p.targetGuideId, null);
    if (!target) throw new GuideInputError('The library guide this edits no longer exists — reject it, or approve it as a new guide.');
    // What clans offered the update read: the reviewer's words if given, else the proposer's.
    const why = reviewNote || p.note;
    const note = `Suggested by ${by}${why ? ` — ${why}` : ''}`.slice(0, GUIDE_LIMITS.note);
    await saveGuide(target, content, reviewerId, note);
    resultId = target.id;
  } else {
    const created = await createGuide(
      null,
      { ...content, status: opts.publish === false ? 'draft' : 'published' },
      reviewerId,
      `Written by ${by}`.slice(0, GUIDE_LIMITS.note),
    );
    resultId = created.id;
  }

  const at = nowIso();
  const [row] = await db
    .update(guideProposals)
    .set({ status: 'approved', reviewNote, reviewedByUserId: reviewerId, reviewedAt: at, updatedAt: at, resultGuideId: resultId })
    .where(eq(guideProposals.id, p.id))
    .returning();
  return row;
}

export async function rejectProposal(p: GuideProposal, reviewerId: number, reviewNote: string | null): Promise<GuideProposal> {
  if (p.status !== 'pending') throw new GuideInputError('This proposal has already been answered.');
  const note = reviewNote?.trim().slice(0, 500) || null;
  if (!note) throw new GuideInputError('Say why — the writer sees it, and a bare no teaches nobody anything.');
  const at = nowIso();
  const [row] = await db
    .update(guideProposals)
    .set({ status: 'rejected', reviewNote: note, reviewedByUserId: reviewerId, reviewedAt: at, updatedAt: at })
    .where(eq(guideProposals.id, p.id))
    .returning();
  return row;
}
