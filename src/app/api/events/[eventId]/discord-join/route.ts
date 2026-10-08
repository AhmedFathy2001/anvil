import { NextResponse } from 'next/server';
import { verifyUser } from '@/lib/auth';
import { eventForRequest } from '@/lib/eventScope';
import { rateLimitByKey } from '@/lib/rate-limit';
import { playerInvite, playerJoinView, playerSettle } from '@/lib/eventDiscord';

/**
 * The signed-in player's own way into their event's Discord server (lib/eventDiscord).
 *
 * Everything here is about the caller's OWN row and nobody else's: the invite is created on demand,
 * single-use, and only ever handed to the player it was made for. This page — not a DM — is the one
 * place an invite appears, which is what lets the DM's "Anvil never DMs invite links" hold.
 */
async function authorize(request: Request, params: Promise<{ eventId: string }>) {
  const id = Number((await params).eventId);
  if (!Number.isInteger(id)) return null;
  const session = await verifyUser();
  if (!session) return null;
  if (!(await eventForRequest(request, id))) return null;
  return { id, userId: session.userId };
}

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await authorize(request, params);
  if (!auth) return NextResponse.json({ error: 'Sign in to see your event server.' }, { status: 401 });
  return NextResponse.json(await playerJoinView(auth.id, auth.userId));
}

// POST { action: 'invite' | 'check' }
//   invite — a single-use 24h invite to the event server, for this player only
//   check  — "I've joined" / "add me": assign the team role now, or auto-join with a stored grant
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await authorize(request, params);
  if (!auth) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const rl = await rateLimitByKey('event-discord-join', `${auth.userId}:${auth.id}`, { limit: 12, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Slow down a moment and try again.' }, { status: 429 });

  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action === 'invite') {
    const r = await playerInvite(auth.id, auth.userId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ url: r.url });
  }
  if (body.action === 'check') {
    const r = await playerSettle(auth.id, auth.userId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json(r);
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
