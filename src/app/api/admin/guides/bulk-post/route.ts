import { NextResponse } from 'next/server';

import { requireClanGuideEditorApi } from '@/lib/guideAccess';
import { BULK_MAX, bulkPost, type BulkLayout } from '@/lib/guideBulk';

// POST — post many guides at once: into new channels under a category, as posts in a new forum, or
// into one existing channel. Everything is pre-checked before anything is created (lib/guideBulk).
export async function POST(request: Request) {
  const gate = await requireClanGuideEditorApi();
  if ('response' in gate) return gate.response;
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const layout = b?.layout;
  if (!b || (layout !== 'channels' && layout !== 'forum' && layout !== 'existing')) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const guideIds = Array.isArray(b.guideIds) ? b.guideIds.map(Number).filter(Number.isInteger) : [];
  if (guideIds.length > BULK_MAX) {
    return NextResponse.json({ error: `Up to ${BULK_MAX} guides at a time.` }, { status: 400 });
  }
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const result = await bulkPost({
    clanId: gate.actor.clan.id,
    guideIds,
    layout: layout as BulkLayout,
    categoryName: str(b.categoryName),
    parentId: str(b.parentId) ?? null,
    forumName: str(b.forumName),
    channelId: str(b.channelId),
    readOnly: b.readOnly === true,
    autoUpdate: b.autoUpdate !== false,
    userId: gate.actor.user.userId,
  });
  // A partial run is still a 200: some guides went out, and the per-guide results say which.
  if (!result.ok && result.results.length === 0) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
