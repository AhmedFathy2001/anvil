import { NextResponse } from 'next/server';

import { flairSince } from '@/lib/chatFlairFeed';
import { log } from '@/lib/logger';

// GET /api/plugin/chat-flair/v?since=<v> — capability 'chat-flair-v'. The Supporter name list's
// current version, tiny: `{v}` when the caller is current, `{v, deltas:[…]}` (lib/chatFlairWire's
// delta, oldest first) when it is a few behind, `{v, full:true}` when it should fetch ./v/<v>. Public
// and the same for everyone who asks with the same `since`, so a CDN may hold it briefly.

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('since');
  const since = raw && /^\d{1,9}$/.test(raw) ? Number(raw) : 0;
  try {
    const answer = await flairSince(since);
    return NextResponse.json(answer, { headers: { 'Cache-Control': 'public, max-age=15' } });
  } catch (err) {
    log.warn('chat-flair.version-failed', { err: String(err) });
    return NextResponse.json({ error: 'Unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
