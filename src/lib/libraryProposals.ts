// Suggestions for the Anvil library, reviewed by staff (schema `library_proposals`).
//
//   task-new    — "add this task to Anvil's library". Payload: a whole task (AnvilTaskInput).
//   task-edit   — "this Anvil task should be…". Payload: the task as the proposer would have it.
//   board-edit  — "this Anvil board should be…". Payload: { tiles?, meta? } — new tiles, details, or both.
//
// Anyone signed in may suggest; approving APPLIES it through the same writes staff use, so an
// approved task edit reaches every clan copy that follows it. Community boards don't take
// suggestions: they belong to their clan, who edits them directly.

import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { clans, libraryBoards, libraryProposals, libraryTasks, users } from '@/db/schema';
import type { TileCsvRow } from '@/lib/csvTiles';
import { getAnvilTask, saveAnvilTask, type AnvilTaskInput } from '@/lib/libraryTasks';
import { cleanMeta, getBoard, replaceBoardTiles, sanitizeRow, sanitizeRows, updateBoardMeta, type BoardMeta } from '@/lib/libraryBoards';

/** Open suggestions one person may have at once — enough to be useful, too few to flood the queue. */
export const MAX_PENDING = 5;

export type ProposalKind = 'task-new' | 'task-edit' | 'board-edit';

export interface BoardEditPayload {
  tiles?: TileCsvRow[];
  meta?: BoardMeta;
}

