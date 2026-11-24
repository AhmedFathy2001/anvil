import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { bad, intParam, readJson } from '@/lib/guideApi';
import { canCurateUser, clearStale, markStale, upkeepTarget } from '@/lib/guideCommunity';

type Ctx = { params: Promise<{ id: string }> };

// POST — upkeep: { stale: true, note } flags a library guide as out of date after a game update (it
// shows a note and goes on Wanted); { stale: false } marks it current again. Curators only.
export async function POST(request: Request, ctx: Ctx) {
  const user = await verifyUser();
  if (!user || !(await canCurateUser(user.userId))) return bad('Curators only.', 403);
  const id = intParam((await ctx.params).id);
  // Library guides only: a clan's guide is never a curator's to flag.
  const guide = await upkeepTarget(id);
  if (!guide) return bad('Not found', 404);
  const body = await readJson(request);
  if (body?.stale === false) await clearStale(guide.id);
  else await markStale(guide.id, String(body?.note ?? ''), user.userId);
  return NextResponse.json({ ok: true });
}
