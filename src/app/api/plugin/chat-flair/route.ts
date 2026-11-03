import { createHash } from 'node:crypto';

import { NextResponse } from 'next/server';

import { log } from '@/lib/logger';
import { gameChatFlair, type GameChatFlair } from '@/lib/supporter';

// GET /api/plugin/chat-flair — capability 'chat-flair'. Every Anvil Supporter's characters with the
// colours (and Patron star) they wear, so the plugin can paint those names in normal game chat. The
// plugin downloads the list and matches names locally: nothing about who it sees is ever sent here.
// Public on purpose (a Supporter's name colour is meant to be seen) and only for people who left the
// toggle on, on characters they share. Cached a few minutes; ETag so a refresh is usually a 304.

const TTL_MS = 5 * 60_000;
let cache: { at: number; body: string; etag: string } | null = null;

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const now = Date.now();
  if (!cache || now - cache.at > TTL_MS) {
    try {
      const names: GameChatFlair[] = await gameChatFlair();
      const body = JSON.stringify({ names });
      cache = { at: now, body, etag: `"${createHash('sha1').update(body).digest('hex').slice(0, 16)}"` };
    } catch (err) {
      log.warn('chat-flair.read-failed', { err: String(err) });
      if (!cache) return NextResponse.json({ names: [] }, { status: 503 });
    }
  }
  const headers = { ETag: cache.etag, 'Cache-Control': 'public, max-age=300' };
  if (request.headers.get('if-none-match') === cache.etag) return new NextResponse(null, { status: 304, headers });
  return new NextResponse(cache.body, { headers: { ...headers, 'Content-Type': 'application/json' } });
}
