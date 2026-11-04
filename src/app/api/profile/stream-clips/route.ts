import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { setPlayerClipSetting } from '@/lib/highlights/store';

// PATCH /api/profile/stream-clips — { on: boolean }
//
// "Clip my stream when I hit a big moment in a streamed event" (lib/highlights). Off by default and
// stored on the caller's own Twitch link, so there is nothing to switch until they have linked Twitch
// (409 then). Keyed on the caller's own login only.
export async function PATCH(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (typeof body?.on !== 'boolean') return NextResponse.json({ error: 'on must be true or false' }, { status: 400 });
  if (!(await setPlayerClipSetting(session.userId, body.on))) {
    return NextResponse.json({ error: 'Link your Twitch account first.' }, { status: 409 });
  }
  return NextResponse.json({ ok: true, on: body.on });
}
