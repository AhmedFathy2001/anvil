import { NextResponse } from 'next/server';

import { bad, publishedGuide, readJson, signedIn } from '@/lib/guideApi';
import { setFollow, tickStep } from '@/lib/guideCommunity';

type Ctx = { params: Promise<{ id: string }> };

// POST — follow a route { on }, or tick a manual step { stepId, done }.
export async function POST(request: Request, ctx: Ctx) {
  const gate = await signedIn('follow', 60);
  if ('response' in gate) return gate.response;
  const guide = await publishedGuide((await ctx.params).id);
  if (!guide || guide.kind !== 'route') return bad('Not found', 404);
  const body = await readJson(request);
  if (typeof body?.stepId === 'string') {
    return NextResponse.json({ manualDone: await tickStep(gate.user.userId, guide.id, body.stepId, body.done !== false) });
  }
  await setFollow(gate.user.userId, guide.id, body?.on !== false);
  return NextResponse.json({ ok: true, on: body?.on !== false });
}
