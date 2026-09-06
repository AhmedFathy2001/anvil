import { notFound } from 'next/navigation';
import { requireClan } from '@/lib/clanContext';
import { getWeeklyCounts, getWeeklyRow, getWeeklyStandings } from '@/lib/weeklyWorkspace';
import { weeklyStage } from '@/lib/weeklyStage';
import { verifyFeeCollector } from '@/lib/auth';
import { getCofferBalance, clanHasCoffer } from '@/lib/coffer';
import { parseWeeklyPrizes } from '@/lib/weeklyPrizes';
import WeeklyHomeClient from './WeeklyHomeClient';

export const dynamic = 'force-dynamic';

export default async function WeeklyHomePage({ params }: { params: Promise<{ weeklyId: string }> }) {
  const { weeklyId } = await params;
  const id = parseInt(weeklyId, 10);

  // Whose competition is this? The id came from the URL.
  const clan = await requireClan();
  const comp = await getWeeklyRow(clan.id, id);
  if (!comp) notFound();

  const [standings, counts, balance, hasCoffer, feeCollector] = await Promise.all([
    getWeeklyStandings(id),
    getWeeklyCounts(id),
    getCofferBalance(clan.id),
    clanHasCoffer(clan.id),
    verifyFeeCollector(),
  ]);

  // The card is ALWAYS rendered. It used to hide itself when the clan had no coffer rows, which got
  // the audience exactly backwards: `clanHasCoffer` means "has moved gp at least once", so the only
  // people who saw the prize editor were the ones already using it, and a clan setting up its first
  // one found a page with nothing on it and no word about why. An empty coffer is a sentence to say,
  // not a control to withhold.
  const prizes = parseWeeklyPrizes(comp.prizes);

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
      prizes={{
        initial: prizes,
        cofferAvailable: balance.available,
        settledAt: comp.prizesSettledAt,
        canEdit: Boolean(feeCollector),
        hasCoffer,
      }}
    />
  );
}
