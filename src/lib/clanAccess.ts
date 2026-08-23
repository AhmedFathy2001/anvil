import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, clanStaff } from '@/db/schema';
import { clanVisibilityOf } from '@/lib/clanVisibility';

export { clanVisibilityOf, isClanVisibility, type ClanVisibility } from '@/lib/clanVisibility';

/**
 * May this person read this clan at all?
 *
 * ONE QUESTION, ASKED ONCE. A clan that keeps to itself keeps ALL of itself to itself — boards,
 * roster, records — so the check belongs to the clan rather than to each of its thirty pages. The
 * root layout asks it and swaps the whole page for the clan's card; nothing downstream has to
 * remember, and nothing can forget.
 *
 * PUBLIC IS THE DEFAULT and always was. Clans paste their board link into Discord and people who are
 * not members click it — that is the ordinary life of one of these sites. The port briefly broke it
 * by reading `events.visibility: 'clan'` as "holds a seat here", which 404'd every board for anyone
 * signed out.
 *
 * A GRANT COUNTS, not just a seat. Staff frequently hold authority and no roster row, and an admin
 * locked out of the clan they run would be a strange way to enforce privacy.
 */
export async function canSeeClan(opts: {
  clanId: number;
  visibility: string | null | undefined;
  /** Null for a signed-out visitor. */
  playerId: number | null | undefined;
  /** Null for a signed-out visitor. A DIFFERENT id space from playerId — see lib/myClans. */
  userId: number | null | undefined;
}): Promise<boolean> {
  if (clanVisibilityOf(opts.visibility) === 'public') return true;

  if (opts.playerId != null) {
    const [seat] = await db
      .select({ id: clanMemberships.id })
      .from(clanMemberships)
      .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
      .where(
        and(
          eq(clanMemberships.clanId, opts.clanId),
          eq(accounts.playerId, opts.playerId),
          isNull(clanMemberships.leftAt),
        ),
      )
      .limit(1);
    if (seat) return true;
  }

  if (opts.userId != null) {
    const [grant] = await db
      .select({ id: clanStaff.id })
      .from(clanStaff)
      .where(and(eq(clanStaff.clanId, opts.clanId), eq(clanStaff.userId, opts.userId)))
      .limit(1);
    if (grant) return true;
  }

  return false;
}
