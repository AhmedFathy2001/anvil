import { NextResponse } from 'next/server';
import { db } from '@/db';
import { teams, teamStaff, users } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { verifyAdmin, verifyUser } from '@/lib/auth';
import { listTeamStaff } from '@/lib/teamStaff';

/**
 * Grant and revoke the extra seats on one team.
 *
 * Admin-only, both ways: a captain can't recruit their own oversight, and staff can't add more
 * staff. Handing someone a seat is a host decision, which is the whole reason it's safe to hand to
 * a moderator from another clan.
 */

async function requireTeam(teamId: number) {
  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  if (!team) return { error: NextResponse.json({ error: 'Team not found' }, { status: 404 }) };
  return { team };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { teamId } = await params;
  const tId = parseInt(teamId, 10);
  if (!Number.isFinite(tId)) return NextResponse.json({ error: 'Invalid team id' }, { status: 400 });

  const found = await requireTeam(tId);
  if ('error' in found) return found.error;
  return NextResponse.json({ staff: await listTeamStaff(tId) });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const session = await verifyUser();
  if (!session || !(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId } = await params;
  const tId = parseInt(teamId, 10);
  if (!Number.isFinite(tId)) return NextResponse.json({ error: 'Invalid team id' }, { status: 400 });

  const found = await requireTeam(tId);
  if ('error' in found) return found.error;

  const body = (await request.json().catch(() => null)) as { userId?: unknown; note?: unknown } | null;
  const userId = Number(body?.userId);
  if (!Number.isFinite(userId)) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  const target = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  // Without a linked Discord they can't sign in to use the seat, so the grant would be a dead row.
  if (!target.discordId) {
    return NextResponse.json({ error: 'That account has no Discord link, so it can never use the seat' }, { status: 400 });
  }
  // The captain already has everything a staff seat grants; a duplicate row would just be confusing
  // in the list.
  if (found.team.captainUserId === userId) {
    return NextResponse.json({ error: 'They already captain this team' }, { status: 409 });
  }

  const note = typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 120) : null;

  await db
    .insert(teamStaff)
    .values({ teamId: tId, userId, note, grantedByUserId: session.userId })
    .onConflictDoUpdate({
      target: [teamStaff.teamId, teamStaff.userId],
      set: { note, grantedByUserId: session.userId },
    });

  return NextResponse.json({ ok: true, staff: await listTeamStaff(tId) });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { teamId } = await params;
  const tId = parseInt(teamId, 10);
  const userId = Number(new URL(request.url).searchParams.get('userId'));
  if (!Number.isFinite(tId) || !Number.isFinite(userId)) {
    return NextResponse.json({ error: 'teamId and userId are required' }, { status: 400 });
  }

  await db.delete(teamStaff).where(and(eq(teamStaff.teamId, tId), eq(teamStaff.userId, userId)));
  return NextResponse.json({ ok: true, staff: await listTeamStaff(tId) });
}
