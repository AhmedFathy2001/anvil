import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, eventSignups, signupFees, teams, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdminOrModerator } from '@/lib/auth';
import { parseProfile } from '@/lib/signup';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await verifyAdminOrModerator();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const id = parseInt(eventId, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }

  const rows = await db
    .select({
      signup: eventSignups,
      fee: signupFees,
      user: {
        id: users.id,
        displayName: users.displayName,
        discordUsername: users.discordUsername,
        role: users.role,
      },
      account: {
        id: clanMembers.id,
        rsn: clanMembers.rsn,
      },
    })
    .from(eventSignups)
    .innerJoin(users, eq(eventSignups.userId, users.id))
    .innerJoin(clanMembers, eq(eventSignups.clanMemberId, clanMembers.id))
    .leftJoin(signupFees, eq(signupFees.signupId, eventSignups.id))
    .where(eq(eventSignups.eventId, id));

  // Look up which signup users captain a team in this event so the UI can render
  // captain-only actions (demote) without an extra round-trip.
  const eventTeams = await db
    .select({ id: teams.id, name: teams.name, color: teams.color, captainUserId: teams.captainUserId })
    .from(teams)
    .where(eq(teams.eventId, id));
  const captainTeamByUser = new Map<number, { id: number; name: string; color: string }>();
  for (const t of eventTeams) {
    if (t.captainUserId !== null) {
      captainTeamByUser.set(t.captainUserId, { id: t.id, name: t.name, color: t.color });
    }
  }

  const signups = rows.map((r) => ({
    id: r.signup.id,
    status: r.signup.status,
    signedUpAt: r.signup.signedUpAt,
    updatedAt: r.signup.updatedAt,
    profile: parseProfile(r.signup.profileData),
    user: r.user,
    account: r.account,
    captainTeam: captainTeamByUser.get(r.user.id) ?? null,
    fee: r.fee
      ? {
          id: r.fee.id,
          amount: r.fee.amount,
          status: r.fee.status,
          collectedByUserId: r.fee.collectedByUserId,
          reportedCollectorUserId: r.fee.reportedCollectorUserId,
          proofBlobUrl: r.fee.proofBlobUrl,
          confirmedAt: r.fee.confirmedAt,
          notes: r.fee.notes,
        }
      : null,
  }));

  return NextResponse.json({ signups });
}
