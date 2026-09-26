import { NextResponse } from 'next/server';

import { libraryActor } from '@/lib/guideAccess';
import { listForReview } from '@/lib/guideProposals';
import { listCategories } from '@/lib/guideCategoryStore';

// GET ?status=pending|reviewed — the review queue.
export async function GET(request: Request) {
  const actor = await libraryActor();
  if (!actor) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const status = new URL(request.url).searchParams.get('status') === 'reviewed' ? 'reviewed' : 'pending';
  const rows = await listForReview(status);
  // The list needs no bodies.
  return NextResponse.json({ canEdit: actor.canEdit, categories: await listCategories(null), proposals: rows.map(({ body: _body, ...r }) => r) });
}
