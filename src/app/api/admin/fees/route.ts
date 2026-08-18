import { NextResponse } from 'next/server';
import { requireClanFromRequest } from '@/lib/clanContext';
import { db } from '@/db';
import { clanRoster, eventSignups, events, signupFees, users } from '@/db/schema';
import { alias } from 'drizzle-orm/pg-core';
import { and, desc, eq, inArray, not } from 'drizzle-orm';
import { verifyAdminOrModerator } from '@/lib/auth';

// Cross-event fee queue. Visible to admins and treasurers (mods read-only). Filters:
//   ?status=pending|reported|collected|disputed|confirmed|open  (open = anything not confirmed)
//   ?eventId=<n>
export async function GET(request: Request) {
  const session = await verifyAdminOrModerator();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Being an admin of one clan confers nothing in another, and this is a ledger of who owes and
  // who collected — so it is scoped to the clan whose host asked, not to the asker's role.
  const clan = await requireClanFromRequest(request);
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const eventIdParam = url.searchParams.get('eventId');

  // Two aliases for users so we can join the same table once for the player and once
  // for the collector — Drizzle won't let us reuse the bare table for both.
  const player = alias(users, 'player_user');
  const collector = alias(users, 'collector_user');
  const reporter = alias(users, 'reporter_user');

  const filters = [eq(events.clanId, clan.id)];
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
    .innerJoin(player, eq(eventSignups.userId, player.id))
    .innerJoin(clanRoster, eq(eventSignups.clanMemberId, clanRoster.id))
    .leftJoin(collector, eq(signupFees.collectedByUserId, collector.id))
    .leftJoin(reporter, eq(signupFees.reportedCollectorUserId, reporter.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(signupFees.id));

  return NextResponse.json({ fees: rows });
}
