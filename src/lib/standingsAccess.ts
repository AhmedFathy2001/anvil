// Who is looking at an event's standings — the database half of lib/standingsVisibility.
//
// Every surface that shows another team's progress asks `standingsScopeFor*` here and filters by
// the answer (canSeeTeamProgress / filterToVisibleTeams). The cheap question comes first: when the
// curtain is up (every 'live' board, and every hidden one once it lifts) nothing below touches the
// database, so a normal board pays nothing for this.

import { and, eq, inArray, isNull, or } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanRoster, eventEditors, eventParticipants, teams, teamStaff, users } from '@/db/schema';
import { pluginRsnHintOnly, pluginTokenPerson, verifyCaptain, verifyPlayer, verifyPluginTokenForEvent, verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import { clanGrant } from '@/lib/clanGrants';
import { cohostBoardEventIds } from '@/lib/eventEditors';
import {
  standingsHidden,
  standingsHiddenFor,
  type StandingsEvent,
  type StandingsScope,
  type StandingsViewer,
} from '@/lib/standingsVisibility';

export type StandingsEventRow = StandingsEvent & { id: number; clanId: number };

const VISIBLE: StandingsScope = { hidden: false };

/**
 * Staff of THIS event, for the standings: the host clan's moderators and up (a board-only treasurer
 * excepted), its all-boards tile editors, anyone holding a grant on this board, a co-host's staff
 * the host let onto it, and platform staff. The same people who can already open every team's board
 * in the admin panel — hiding the public scoreboard from them would hide nothing.
 */
export async function isStandingsStaff(event: { id: number; clanId: number }, userId: number): Promise<boolean> {
  // clan-scope: global -- a platform role is not a clan's.
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { platformRole: true } });
  if (user?.platformRole && user.platformRole !== 'none') return true;

  const grant = await clanGrant(event.clanId, userId);
  if (grant) {
    const boardOnlyTreasurer = grant.role === 'treasurer' && grant.treasurerScope === 'assigned';
    if (!boardOnlyTreasurer && atLeast(grant.role, 'moderator')) return true;
    if (grant.canEditTiles && grant.editorScope === 'all') return true;
  }

  const boardGrant = await db.query.eventEditors.findFirst({
    where: and(eq(eventEditors.eventId, event.id), eq(eventEditors.userId, userId)),
    columns: { id: true },
  });
  if (boardGrant) return true;

  return (await cohostBoardEventIds(userId, { eventId: event.id })).length > 0;
}

/**
 * The teams in this event a person plays on, captains, or holds a team-staff seat on. Any of their
 * characters counts — a player's alt on another team is still them, and they'd see it anyway.
 */
export async function viewerTeamIds(eventId: number, person: { userId: number | null; playerId: number | null }): Promise<number[]> {
  const ids = new Set<number>();
  if (person.playerId != null) {
    // clan-scope: global -- the subject is a PERSON, whose seats span clans by design; scoped to the viewer's own.
    const seats = await db
      .select({ id: clanRoster.id })
      .from(clanRoster)
      .where(and(eq(clanRoster.playerId, person.playerId), isNull(clanRoster.leftAt)));
    // clan-scope: global -- the viewer's own characters.
    const owned = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.playerId, person.playerId));
    const seatIds = seats.map((s) => s.id);
    const accountIds = owned.map((a) => a.id);
    if (seatIds.length || accountIds.length) {
      const rows = await db
        .select({ teamId: eventParticipants.teamId })
        .from(eventParticipants)
        .where(
          and(
            eq(eventParticipants.eventId, eventId),
            or(
              seatIds.length ? inArray(eventParticipants.clanMemberId, seatIds) : undefined,
              accountIds.length ? inArray(eventParticipants.accountId, accountIds) : undefined,
            ),
          ),
        );
      for (const r of rows) if (r.teamId != null) ids.add(r.teamId);
    }
  }
  if (person.userId != null) {
    const captained = await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.eventId, eventId), eq(teams.captainUserId, person.userId)));
    for (const t of captained) ids.add(t.id);
    const seated = await db
      .select({ id: teams.id })
      .from(teamStaff)
      .innerJoin(teams, eq(teams.id, teamStaff.teamId))
      .where(and(eq(teams.eventId, eventId), eq(teamStaff.userId, person.userId)));
    for (const t of seated) ids.add(t.id);
  }
  return [...ids];
}

