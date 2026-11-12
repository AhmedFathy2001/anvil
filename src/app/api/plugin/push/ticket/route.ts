import { NextResponse } from 'next/server';

import { relayIdentity, relayOn } from '@/lib/chatRelay';
import { pluginRsnHintOnly, resolvePluginClan, verifyPluginToken, verifyPluginTokenUser } from '@/lib/auth';
import { requireSecret } from '@/lib/env';
import { homeBoardForUser } from '@/lib/pluginHomeBoard';
import { resolvePluginCharacter } from '@/lib/pluginAccount';
import { liveBoardsForCharacter } from '@/lib/pluginBoards';
import { signTicket, ticketKey } from '@/lib/push/ticket';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { publicOrigin } from '@/lib/request-origin';
import { pushEnabled } from '@/lib/serverInfo';

const KEY = ticketKey(requireSecret('PLAYER_SESSION_SECRET', 'dev-player-secret'));
const SOCKET_PATH = '/api/plugin/push/ws';
/** Other live boards a ticket covers beyond the seat's: plenty for real play, bounded for the ticket. */
const MAX_EXTRA_BOARDS = 8;

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

  // ?feed=1: the plugin's chat-feed switch is on, so it listens for feed lines (lib/chatFeed) even
  // with no board to watch.
  const params = new URL(request.url).searchParams;
  const feed = params.get('feed') === '1';
  // ?rows=1: a plugin with the panel Feed tab (capability 'panel-rows'). It is sent panel rows and
  // looks (no other client is: older plugins can't read them), and listens even with no board.
  const rows = params.get('rows') === '1';
  // ?flair=1: a plugin with 'chat-flair-v' — it is sent the Supporter list's deltas ({t:'flair'}). Not
  // a reason to listen by itself: a plugin with no other socket polls the list's version instead.
  const flair = params.get('flair') === '1';
  // ?relay=1: the plugin's chat relay is on (either way: sending its own lines, or showing others'),
  // with &world=: the world it is on, and &fc=: the friends chat owner it sits with.
  // Signed in on a character of theirs, with staff's switch on, the ticket carries who it speaks as
  // (lib/chatRelay relayIdentity) and the push server lets it talk (lib/push/relay).
  // `world`: its public room (only the client knows it; a hop asks for a new ticket).
  const relay = params.get('relay') === '1' && (await relayOn()) ? await relayIdentity(request, Number(params.get('world')) || null, params.get('fc')).catch(() => null) : null;
  const clan = await resolvePluginClan(request);
  const seat = clan ? await verifyPluginToken(request, { hintOnly: pluginRsnHintOnly(request) }) : null;
  const home = !clan || seat ? null : await homeBoardForUser(clan.id, user.userId);
  const eventIds = seat ? [seat.eventId] : home?.eventId ? [home.eventId] : [];
  // A plugin that reads panel rows hears EVERY live board its character plays (a creator's event, a
  // guest board in another clan), not only the one it's pointed at: their chat and Feed rows go to
  // each board's room. The first stays the seat's board (its team view, its team).
  if (rows) {
    const character = await resolvePluginCharacter(request).catch(() => null);
    if (character) {
      const others = await liveBoardsForCharacter(request, character.accountId, { except: eventIds[0] ?? null, preferClanId: clan?.id ?? null }).catch(() => []);
      for (const b of others.slice(0, MAX_EXTRA_BOARDS)) if (!eventIds.includes(b.eventId)) eventIds.push(b.eventId);
    }
  }
  if (eventIds.length === 0 && !feed && !rows && !relay) return new NextResponse(null, { status: 204 });

  const { ticket, expiresAt } = signTicket(
    { userId: user.userId, eventIds, teamId: seat?.teamId ?? null, feed, rows, flair, ...(relay ? { relay } : {}) },
    KEY,
    Date.now(),
  );
  const url = process.env.PUSH_WS_URL || publicOrigin(request).replace(/^http/, 'ws') + SOCKET_PATH;
  return NextResponse.json({ url, ticket, expiresAt }, { headers: { 'Cache-Control': 'no-store' } });
}
