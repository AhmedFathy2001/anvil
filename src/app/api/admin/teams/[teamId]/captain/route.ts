import { NextResponse } from 'next/server';
import { db } from '@/db';
import { teams, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { captainSeatNotice, placeCaptainOnTeam } from '@/lib/teamCaptain';

// PUT /api/admin/teams/[teamId]/captain { userId: number | null }
// Admin (or moderator) assigns or clears the Discord-linked captain for a team.
// Setting userId=null reverts the team to password-only captain access.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const session = await verifyUser();
  if (!session || (session.role !== 'admin' && session.role !== 'moderator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId } = await params;
  const id = Number(teamId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid teamId' }, { status: 400 });
  }

  let body: { userId?: number | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const team = await db.query.teams.findFirst({ where: eq(teams.id, id) });
  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  let newCaptainUserId: number | null = null;
  if (body.userId != null) {
    const target = await db.query.users.findFirst({ where: eq(users.id, body.userId) });
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    newCaptainUserId = target.id;
  }

  await db.update(teams).set({ captainUserId: newCaptainUserId }).where(eq(teams.id, id));

  // Seat the captain on their own team, and say so when that couldn't happen — see
  // lib/teamCaptain#captainSeatNotice.
  //
  // Every save, not only a change of person: it's idempotent, and re-assigning the SAME captain is
  // how the admin card repairs one who was named back when seating didn't happen (or failed).
  let captainNotice: string | null = null;
  if (newCaptainUserId != null) {
    captainNotice = captainSeatNotice(await placeCaptainOnTeam(team.eventId, id, newCaptainUserId));
  }

  return NextResponse.json({ success: true, teamId: id, captainUserId: newCaptainUserId, captainNotice });
}
