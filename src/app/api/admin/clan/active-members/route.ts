import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanRoster, eventParticipants, users } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { verifyAdminOrModerator } from '@/lib/auth';

// GET /api/admin/clan/active-members?eventId=N
//
// Powers the roster picker on the event detail page. Returns the active clan roster
// joined with the user (Discord identity) and a flag indicating whether the member is
// already in the given event's player pool — so the UI can grey those rows out and
// avoid duplicate sign-ups.
//
// eventId is optional: omit it to get the raw active roster without participation flags
// (useful from any context that just needs to render members).
export async function GET(request: Request) {
  const session = await verifyAdminOrModerator();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const eventIdRaw = url.searchParams.get('eventId');
  const eventId = eventIdRaw ? Number(eventIdRaw) : null;

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
    .leftJoin(users, eq(clanRoster.playerId, users.id))
    .leftJoin(
      eventParticipants,
      eventId != null
        ? and(eq(eventParticipants.clanMemberId, clanRoster.id), eq(eventParticipants.eventId, eventId))
        : // Sentinel join that never matches when no eventId is supplied — keeps the
          // shape consistent (enrolledPlayerId will always be null in that branch).
          eq(eventParticipants.id, -1),
    )
    .where(isNull(clanRoster.leftAt))
    .orderBy(clanRoster.rsn);

  return NextResponse.json(
    rows.map((r) => ({
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
