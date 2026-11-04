import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

import { refreshChatFlair } from '@/lib/chatFlairFeed';
import { requireSecret } from '@/lib/env';
import { log } from '@/lib/logger';
import { internalSecret } from '@/lib/push/ticket';

const SECRET = Buffer.from(internalSecret(requireSecret('PLAYER_SESSION_SECRET', 'dev-player-secret')));

// POST /api/internal/push/flair {players?, names?, all?} — the push server, after gathering a burst of
// 'flairdirty' NOTIFYs (migration 0216): work out what those people's and names' flair is now and, if
// it moved, store the next version (lib/chatFlairFeed), whose delta then comes back over NOTIFY.
// Answers only to the push server's derived secret; 404 to anything else.
export async function POST(request: Request) {
  const given = Buffer.from(request.headers.get('x-push-secret') ?? '');
  if (given.length !== SECRET.length || !crypto.timingSafeEqual(given, SECRET)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as { players?: unknown; names?: unknown; all?: unknown } | null;
  const players = Array.isArray(body?.players) ? body.players.filter((n): n is number => Number.isInteger(n)).slice(0, 5_000) : [];
  const names = Array.isArray(body?.names) ? body.names.filter((n): n is string => typeof n === 'string').slice(0, 5_000) : [];
  try {
    const v = await refreshChatFlair(body?.all === true ? 'all' : { players, names });
    return NextResponse.json({ v }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    log.warn('chat-flair.refresh-failed', { err: String(err) });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
