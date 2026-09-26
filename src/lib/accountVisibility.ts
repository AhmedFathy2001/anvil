// Which of a person's characters a given clan may see.
//
// THE RULE, and it is one sentence:
//
//   A clan may see a character iff that character holds a seat in that clan.
//
// IT USED TO BE "seat OR shared", and `shared` meant something no clan could act on. Sharing is now
// the PLATFORM's question — is this character public on Anvil, on its own profile and the cross-clan
// boards — and a clan's question is answered by its roster alone. The two were tangled because one
// flag was asked to mean both, so ticking "share" told a person their character was visible to
// clans that had never heard of them, while every clan screen went on showing seats.
//
// Being seen by a clan is now the same act as being IN it: you offer the character as a guest, the
// clan's own door answers (lib/guestAdmission — open seats you, approval asks a moderator, closed
// refuses), and the seat that comes out of it is what makes you visible and lets you play their
// events. One relationship, one answer, and the person is on both ends of it.
//
// ONE HELPER, not a filter repeated at each call site. A privacy rule enforced in nine places is a
// privacy rule with eight chances to be forgotten, and the forgetting is silent: the query returns
// MORE rows, so nothing errors and nothing looks wrong from the inside.
//
// Platform surfaces (/staff, lib/platformView) deliberately do not use this. An operator seeing
// everything is the job, and it is already gated behind users.platform_role, which no clan role can
// confer.

import { and, eq, exists, isNull, type SQL } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships } from '@/db/schema';

/**
 * A condition on `accounts` matching only what this clan may see.
 *
 * Composable so callers keep their own joins and ordering — the helper contributes the rule, not the
 * shape of the query.
 */
export function visibleToClan(clanId: number): SQL {
  // Seated here, and that is the whole rule: this clan knows them because they are on its roster.
  return exists(
    db
      .select({ one: clanMemberships.id })
      .from(clanMemberships)
      .where(and(eq(clanMemberships.accountId, accounts.id), eq(clanMemberships.clanId, clanId))),
  );
}

export interface VisibleAccount {
  id: number;
  rsn: string;
  status: string;
  verified: boolean;
  isPrimary: boolean;
}

/**
 * The accounts of one person that this clan may see.
 *
 * Note the seat lookup ignores `leftAt`: a clan that had someone on its roster does not un-learn
 * their RSN when they leave, and pretending otherwise would break its own history — completions and
 * submissions name that account. Departure removes them from the roster, not from the record.
 */
export async function accountsVisibleToClan(clanId: number, playerId: number): Promise<VisibleAccount[]> {
  const rows = await db
    .select({
      id: accounts.id,
      rsn: accounts.rsn,
      status: accounts.status,
      verifiedAt: accounts.verifiedAt,
      isPrimary: accounts.isPrimary,
    })
    .from(accounts)
    .where(and(eq(accounts.playerId, playerId), visibleToClan(clanId)));

  return rows.map((r) => ({
    id: r.id,
    rsn: r.rsn,
    status: r.status,
    verified: r.verifiedAt != null,
    isPrimary: r.isPrimary === 1,
  }));
}

/**
 * How many of this person's characters this clan CANNOT see.
 *
 * For telling a clan that there is more without telling them what: "3 other characters" is honest,
 * and hiding the existence of the count would be a different and worse kind of lie — a clan deciding
 * whether to admit a guest is entitled to know the shape of what it is not being shown.
 */
export async function hiddenAccountCount(clanId: number, playerId: number): Promise<number> {
  const [all, visible] = await Promise.all([
    db.select({ id: accounts.id }).from(accounts).where(eq(accounts.playerId, playerId)),
    accountsVisibleToClan(clanId, playerId),
  ]);
  return Math.max(0, all.length - visible.length);
}

/** Seats in this clan whose account the clan may see. The seat-shaped half of the same rule. */
export function seatVisibleToClan(clanId: number): SQL {
  // A seat IS the clan knowing about the account, so this is only ever about the clan's own seats —
  // kept as its own helper so a caller filtering seats does not reach for the account-shaped one and
  // silently widen to every clan.
  return and(eq(clanMemberships.clanId, clanId), isNull(clanMemberships.leftAt))!;
}
