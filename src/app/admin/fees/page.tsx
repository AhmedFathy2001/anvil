import { requireFeature } from '@/lib/clanFeatures';
import { db } from '@/db';
import { clanHref } from '@/lib/clanPath';
import { requireClan } from '@/lib/clanContext';
import { events, eventSignups, signupFees, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { and, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import ClanLink from '@/components/ClanLink';
import { verifyFeeCollector } from '@/lib/auth';
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
  // Treasurer or admin, as collecting on its API is (verifyFeeCollector) — a moderator cannot act on
  // anything here, so the page is not theirs either. Same gate as the coffer.
  const session = await verifyFeeCollector();
  if (!session) redirect(await clanHref('/admin'));

  // Resolved before the ledger query, which is now scoped by it.
  const clan = await requireClan();
  await requireFeature(clan.id, 'fees', '/admin/dashboard');

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
    const stage = eventStage(r, now);
    const board =
      byEvent.get(r.eventId) ??
      ({
        eventId: r.eventId,
        name: r.name,
        stage,
        // 'wrap' is the only stage where closing out is offered: while a board runs, an unpaid fee
        // is a debt someone is still chasing.
        ended: stage === 'wrap',
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

  // Competitions with entry fees still open (lib/weeklySignups): owed, or collected and waiting for
  // its confirmation. Collecting happens on each competition's Participants page.
  const compRows = await db
    .select({
      id: weeklyCompetitions.id,
      title: weeklyCompetitions.title,
      status: weeklyCompetitions.status,
      feeStatus: weeklyParticipants.feeStatus,
      c: sql<number>`count(*)`,
      gp: sql<number>`coalesce(sum(${weeklyParticipants.feeAmount}), 0)`,
    })
    .from(weeklyParticipants)
    .innerJoin(weeklyCompetitions, eq(weeklyParticipants.competitionId, weeklyCompetitions.id))
    .where(and(eq(weeklyCompetitions.clanId, clan.id), inArray(weeklyParticipants.feeStatus, ['pending', 'collected'])))
    .groupBy(weeklyCompetitions.id, weeklyParticipants.feeStatus);
  const comps = new Map<number, { id: number; title: string; status: string; owes: number; owedGp: number; toConfirm: number }>();
  for (const r of compRows) {
    const c = comps.get(r.id) ?? { id: r.id, title: r.title, status: r.status, owes: 0, owedGp: 0, toConfirm: 0 };
    if (r.feeStatus === 'pending') {
      c.owes += Number(r.c);
      c.owedGp += Number(r.gp);
    } else c.toConfirm += Number(r.c);
    comps.set(r.id, c);
  }
  const competitions = [...comps.values()].sort((a, b) => Number(b.status === 'completed') - Number(a.status === 'completed') || a.title.localeCompare(b.title));

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
          href="/admin/rules#fees"
          className="ml-auto text-xs font-medium text-gold hover:underline underline-offset-2"
        >
          Change this →
        </ClanLink>
      </div>

      <FeesBoardList boards={boards} viewerRole={session.role} />

      {competitions.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
            <span className="h-5 w-1 rounded-full bg-gold" />
            Competition entry fees
          </h2>
          <p className="mb-3 text-sm text-text-muted">Competitions people signed up for with an entry fee. Open one to mark fees collected, confirm them or remind who owes.</p>
          <ul className="space-y-2">
            {competitions.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-card-border bg-card-bg px-4 py-3">
                <div className="min-w-0">
                  <span className="font-medium">{c.title}</span>
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${c.status === 'completed' ? 'bg-card-border/70 text-text-muted' : c.status === 'active' ? 'bg-accent-green/15 text-accent-green-light' : 'bg-gold/10 text-gold'}`}>
                    {c.status === 'completed' ? 'Ended' : c.status === 'active' ? 'Running' : 'Upcoming'}
                  </span>
                  <p className="mt-0.5 text-sm text-text-muted">
                    {c.owes > 0 && <span className="text-amber-300">{c.owes} {c.owes === 1 ? 'owes' : 'owe'} · {c.owedGp.toLocaleString()} gp</span>}
                    {c.owes > 0 && c.toConfirm > 0 && ' · '}
                    {c.toConfirm > 0 && <span className="text-sky-300">{c.toConfirm} to confirm</span>}
                  </p>
                </div>
                <ClanLink href={`/admin/events/weekly/${c.id}/participants`} className="text-sm font-medium text-gold underline-offset-2 hover:underline">
                  Open its fees →
                </ClanLink>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
