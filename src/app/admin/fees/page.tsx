import { db } from '@/db';
import { clanHref } from '@/lib/clanPath';
import { requireClan } from '@/lib/clanContext';
import { events, eventSignups, signupFees } from '@/db/schema';
import { and, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import ClanLink from '@/components/ClanLink';
import { verifyAdminOrModerator } from '@/lib/auth';
import { getRequiredConfirmations } from '@/lib/feeConfirmations';
import { eventStage } from '@/lib/eventStage';
import FeesBoardList, { type FeeBoard } from './FeesBoardList';

export const dynamic = 'force-dynamic';

/**
 * Where the money is, across every board.
 *
 * The standalone fee queue was retired when fees moved onto each event's Sign-ups tab — and this
 * route became a redirect to the events list. That left the dashboard's own "Fees to collect →"
 * pointing at a page of boards with no fee information on it, so the one question it raised ("which
 * board, and what do I do about it?") had no answer anywhere. On a two-month-old bingo that meant
 * opening events one at a time looking for the one still holding fees.
 *
 * So it's a page again, but a different one: not a list of fees, a list of BOARDS that still owe
 * something, each with the two things you can do about it — open its Sign-ups tab, or (once the
 * event is over) close its ledger out in one action.
 */
export default async function AdminFeesPage() {
  const session = await verifyAdminOrModerator();
  if (!session) redirect(await clanHref('/admin'));

  // Resolved before the ledger query, which is now scoped by it.
  const clan = await requireClan();

  // One row per (event, status). Withdrawn and rejected sign-ups are excluded the same way every
  // other fee surface excludes them: nothing was collected and nobody is chasing it.
  const rows = await db
    .select({
      eventId: events.id,
      name: events.name,
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
      status: signupFees.status,
      c: sql<number>`count(*)`,
      gp: sql<number>`coalesce(sum(${signupFees.amount}), 0)`,
    })
    .from(signupFees)
    .innerJoin(eventSignups, eq(signupFees.signupId, eventSignups.id))
    .innerJoin(events, eq(eventSignups.eventId, events.id))
    .where(
      and(
        // This clan's ledger. Unscoped, the overview totalled every clan's outstanding fees.
        eq(events.clanId, clan.id),
        inArray(signupFees.status, ['pending', 'reported', 'collected', 'disputed']),
        notInArray(eventSignups.status, ['withdrawn', 'rejected']),
      ),
    )
    .groupBy(events.id, signupFees.status);

  const now = new Date().getTime();
  const byEvent = new Map<number, FeeBoard>();
  for (const r of rows) {
    const board =
      byEvent.get(r.eventId) ??
      ({
        eventId: r.eventId,
        name: r.name,
        // 'wrap' is the only stage where closing out is offered: while a board runs, an unpaid fee
        // is a debt someone is still chasing.
        ended: eventStage(r, now) === 'wrap',
        endDate: r.forceEndedAt ?? r.endDate,
        unpaid: 0,
        toSign: 0,
        disputed: 0,
        outstandingGp: 0,
      } satisfies FeeBoard);
    if (r.status === 'collected') board.toSign += r.c;
    else if (r.status === 'disputed') board.disputed += r.c;
    else board.unpaid += r.c;
    // Money nobody has yet — a collected fee is already in someone's hands, so it isn't outstanding.
    if (r.status !== 'collected') board.outstandingGp += r.gp;
    byEvent.set(r.eventId, board);
  }

  // Ended boards first, oldest end date first: the stale ledgers are the ones nobody comes back to.
  const boards = [...byEvent.values()].sort(
    (a, b) =>
      Number(b.ended) - Number(a.ended) ||
      (a.endDate ?? '').localeCompare(b.endDate ?? '') ||
      a.name.localeCompare(b.name),
  );

  const required = await getRequiredConfirmations(clan.id);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
        <span className="w-1 h-6 bg-gold rounded-full" />
        Fees
      </h1>
      <p className="text-sm text-text-muted mb-5">
        Every board still holding money, and what to do about it. Collecting happens on a board&apos;s
        own Sign-ups tab — this is the list that says which board to open.
      </p>

      <div className="mb-5 rounded-xl border border-card-border bg-card-bg px-4 py-3 text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-text-muted">Settling a paid fee takes</span>
        <span className="font-semibold text-foreground">
          {required === 0
            ? 'no second signature'
            : `${required} confirmation${required === 1 ? '' : 's'}`}
        </span>
        <span className="text-text-muted">
          {required === 0
            ? '— marking a fee paid settles it outright.'
            : '— from someone other than whoever collected it.'}
        </span>
        <ClanLink
          href="/admin/integrations?tab=fees"
          className="ml-auto text-xs font-medium text-gold hover:underline underline-offset-2"
        >
          Change this →
        </ClanLink>
      </div>

      <FeesBoardList boards={boards} viewerRole={session.role} />
    </div>
  );
}
