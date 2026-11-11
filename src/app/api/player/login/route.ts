import { NextResponse } from 'next/server';
import { db } from '@/db';
import { eventParticipants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { signPlayerToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

export async function POST(request: Request) {
  // A bearer token checked anonymously: cap the guessing, and a bad body is a 400, not a 500.
  const rl = await rateLimit(request, 'player-login', { limit: 20, windowMs: 5 * 60 * 1000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });
  const { playerToken } = ((await request.json().catch(() => null)) ?? {}) as { playerToken?: unknown };

  if (!playerToken || typeof playerToken !== 'string') {
    return NextResponse.json({ error: 'playerToken is required' }, { status: 400 });
  }

  const player = await db.query.eventParticipants.findFirst({
    where: eq(eventParticipants.playerToken, playerToken.trim()),
  });

  if (!player) {
    return NextResponse.json({ error: 'Invalid player token' }, { status: 401 });
  }

  if (!player.teamId || !player.playerToken) {
    return NextResponse.json({ error: 'Player is not assigned to a team yet' }, { status: 403 });
  }

  const token = signPlayerToken(player.id, player.teamId, player.playerToken);
  const cookieStore = await cookies();
  cookieStore.set('player_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });

  return NextResponse.json({
    success: true,
    playerId: player.id,
    playerName: player.name,
    teamId: player.teamId,
  });
}
