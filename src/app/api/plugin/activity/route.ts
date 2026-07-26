import { NextResponse } from 'next/server';
import { verifyPluginToken, verifyPluginTokenUser } from '@/lib/auth';
import { jsonWithEtag } from '@/lib/httpEtag';
import { buildActivity, parseCursor } from '@/lib/pluginActivity';

/**
 * `GET /api/plugin/activity?since=<cursor>` — the always-on sidebar's live team feed.
 *
 * Returns the caller's team's newest submissions + completions after `since`, player-attributed and
 * bounded, plus a best-effort per-tile progress sum. Wrapped in {@link jsonWithEtag}: the payload is
 * deterministic for the same rows, so an unchanged team → same cursor → same ETag → **304, no body**.
 * The plugin polls this on its existing cadence with `If-None-Match`, so an idle team costs nothing.
 *
 * Auth mirrors `/api/plugin/config`: a valid token with no live event isn't an error — it's an empty
 * feed (so the panel shows its schedule/quiet state rather than a "failed to connect").
 *
 * The bidirectional send+receive form (`POST` with a light `outbound` of KC/XP pushes, consolidating
 * `/api/plugin/stats`) is a planned follow-up; see the POST handler. This GET is the receive half the
 * panel needs today.
 */
export async function GET(request: Request) {
  const auth = await verifyPluginToken(request);
  if (!auth) {
    // Valid token but no live event → empty feed (not an error), so the panel degrades gracefully.
    const userOnly = await verifyPluginTokenUser(request);
    if (userOnly) {
      return jsonWithEtag(request, {
        cursor: 's0_c0',
        activity: [],
        progress: {},
        truncated: false,
        noActiveEvent: true,
      });
    }
    return NextResponse.json(
      { error: 'Unauthorized. Provide Authorization: Bearer <accountToken>' },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const since = parseCursor(url.searchParams.get('since'));

  const payload = await buildActivity({
    teamId: auth.teamId,
    eventId: auth.eventId,
    selfPlayerId: auth.playerId,
    selfRsn: auth.rsn,
    since,
  });

  return jsonWithEtag(request, payload);
}

/**
 * `POST /api/plugin/activity` — the bidirectional "sync tick": send a light `outbound` batch and
 * receive the same feed as GET in one round-trip.
 *
 * v1 implements the **receive** half only (identical to GET, with `since` taken from the body so a
 * client with nothing to send can still use one method). `outbound` KC/XP pushes are NOT processed
 * here yet — they keep flowing through the dedicated {@link file:../stats/route.ts `/api/plugin/stats`}
 * endpoint (a 200-line live-overlay/credit/notify handler). Folding that in is a deliberate, separate
 * step so this endpoint can ship without touching stat-credit logic; the response flags it so a client
 * never assumes its pushes were consumed here.
 *
 * Note: POST responses are not conditional (no ETag/304) — the plugin only POSTs on ticks where it
 * actually has something to send, and GET remains the cheap idle path.
 */
export async function POST(request: Request) {
  const auth = await verifyPluginToken(request);
  if (!auth) {
    const userOnly = await verifyPluginTokenUser(request);
    if (userOnly) {
      return NextResponse.json({
        cursor: 's0_c0',
        activity: [],
        progress: {},
        truncated: false,
        noActiveEvent: true,
        outboundAccepted: 0,
      });
    }
    return NextResponse.json(
      { error: 'Unauthorized. Provide Authorization: Bearer <accountToken>' },
      { status: 401 },
    );
  }

  let body: { since?: string; outbound?: unknown[] } = {};
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === 'object') body = parsed as typeof body;
  } catch {
    // Empty/invalid body is fine — treat as a receive-only tick from the start.
  }

  const since = parseCursor(typeof body.since === 'string' ? body.since : null);
  const payload = await buildActivity({
    teamId: auth.teamId,
    eventId: auth.eventId,
    selfPlayerId: auth.playerId,
    selfRsn: auth.rsn,
    since,
  });

  const hadOutbound = Array.isArray(body.outbound) && body.outbound.length > 0;
  return NextResponse.json({
    ...payload,
    // Explicit: outbound stat pushes are not consumed here yet — keep POSTing them to /api/plugin/stats.
    outboundAccepted: 0,
    ...(hadOutbound ? { outboundNote: 'Push KC/XP to /api/plugin/stats; consolidation pending.' } : {}),
  });
}
