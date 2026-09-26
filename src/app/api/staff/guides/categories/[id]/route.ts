import { NextResponse } from 'next/server';

import { requireLibraryEditorApi } from '@/lib/guideAccess';
import { CategoryError, deleteCategory, getCategory, updateCategory } from '@/lib/guideCategoryStore';

type Ctx = { params: Promise<{ id: string }> };

async function platformRow(ctx: Ctx) {
  const row = await getCategory(Number((await ctx.params).id));
  return row && row.clanId == null ? row : null;
}

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireLibraryEditorApi();
  if ('response' in gate) return gate.response;
  const row = await platformRow(ctx);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    return NextResponse.json({ category: await updateCategory(row, (await request.json().catch(() => ({}))) ?? {}) });
  } catch (err) {
    if (err instanceof CategoryError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireLibraryEditorApi();
  if ('response' in gate) return gate.response;
  const row = await platformRow(ctx);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    await deleteCategory(row);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CategoryError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
