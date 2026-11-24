import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { guidePosts } from '@/db/schema';
import { requireClanGuideEditorApi } from '@/lib/guideAccess';
import { getScopedGuide } from '@/lib/guides';
import { resyncPost, unpost } from '@/lib/guidePosting';
import { cleanSelection } from '@/lib/guideSelection';

type Ctx = { params: Promise<{ id: string; postId: string }> };

async function load(ctx: Ctx) {
  const gate = await requireClanGuideEditorApi();
  if ('response' in gate) return gate;
  const { id, postId } = await ctx.params;
  const guide = await getScopedGuide(Number(id), gate.actor.clan.id);
  const post = guide
    ? await db.query.guidePosts.findFirst({
        where: and(eq(guidePosts.id, Number(postId)), eq(guidePosts.guideId, guide.id), eq(guidePosts.clanId, gate.actor.clan.id)),
      })
    : null;
  if (!guide || !post) return { response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  return { guide, post };
}

// PATCH — { autoUpdate?: boolean, resync?: true, selection?: PostSelection | null }. A new selection
// is stored on the post and the messages are brought in line with it at once.
export async function PATCH(request: Request, ctx: Ctx) {
  const loaded = await load(ctx);
  if ('response' in loaded) return loaded.response;
  const body = (await request.json().catch(() => null)) as { autoUpdate?: unknown; resync?: unknown; selection?: unknown } | null;
  if (typeof body?.autoUpdate === 'boolean') {
    await db.update(guidePosts).set({ autoUpdate: body.autoUpdate }).where(eq(guidePosts.id, loaded.post.id));
  }
  let post = loaded.post;
  if (body && 'selection' in body) {
    const selection = cleanSelection(body.selection);
    [post] = await db.update(guidePosts).set({ selection }).where(eq(guidePosts.id, post.id)).returning();
  }
  if (body?.resync === true || (body && 'selection' in body)) {
    const r = await resyncPost(post, loaded.guide, true);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE — ?discord=1 deletes the messages too; without it Anvil just stops tracking them.
export async function DELETE(request: Request, ctx: Ctx) {
  const loaded = await load(ctx);
  if ('response' in loaded) return loaded.response;
  const r = await unpost(loaded.post, new URL(request.url).searchParams.get('discord') === '1');
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
  return NextResponse.json({ ok: true, note: r.note ?? null });
}
