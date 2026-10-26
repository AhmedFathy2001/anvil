import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

import { requireSecret } from '@/lib/env';
import { internalSecret } from '@/lib/push/ticket';
import { pushView } from '@/lib/push/views';

const SECRET = Buffer.from(internalSecret(requireSecret('PLAYER_SESSION_SECRET', 'dev-player-secret')));

// GET /api/internal/push/view?key=team:<event>:<team> | tile:<event>:<tile> — the push server's read
// (lib/push/views). Not for plugins or browsers: it answers only to the push server's derived secret,
// and 404s anything else so the route doesn't advertise itself.
export async function GET(request: Request) {
  const given = Buffer.from(request.headers.get('x-push-secret') ?? '');
  if (given.length !== SECRET.length || !crypto.timingSafeEqual(given, SECRET)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const key = new URL(request.url).searchParams.get('key') ?? '';
  const view = await pushView(key);
  if (!view) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(view, { headers: { 'Cache-Control': 'no-store' } });
}
