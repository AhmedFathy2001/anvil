import { notFound } from 'next/navigation';
import { getWeeklyRow, getWeeklyStandings } from '@/lib/weeklyWorkspace';
import WeeklyRosterClient from '../WeeklyRosterClient';

export const dynamic = 'force-dynamic';

export default async function WeeklyParticipantsPage({ params }: { params: Promise<{ weeklyId: string }> }) {
  const { weeklyId } = await params;
  const id = parseInt(weeklyId, 10);

  const comp = await getWeeklyRow(id);
  if (!comp) notFound();

  const standings = await getWeeklyStandings(id);

  return <WeeklyRosterClient competitionId={id} type={comp.type} standings={standings} mode="participants" />;
}
