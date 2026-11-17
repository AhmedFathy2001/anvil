import { competitionStat } from '@/lib/weeklyMetric';
import { metricKeys, weeklyMetricLabel } from '@/lib/constants';
import { notFound } from 'next/navigation';
import { requireClan } from '@/lib/clanContext';
import { getWeeklyRow, getWeeklyStandings } from '@/lib/weeklyWorkspace';
import WeeklyRosterClient from '../WeeklyRosterClient';
import { weeklyStartingStatsFor } from '@/lib/startingStats';
import { idParam } from '@/lib/routeIds';

export const dynamic = 'force-dynamic';

export default async function WeeklyBaselinesPage({ params }: { params: Promise<{ weeklyId: string }> }) {
  const { weeklyId } = await params;
  const id = idParam(weeklyId);

  // Whose competition is this? The id came from the URL.
  const clan = await requireClan();
  const comp = await getWeeklyRow(clan.id, id);
  if (!comp) notFound();

  const standings = await getWeeklyStandings(id);
  const startingStats = weeklyStartingStatsFor(comp, standings.map((s) => ({ id: s.participantId, baselineValue: s.baselineValue, lastUpdated: s.lastUpdated })));

  // A competition over several bosses or skills is corrected one boss at a time (the starting value
  // is their sum), so the page needs their names.
  const stat = competitionStat(comp);
  const keys = stat && stat.type !== 'efficiency' ? metricKeys(stat.metric) : [];
  const partKeys = stat && keys.length > 1 ? keys.map((key) => ({ key, label: weeklyMetricLabel(stat.type, key) || key })) : [];

  return <WeeklyRosterClient competitionId={id} type={stat?.type ?? 'boss'} standings={standings} startingStats={startingStats} mode="baselines" partKeys={partKeys} />;
}
