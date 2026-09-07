import { NextResponse } from 'next/server';
import { resolveTeamManagement } from '@/lib/teamStaff';
import { db } from '@/db';
import { clanRoster, eventSignups, teams, users } from '@/db/schema';
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
  // Captain or team staff. A visiting clan's moderator runs their own team's side of a co-hosted
  // board, and the applicants to it are the first thing they need to see.
  const management = await resolveTeamManagement(tId);
  if (!management?.canManage) {
    return NextResponse.json({ error: 'You do not manage this team' }, { status: 403 });
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

  // clan-scope: global -- reached through team membership or a token, not through a clan — that is what lets a visiting clan's people use it.
  const rows = await db
    .select({
      signup: eventSignups,
      user: {
        displayName: users.displayName,
        discordUsername: users.discordUsername,
      },
      account: {
        rsn: clanRoster.rsn,
      },
    })
    .from(eventSignups)
    .innerJoin(users, eq(eventSignups.userId, users.id))
    .innerJoin(clanRoster, eq(eventSignups.clanMemberId, clanRoster.id))
    .where(eq(eventSignups.eventId, team.eventId));

  const applicants = rows
    // Inner-joined on users, so userId is always present here; guard keeps the types honest.
    .filter((r) => r.signup.userId != null && !captainUserIds.has(r.signup.userId))
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
