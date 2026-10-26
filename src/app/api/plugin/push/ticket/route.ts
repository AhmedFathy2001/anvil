import { NextResponse } from 'next/server';

import { pluginRsnHintOnly, resolvePluginClan, verifyPluginToken, verifyPluginTokenUser } from '@/lib/auth';
import { requireSecret } from '@/lib/env';
import { homeBoardForUser } from '@/lib/pluginHomeBoard';
import { signTicket, ticketKey } from '@/lib/push/ticket';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { publicOrigin } from '@/lib/request-origin';
import { pushEnabled } from '@/lib/serverInfo';

const KEY = ticketKey(requireSecret('PLAYER_SESSION_SECRET', 'dev-player-secret'));
const SOCKET_PATH = '/api/plugin/push/ws';

// GET /api/plugin/push/ticket — the plugin's pass onto the push socket (capability 'push-ws').
//
// Who hears what is decided HERE, by the same resolution /api/plugin/config makes: the seat's event
// and team when the caller plays in a live board, else their clan's home board. The socket server
// trusts the signed answer and nothing else (lib/push/ticket). 204 when there is nothing to listen
// to — the plugin then just polls.
export async function GET(request: Request) {
  if (!pushEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const user = await verifyPluginTokenUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // A reconnect asks once; a client stuck in a loop gets told to slow down.
  const rl = await rateLimit(request, `plugin-push-ticket:${user.userId}`, { limit: 20, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });

  const clan = await resolvePluginClan(request);
  if (!clan) return new NextResponse(null, { status: 204 });
  const seat = await verifyPluginToken(request, { hintOnly: pluginRsnHintOnly(request) });
  const home = seat ? null : await homeBoardForUser(clan.id, user.userId);
  const eventIds = seat ? [seat.eventId] : home?.eventId ? [home.eventId] : [];
  if (eventIds.length === 0) return new NextResponse(null, { status: 204 });

  const { ticket, expiresAt } = signTicket(
    { userId: user.userId, eventIds, teamId: seat?.teamId ?? null },
    KEY,
    Date.now(),
  );
  const url = process.env.PUSH_WS_URL || publicOrigin(request).replace(/^http/, 'ws') + SOCKET_PATH;
  return NextResponse.json({ url, ticket, expiresAt }, { headers: { 'Cache-Control': 'no-store' } });
}
