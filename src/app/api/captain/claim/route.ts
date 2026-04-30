import { NextResponse } from 'next/server';
import { db } from '@/db';
import { teams } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { signCaptainToken, verifyUser } from '@/lib/auth';

// POST /api/captain/claim { teamId }
// A Discord-authenticated user picks a team they've been assigned as captain of.
// Sets the captain_session cookie scoped to that team — no password needed because the
// admin already vouched for them by setting captainUserId.
export async function POST(request: Request) {
  const user = await verifyUser();
  if (!user || user.userId <= 0) {
    return NextResponse.json({ error: 'Sign in with Discord first' }, { status: 401 });
  }

  let body: { teamId?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const teamId = Number(body.teamId);
  if (!Number.isFinite(teamId) || teamId <= 0) {
    return NextResponse.json({ error: 'teamId required' }, { status: 400 });
  }

  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  // Admins can also claim any team's captain seat — useful for handling captain absence
  // mid-event without rotating the password.
  const isAdmin = user.role === 'admin';
  if (team.captainUserId !== user.userId && !isAdmin) {
    return NextResponse.json({ error: 'You are not assigned as captain of this team.' }, { status: 403 });
  }

  const token = signCaptainToken(team.id);
  const response = NextResponse.json({
    success: true,
    teamId: team.id,
    teamName: team.name,
    redirectTo: `/captain/${team.id}`,
  });
  response.cookies.set('captain_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
