import { NextResponse } from 'next/server';
import { requireClanFromRequest } from '@/lib/clanContext';
import { db } from '@/db';
import { clanRoster, eventCohosts, eventParticipants, teams, users } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { verifyAdminOrModerator } from '@/lib/auth';
import { clanGrant } from '@/lib/clanGrants';
import { atLeast } from '@/lib/clanRoles';

// GET /api/admin/clan/active-members?eventId=N&teamId=M
//
// Powers the roster picker on the event detail page. Returns the active clan roster
// joined with the user (Discord identity) and a flag indicating whether the member is
// already in the given event's player pool — so the UI can grey those rows out and
// avoid duplicate sign-ups.
//
// eventId is optional: omit it to get the raw active roster without participation flags
// (useful from any context that just needs to render members).
//
// WHOSE ROSTER, on a co-hosted board. `teamId` names a team, and a co-host's team carries the
// visiting clan on `teams.clanId`. Without it this always answered with the clan in the URL — the
// HOST — so filling a visiting clan's team offered the host's roster and, on a board hosted by a
// small clan, an empty list reading "run a clan-sync to populate the roster". The roster was
// populated; it was somebody else's, and nothing here would ever have asked for it.
//
// It is not a way to read another clan's members: the caller must hold staff in the clan being
// asked about. A host with no seat there gets an empty list, same as before, because a visiting
// clan's roster is theirs and co-hosting a board does not publish it.
export async function GET(request: Request) {
  const session = await verifyAdminOrModerator();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // The roster of the clan whose host asked. An admin elsewhere is not an admin here.
  const clan = await requireClanFromRequest(request);
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const url = new URL(request.url);
  const eventIdRaw = url.searchParams.get('eventId');
  const eventId = eventIdRaw ? Number(eventIdRaw) : null;
  const teamIdRaw = url.searchParams.get('teamId');
  const teamId = teamIdRaw ? Number(teamIdRaw) : null;

  // Which clan's roster this answers with. The URL's clan unless a team names another one AND the
  // caller has standing there.
  let rosterClanId = clan.id;
  if (teamId != null && Number.isFinite(teamId)) {
    const [team] = await db
      .select({ clanId: teams.clanId, eventId: teams.eventId })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);
    if (team?.clanId != null && team.clanId !== clan.id) {
      // The team has to belong to a co-host OF THIS EVENT — a team id alone must not reach across
      // to an unrelated board.
      const [cohost] = await db
        .select({ id: eventCohosts.id })
        .from(eventCohosts)
        .where(
          and(
            eq(eventCohosts.eventId, team.eventId),
            eq(eventCohosts.clanId, team.clanId),
            eq(eventCohosts.status, 'accepted'),
          ),
        )
        .limit(1);
      // Staff THERE, not here. `atLeast`, because owner outranks admin and equality would miss the
      // one person who cannot be removed from the clan.
      const grant = cohost ? await clanGrant(team.clanId, session.userId) : null;
      if (grant && atLeast(grant.role, 'moderator')) rosterClanId = team.clanId;
    }
  }

  // Single query: clan members + linked user (left join — ghosts have no user yet) +
  // optional left join to players for the eventId so we can flag already-enrolled rows.
  const rows = await db
    .select({
      id: clanRoster.id,
      rsn: clanRoster.rsn,
      rank: clanRoster.rank,
      isPrimary: clanRoster.isPrimary,
      verifiedAt: clanRoster.verifiedAt,
      verificationMethod: clanRoster.verificationMethod,
      accountHash: clanRoster.accountHash,
      provisional: clanRoster.provisional,
      lastSeenInClan: clanRoster.lastSeenInClan,
      userId: users.id,
      displayName: users.displayName,
      discordId: users.discordId,
      discordUsername: users.discordUsername,
      discordAvatar: users.discordAvatar,
      enrolledPlayerId: eventParticipants.id,
      enrolledTeamId: eventParticipants.teamId,
    })
    .from(clanRoster)
    // THE PERSON, NOT THE LOGIN. `clanRoster.playerId` is a players.id; `users.id` is a login id.
    // Two sequences, seeded 1:1 and long since diverged — so this compared a person to whichever
    // login happened to share its number and hung a stranger's Discord name and avatar on a
    // character. The bridge is `users.playerId`, which is the column that says which person a login
    // belongs to. It does not error either way, which is why it survived: it answers, wrongly.
    .leftJoin(users, eq(users.playerId, clanRoster.playerId))
    .leftJoin(
      eventParticipants,
      eventId != null
        ? and(eq(eventParticipants.clanMemberId, clanRoster.id), eq(eventParticipants.eventId, eventId))
        : // Sentinel join that never matches when no eventId is supplied — keeps the
          // shape consistent (enrolledPlayerId will always be null in that branch).
          eq(eventParticipants.id, -1),
    )
    .where(and(eq(clanRoster.clanId, rosterClanId), isNull(clanRoster.leftAt)))
    .orderBy(clanRoster.rsn);

  // ONE ROW PER SEAT. Joining through the person is correct and, unlike the id comparison it
  // replaces, can match more than once: the schema allows a person several logins. A picker that
  // listed the same member twice would be a new confusion in place of the old one.
  const seen = new Set<number>();
  const unique = rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));

  return NextResponse.json(
    unique.map((r) => ({
      id: r.id,
      rsn: r.rsn,
      rank: r.rank,
      isPrimary: r.isPrimary === 1,
      verifiedAt: r.verifiedAt,
      verificationMethod: r.verificationMethod,
      // "On the plugin" = we hold a Jagex account hash from the plugin handshake, or the account was
      // plugin-verified. Non-plugin accounts still track via hiscores (just no live overlay).
      hasPlugin: r.accountHash != null || r.verificationMethod === 'plugin',
      provisional: r.provisional === 1,
      lastSeenInClan: r.lastSeenInClan,
      user: r.userId
        ? {
            id: r.userId,
            displayName: r.displayName,
            discordId: r.discordId,
            discordUsername: r.discordUsername,
            discordAvatar: r.discordAvatar,
          }
        : null,
      enrolledPlayerId: r.enrolledPlayerId,
      enrolledTeamId: r.enrolledTeamId,
    })),
  );
}
