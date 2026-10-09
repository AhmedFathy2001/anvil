import { NextResponse } from 'next/server';
import { verifyPluginToken, verifyPluginTokenUser } from '@/lib/auth';
import { rateLimitByKey } from '@/lib/rate-limit';
import { claimTile, cleanNote, unclaimTile } from '@/lib/tileClaims';

/**
 * Tile claims from RuneLite (lib/tileClaims) — the same "I'm going for this" the team page has.
 *
 * The token names the account, which names the active event and the team; nothing about the team is
 * taken from the request, so a client can only ever claim on its own team. Advertised as the
 * `tile-claims` capability; the plugin reads the result back from the authed /api/plugin/board.
 */
async function caller(request: Request) {
  const auth = await verifyPluginToken(request);
  if (!auth) {
    return { error: NextResponse.json({ error: 'Unauthorized. Provide Authorization: Bearer <accountToken>' }, { status: 401 }) };
  }
  // A token minted before logins were linked can resolve the account but not the login. The claim is
  // a person's, so fall back to the token's own user; refuse rather than invent one.
  const userId = auth.userId ?? (await verifyPluginTokenUser(request))?.userId ?? null;
  if (userId == null) {
    return { error: NextResponse.json({ error: 'Sign in to the site once to link this account.' }, { status: 403 }) };
  }
  const rl = await rateLimitByKey('tile-claims', `${userId}:${auth.teamId}`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok) return { error: NextResponse.json({ error: 'Slow down a moment and try again.' }, { status: 429 }) };
  return { auth, userId };
}

// POST { tileId, note? } — claim it for yourself on your team (or update your note).
export async function POST(request: Request) {
  const c = await caller(request);
  if ('error' in c) return c.error;
  const body = (await request.json().catch(() => ({}))) as { tileId?: unknown; note?: unknown };
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
  const c = await caller(request);
  if ('error' in c) return c.error;
  const tileId = Number(new URL(request.url).searchParams.get('tileId'));
  if (!Number.isInteger(tileId)) return NextResponse.json({ error: 'tileId is required' }, { status: 400 });
  await unclaimTile(c.auth.teamId, tileId, c.userId);
  return NextResponse.json({ ok: true });
}
