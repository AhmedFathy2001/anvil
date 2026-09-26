import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { libraryActor, requireLibraryEditorApi } from '@/lib/guideAccess';
import { GuideInputError, getScopedGuide } from '@/lib/guides';
import { approveProposal, getProposal, rejectProposal } from '@/lib/guideProposals';
import { listCategories } from '@/lib/guideCategoryStore';

type Ctx = { params: Promise<{ id: string }> };

// GET — the proposal, who wrote it, and (for an edit) the library guide as it stands now, for the diff.
export async function GET(_req: Request, { params }: Ctx) {
  const actor = await libraryActor();
  if (!actor) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const p = await getProposal(Number((await params).id));
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const [proposer, target] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, p.proposerUserId), columns: { displayName: true } }),
    p.targetGuideId ? getScopedGuide(p.targetGuideId, null) : Promise.resolve(null),
  ]);
  return NextResponse.json({
    canEdit: actor.canEdit,
    categories: await listCategories(null),
    proposal: p,
    proposer: proposer?.displayName ?? 'Unknown',
    target: target && { id: target.id, title: target.title, summary: target.summary, body: target.body, version: target.version, slug: target.slug },
  });
}

// POST — { action: 'approve', reviewNote?, publish? } or { action: 'reject', reviewNote }.
export async function POST(request: Request, { params }: Ctx) {
  const gate = await requireLibraryEditorApi();
  if ('response' in gate) return gate.response;
  const p = await getProposal(Number((await params).id));
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { action?: string; reviewNote?: string; publish?: boolean } | null;
  try {
    if (body?.action === 'approve') {
      const r = await approveProposal(p, gate.actor.user.userId, { reviewNote: body.reviewNote ?? null, publish: body.publish !== false });
      return NextResponse.json({ proposal: r });
    }
    if (body?.action === 'reject') {
      return NextResponse.json({ proposal: await rejectProposal(p, gate.actor.user.userId, body.reviewNote ?? null) });
    }
  } catch (err) {
    if (err instanceof GuideInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
