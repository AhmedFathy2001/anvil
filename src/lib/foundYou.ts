import { and, eq, isNull, ne } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, clans, users } from '@/db/schema';

// "We think we found you."
//
// After the multi-clan port a login and a roster seat are separate things, joined only by a CLAIMED
// account: the sweep, the clan switcher and the apex home all reach a person's clans through
// `accounts.playerId`. So somebody who signed in with Discord and never linked a character has no
// clans at all — while a clan's roster sits there with their RSN on it. The site had nothing to say
// about that beyond "You're not in a clan yet", which reads as *you have no clan* rather than *we
// have not matched you to the one you are in*.
//
// The bot already knew. `accounts.discord_id` is a name-match against the guild, written when the
// roster syncs, and `resolveInvoker` uses it to answer "who am I in this clan" for a slash command.
// The website never read it. This does.
//
// WEAK ON PURPOSE, and it never grants anything. A name-match is a guess: two people can wear the
// same Discord nickname and a clan can rename anybody. So this returns a SUGGESTION, and claiming it
// still goes through the same proof `claimAccountForUser` demands of everyone. The roster stays the
// source of truth; this only stops a person having to guess which RSN to type.

export interface FoundSeat {
  clanSlug: string;
  clanName: string;
  rsn: string;
  /** A member seat is the one worth shouting about; a guest seat is still worth offering. */
  member: boolean;
}

/**
 * Unclaimed roster seats whose name-matched Discord id is this login's.
 *
 * Unclaimed only: an account somebody already owns is not a suggestion, it is somebody else's
 * character. Left seats are excluded — a clan that removed you is not a clan waiting for you.
 */
export async function seatsWaitingFor(userId: number): Promise<FoundSeat[]> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { discordId: true },
  });
  const discordId = user?.discordId?.trim();
  if (!discordId) return [];

  const rows = await db
    .select({
      clanSlug: clans.slug,
      clanName: clans.name,
      rsn: accounts.rsn,
      kind: clanMemberships.kind,
    })
    .from(clanMemberships)
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
    .where(
      and(
        eq(accounts.discordId, discordId),
        isNull(accounts.claimedAt),
        isNull(clanMemberships.leftAt),
        // A clan that is not taking part is not somewhere to send anybody.
        ne(clans.status, 'suspended'),
      ),
    )
    .limit(10);

  // One row per (clan, rsn): the same character rostered in two clans is two invitations, but the
  // same seat found twice is not.
  const seen = new Set<string>();
  const out: FoundSeat[] = [];
  for (const r of rows) {
    const key = `${r.clanSlug}/${r.rsn.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ clanSlug: r.clanSlug, clanName: r.clanName, rsn: r.rsn, member: r.kind === 'member' });
  }
  // Member seats first: that is the one somebody is actually missing.
  return out.sort((a, b) => Number(b.member) - Number(a.member));
}
