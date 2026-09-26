import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { guidePosts } from '@/db/schema';
import { requireClanGuideEditorApi } from '@/lib/guideAccess';
import { getScopedGuide } from '@/lib/guides';
import { resyncPost, unpost } from '@/lib/guidePosting';

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

// PATCH — { autoUpdate?: boolean, resync?: true }.
export async function PATCH(request: Request, ctx: Ctx) {
  const loaded = await load(ctx);
  if ('response' in loaded) return loaded.response;
  const body = (await request.json().catch(() => null)) as { autoUpdate?: unknown; resync?: unknown } | null;
  if (typeof body?.autoUpdate === 'boolean') {
    await db.update(guidePosts).set({ autoUpdate: body.autoUpdate }).where(eq(guidePosts.id, loaded.post.id));
  }
  if (body?.resync === true) {
    const r = await resyncPost(loaded.post, loaded.guide, true);
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
  return NextResponse.json({ ok: true });
}
