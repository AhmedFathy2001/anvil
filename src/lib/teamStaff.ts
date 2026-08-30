import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanRoster, eventParticipants, teams, teamStaff, users } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';

/**
 * Who may run a team, and how far that runs.
 *
 * A team has one captain column, which is fine until an event has two clans in it: handing the seat
 * to the visiting side's moderator takes it off the person actually playing. Staff are additional
 * people scoped to ONE team — the grant means nothing on any other team, in any other event, which
 * is what makes it safe to give to someone from outside the clan.
 *
 * What a manager (captain or staff) can do, and deliberately can't:
 *
 *   can  — see and manage their own roster, read their team's submissions and proof,
 *          mark their own players' fees paid, complete/reopen their own team's tiles
 *   can't— touch another team, edit the board, run the draft's picks (the captain's seat),
 *          or sub a player out once the event is live. Subbing changes scoring history, so it
 *          stays with the host, by explicit decision.
 */

export interface TeamManagement {
  userId: number;
  teamId: number;
  eventId: number;
  isCaptain: boolean;
  isStaff: boolean;
  /** The gate every team-scoped management action should check. */
  canManage: boolean;
  /** Their own player row on this team, when they also play. */
  playerId: number | null;
}

/**
 * Resolve the caller's standing on one team.
 *
 * Separate from lib/auth's resolveTeamMembership because that one returns null for anyone who is
 * neither captain nor player — which is precisely what a visiting clan's moderator is.
 */
export async function resolveTeamManagement(teamId: number): Promise<TeamManagement | null> {
  const user = await verifyUser();
  if (!user) return null;

  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  if (!team) return null;

  const isCaptain = team.captainUserId === user.userId;

  const staffRow = await db.query.teamStaff.findFirst({
    where: and(eq(teamStaff.teamId, teamId), eq(teamStaff.userId, user.userId)),
  });
  const isStaff = !!staffRow;

  // Do they also play on it? Any of their linked accounts counts — a captain is usually a player
  // too, and a staff member from another clan usually isn't.
  // clan-scope: global -- reached through team membership or a token, not through a clan — that is what lets a visiting clan's people use it.
  const myMembers = await db
    .select({ id: clanRoster.id })
    .from(clanRoster)
    .where(and(eq(clanRoster.playerId, user.playerId), isNull(clanRoster.leftAt)));
  let playerId: number | null = null;
  if (myMembers.length > 0) {
    const mine = new Set(myMembers.map((m) => m.id));
    const roster = await db
      .select({ id: eventParticipants.id, clanMemberId: eventParticipants.clanMemberId })
      .from(eventParticipants)
      .where(and(eq(eventParticipants.eventId, team.eventId), eq(eventParticipants.teamId, teamId)));
    playerId = roster.find((p) => p.clanMemberId != null && mine.has(p.clanMemberId))?.id ?? null;
  }

  if (!isCaptain && !isStaff && playerId == null) return null;

  return {
    userId: user.userId,
    teamId,
    eventId: team.eventId,
    isCaptain,
    isStaff,
    canManage: isCaptain || isStaff,
    playerId,
  };
}

export interface TeamStaffRow {
  userId: number;
  displayName: string;
  discordUsername: string | null;
  discordId: string | null;
  discordAvatar: string | null;
  note: string | null;
  grantedAt: string;
}

/** Everyone holding a staff seat on this team, for the admin panel and the team page. */
export async function listTeamStaff(teamId: number): Promise<TeamStaffRow[]> {
  const rows = await db
    .select({
      userId: teamStaff.userId,
      note: teamStaff.note,
      grantedAt: teamStaff.createdAt,
      displayName: users.displayName,
      discordUsername: users.discordUsername,
      discordId: users.discordId,
      discordAvatar: users.discordAvatar,
    })
    .from(teamStaff)
    .innerJoin(users, eq(teamStaff.userId, users.id))
    .where(eq(teamStaff.teamId, teamId))
    .orderBy(teamStaff.createdAt);
  return rows;
}

/** Teams this user staffs — the nav and the hub need it to show their seat. */
export async function staffedTeamIds(userId: number): Promise<number[]> {
  const rows = await db
    .select({ teamId: teamStaff.teamId })
    .from(teamStaff)
    .where(eq(teamStaff.userId, userId));
  return rows.map((r) => r.teamId);
}

/**
 * Route guard: the caller must manage this team.
 *
 * Distinguishes "not signed in" from "signed in, but this isn't your team" — a client that gets 401
 * sends the user to log in, which is the wrong move when they're already logged in and simply
 * poking at someone else's roster. Mirrors lib/eventLock's assertEventEditable, which also hands a
 * ready-made response back to the route.
 */
export async function requireTeamManager(
  teamId: number,
): Promise<{ management: TeamManagement } | { response: NextResponse }> {
  const management = await resolveTeamManagement(teamId);
  if (management?.canManage) return { management };

  const user = await verifyUser();
  if (!user) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return {
    response: NextResponse.json({ error: 'You do not manage this team' }, { status: 403 }),
  };
}
