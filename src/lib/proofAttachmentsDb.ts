// The DB half of lib/proofAttachments: read a proof's extras, save a draft, move drafts onto a proof.

import { and, count, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { proofUploads, submissionAttachments } from '@/db/schema';
import { orderAttachments, type AttachmentKind, type AttachmentLabel, type ProofAttachment, type ProofAttachmentInput } from '@/lib/proofAttachments';

type Row = typeof submissionAttachments.$inferSelect;

const view = (r: Row): ProofAttachment => ({
  id: r.id,
  submissionId: r.submissionId,
  kind: r.kind as AttachmentKind,
  url: r.url,
  label: (r.label as AttachmentLabel | null) ?? null,
  createdAt: r.createdAt,
  userId: r.userId,
});

/** Each submission's extras, start shots first. Submissions with none are absent. */
export async function attachmentsFor(submissionIds: number[]): Promise<Map<number, ProofAttachment[]>> {
  const out = new Map<number, ProofAttachment[]>();
  if (submissionIds.length === 0) return out;
  // clan-scope: global -- keyed by submission ids the caller already scoped to its event.
  const rows = await db.select().from(submissionAttachments).where(inArray(submissionAttachments.submissionId, submissionIds));
  for (const r of rows) {
    const list = out.get(r.submissionId!) ?? [];
    list.push(view(r));
    out.set(r.submissionId!, list);
  }
  for (const [k, v] of out) out.set(k, orderAttachments(v));
  return out;
}

/** One person's unsent extras for a tile (their saved start screenshot). */
export async function draftsFor(tileId: number, teamId: number, userId: number): Promise<ProofAttachment[]> {
  // clan-scope: global -- the caller resolved tile and team inside its event.
  const rows = await db
    .select()
    .from(submissionAttachments)
    .where(and(eq(submissionAttachments.tileId, tileId), eq(submissionAttachments.teamId, teamId), eq(submissionAttachments.userId, userId), isNull(submissionAttachments.submissionId)));
  return orderAttachments(rows.map(view));
}

/** How many extras a proof (or, with submissionId null, a person's draft on a tile) already holds. */
export async function attachmentCount(where: { submissionId: number } | { tileId: number; teamId: number; userId: number }): Promise<number> {
  const cond =
    'submissionId' in where
      ? eq(submissionAttachments.submissionId, where.submissionId)
      : and(eq(submissionAttachments.tileId, where.tileId), eq(submissionAttachments.teamId, where.teamId), eq(submissionAttachments.userId, where.userId), isNull(submissionAttachments.submissionId));
  // clan-scope: global -- the caller resolved the submission or tile inside its event.
  const [r] = await db.select({ n: count() }).from(submissionAttachments).where(cond);
  return Number(r?.n ?? 0);
}

export async function addAttachments(target: { submissionId: number | null; tileId: number; teamId: number; userId: number | null }, items: ProofAttachmentInput[]): Promise<ProofAttachment[]> {
  if (items.length === 0) return [];
  const rows = await db
    .insert(submissionAttachments)
    .values(items.map((a) => ({ ...target, kind: a.kind, url: a.url, label: a.label ?? null })))
    .returning();
  return rows.map(view);
}

/** Move this person's drafts on the tile onto the proof they just sent. Returns how many moved. */
export async function adoptDrafts(submissionId: number, tileId: number, teamId: number, userId: number): Promise<number> {
  // clan-scope: global -- the submission was just inserted for this tile and team.
  const moved = await db
    .update(submissionAttachments)
    .set({ submissionId })
    .where(and(eq(submissionAttachments.tileId, tileId), eq(submissionAttachments.teamId, teamId), eq(submissionAttachments.userId, userId), isNull(submissionAttachments.submissionId)))
    .returning({ id: submissionAttachments.id });
  return moved.length;
}

/**
 * True when every screenshot among these extras is a file THIS person uploaded here (proof_uploads).
 * "On our storage" is not enough: the media purge deletes an event's attachment files, so a pasted
 * URL of another clan's (or event's) upload would get that file deleted with this event's.
 */
export async function ownsAttachmentImages(items: ProofAttachmentInput[], userId: number): Promise<boolean> {
  const urls = [...new Set(items.filter((a) => a.kind === 'image').map((a) => a.url))];
  if (urls.length === 0) return true;
  // clan-scope: global -- keyed by the caller's own user id and the URLs they sent.
  const rows = await db
    .select({ url: proofUploads.url })
    .from(proofUploads)
    .where(and(inArray(proofUploads.url, urls), eq(proofUploads.userId, userId)));
  return rows.length === urls.length;
}
