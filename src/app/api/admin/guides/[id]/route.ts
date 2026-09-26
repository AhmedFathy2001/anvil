import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { guidePosts } from '@/db/schema';
import { clanGuideActor, requireClanGuideEditorApi } from '@/lib/guideAccess';
import { GuideInputError, deleteGuide, getScopedGuide, listRevisions, saveGuide } from '@/lib/guides';
import { postJumpUrl, unpost } from '@/lib/guidePosting';
import { getBotCredentials } from '@/lib/discord-roles';

type Ctx = { params: Promise<{ id: string }> };

// GET — the guide, its history, its library original (for the diff), and where it is posted.
export async function GET(_req: Request, { params }: Ctx) {
  const actor = await clanGuideActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const guide = await getScopedGuide(Number((await params).id), actor.clan.id);
  if (!guide) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [revisions, source, posts, creds] = await Promise.all([
    listRevisions(guide.id),
    guide.sourceGuideId ? getScopedGuide(guide.sourceGuideId, null) : Promise.resolve(null),
    db.select().from(guidePosts).where(eq(guidePosts.guideId, guide.id)),
    getBotCredentials(actor.clan.id),
  ]);
  // The library editor's notes for every version this copy has not taken yet.
  const sourceNotes = source
    ? (await listRevisions(source.id))
        .filter((r) => r.version > (guide.sourceVersion ?? 0))
        .map((r) => ({ version: r.version, note: r.note, at: r.createdAt }))
    : [];

  return NextResponse.json({
    canEdit: actor.canEdit,
    guide,
    sourceNotes,
    revisions: revisions.map((r) => ({ version: r.version, note: r.note, at: r.createdAt })),
    source: source && {
      id: source.id,
      title: source.title,
      summary: source.summary,
      body: source.body,
      version: source.version,
      status: source.status,
      updatedAt: source.updatedAt,
    },
    posts: posts.map((p) => ({ ...p, jumpUrl: postJumpUrl(creds?.guildId ?? null, p) })),
    botConnected: creds != null,
  });
}

// PATCH — save. { title?, summary?, body?, category?, coverUrl?, status?, slug?, note? }
export async function PATCH(request: Request, { params }: Ctx) {
  const gate = await requireClanGuideEditorApi();
  if ('response' in gate) return gate.response;
  const guide = await getScopedGuide(Number((await params).id), gate.actor.clan.id);
  if (!guide) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  // Stale-write guard: two officers editing the same guide must not silently eat each other's work.
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

// DELETE — ?discord=1 also takes its Discord posts down.
export async function DELETE(request: Request, { params }: Ctx) {
  const gate = await requireClanGuideEditorApi();
  if ('response' in gate) return gate.response;
  const guide = await getScopedGuide(Number((await params).id), gate.actor.clan.id);
  if (!guide) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (new URL(request.url).searchParams.get('discord') === '1') {
    const posts = await db.select().from(guidePosts).where(eq(guidePosts.guideId, guide.id));
    for (const p of posts) {
      const r = await unpost(p, true);
      if (!r.ok) return NextResponse.json({ error: `Could not remove a Discord post: ${r.error}` }, { status: 502 });
    }
  }
  await deleteGuide(guide);
  return NextResponse.json({ ok: true });
}
