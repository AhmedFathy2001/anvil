import { NextResponse } from 'next/server';
import { and, count, isNotNull } from 'drizzle-orm';

import { db } from '@/db';
import { guides } from '@/db/schema';
import { libraryActor, requireLibraryEditorApi } from '@/lib/guideAccess';
import { GuideInputError, createGuide, guideCard, listLibrary } from '@/lib/guides';

// GET — the whole library, drafts included, with how many clans copied each guide (and how many of
// those copies still follow it — i.e. who an edit here will rewrite).
export async function GET() {
  const actor = await libraryActor();
  if (!actor) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const [library, copies] = await Promise.all([
    listLibrary({ includeDrafts: true }),
    db
      .select({ src: guides.sourceGuideId, follows: guides.followsSource, n: count() })
      .from(guides)
      .where(and(isNotNull(guides.sourceGuideId), isNotNull(guides.clanId)))
      .groupBy(guides.sourceGuideId, guides.followsSource),
  ]);
  const stats = new Map<number, { copies: number; following: number }>();
  for (const c of copies) {
    const s = stats.get(c.src!) ?? { copies: 0, following: 0 };
    s.copies += c.n;
    if (c.follows) s.following += c.n;
    stats.set(c.src!, s);
  }
  return NextResponse.json({
    canEdit: actor.canEdit,
    guides: library.map((g) => ({ ...guideCard(g), ...(stats.get(g.id) ?? { copies: 0, following: 0 }) })),
  });
}

// POST — a new library guide (starts as a draft; clans see nothing until it is published).
export async function POST(request: Request) {
  const gate = await requireLibraryEditorApi();
  if ('response' in gate) return gate.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  try {
    const guide = await createGuide(null, body, gate.actor.user.userId);
    return NextResponse.json({ guide: guideCard(guide) });
  } catch (err) {
    if (err instanceof GuideInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
