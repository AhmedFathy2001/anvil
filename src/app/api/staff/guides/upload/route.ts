import { requireLibraryEditorApi } from '@/lib/guideAccess';
import { handleGuideImageUpload } from '@/lib/guideUpload';

export async function POST(request: Request) {
  const gate = await requireLibraryEditorApi();
  if ('response' in gate) return gate.response;
  // Library media belongs to no clan.
  return handleGuideImageUpload(request, 'library/guides');
}
