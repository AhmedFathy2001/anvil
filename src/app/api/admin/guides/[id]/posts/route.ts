import { NextResponse } from 'next/server';

import { requireClanGuideEditorApi } from '@/lib/guideAccess';
import { getScopedGuide } from '@/lib/guides';
import { postGuide } from '@/lib/guidePosting';

// POST — post the guide to Discord: { channelId, tagIds?, autoUpdate? }.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireClanGuideEditorApi();
  if ('response' in gate) return gate.response;
  const { clan, user } = gate.actor;
  const guide = await getScopedGuide(Number((await params).id), clan.id);
  if (!guide) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (guide.status !== 'published') {
    return NextResponse.json({ error: 'Publish the guide before posting it — drafts stay off Discord.' }, { status: 400 });
  }
  const body = (await request.json().catch(() => null)) as { channelId?: unknown; tagIds?: unknown; autoUpdate?: unknown } | null;
  if (typeof body?.channelId !== 'string' || !body.channelId) {
    return NextResponse.json({ error: 'Pick a channel.' }, { status: 400 });
  }
  const r = await postGuide({
    clanId: clan.id,
    guide,
    channelId: body.channelId,
    tagIds: Array.isArray(body.tagIds) ? body.tagIds.filter((t): t is string => typeof t === 'string') : [],
    autoUpdate: body.autoUpdate !== false,
    userId: user.userId,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ post: r.post });
}
