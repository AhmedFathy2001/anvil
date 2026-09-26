import { NextResponse } from 'next/server';

import { libraryActor, requireLibraryEditorApi } from '@/lib/guideAccess';
import { CategoryError, createCategory, listCategories } from '@/lib/guideCategoryStore';

// The platform's guide categories.
export async function GET() {
  const actor = await libraryActor();
  if (!actor) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ canEdit: actor.canEdit, categories: await listCategories(null) });
}

export async function POST(request: Request) {
  const gate = await requireLibraryEditorApi();
  if ('response' in gate) return gate.response;
  try {
    return NextResponse.json({ category: await createCategory(null, (await request.json().catch(() => ({}))) ?? {}) });
  } catch (err) {
    if (err instanceof CategoryError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
