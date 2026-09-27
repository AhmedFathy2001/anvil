import { NextResponse } from 'next/server';

import { requireClanGuideEditorApi } from '@/lib/guideAccess';
import { removeRun } from '@/lib/guideBulk';

// DELETE — undo a bulk post: the channels, forum and category Anvil created, and the posts in them.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireClanGuideEditorApi();
  if ('response' in gate) return gate.response;
  const r = await removeRun(gate.actor.clan.id, Number((await params).id));
  return NextResponse.json(r, { status: r.ok ? 200 : 207 });
}
