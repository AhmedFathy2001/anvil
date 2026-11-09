import { NextResponse } from 'next/server';

import { requireSecret } from '@/lib/env';
import { liveTicket } from '@/lib/liveData';
import { WEB_TICKET_TTL_MS, signTicket, ticketKey } from '@/lib/push/ticket';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { publicOrigin } from '@/lib/request-origin';
import { pushEnabled } from '@/lib/serverInfo';

import { liveScope } from '../scope';

const KEY = ticketKey(requireSecret('PLAYER_SESSION_SECRET', 'dev-player-secret'));
const SOCKET_PATH = '/api/plugin/push/ws';

// GET /api/events/[id]/live/ticket?seat=<participant> — the Feed & chat page's pass onto the push
// socket (push/server.ts), so new lines and rows arrive as they happen instead of on the next poll.
//
// Who hears what is decided HERE, by the page's own rules: the site session and chatAccess
// (../scope liveScope, the same gate as chat/feed/pulse), then lib/liveTicket for the rooms. The
// ticket is a web one (rows only, short-lived) and the only kind the socket takes in its address.
// 404 when this deployment runs no push server: the page just polls.
export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  if (!pushEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const url = new URL(request.url);
  const s = await liveScope((await params).eventId, url.searchParams.get('seat'));
  if (s instanceof NextResponse) return s;
  // A reconnect asks once; a page stuck in a loop gets told to slow down (it polls meanwhile).
  const rl = await rateLimit(request, `live-push-ticket:${s.userId}`, { limit: 20, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });

  const scope = await liveTicket(s.access, s.userId);
  if (!scope) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { ticket, expiresAt } = signTicket(scope, KEY, Date.now(), WEB_TICKET_TTL_MS);
  const ws = process.env.PUSH_WS_URL || publicOrigin(request).replace(/^http/, 'ws') + SOCKET_PATH;
  return NextResponse.json({ url: ws, ticket, expiresAt }, { headers: { 'Cache-Control': 'no-store' } });
}
