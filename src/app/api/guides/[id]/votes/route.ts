import { NextResponse } from 'next/server';

import { bad, publishedGuide, readJson, signedIn } from '@/lib/guideApi';
import { unvote, voteUsed } from '@/lib/guideCommunity';

type Ctx = { params: Promise<{ id: string }> };

// POST — "Used it" on a setup: { setupKey, on }. One per person; needs kc on the guide's boss.
export async function POST(request: Request, ctx: Ctx) {
  const gate = await signedIn('vote', 30);
  if ('response' in gate) return gate.response;
  const guide = await publishedGuide((await ctx.params).id);
  if (!guide) return bad('Not found', 404);
  const body = await readJson(request);
  const key = typeof body?.setupKey === 'string' ? body.setupKey : '';
  if (!/^[a-z0-9-]{1,60}$/.test(key)) return bad('Unknown setup.');
  if (body?.on === false) {
    await unvote(guide.id, key, gate.user.userId);
    return NextResponse.json({ ok: true, on: false });
  }
  const r = await voteUsed({ guideId: guide.id, setupKey: key, userId: gate.user.userId });
  if (!r.ok) return bad(r.error);
  return NextResponse.json({ ok: true, on: true, kc: r.kc });
}
