import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { bad, intParam, readJson } from '@/lib/guideApi';
import { canCurateUser, clearStale, markStale } from '@/lib/guideCommunity';

type Ctx = { params: Promise<{ id: string }> };

// POST — upkeep: { stale: true, note } flags a library guide as out of date after a game update (it
// shows a note and goes on Wanted); { stale: false } marks it current again. Curators only.
export async function POST(request: Request, ctx: Ctx) {
  const user = await verifyUser();
  if (!user || !(await canCurateUser(user.userId))) return bad('Curators only.', 403);
  const id = intParam((await ctx.params).id);
  if (!id) return bad('Not found', 404);
  const body = await readJson(request);
  if (body?.stale === false) await clearStale(id);
  else await markStale(id, String(body?.note ?? ''), user.userId);
  return NextResponse.json({ ok: true });
}
