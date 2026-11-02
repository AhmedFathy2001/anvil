// Member or guest fee — who owes which. The pure half lives in lib/entryFeeMath.
//
// A GUEST is an entrant whose character holds no member seat in any clan running the board (the host
// or an accepted co-host). Asked by ACCOUNT, not by the seat they signed up with: a co-host's own
// member enters a co-hosted board on a guest seat of the HOST clan (lib/coHost), and charging them
// the guest fee would bill a running clan's members as outsiders.

import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { clanMemberships, eventSignups, signupFees } from '@/db/schema';
import { acceptedCohostClanIds } from '@/lib/coHost';
import { standardFee, type EventFees } from '@/lib/entryFeeMath';

export interface FeeEvent extends EventFees {
  id: number;
  clanId: number;
}

/** Of these characters, the ones holding a member seat in a clan running the board. */
export async function memberAccounts(event: FeeEvent, accountIds: number[]): Promise<Set<number>> {
  if (accountIds.length === 0) return new Set();
  const running = [event.clanId, ...(await acceptedCohostClanIds(event.id))];
  const rows = await db
    .select({ accountId: clanMemberships.accountId })
    .from(clanMemberships)
    .where(
      and(
        inArray(clanMemberships.accountId, accountIds),
        inArray(clanMemberships.clanId, running),
        eq(clanMemberships.kind, 'member'),
        isNull(clanMemberships.leftAt),
      ),
    );
  return new Set(rows.map((r) => r.accountId));
}

export async function isGuestEntrant(event: FeeEvent, accountId: number): Promise<boolean> {
  return !(await memberAccounts(event, [accountId])).has(accountId);
}

/** What this character owes on entry by default. Skips the lookup when guests pay the same. */
export async function standardFeeForAccount(event: FeeEvent, accountId: number): Promise<number | null> {
  if (event.guestSignupFee == null) return event.signupFee;
  return standardFee(event, await isGuestEntrant(event, accountId));
}

/**
 * After the host changes a fee: move every UNTOUCHED fee row onto it. Untouched = still pending (no
 * one has reported paying, collected or settled it) and not priced by hand. Anything further along
 * is a record of money that moved at the old price and stays as it is.
 */
export async function repriceStandardFees(event: FeeEvent): Promise<number> {
  // clan-scope: global -- driven by this event's own sign-ups (eventSignups.eventId); the seat join adds columns, not rows.
  const rows = await db
    .select({ feeId: signupFees.id, amount: signupFees.amount, accountId: clanMemberships.accountId })
    .from(signupFees)
    .innerJoin(eventSignups, eq(eventSignups.id, signupFees.signupId))
    .innerJoin(clanMemberships, eq(clanMemberships.id, eventSignups.clanMemberId))
    .where(and(eq(eventSignups.eventId, event.id), eq(signupFees.status, 'pending'), eq(signupFees.customAmount, false)));
  if (rows.length === 0) return 0;
  const members = await memberAccounts(event, [...new Set(rows.map((r) => r.accountId))]);
  let changed = 0;
  for (const r of rows) {
    const next = standardFee(event, !members.has(r.accountId)) ?? 0;
    // A fee dropped to nothing leaves the row alone: removing owed rows is the host's call, not a
    // side effect of editing a number.
    if (next > 0 && next !== r.amount) {
      await db.update(signupFees).set({ amount: next }).where(eq(signupFees.id, r.feeId));
      changed++;
    }
  }
  return changed;
}
