// Which of a person's accounts a given clan may see.
//
// THE RULE, and it is one sentence:
//
//   A clan may see an account iff that account holds a seat in that clan, OR the account is shared.
//
// The globalised account token is what makes this necessary. One token covers every account a person
// owns across every clan — which is the right model, since Jagex tracks accounts and re-linking per
// clan was the part everyone hated — but it means a clan holding one of someone's accounts must not
// thereby learn the others. Guesting into a clan on an alt is not telling that clan about your main.
//
// ONE HELPER, not a filter repeated at each call site. A privacy rule enforced in nine places is a
// privacy rule with eight chances to be forgotten, and the forgetting is silent: the query returns
// MORE rows, so nothing errors and nothing looks wrong from the inside.
//
// Platform surfaces (/staff, lib/platformView) deliberately do not use this. An operator seeing
// everything is the job, and it is already gated behind users.platform_role, which no clan role can
// confer.

import { and, eq, exists, inArray, isNull, or, type SQL } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships } from '@/db/schema';

/**
 * A condition on `accounts` matching only what this clan may see.
 *
 * Composable so callers keep their own joins and ordering — the helper contributes the rule, not the
 * shape of the query.
 */
export function visibleToClan(clanId: number): SQL {
  return or(
    // Seated here: this clan already knows them, because they are on its roster.
    exists(
      db
        .select({ one: clanMemberships.id })
        .from(clanMemberships)
        .where(and(eq(clanMemberships.accountId, accounts.id), eq(clanMemberships.clanId, clanId))),
    ),
    // Or the person chose to publish it.
    eq(accounts.shared, true),
  )!;
}

export interface VisibleAccount {
  id: number;
  rsn: string;
  status: string;
  verified: boolean;
  isPrimary: boolean;
  /** True when this clan can see it only because it was shared, not because they hold a seat. */
  viaSharing: boolean;
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
      shared: accounts.shared,
    })
    .from(accounts)
    .where(and(eq(accounts.playerId, playerId), visibleToClan(clanId)));

  if (rows.length === 0) return [];

  // Which of them are seated here, so the caller can distinguish "our member" from "someone who
  // published this account". They mean different things to a clan looking at a guest.
  const seated = await db
    .select({ accountId: clanMemberships.accountId })
    .from(clanMemberships)
    .where(
      and(
        eq(clanMemberships.clanId, clanId),
        inArray(clanMemberships.accountId, rows.map((r) => r.id)),
      ),
    );
  const seatedIds = new Set(seated.map((s) => s.accountId));

  return rows.map((r) => ({
    id: r.id,
    rsn: r.rsn,
    status: r.status,
    verified: r.verifiedAt != null,
    isPrimary: r.isPrimary === 1,
    viaSharing: !seatedIds.has(r.id),
  }));
}

/**
 * How many of this person's accounts this clan CANNOT see.
 *
 * For telling a clan that there is more without telling them what: "3 other accounts, not shared" is
 * honest, and hiding the existence of the count would be a different and worse kind of lie — a clan
 * deciding whether to admit a guest is entitled to know the shape of what it is not being shown.
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
