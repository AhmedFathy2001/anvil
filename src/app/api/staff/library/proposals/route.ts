import { NextResponse } from 'next/server';
import { requireLibraryEditorApi } from '@/lib/guideAccess';
import { listForReview } from '@/lib/libraryProposals';

export const dynamic = 'force-dynamic';

// GET ?status=pending|reviewed — the review queue.
export async function GET(request: Request) {
  const g = await requireLibraryEditorApi();
  if ('response' in g) return g.response;
  const which = new URL(request.url).searchParams.get('status') === 'reviewed' ? 'reviewed' : 'pending';
  return NextResponse.json({ proposals: await listForReview(which) });
}
