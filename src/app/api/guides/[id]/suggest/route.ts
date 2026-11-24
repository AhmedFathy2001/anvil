import { NextResponse } from 'next/server';

import { bad, intParam, publishedGuide, readJson, refusal, signedIn } from '@/lib/guideApi';
import { suggestStep } from '@/lib/guideCommunity';

type Ctx = { params: Promise<{ id: string }> };

// POST — suggest a route step { chapter, step } or an edit to one { edit: { stepId, title?, why?, reason? } }.
// Suggestions wait in the curator queue; nothing shows until one is promoted.
export async function POST(request: Request, ctx: Ctx) {
  const gate = await signedIn('suggest', 10, 3_600_000);
  if ('response' in gate) return gate.response;
  const guide = await publishedGuide((await ctx.params).id);
  if (!guide) return bad('Not found', 404);
  const body = await readJson(request);
  if (!body) return bad('Bad request');
  try {
    const edit = body.edit as { stepId?: unknown; title?: unknown; why?: unknown; reason?: unknown } | undefined;
    const row = await suggestStep({
      guideId: guide.id,
      userId: gate.user.userId,
      chapter: intParam(body.chapter) ?? 0,
      step: body.step,
      edit: edit && typeof edit.stepId === 'string' ? { stepId: edit.stepId, title: String(edit.title ?? ''), why: String(edit.why ?? ''), reason: String(edit.reason ?? '') } : undefined,
    });
    return NextResponse.json({ id: row.id });
  } catch (err) {
    return refusal(err);
  }
}
