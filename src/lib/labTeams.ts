// Teams on a lab board: more sides to play against, and your own place among them.
//
// A lab session starts as one team holding your characters (lib/lab). This adds teams filled with
// the lab's test users (lib/labCast), moves any participant between teams or off every team, and
// sets YOUR role on a team (captain, team staff, plain member), so a captain's tools, a staffer's,
// and an ordinary member's plugin can all be tried from one account. Every write is pinned to the
// lab event it names.

import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, eventParticipants, teamStaff, teams, users } from '@/db/schema';
import { forgetLabSessions } from '@/lib/lab';
import { ensureTestUser } from '@/lib/labCast';
import { LAB_DUMMY_LOGIN } from '@/lib/labRules';

const SIDES: { name: string; color: string }[] = [
  { name: 'Red', color: '#d9534f' },
  { name: 'Blue', color: '#4a90d9' },
  { name: 'Green', color: '#5cb85c' },
  { name: 'Purple', color: '#9b59b6' },
  { name: 'Teal', color: '#1abc9c' },
  { name: 'Orange', color: '#e67e22' },
];

export type TeamRole = 'captain' | 'staff' | 'member';

export interface LabTeamView {
  id: number;
  name: string;
  color: string;
  captain: string | null;
  youCaptain: boolean;
  youStaff: boolean;
  staff: string[];
  members: { participantId: number; name: string; test: boolean }[];
}

export interface LabTeamsView {
  teams: LabTeamView[];
  /** Participants on no team: in the event, but not playing for anyone. */
  unplaced: { participantId: number; name: string; test: boolean }[];
}

export async function labTeams(eventId: number, actorUserId: number): Promise<LabTeamsView> {
  const teamRows = await db.select().from(teams).where(eq(teams.eventId, eventId)).orderBy(teams.id);
  const ids = teamRows.map((t) => t.id);
  const [people, staffRows, captains] = await Promise.all([
    db
      .select({ id: eventParticipants.id, name: eventParticipants.name, teamId: eventParticipants.teamId, discordId: users.discordId })
      .from(eventParticipants)
      .leftJoin(accounts, eq(accounts.id, eventParticipants.accountId))
      .leftJoin(users, eq(users.playerId, accounts.playerId))
      .where(eq(eventParticipants.eventId, eventId))
      .orderBy(eventParticipants.id),
    ids.length
      ? db.select({ teamId: teamStaff.teamId, userId: teamStaff.userId, name: users.displayName }).from(teamStaff).innerJoin(users, eq(users.id, teamStaff.userId)).where(inArray(teamStaff.teamId, ids))
      : [],
    ids.length
      ? db.select({ id: users.id, name: users.displayName }).from(users).where(inArray(users.id, teamRows.map((t) => t.captainUserId).filter((n): n is number => n != null).concat(-1)))
      : [],
  ]);
  // One row per participant even when a person has several logins.
  const seen = new Set<number>();
  const person = people.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  const out = (p: (typeof person)[number]) => ({ participantId: p.id, name: p.name, test: !!p.discordId?.startsWith(LAB_DUMMY_LOGIN) });
  return {
    teams: teamRows.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      captain: captains.find((c) => c.id === t.captainUserId)?.name ?? null,
      youCaptain: t.captainUserId === actorUserId,
      youStaff: staffRows.some((s) => s.teamId === t.id && s.userId === actorUserId),
      staff: staffRows.filter((s) => s.teamId === t.id).map((s) => s.name),
      members: person.filter((p) => p.teamId === t.id).map(out),
    })),
    unplaced: person.filter((p) => p.teamId == null).map(out),
  };
}

/** A new side named after the next free colour, with `players` test users on it. */
export async function addLabTeam(actorUserId: number, eventId: number, players: number): Promise<number> {
  const existing = await db.select({ name: teams.name }).from(teams).where(eq(teams.eventId, eventId));
  const side = SIDES.find((s) => !existing.some((e) => e.name === s.name)) ?? { name: `Team ${existing.length + 1}`, color: '#989898' };
  const [team] = await db.insert(teams).values({ eventId, name: side.name, color: side.color }).returning({ id: teams.id });
  const count = Math.max(0, Math.min(10, Math.round(players)));
  for (let i = 1; i <= count; i++) {
    const user = await ensureTestUser(actorUserId, `${side.name}${i}`);
    if (!user) continue;
    const already = await db.query.eventParticipants.findFirst({
      where: and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.accountId, user.accountId)),
      columns: { id: true },
    });
    if (already) await db.update(eventParticipants).set({ teamId: team.id }).where(eq(eventParticipants.id, already.id));
    else await db.insert(eventParticipants).values({ eventId, accountId: user.accountId, name: user.rsn, teamId: team.id });
  }
  forgetLabSessions();
  return team.id;
}

async function teamOfEvent(eventId: number, teamId: number): Promise<boolean> {
  const row = await db.query.teams.findFirst({ where: and(eq(teams.id, teamId), eq(teams.eventId, eventId)), columns: { id: true } });
  return !!row;
}

/** Put a participant on a team of this event, or on none (null). */
export async function moveLabParticipant(eventId: number, participantId: number, teamId: number | null): Promise<boolean> {
  if (teamId != null && !(await teamOfEvent(eventId, teamId))) return false;
  const moved = await db
    .update(eventParticipants)
    .set({ teamId })
    .where(and(eq(eventParticipants.id, participantId), eq(eventParticipants.eventId, eventId)))
    .returning({ accountId: eventParticipants.accountId });
  forgetLabSessions(moved.map((m) => m.accountId).filter((n): n is number => n != null));
  return moved.length > 0;
}

/**
 * Your role on one of this event's teams, one at a time on the board: captain of that team, its team
 * staff, or a plain member (neither, anywhere on this board).
 */
export async function setLabTeamRole(eventId: number, actorUserId: number, teamId: number, role: TeamRole): Promise<boolean> {
  if (!(await teamOfEvent(eventId, teamId))) return false;
  const boardTeams = (await db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, eventId))).map((t) => t.id);
  // One role at a time on this board: clear both, then take the one asked for.
  await db.update(teams).set({ captainUserId: null }).where(and(inArray(teams.id, boardTeams), eq(teams.captainUserId, actorUserId)));
  await db.delete(teamStaff).where(and(inArray(teamStaff.teamId, boardTeams), eq(teamStaff.userId, actorUserId)));
  if (role === 'captain') await db.update(teams).set({ captainUserId: actorUserId }).where(eq(teams.id, teamId));
  if (role === 'staff') await db.insert(teamStaff).values({ teamId, userId: actorUserId, grantedByUserId: actorUserId, note: 'lab' });
  return true;
}
