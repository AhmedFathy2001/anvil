import { requireClanGuideEditorApi } from '@/lib/guideAccess';
import { handleGuideImageUpload } from '@/lib/guideUpload';
import { clanMediaKey } from '@/lib/storage';

export async function POST(request: Request) {
  const gate = await requireClanGuideEditorApi();
  if ('response' in gate) return gate.response;
  return handleGuideImageUpload(request, clanMediaKey(gate.actor.clan.slug, 'guides'));
}
