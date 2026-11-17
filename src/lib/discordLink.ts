// A Discord id that clan staff typed onto a roster entry (adding a member, editing one, importing
// event players), as opposed to one picked through the "link" control (api/admin/discord/link-member).
//
// Every write of accounts.discordId sets its source (drizzle/0265). This decides the source for
// these typed ones, by the same rules as the link control, so there is no softer way in:
//   'admin'   only when an admin or the owner entered it, it is a real Discord id (not a username),
//             the character is unclaimed, and no sign-in ties that Discord account to a different
//             member of this clan
//   unknown   everything else. The value is stored as before and still counts while the clan's
//             nickname matching is on; with it off it earns no roles.
//
// WHO MAY WRITE AT ALL is decided before this is called: a moderator's Discord id never reaches
// here (lib/discordRoleSafety rosterDiscordIdWrite, enforced in api/admin/clan, api/admin/clan/[id]
// and lib/clan findOrCreateClanMember). The non-admin branch below stays as a second line.

import { discordProvenForOtherSeat } from '@/lib/discord-roles';
import { handLinkRefusal, mayHandLink, storedDiscordLink, type StoredDiscordLink } from '@/lib/discordRoleSafety';
import { isDiscordId } from '@/lib/personData';

export async function staffEnteredDiscordLink(input: {
  clanId: number;
  /** The seat being written, or null when it does not exist yet. */
  seatId: number | null;
  /** The character already belongs to a player. */
  claimed: boolean;
  discordId: string | null | undefined;
  /** Who typed it. Absent = nobody this can be attributed to, so never a hand link. */
  actor?: { userId: number; role: string } | null;
}): Promise<StoredDiscordLink> {
  const id = input.discordId?.trim() || null;
  if (!id) return storedDiscordLink(null, null);
  if (!input.actor || !mayHandLink(input.actor.role) || !isDiscordId(id)) return storedDiscordLink(id, null);
  const refusal = handLinkRefusal({
    seatClaimed: input.claimed,
    provenForOtherSeat: !input.claimed && (await discordProvenForOtherSeat(input.clanId, input.seatId, id)),
  });
  if (refusal) return storedDiscordLink(id, null);
  return storedDiscordLink(id, 'admin', { userId: input.actor.userId, clanId: input.clanId, at: new Date().toISOString() });
}
