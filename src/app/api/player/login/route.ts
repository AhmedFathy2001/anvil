import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { signPlayerToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const { playerToken } = await request.json();

  if (!playerToken || typeof playerToken !== 'string') {
    return NextResponse.json({ error: 'playerToken is required' }, { status: 400 });
  }

  const player = await db.query.players.findFirst({
    where: eq(players.playerToken, playerToken.trim()),
  });

  if (!player) {
    return NextResponse.json({ error: 'Invalid player token' }, { status: 401 });
  }

  if (!player.teamId) {
    return NextResponse.json({ error: 'Player is not assigned to a team yet' }, { status: 403 });
  }

  const token = signPlayerToken(player.id, player.teamId);
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
