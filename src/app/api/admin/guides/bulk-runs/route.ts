import { NextResponse } from 'next/server';

import { requireClanGuideEditorApi } from '@/lib/guideAccess';
import { listRuns } from '@/lib/guideBulk';

// Past bulk posts that still have something in Discord — each can be undone as a whole.
export async function GET() {
  const gate = await requireClanGuideEditorApi();
  if ('response' in gate) return gate.response;
  return NextResponse.json({ runs: await listRuns(gate.actor.clan.id) });
}
