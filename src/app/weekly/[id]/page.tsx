import { db } from '@/db';
import { weeklyCompetitions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import LiveRefresher from '@/components/LiveRefresher';
import { verifyUser } from '@/lib/auth';
import { buildCompetitionView, viewerMemberIds } from '@/lib/competitionView';
import { competitionIconUrl } from '@/lib/tileIcons';
import CompetitionHero from '@/components/weekly/CompetitionHero';
import { RaceChart, DayStrip, TrainingHeatmap } from '@/components/weekly/CompetitionWeek';
import { Board, Podium, SidePanels, YouStrip } from '@/components/weekly/CompetitionBoard';

export const dynamic = 'force-dynamic';

/**
 * A competition week.
 *
 * This used to be a three-column table: rank, name, total. That's the one thing the Discord post
 * already tells everyone, so there was no reason to open the page twice. The week's shape — who
 * moved on which day, who is on a streak, whether the clan is beating its last run at this metric —
 * comes from `member_daily_stats`, which the sweep already writes, so all of it is a read.
 */
export default async function WeeklyLeaderboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const compId = parseInt(id, 10);

  const [competition] = await db.select().from(weeklyCompetitions).where(eq(weeklyCompetitions.id, compId));
  if (!competition) notFound();

  const session = await verifyUser();
  const myMemberIds = await viewerMemberIds(session?.userId ?? null);
  const view = await buildCompetitionView(competition, myMemberIds);

  const leader = view.entries[0]?.gained > 0
    ? {
        rsn: view.entries[0].rsn,
        gained: view.entries[0].gained,
        margin: view.entries[0].gained - (view.entries[1]?.gained ?? 0),
      }
    : null;
  // Everything day-shaped hangs off history the sweep writes. A competition from before that (or a
  // guest-only board) still ranks fine — it just shows the board without the week around it. So does
  // one whose history is too thin to be honest about: a partial account isn't a rough version of the
  // week, it's a biased one, and drawing it puts the leader underneath people he's beating.
  const showDaily = view.trust === 'ok';

  return (
    <div>
      <LiveRefresher url={`/api/weekly/${compId}/pulse`} />

      <Link href="/weekly" className="mb-3 inline-block text-sm text-text-muted transition-colors hover:text-gold">
        ← All competitions
      </Link>

      <CompetitionHero
        title={competition.title}
        type={view.type}
        metricLabel={view.metricLabel}
        unit={view.unit}
        status={competition.status}
        startDate={competition.startDate}
        endDate={competition.endDate}
        iconUrl={competitionIconUrl(competition.type, competition.metric)}
        clanTotal={view.clanTotal}
        todayTotal={view.todayTotal}
        scoring={view.scoring}
        entered={view.entries.length}
        leader={leader}
        projected={view.projected}
        previous={view.previous}
        elapsed={view.elapsed}
        totalDays={view.days.length}
      />

      {view.me && <YouStrip me={view.me} type={view.type} unit={view.unit} elapsed={view.elapsed} />}

      <Podium entries={view.entries} days={view.days} elapsed={view.elapsed} type={view.type} unit={view.unit} />

      <div className="grid items-start gap-7 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="min-w-0">
          {showDaily ? (
            <>
              <RaceChart
                entries={view.entries}
                days={view.days}
                elapsed={view.elapsed}
                type={view.type}
                unit={view.unit}
                clanTotal={view.clanTotal}
                trackedTotal={view.trackedTotal}
              />
              <DayStrip
                days={view.days}
                elapsed={view.elapsed}
                totals={view.dailyTotals}
                leaders={view.dailyLeaders}
                entries={view.entries}
                type={view.type}
                unit={view.unit}
              />
              <TrainingHeatmap
                entries={view.entries}
                days={view.days}
                elapsed={view.elapsed}
                verb={view.verb}
                type={view.type}
              />
            </>
          ) : (
            <DailyUnavailable trust={view.trust} coverage={view.coverage} />
          )}
        </div>

        <div className="min-w-0">
          <Board
            entries={view.entries}
            elapsed={view.elapsed}
            type={view.type}
            unit={view.unit}
            showDaily={showDaily}
          />
          <SidePanels milestones={view.milestones} records={view.records} />
        </div>
      </div>
    </div>
  );
}
