import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

import { requireSecret } from '@/lib/env';
import { overlayEventForKey } from '@/lib/overlay/overlayData';
import { internalSecret } from '@/lib/push/ticket';

const SECRET = Buffer.from(internalSecret(requireSecret('PLAYER_SESSION_SECRET', 'dev-player-secret')));

// GET /api/internal/push/overlay?key=<overlay key> → { eventId } — the push server asking which event
// a stream overlay's socket should be nudged for (lib/push/hub, watchers). Same gate as the view
// route: only the push server's derived secret, and a 404 for anything else, so it advertises nothing.
// An unknown, reset or removed key is a 404 too, and the socket is refused.
export async function GET(request: Request) {
  const given = Buffer.from(request.headers.get('x-push-secret') ?? '');
  if (given.length !== SECRET.length || !crypto.timingSafeEqual(given, SECRET)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const event = await overlayEventForKey(new URL(request.url).searchParams.get('key') ?? '');
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ eventId: event.id }, { headers: { 'Cache-Control': 'no-store' } });
}
