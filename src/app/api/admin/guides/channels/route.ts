import { NextResponse } from 'next/server';

import { requireClanGuideEditorApi } from '@/lib/guideAccess';
import { listGuideChannels } from '@/lib/guidePosting';

// The channels and forums a guide can be posted to, with each forum's tags.
export async function GET() {
  const gate = await requireClanGuideEditorApi();
  if ('response' in gate) return gate.response;
  return NextResponse.json(await listGuideChannels(gate.actor.clan.id));
}
