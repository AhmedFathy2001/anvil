import { notFound } from 'next/navigation';
import { requireClan } from '@/lib/clanContext';
import { getWeeklyRow, getWeeklyStandings } from '@/lib/weeklyWorkspace';
import WeeklyRosterClient from '../WeeklyRosterClient';

export const dynamic = 'force-dynamic';

export default async function WeeklyBaselinesPage({ params }: { params: Promise<{ weeklyId: string }> }) {
  const { weeklyId } = await params;
  const id = parseInt(weeklyId, 10);

  // Whose competition is this? The id came from the URL.
  const clan = await requireClan();
  const comp = await getWeeklyRow(clan.id, id);
  if (!comp) notFound();

  const standings = await getWeeklyStandings(id);

  return <WeeklyRosterClient competitionId={id} type={comp.type} standings={standings} mode="baselines" />;
}
