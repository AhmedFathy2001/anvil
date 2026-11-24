import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { bad, publishedGuide, readJson, refusal, signedIn } from '@/lib/guideApi';
import { addTip, tipsFor } from '@/lib/guideCommunity';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const guide = await publishedGuide((await ctx.params).id);
  if (!guide) return bad('Not found', 404);
  const user = await verifyUser();
  return NextResponse.json({ tips: await tipsFor(guide, user?.userId ?? null) });
}

// POST — add a tip or a common mistake: { kind: 'tip'|'mistake', tier?, text }. Plain text, 280 max.
export async function POST(request: Request, ctx: Ctx) {
  const gate = await signedIn('tip', 10, 3_600_000);
  if ('response' in gate) return gate.response;
  const guide = await publishedGuide((await ctx.params).id);
  if (!guide) return bad('Not found', 404);
  const body = await readJson(request);
  if (!body) return bad('Bad request');
  try {
    await addTip({ guideId: guide.id, userId: gate.user.userId, kind: String(body.kind ?? 'tip'), tier: typeof body.tier === 'string' ? body.tier : null, text: String(body.text ?? '') });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return refusal(err);
  }
}
