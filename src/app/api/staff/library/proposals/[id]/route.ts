import { NextResponse } from 'next/server';
import { requireLibraryEditorApi } from '@/lib/guideAccess';
import { approveProposal, rejectProposal } from '@/lib/libraryProposals';

// POST { action: 'approve' | 'reject', note? } — approving applies the suggestion; rejecting needs a reason.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireLibraryEditorApi();
  if ('response' in g) return g.response;
  const id = Number((await params).id);
  const body = await request.json().catch(() => ({}));
  const note = typeof body?.note === 'string' ? body.note : '';
  try {
    if (body?.action === 'approve') await approveProposal(id, g.actor.user.userId, note || null);
    else if (body?.action === 'reject') await rejectProposal(id, g.actor.user.userId, note);
    else return NextResponse.json({ error: 'approve or reject' }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
