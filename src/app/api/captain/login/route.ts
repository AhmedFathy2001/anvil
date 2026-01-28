import { NextResponse } from 'next/server';
import { db } from '@/db';
import { teams } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { signCaptainToken, verifyPassword } from '@/lib/auth';

export async function POST(request: Request) {
  const { teamId, password } = await request.json();

  if (!teamId || !password) {
    return NextResponse.json({ error: 'Team ID and password are required' }, { status: 400 });
  }

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
  });

  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  if (!verifyPassword(password, team.captainPassword)) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const token = signCaptainToken(team.id);
  const response = NextResponse.json({ success: true, teamId: team.id, teamName: team.name });
  response.cookies.set('captain_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
