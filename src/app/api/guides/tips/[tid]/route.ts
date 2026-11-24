import { NextResponse } from 'next/server';

import { bad, intParam, readJson, signedIn } from '@/lib/guideApi';
import { canCurateUser, hideTip, reportTip, toggleTipUseful } from '@/lib/guideCommunity';

type Ctx = { params: Promise<{ tid: string }> };

// POST — { action: 'useful' } toggles "found this useful"; 'report' { reason }; 'hide' (curators).
export async function POST(request: Request, ctx: Ctx) {
  const gate = await signedIn('tip-act', 30);
  if ('response' in gate) return gate.response;
  const id = intParam((await ctx.params).tid);
  if (!id) return bad('Not found', 404);
  const body = await readJson(request);
  switch (body?.action) {
    case 'useful':
      return NextResponse.json({ on: await toggleTipUseful(id, gate.user.userId) });
    case 'report':
      await reportTip(id, gate.user.userId, String(body.reason ?? ''));
      return NextResponse.json({ ok: true });
    case 'hide':
      if (!(await canCurateUser(gate.user.userId))) return bad('Curators only.', 403);
      await hideTip(id);
      return NextResponse.json({ ok: true });
    default:
      return bad('Bad request');
  }
}
