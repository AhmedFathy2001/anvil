import { competitionStat } from '@/lib/weeklyMetric';
import { notFound } from 'next/navigation';
import { requireClan } from '@/lib/clanContext';
import { getWeeklyRow, getWeeklyStandings } from '@/lib/weeklyWorkspace';
import WeeklyRosterClient from '../WeeklyRosterClient';
import WeeklyFeesPanel from '../WeeklyFeesPanel';
import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import { weeklyStartingStatsFor } from '@/lib/startingStats';
import { idParam } from '@/lib/routeIds';

export const dynamic = 'force-dynamic';

export default async function WeeklyParticipantsPage({ params }: { params: Promise<{ weeklyId: string }> }) {
  const { weeklyId } = await params;
  const id = idParam(weeklyId);

  // Whose competition is this? The id came from the URL.
  const clan = await requireClan();
  const comp = await getWeeklyRow(clan.id, id);
  if (!comp) notFound();

  const standings = await getWeeklyStandings(id);
  const startingStats = weeklyStartingStatsFor(comp, standings.map((s) => ({ id: s.participantId, baselineValue: s.baselineValue, lastUpdated: s.lastUpdated })));

  const session = await verifyUser();
  return (
    <>
      <WeeklyFeesPanel competitionId={id} canCollect={atLeast(session?.role, 'treasurer')} canConfirm={atLeast(session?.role, 'admin')} />
      <WeeklyRosterClient competitionId={id} type={competitionStat(comp)?.type ?? 'boss'} standings={standings} startingStats={startingStats} mode="participants" includeGuests={comp.includeGuests === 1} selectedOnly={comp.hostEntrants === 'selected'} />
    </>
  );
}
