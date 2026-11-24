import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { bad, intParam, readJson } from '@/lib/guideApi';
import { canCurateUser, featuredFor, grantReward, pickReward, recordMonth } from '@/lib/guideCommunity';
import { requirePlatformApi } from '@/lib/platformAccess';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// GET ?month=YYYY-MM — the featured group.
export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
  if (!MONTH_RE.test(month)) return bad('Bad month');
  return NextResponse.json({ month, featured: await featuredFor(month) });
}

// POST — { action: 'record', month } (curators: store the month's credit and featured group),
// { action: 'pick', month, userId } (curators pick the reward from the group),
// { action: 'grant', month, userId } (platform staff: a month of Supporter via the gift mechanism).
export async function POST(request: Request) {
  const body = await readJson(request);
  const month = typeof body?.month === 'string' ? body.month : '';
  if (!MONTH_RE.test(month)) return bad('Bad month');
  if (body?.action === 'grant') {
    const gate = await requirePlatformApi('staff');
    if ('response' in gate) return gate.response;
    const userId = intParam(body.userId);
    if (!userId) return bad('Pick a writer.');
    const r = await grantReward(month, userId, gate.actor.user.userId);
    return r.ok ? NextResponse.json({ ok: true }) : bad(r.error ?? 'Could not grant');
  }
  const user = await verifyUser();
  if (!user || !(await canCurateUser(user.userId))) return bad('Curators only.', 403);
  if (body?.action === 'record') return NextResponse.json({ featured: await recordMonth(month) });
  if (body?.action === 'pick') {
    const userId = intParam(body.userId);
    return NextResponse.json({ ok: !!userId && (await pickReward(month, userId)) });
  }
  return bad('Bad request');
}
