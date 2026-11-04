import { NextResponse } from 'next/server';

import { flairLegacy } from '@/lib/chatFlairFeed';
import { log } from '@/lib/logger';

// GET /api/plugin/chat-flair — capability 'chat-flair'. Every Anvil Supporter's characters with the
// colours (and Patron star) they wear, so the plugin can paint those names in normal game chat. The
// plugin downloads the list and matches names locally: nothing about who it sees is ever sent here.
// Public on purpose (a Supporter's name colour is meant to be seen) and only for people who left the
// toggle on, on characters they share.
//
// The original whole-list shape, for plugins before 'chat-flair-v' (which use ./v and ./v/<v>: a
// version, its deltas, and a cacheable compact list). Served from the same versioned copy
// (lib/chatFlairFeed), so it is current the moment a version is.

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  let list;
  try {
    list = await flairLegacy();
  } catch (err) {
    log.warn('chat-flair.read-failed', { err: String(err) });
    return NextResponse.json({ names: [] }, { status: 503 });
  }
  const headers = { ETag: list.etag, 'Cache-Control': 'public, max-age=60' };
  if (request.headers.get('if-none-match') === list.etag) return new NextResponse(null, { status: 304, headers });
  return new NextResponse(list.body, { headers: { ...headers, 'Content-Type': 'application/json' } });
}
