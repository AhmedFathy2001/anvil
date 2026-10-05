// Which clan a character is a MEMBER of, when two in-game rosters both list it — the player's call.
//
// A roster sync never moves a membership between clans (lib/guestAdmission memberSeatElsewhere): a
// character already a member elsewhere is seated as a guest. That stops a sync from demoting real
// members of their real clan — and leaves the opposite risk, a first-come lock: whichever clan synced
// first holds them, including a clan stood up under a modified client listing names it has no right
// to. The roster cannot settle that (each side's says "mine"), so the person does, here, and platform
// staff can when the person cannot (unverify releases a disputed clan's memberships).

import { and, eq, inArray, isNull, ne } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { db } from '@/db';
import { accounts, clanAuditLog, clanMemberships, clans } from '@/db/schema';

export interface MembershipConflict {
  accountId: number;
  rsn: string;
  /** Where it is a member now. */
  member: { seatId: number; clanId: number; name: string; slug: string };
  /** Another clan whose in-game roster also lists it — a guest there only because of the rule above. */
  listedBy: { seatId: number; clanId: number; name: string; slug: string };
}

const memberSeat = alias(clanMemberships, 'member_seat');
const memberClan = alias(clans, 'member_clan');

/** This person's characters that two in-game rosters both claim. */
export async function membershipConflicts(playerId: number): Promise<MembershipConflict[]> {
  // clan-scope: global -- one person's own seats across clans; the conflict IS between two clans.
  const rows = await db
    .select({
      accountId: accounts.id,
      rsn: accounts.rsn,
      guestSeatId: clanMemberships.id,
      guestClanId: clans.id,
      guestClanName: clans.name,
      guestClanSlug: clans.slug,
      memberSeatId: memberSeat.id,
      memberClanId: memberClan.id,
      memberClanName: memberClan.name,
      memberClanSlug: memberClan.slug,
    })
    .from(clanMemberships)
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
    .innerJoin(
      memberSeat,
      and(
        eq(memberSeat.accountId, clanMemberships.accountId),
        eq(memberSeat.kind, 'member'),
        isNull(memberSeat.leftAt),
        ne(memberSeat.clanId, clanMemberships.clanId),
      ),
    )
    .innerJoin(memberClan, eq(memberClan.id, memberSeat.clanId))
    .where(
      and(
        eq(accounts.playerId, playerId),
        eq(clanMemberships.kind, 'guest'),
        // The in-game roster put them there: a guest by the rule, not by choice.
        eq(clanMemberships.source, 'roster'),
        isNull(clanMemberships.leftAt),
      ),
    );
  // Settled ones stay settled: a member seat the player CHOSE here is not re-asked about every time
  // the other clan's roster lists them again (which it will — they are still a guest there).
  const memberSeatIds = [...new Set(rows.map((r) => r.memberSeatId))];
  const chosen = memberSeatIds.length
    ? await db
        .select({ seatId: clanAuditLog.clanMemberId })
        .from(clanAuditLog)
        .where(and(inArray(clanAuditLog.clanMemberId, memberSeatIds), eq(clanAuditLog.eventType, 'member_chose_this_clan')))
    : [];
  const settled = new Set(chosen.map((c) => c.seatId));

  return rows.filter((r) => !settled.has(r.memberSeatId)).map((r) => ({
    accountId: r.accountId,
    rsn: r.rsn,
    member: { seatId: r.memberSeatId, clanId: r.memberClanId, name: r.memberClanName, slug: r.memberClanSlug },
    listedBy: { seatId: r.guestSeatId, clanId: r.guestClanId, name: r.guestClanName, slug: r.guestClanSlug },
  }));
}

/**
 * Make the clan behind `seatId` this character's home: that seat becomes the member one, the other
 * clan's becomes a guest seat. Only the person's OWN character, and only a conflict as defined above.
 *
 * Stable against both rosters afterwards: the clan that lost them now holds a guest seat it cannot
 * promote while they are a member here, and this clan's sync finds a member already in place.
 */
export async function chooseHomeClan(playerId: number, seatId: number, actorUserId: number | null): Promise<boolean> {
  const conflict = (await membershipConflicts(playerId)).find((c) => c.listedBy.seatId === seatId);
  if (!conflict) return false;

  // One transaction, audit included: the 'member_chose_this_clan' row is what keeps the choice from
  // being asked again (membershipConflicts), so it must not be a best-effort write.
  await db.transaction(async (tx) => {
    // Demote first: the one-member-seat index would refuse the promotion while both are members.
    await tx.update(clanMemberships).set({ kind: 'guest' }).where(eq(clanMemberships.id, conflict.member.seatId));
    await tx.update(clanMemberships).set({ kind: 'member' }).where(eq(clanMemberships.id, conflict.listedBy.seatId));
    await tx.insert(clanAuditLog).values([
      {
        clanId: conflict.member.clanId,
        clanMemberId: conflict.member.seatId,
        eventType: 'member_left_for_another_clan',
        actorUserId,
        newValue: JSON.stringify({ nowMemberOf: conflict.listedBy.clanId, via: 'player' }),
        notes: 'the player chose another clan as their home',
      },
      {
        clanId: conflict.listedBy.clanId,
        clanMemberId: conflict.listedBy.seatId,
        eventType: 'member_chose_this_clan',
        actorUserId,
        newValue: JSON.stringify({ previouslyMemberOf: conflict.member.clanId }),
      },
    ]);
  });
  return true;
}

/**
 * Release a clan's ROSTER memberships — every member seat its in-game sync made becomes a guest
 * seat. For platform staff withdrawing a clan's verification in a dispute: a clan that was not who it
 * said it was must not keep holding the members it synced, or the real clan's roster can only ever
 * seat them as guests. The real clan's next sync promotes them.
 */
export async function releaseRosterMemberships(clanId: number, actorUserId: number | null): Promise<number> {
  const seats = await db
    .select({ id: clanMemberships.id })
    .from(clanMemberships)
    .where(
      and(
        eq(clanMemberships.clanId, clanId),
        eq(clanMemberships.kind, 'member'),
        eq(clanMemberships.source, 'roster'),
        isNull(clanMemberships.leftAt),
      ),
    );
  if (seats.length === 0) return 0;
  await db.update(clanMemberships).set({ kind: 'guest' }).where(inArray(clanMemberships.id, seats.map((s) => s.id)));
  await db
    .insert(clanAuditLog)
    .values({
      clanId,
      eventType: 'roster_memberships_released',
      actorUserId,
      newValue: JSON.stringify({ seats: seats.length }),
      notes: 'verification withdrawn by platform staff',
    })
    .catch(() => {});
  return seats.length;
}
