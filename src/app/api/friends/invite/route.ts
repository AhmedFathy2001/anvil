import { NextResponse } from 'next/server';

import { track } from '@/lib/analytics';
import { verifyUser } from '@/lib/auth';
import { acceptInvite } from '@/lib/friendEvents';
import { rateLimitByKey } from '@/lib/rate-limit';

/**
 * Pressing a friends event's invite link (/f/<token>): the person is invited to that one event
 * (lib/friendEvents acceptInvite), then joins it the usual way on its page. A token that is not one
 * answers 404, the same as a link that was replaced.
 */
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session?.playerId) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

  // Tokens are 144 bits, so this is about a script hammering the route, not about guessing.
  const limited = await rateLimitByKey('friends-invite', String(session.userId), { limit: 30, windowMs: 3600_000 });
  if (!limited.ok) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });

  const body = await request.json().catch(() => null);
  const target = await acceptInvite({ token: String(body?.token ?? ''), playerId: session.playerId, userId: session.userId });
  if (!target) return NextResponse.json({ error: 'This invite link doesn’t work any more. Ask your friend for a new one.' }, { status: 404 });
  track('invite.joined', { userId: session.userId, clanId: null });
  return NextResponse.json({ ok: true, next: `/c/${target.hostSlug}/events/${target.eventId}` });
}
