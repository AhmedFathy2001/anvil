import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, eventSignups, events, signupFees, users } from '@/db/schema';
import { alias } from 'drizzle-orm/sqlite-core';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { verifyAdminOrModerator } from '@/lib/auth';

// Cross-event fee queue. Visible to admins and treasurers (mods read-only). Filters:
//   ?status=pending|reported|collected|disputed|confirmed|open  (open = anything not confirmed)
//   ?eventId=<n>
export async function GET(request: Request) {
  const session = await verifyAdminOrModerator();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const eventIdParam = url.searchParams.get('eventId');

  // Two aliases for users so we can join the same table once for the player and once
  // for the collector — Drizzle won't let us reuse the bare table for both.
  const player = alias(users, 'player_user');
  const collector = alias(users, 'collector_user');
  const reporter = alias(users, 'reporter_user');

  const filters = [];
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
        id: clanMembers.id,
        rsn: clanMembers.rsn,
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
    .innerJoin(clanMembers, eq(eventSignups.clanMemberId, clanMembers.id))
    .leftJoin(collector, eq(signupFees.collectedByUserId, collector.id))
    .leftJoin(reporter, eq(signupFees.reportedCollectorUserId, reporter.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(signupFees.id));

  return NextResponse.json({ fees: rows });
}
