// May this person name this clan as the one they are asking to join?
//
// The doors that take a clan from what the caller typed (a slug in the body, a slug in the path, an
// event id) all end in `admit`, and some of them grant a seat over the clan's own guest setting
// (lib/characterState doorPolicy). That is only right at a clan the person could have walked up to:
//
//   - the clan is public and not hidden by the platform, or
//   - they already hold a seat or a staff grant there (lib/clanAccess canSeeClan), or
//   - they already have a request waiting on that clan's staff, or
//   - they carry a good invite to one of that clan's events (lib/eventEntry inviteStanding).
//
// For anybody else a members-only or hidden clan is not theirs to address: an unproven claim is
// answered exactly as if the clan did not exist, and a proven character gets no override, so the
// clan's own guest setting decides.

import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanJoinRequests, clans, events, teamInvites } from '@/db/schema';
import { canSeeClan } from '@/lib/clanAccess';
import { clanVisibilityOf } from '@/lib/clanVisibility';
import { isWellFormedToken } from '@/lib/teamInvites';

export async function mayAddressClan(opts: {
  clanId: number;
  /** Null when the login has no person row yet (nothing linked, so no seat or request either). */
  playerId: number | null | undefined;
  userId: number | null | undefined;
  /** A team's invite token, when the request carries one. */
  inviteToken?: string | null;
  /**
   * False where the answer decides whether a PROVEN character is seated over the clan's own guest
   * setting: a request is something the person files themselves, so it must not be what lets the
   * next press skip the very approval it is waiting for. Default true (may they ask at all).
   */
  countRequests?: boolean;
}): Promise<boolean> {
  const clan = await db.query.clans.findFirst({ where: eq(clans.id, opts.clanId), columns: { visibility: true, platformHidden: true } });
  if (!clan) return false;
  if (clanVisibilityOf(clan.visibility) === 'public' && !clan.platformHidden) return true;

  // A seat or a staff grant. Asked as "members-only" whatever the clan's setting, so a public clan
  // the platform has hidden is held to the same bar.
  if (await canSeeClan({ clanId: opts.clanId, visibility: 'members', playerId: opts.playerId, userId: opts.userId })) return true;

  if (opts.playerId != null && opts.countRequests !== false) {
    const [asked] = await db
      .select({ id: clanJoinRequests.id })
      .from(clanJoinRequests)
      .innerJoin(accounts, eq(accounts.id, clanJoinRequests.accountId))
      .where(and(eq(clanJoinRequests.clanId, opts.clanId), eq(accounts.playerId, opts.playerId), eq(clanJoinRequests.status, 'pending')))
      .limit(1);
    if (asked) return true;
  }

  if (isWellFormedToken(opts.inviteToken)) {
    const [invite] = await db
      .select({ eventId: teamInvites.eventId })
      .from(teamInvites)
      .innerJoin(events, eq(events.id, teamInvites.eventId))
      .where(and(eq(teamInvites.token, opts.inviteToken!), eq(events.clanId, opts.clanId)))
      .limit(1);
    if (invite) {
      // Loaded here: lib/eventEntry asks this question itself.
      const { inviteStanding } = await import('@/lib/eventEntry');
      if ((await inviteStanding(invite.eventId, opts.inviteToken))?.ok === true) return true;
    }
  }
  return false;
}
