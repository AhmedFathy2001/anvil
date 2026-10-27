import { NextResponse } from 'next/server';
import { pluginClaimCaller } from '@/lib/pluginClaimCaller';
import { claimTile, cleanNote, unclaimTile } from '@/lib/tileClaims';

/**
 * Tile claims from RuneLite (lib/tileClaims) — the same "I'm going for this" the team page has. Who
 * may claim on which team: lib/pluginClaimCaller. Advertised as the `tile-claims` capability; the
 * plugin reads the result back from the authed /api/plugin/board.
 */
async function caller(request: Request, eventId?: number) {
  const c = await pluginClaimCaller(request, eventId);
  return c.ok ? c : { error: NextResponse.json({ error: c.error }, { status: c.status }) };
}

// POST { tileId, note? } — claim it for yourself on your team (or update your note).
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { eventId?: unknown; tileId?: unknown; note?: unknown };
  const eventId = body.eventId == null ? undefined : Number(body.eventId);
  if (eventId != null && !Number.isInteger(eventId)) return NextResponse.json({ error: 'Invalid eventId' }, { status: 400 });
  const c = await caller(request, eventId);
  if ('error' in c) return c.error;
  const tileId = Number(body.tileId);
  if (!Number.isInteger(tileId)) return NextResponse.json({ error: 'tileId is required' }, { status: 400 });
  const r = await claimTile({
    eventId: c.auth.eventId,
    teamId: c.auth.teamId,
    tileId,
    userId: c.userId,
    participantId: c.auth.playerId,
    note: cleanNote(body.note),
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}

// DELETE ?tileId=… — drop your own claim. Only ever your own: clearing a teammate's is the team page's.
export async function DELETE(request: Request) {
  const eventIdParam = new URL(request.url).searchParams.get('eventId');
  const eventId = eventIdParam == null ? undefined : Number(eventIdParam);
  if (eventId != null && !Number.isInteger(eventId)) return NextResponse.json({ error: 'Invalid eventId' }, { status: 400 });
  const c = await caller(request, eventId);
  if ('error' in c) return c.error;
  const tileId = Number(new URL(request.url).searchParams.get('tileId'));
  if (!Number.isInteger(tileId)) return NextResponse.json({ error: 'tileId is required' }, { status: 400 });
  await unclaimTile(c.auth.teamId, tileId, c.userId);
  return NextResponse.json({ ok: true });
}
