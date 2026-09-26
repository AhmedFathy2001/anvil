import { NextResponse } from 'next/server';
import { and, count, eq } from 'drizzle-orm';

import { db } from '@/db';
import { guides } from '@/db/schema';
import { libraryActor, requireLibraryEditorApi } from '@/lib/guideAccess';
import { GuideInputError, deleteGuide, getScopedGuide, listRevisions, saveGuide } from '@/lib/guides';

type Ctx = { params: Promise<{ id: string }> };

async function reach(guideId: number) {
  const rows = await db
    .select({ follows: guides.followsSource, n: count() })
    .from(guides)
    .where(eq(guides.sourceGuideId, guideId))
    .groupBy(guides.followsSource);
  return {
    following: rows.find((r) => r.follows)?.n ?? 0,
    forked: rows.find((r) => !r.follows)?.n ?? 0,
  };
}

export async function GET(_req: Request, { params }: Ctx) {
  const actor = await libraryActor();
  if (!actor) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const guide = await getScopedGuide(Number((await params).id), null);
  if (!guide) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const [revisions, copies] = await Promise.all([listRevisions(guide.id), reach(guide.id)]);
  return NextResponse.json({
    canEdit: actor.canEdit,
    guide,
    revisions: revisions.map((r) => ({ version: r.version, note: r.note, at: r.createdAt })),
    copies,
  });
}

// PATCH — save a library guide. Published changes rewrite every following copy (and its Discord
// posts) and offer the update to every edited one; `note` is what those clans are shown.
export async function PATCH(request: Request, { params }: Ctx) {
  const gate = await requireLibraryEditorApi();
  if ('response' in gate) return gate.response;
  const guide = await getScopedGuide(Number((await params).id), null);
  if (!guide) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  if (typeof body.baseVersion === 'number' && body.baseVersion !== guide.version) {
    return NextResponse.json(
      { error: 'Someone saved this guide while you were editing. Copy your changes, reload, and apply them again.', conflict: true },
      { status: 409 },
    );
  }
  try {
    const saved = await saveGuide(guide, body, gate.actor.user.userId, typeof body.note === 'string' ? body.note : null);
    return NextResponse.json({ guide: saved });
  } catch (err) {
    if (err instanceof GuideInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

// DELETE — copies survive: they become ordinary clan guides (source_guide_id is set null).
export async function DELETE(_req: Request, { params }: Ctx) {
  const gate = await requireLibraryEditorApi();
  if ('response' in gate) return gate.response;
  const guide = await getScopedGuide(Number((await params).id), null);
  if (!guide) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await db.update(guides).set({ followsSource: false }).where(and(eq(guides.sourceGuideId, guide.id)));
  await deleteGuide(guide);
  return NextResponse.json({ ok: true });
}
