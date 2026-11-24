import { NextResponse } from 'next/server';

import { bad, intParam, readJson, signedIn } from '@/lib/guideApi';
import { isEditTag, mayReviewContribution, reportContribution, reviewContribution } from '@/lib/guideCommunity';

type Ctx = { params: Promise<{ cid: string }> };

// POST — { action: 'report', reason } (anyone signed in) or, for curators,
// { action: 'promote' | 'hide' | 'keep', tag? } — tag is the edit credit tag for steps and edits.
export async function POST(request: Request, ctx: Ctx) {
  const gate = await signedIn('review', 60);
  if ('response' in gate) return gate.response;
  const id = intParam((await ctx.params).cid);
  if (!id) return bad('Not found', 404);
  const body = await readJson(request);
  const action = body?.action;
  if (action === 'report') {
    await reportContribution(id, gate.user.userId, String(body?.reason ?? ''));
    return NextResponse.json({ ok: true });
  }
  if (action !== 'promote' && action !== 'hide' && action !== 'keep') return bad('Bad request');
  // Scoped to the row: library rows for curators, a clan's rows for that clan's guide editors.
  if (!(await mayReviewContribution(gate.user.userId, id))) return bad('Not found', 404);
  const r = await reviewContribution({ id, action, userId: gate.user.userId, tag: isEditTag(body?.tag) ? body.tag : null });
  if (!r.ok) return bad(r.error);
  return NextResponse.json({ ok: true });
}
