import { NextResponse } from 'next/server';
import { verifyUser } from '@/lib/auth';
import { currentClan } from '@/lib/clanContext';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { createProposal, listMine, type ProposalKind } from '@/lib/libraryProposals';

export const dynamic = 'force-dynamic';

// Suggestions for the Anvil library. Anyone signed in may suggest a new task, a fix to an Anvil task,
// or a change to an Anvil board; staff review them at /staff/library.

export async function GET() {
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  return NextResponse.json({ proposals: await listMine(session.userId) });
}

// POST { kind, targetTaskId?, targetBoardId?, payload, note? }
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const rl = await rateLimit(request, 'library-proposal', { limit: 10, windowMs: 3_600_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many suggestions — try again later.' }, { status: 429, headers: rateLimitHeaders(rl) });
  const body = await request.json().catch(() => null);
  const kind = body?.kind as ProposalKind;
  if (!['task-new', 'task-edit', 'board-edit'].includes(kind)) return NextResponse.json({ error: 'Unknown kind.' }, { status: 400 });
  // Big enough for a 7x7 board, small enough that nobody files a novel.
  if (JSON.stringify(body?.payload ?? null).length > 200_000) return NextResponse.json({ error: 'That suggestion is too large.' }, { status: 413 });
  const clan = await currentClan();
  try {
    const id = await createProposal(session.userId, clan?.id ?? null, {
      kind,
      targetTaskId: Number.isInteger(body?.targetTaskId) ? body.targetTaskId : null,
      targetBoardId: Number.isInteger(body?.targetBoardId) ? body.targetBoardId : null,
      payload: body?.payload,
      note: typeof body?.note === 'string' ? body.note : null,
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