/** The viewer behind a signed-in person (web session or plugin token's owner). */
export async function standingsViewerFor(
  event: { id: number; clanId: number },
  person: { userId: number | null; playerId: number | null },
): Promise<StandingsViewer> {
  if (person.userId != null && (await isStandingsStaff(event, person.userId))) return { staff: true, teamIds: [] };
  return { staff: false, teamIds: await viewerTeamIds(event.id, person) };
}

/**
 * The scope for a web page or a browser API call: the session cookie, plus the legacy captain and
 * player cookies (each names one team). Signed out = the public.
 */
export async function standingsScopeForSession(event: StandingsEventRow): Promise<StandingsScope> {
  if (!standingsHidden(event)) return VISIBLE;
  const user = await verifyUser();
  const viewer = user
    ? await standingsViewerFor(event, { userId: user.userId, playerId: user.playerId })
    : { staff: false, teamIds: [] as number[] };
  if (!viewer.staff) {
    const extra = [(await verifyCaptain())?.teamId, (await verifyPlayer())?.teamId].filter(
      (t): t is number => typeof t === 'number',
    );
    if (extra.length) viewer.teamIds = [...new Set([...viewer.teamIds, ...extra])];
  }
  return standingsHiddenFor(event, viewer);
}

/**
 * The scope for a request that may come from either the site or the RuneLite plugin. A bearer token
 * resolves to the logged-in character's team on this event (and its owner's staff standing); a
 * cookie session resolves as above. Both are unioned — one person, whichever client asked.
 */
export async function standingsScopeForRequest(request: Request, event: StandingsEventRow): Promise<StandingsScope> {
  if (!standingsHidden(event)) return VISIBLE;
  let pluginTeams: number[] = [];
  let pluginStaff = false;
  if (request.headers.get('Authorization')?.startsWith('Bearer ')) {
    const [seat, person] = await Promise.all([
      // A read, so the launcher's character may stand in for the played one (as the board does).
      verifyPluginTokenForEvent(request, event.id, { hintOnly: pluginRsnHintOnly(request) }).catch(() => null),
      pluginTokenPerson(request).catch(() => null),
    ]);
    if (seat) pluginTeams = [seat.teamId];
    if (person) {
      pluginStaff = await isStandingsStaff(event, person.userId);
      if (!pluginStaff) {
        // clan-scope: global -- the token's own person.
        const row = await db.query.users.findFirst({ where: eq(users.id, person.userId), columns: { playerId: true } });
        pluginTeams = [...new Set([...pluginTeams, ...(await viewerTeamIds(event.id, { userId: person.userId, playerId: row?.playerId ?? null }))])];
      }
    }
  }
  if (pluginStaff) return VISIBLE;
  const session = await standingsScopeForSession(event);
  if (!session.hidden) return session;
  if (!pluginTeams.length) return session;
  return { ...session, ownTeamIds: new Set([...session.ownTeamIds, ...pluginTeams]) };
}

/** The scope for a known plugin caller (the route already resolved its token). */
export async function standingsScopeForPlugin(
  event: StandingsEventRow,
  caller: { userId: number | null; teamId: number | null; playerId?: number | null },
): Promise<StandingsScope> {
  if (!standingsHidden(event)) return VISIBLE;
  if (caller.userId != null && (await isStandingsStaff(event, caller.userId))) return VISIBLE;
  const teamIds = caller.teamId != null ? [caller.teamId] : [];
  if (caller.userId != null) {
    // clan-scope: global -- the token's own person.
    const row = await db.query.users.findFirst({ where: eq(users.id, caller.userId), columns: { playerId: true } });
    teamIds.push(...(await viewerTeamIds(event.id, { userId: caller.userId, playerId: row?.playerId ?? null })));
  }
  return standingsHiddenFor(event, { staff: false, teamIds: [...new Set(teamIds)] });
}
