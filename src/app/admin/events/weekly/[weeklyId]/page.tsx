import { notFound } from 'next/navigation';
import { getWeeklyCounts, getWeeklyRow, getWeeklyStandings } from '@/lib/weeklyWorkspace';
import { weeklyStage } from '@/lib/weeklyStage';
import WeeklyHomeClient from './WeeklyHomeClient';

export const dynamic = 'force-dynamic';

export default async function WeeklyHomePage({ params }: { params: Promise<{ weeklyId: string }> }) {
  const { weeklyId } = await params;
  const id = parseInt(weeklyId, 10);

  const comp = await getWeeklyRow(id);
  if (!comp) notFound();

  const [standings, counts] = await Promise.all([getWeeklyStandings(id), getWeeklyCounts(id)]);

  return (
    <WeeklyHomeClient
      comp={{
        id: comp.id,
        title: comp.title,
        type: comp.type,
        metric: comp.metric,
        startDate: comp.startDate,
        endDate: comp.endDate,
        status: comp.status,
      }}
      stage={weeklyStage(comp)}
      standings={standings}
      counts={counts}
    />
  );
}
