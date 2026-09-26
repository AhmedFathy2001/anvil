import { NextResponse } from 'next/server';

import { clanGuideActor, requireClanGuideEditorApi } from '@/lib/guideAccess';
import { CategoryError, createCategory, listCategories } from '@/lib/guideCategoryStore';

// The platform's categories (read-only here) plus this clan's own.
export async function GET() {
  const actor = await clanGuideActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ canEdit: actor.canEdit, categories: await listCategories(actor.clan.id) });
}

export async function POST(request: Request) {
  const gate = await requireClanGuideEditorApi();
  if ('response' in gate) return gate.response;
  try {
    return NextResponse.json({ category: await createCategory(gate.actor.clan.id, (await request.json().catch(() => ({}))) ?? {}) });
  } catch (err) {
    if (err instanceof CategoryError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
