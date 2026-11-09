import { alias } from 'drizzle-orm/pg-core';
import { and, desc, eq, inArray, not } from 'drizzle-orm';
import { db } from '@/db';
import { clanRoster, eventSignups, events, signupFees, users } from '@/db/schema';
import { selfMarkedFeeIds } from '@/lib/feeConfirmations';

/** One clan's fee ledger. Payer is a left join: sign-ups with no login (added on someone's behalf,
 *  or an unclaimed roster seat) still appear, named by their roster character. */
export async function listClanFees(clanId: number, status: string | null, eventIdParam: string | null) {
  // Two aliases for users so we can join the same table once for the player and once
  // for the collector — Drizzle won't let us reuse the bare table for both.
  const player = alias(users, 'player_user');
  const collector = alias(users, 'collector_user');
  const reporter = alias(users, 'reporter_user');

  const filters = [eq(events.clanId, clanId)];
  // A still-pending (untouched) fee whose sign-up was withdrawn or rejected is dead money —
  // nothing was collected and the player is out. Withdrawal/rejection is supposed to delete
  // it, but stale rows from before that logic (and the reject path, which doesn't delete)
  // can linger and pollute the Open queue as a phantom "collect me". Hide them everywhere;
  // a *touched* fee (collected/disputed/confirmed) is kept so its refund trail stays visible.
  // 'reported' counts as untouched too: the player claims they paid, but no mod ever confirmed
  // receiving anything, so a withdrawn/rejected sign-up leaves exactly the same phantom "collect me"
  // as a pending one. Only a TOUCHED fee (collected/disputed/confirmed) survives here, so its refund
  // trail stays visible.
  filters.push(
    not(
      and(
        inArray(signupFees.status, ['pending', 'reported']),
        inArray(eventSignups.status, ['withdrawn', 'rejected']),
      )!,
    ),
  );
  if (status) {
    if (status === 'open') {
      filters.push(inArray(signupFees.status, ['pending', 'reported', 'collected', 'disputed']));
    } else if (['pending', 'reported', 'collected', 'disputed', 'confirmed'].includes(status)) {
      filters.push(eq(signupFees.status, status));
    }
  }
  if (eventIdParam) {
    const eventId = parseInt(eventIdParam, 10);
    if (Number.isFinite(eventId)) filters.push(eq(eventSignups.eventId, eventId));
  }

  const rows = await db
    .select({
      fee: signupFees,
      signup: {
        id: eventSignups.id,
        status: eventSignups.status,
        signedUpAt: eventSignups.signedUpAt,
      },
      event: {
        id: events.id,
        name: events.name,
        startDate: events.startDate,
      },
      player: {
        id: player.id,
        displayName: player.displayName,
        discordUsername: player.discordUsername,
      },
      account: {
        id: clanRoster.id,
        rsn: clanRoster.rsn,
      },
      collector: {
        id: collector.id,
        displayName: collector.displayName,
        role: collector.role,
      },
      reportedCollector: {
        id: reporter.id,
        displayName: reporter.displayName,
        role: reporter.role,
      },
    })
    .from(signupFees)
    .innerJoin(eventSignups, eq(signupFees.signupId, eventSignups.id))
    .innerJoin(events, eq(eventSignups.eventId, events.id))
    .leftJoin(player, eq(eventSignups.userId, player.id))
    .leftJoin(clanRoster, eq(eventSignups.clanMemberId, clanRoster.id))
    .leftJoin(collector, eq(signupFees.collectedByUserId, collector.id))
    .leftJoin(reporter, eq(signupFees.reportedCollectorUserId, reporter.id))
    // THIS CLAN'S money. `filters` only ever carried a status and an optional event id from the
    // query string, so the ledger returned every clan's fees — amounts, payer names through the
    // clanRoster join, and who collected them. The events join is what carries the clan, which is
    // why the rule could not see it until it learned to watch joins.
    .where(and(eq(events.clanId, clanId), ...(filters.length > 0 ? [and(...filters)] : [])))
    .orderBy(desc(signupFees.id));

  // "Self-marked": the collector is the fee's own owner (lib/feeConfirmations). Allowed, never hidden.
  const self = await selfMarkedFeeIds(rows.map((r) => ({ id: r.fee.id, signupId: r.fee.signupId, collectedByUserId: r.fee.collectedByUserId })));
  // A sign-up with no login (an admin added them on someone's behalf, or the seat was never claimed)
  // has no payer user: name the payer by the character on the roster seat instead of dropping the fee.
  return {
    fees: rows.map((r) => ({
      ...r,
      player: {
        id: r.player?.id ?? null,
        displayName: r.player?.displayName ?? r.account?.rsn ?? 'Unknown player',
        discordUsername: r.player?.discordUsername ?? null,
      },
      account: { id: r.account?.id ?? 0, rsn: r.account?.rsn ?? '' },
      selfMarked: self.has(r.fee.id),
    })),
  };
}
