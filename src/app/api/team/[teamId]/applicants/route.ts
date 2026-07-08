import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, eventSignups, teams, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { parseProfile } from '@/lib/signup';

// Captain-facing applicant list. A team captain can review everyone who signed up for
// their event — their RSN, sign-up answers, and (via the RSN) their live hiscores — so
// they can plan draft picks. Captain-only: regular players and non-captains get 403.
// Fee/collection internals are intentionally NOT exposed here; that's admin-only.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const session = await verifyUser();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { teamId } = await params;
  const tId = parseInt(teamId, 10);
  if (!Number.isFinite(tId)) {
    return NextResponse.json({ error: 'Invalid team id' }, { status: 400 });
  }

  const team = await db.query.teams.findFirst({ where: eq(teams.id, tId) });
  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }
  if (team.captainUserId !== session.userId) {
    return NextResponse.json({ error: 'Captains only' }, { status: 403 });
  }

  // Captains are already seated on their own teams and can't be drafted, so exclude them from the
  // scouting pool — a captain doing due diligence only cares about the draftable applicants.
  const eventTeams = await db
    .select({ captainUserId: teams.captainUserId })
    .from(teams)
    .where(eq(teams.eventId, team.eventId));
  const captainUserIds = new Set(
    eventTeams.map((t) => t.captainUserId).filter((v): v is number => v != null),
  );

  const rows = await db
    .select({
      signup: eventSignups,
      user: {
        displayName: users.displayName,
        discordUsername: users.discordUsername,
      },
      account: {
        rsn: clanMembers.rsn,
      },
    })
    .from(eventSignups)
    .innerJoin(users, eq(eventSignups.userId, users.id))
    .innerJoin(clanMembers, eq(eventSignups.clanMemberId, clanMembers.id))
    .where(eq(eventSignups.eventId, team.eventId));

  const applicants = rows
    .filter((r) => !captainUserIds.has(r.signup.userId))
    .map((r) => ({
    id: r.signup.id,
    status: r.signup.status,
    signedUpAt: r.signup.signedUpAt,
    profile: parseProfile(r.signup.profileData),
    displayName: r.user.displayName,
    discordUsername: r.user.discordUsername,
    rsn: r.account.rsn,
  }));

  return NextResponse.json({ applicants });
}
