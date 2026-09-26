import { NextResponse } from 'next/server';

import { requireClanGuideEditorApi } from '@/lib/guideAccess';
import { GuideInputError, dismissUpdate, getScopedGuide, syncFromSource } from '@/lib/guides';

// POST — answer a library update: { action: 'sync' } takes the library's text (overwriting local
// edits, and following it again from then on); { action: 'dismiss' } keeps the clan's version.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireClanGuideEditorApi();
  if ('response' in gate) return gate.response;
  const guide = await getScopedGuide(Number((await params).id), gate.actor.clan.id);
  if (!guide) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { action?: string; follow?: boolean } | null;
  try {
    if (body?.action === 'dismiss') {
      await dismissUpdate(guide);
      return NextResponse.json({ ok: true });
    }
    if (body?.action === 'sync') {
      const saved = await syncFromSource(guide, gate.actor.user.userId, body.follow !== false);
      return NextResponse.json({ guide: saved });
    }
  } catch (err) {
    if (err instanceof GuideInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