export interface LibraryProposal {
  id: number;
  kind: ProposalKind;
  targetTaskId: number | null;
  targetBoardId: number | null;
  /** The target's title, for listing. */
  targetTitle: string | null;
  baseVersion: number | null;
  /** The target has changed since this was written — reviewers should look twice. */
  stale: boolean;
  payload: AnvilTaskInput | BoardEditPayload;
  note: string | null;
  proposerName: string;
  clanName: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

const nowIso = () => new Date().toISOString();

function isTaskInput(v: unknown): v is AnvilTaskInput {
  const o = v as AnvilTaskInput;
  return !!o && typeof o === 'object' && typeof o.label === 'string' && o.label.trim().length > 0 && typeof o.points === 'number' && !!o.config && typeof o.config === 'object';
}

function isBoardEdit(v: unknown): v is BoardEditPayload {
  const o = v as BoardEditPayload;
  if (!o || typeof o !== 'object') return false;
  const tilesOk = o.tiles === undefined || (Array.isArray(o.tiles) && o.tiles.length > 0 && o.tiles.length <= 200);
  const metaOk = o.meta === undefined || (typeof o.meta === 'object' && typeof o.meta.title === 'string');
  return tilesOk && metaOk && (o.tiles !== undefined || o.meta !== undefined);
}

export async function pendingCount(): Promise<number> {
  const [r] = await db.select({ n: count() }).from(libraryProposals).where(eq(libraryProposals.status, 'pending'));
  return Number(r?.n ?? 0);
}

/** Validate and file a suggestion. Throws a message fit to show the person who sent it. */
export async function createProposal(
  userId: number,
  clanId: number | null,
  input: { kind: ProposalKind; targetTaskId?: number | null; targetBoardId?: number | null; payload: unknown; note?: string | null },
): Promise<number> {
  const [mine] = await db
    .select({ n: count() })
    .from(libraryProposals)
    .where(and(eq(libraryProposals.proposerUserId, userId), eq(libraryProposals.status, 'pending')));
  if (Number(mine?.n ?? 0) >= MAX_PENDING) {
    throw new Error(`You have ${MAX_PENDING} suggestions waiting already. Wait for those to be reviewed, or withdraw one.`);
  }

  let baseVersion: number | null = null;
  let targetTaskId: number | null = null;
  let targetBoardId: number | null = null;
  if (input.kind === 'task-new' || input.kind === 'task-edit') {
    if (!isTaskInput(input.payload)) throw new Error('A task suggestion needs a name, points and how it tracks.');
    // Stored cleaned, so the reviewer reads exactly the setup approving would save.
    input.payload = { ...input.payload, config: sanitizeRow({ ...input.payload.config, label: input.payload.label }) };
    if (input.kind === 'task-edit') {
      const task = input.targetTaskId ? await getAnvilTask(input.targetTaskId) : null;
      if (!task || task.archived) throw new Error('That Anvil task no longer exists.');
      targetTaskId = task.id;
      baseVersion = task.version;
    }
  } else if (input.kind === 'board-edit') {
    if (!isBoardEdit(input.payload)) throw new Error('Suggest new tiles, new details, or both.');
    const board = input.targetBoardId ? await getBoard(input.targetBoardId) : null;
    if (!board || board.origin !== 'anvil') throw new Error('Only Anvil’s own boards take suggestions; community boards belong to their clan.');
    targetBoardId = board.id;
    baseVersion = board.version;
    // Stored in the cleaned form, so the reviewer sees exactly what approving would write.
    if (input.payload.tiles) input.payload.tiles = sanitizeRows(input.payload.tiles, board);
  } else {
    throw new Error('Unknown kind of suggestion.');
  }

  const [row] = await db
    .insert(libraryProposals)
    .values({
      kind: input.kind,
      targetTaskId,
      targetBoardId,
      baseVersion,
      payload: JSON.stringify(input.payload),
      note: input.note?.trim().slice(0, 1000) || null,
      proposerUserId: userId,
      clanId,
      createdAt: nowIso(),
    })
    .returning({ id: libraryProposals.id });
  return row.id;
}

async function hydrate(rows: (typeof libraryProposals.$inferSelect)[]): Promise<LibraryProposal[]> {
  if (rows.length === 0) return [];
  const userIds = [...new Set(rows.map((r) => r.proposerUserId))];
  const clanIds = [...new Set(rows.map((r) => r.clanId).filter((x): x is number => x != null))];
  const taskIds = [...new Set(rows.map((r) => r.targetTaskId).filter((x): x is number => x != null))];
  const boardIds = [...new Set(rows.map((r) => r.targetBoardId).filter((x): x is number => x != null))];
  const [us, cs, ts, bs] = await Promise.all([
    db.select({ id: users.id, name: users.displayName }).from(users).where(inArray(users.id, userIds)),
    clanIds.length ? db.select({ id: clans.id, name: clans.name }).from(clans).where(inArray(clans.id, clanIds)) : [],
    taskIds.length
      ? db.select({ id: libraryTasks.id, label: libraryTasks.label, version: libraryTasks.version }).from(libraryTasks).where(inArray(libraryTasks.id, taskIds))
      : [],
    boardIds.length
      ? db.select({ id: libraryBoards.id, title: libraryBoards.title, version: libraryBoards.version }).from(libraryBoards).where(inArray(libraryBoards.id, boardIds))
      : [],
  ]);
  const user = new Map(us.map((u) => [u.id, u.name]));
  const clan = new Map(cs.map((c) => [c.id, c.name]));
  const task = new Map(ts.map((t) => [t.id, t]));
  const board = new Map(bs.map((b) => [b.id, b]));
  return rows.map((r) => {
    const target = r.targetTaskId ? task.get(r.targetTaskId) : null;
    const boardTarget = r.targetBoardId ? board.get(r.targetBoardId) : null;
    const currentVersion = target?.version ?? boardTarget?.version ?? null;
    let payload: LibraryProposal['payload'];
    try {
      payload = JSON.parse(r.payload);
    } catch {
      payload = {};
    }
    return {
      id: r.id,
      kind: r.kind as ProposalKind,
      targetTaskId: r.targetTaskId,
      targetBoardId: r.targetBoardId,
      targetTitle: target?.label ?? boardTarget?.title ?? null,
      baseVersion: r.baseVersion,
      stale: r.baseVersion != null && currentVersion != null && currentVersion > r.baseVersion,
      payload,
      note: r.note,
      proposerName: user.get(r.proposerUserId) ?? 'Someone',
      clanName: r.clanId ? clan.get(r.clanId) ?? null : null,
      status: r.status as LibraryProposal['status'],
      reviewNote: r.reviewNote,
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt,
    };
  });
}

export async function listMine(userId: number): Promise<LibraryProposal[]> {
  const rows = await db
    .select()
    .from(libraryProposals)
    .where(eq(libraryProposals.proposerUserId, userId))
    .orderBy(desc(libraryProposals.createdAt))
    .limit(50);
  return hydrate(rows);
}

export async function listForReview(which: 'pending' | 'reviewed'): Promise<LibraryProposal[]> {
  const rows = await db
    .select()
    .from(libraryProposals)
    .where(which === 'pending' ? eq(libraryProposals.status, 'pending') : inArray(libraryProposals.status, ['approved', 'rejected']))
    .orderBy(which === 'pending' ? libraryProposals.createdAt : desc(libraryProposals.reviewedAt))
    .limit(100);
  return hydrate(rows);
}

async function pendingRow(id: number) {
  const row = await db.query.libraryProposals.findFirst({ where: eq(libraryProposals.id, id) });
  if (!row) throw new Error('Suggestion not found.');
  if (row.status !== 'pending') throw new Error('That suggestion has already been dealt with.');
  return row;
}

/** Approve and apply. Applying goes through the same writes staff use for their own edits. */
export async function approveProposal(id: number, reviewerId: number, reviewNote: string | null): Promise<void> {
  const row = await pendingRow(id);
  const payload = JSON.parse(row.payload) as unknown;
  if (row.kind === 'task-new') {
    if (!isTaskInput(payload)) throw new Error('This suggestion is no longer a valid task.');
    await saveAnvilTask(null, payload, reviewerId);
  } else if (row.kind === 'task-edit') {
    if (!row.targetTaskId || !isTaskInput(payload)) throw new Error('The task this was for is gone.');
    await saveAnvilTask(row.targetTaskId, payload, reviewerId);
  } else if (row.kind === 'board-edit') {
    const board = row.targetBoardId ? await getBoard(row.targetBoardId) : null;
    if (!board || !isBoardEdit(payload)) throw new Error('The board this was for is gone.');
    if (payload.meta) await updateBoardMeta(board.id, { ...board, ...cleanMeta({ ...board, ...payload.meta }) });
    if (payload.tiles) {
      // Cleaned again at approval: a row stored before this check existed, or against a board whose
      // size has changed since, must not reach the board unvalidated.
      const rows = sanitizeRows(payload.tiles, board);
      await replaceBoardTiles(board.id, rows, board.mode === 'classic' ? board.boardSize : rows.length);
    }
  }
  await db
    .update(libraryProposals)
    .set({ status: 'approved', reviewNote: reviewNote?.trim() || null, reviewedByUserId: reviewerId, reviewedAt: nowIso() })
    .where(eq(libraryProposals.id, id));
}

/** Reject with a reason — the person who suggested it deserves to know why. */
export async function rejectProposal(id: number, reviewerId: number, reviewNote: string): Promise<void> {
  if (!reviewNote.trim()) throw new Error('Say why, so they know what to change.');
  await pendingRow(id);
  await db
    .update(libraryProposals)
    .set({ status: 'rejected', reviewNote: reviewNote.trim().slice(0, 1000), reviewedByUserId: reviewerId, reviewedAt: nowIso() })
    .where(eq(libraryProposals.id, id));
}

export async function withdrawProposal(id: number, userId: number): Promise<void> {
  const row = await pendingRow(id);
  if (row.proposerUserId !== userId) throw new Error('Suggestion not found.');
  await db.update(libraryProposals).set({ status: 'withdrawn' }).where(eq(libraryProposals.id, id));
}
