import { NextResponse } from 'next/server';

import { requireClanGuideEditorApi } from '@/lib/guideAccess';
import { CategoryError, deleteCategory, getCategory, updateCategory } from '@/lib/guideCategoryStore';

type Ctx = { params: Promise<{ id: string }> };

// Only this clan's own categories; the platform's are managed at /staff.
async function ownRow(ctx: Ctx, clanId: number) {
  const row = await getCategory(Number((await ctx.params).id));
  return row && row.clanId === clanId ? row : null;
}

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireClanGuideEditorApi();
  if ('response' in gate) return gate.response;
  const row = await ownRow(ctx, gate.actor.clan.id);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    return NextResponse.json({ category: await updateCategory(row, (await request.json().catch(() => ({}))) ?? {}) });
  } catch (err) {
    if (err instanceof CategoryError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireClanGuideEditorApi();
  if ('response' in gate) return gate.response;
  const row = await ownRow(ctx, gate.actor.clan.id);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    await deleteCategory(row);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CategoryError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
