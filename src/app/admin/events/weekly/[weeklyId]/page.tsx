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

  // The prize card only appears for a clan that runs a coffer, or one that has already promised
  // something on this competition. A clan with no ledger has no gp to pay from, and offering the
  // control anyway is how a host sets a ladder that can never be funded.
  const prizes = parseWeeklyPrizes(comp.prizes);
  const showPrizes = hasCoffer || prizes.places.length > 0;

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
      prizes={
        showPrizes
          ? {
              initial: prizes,
              cofferAvailable: balance.available,
              settledAt: comp.prizesSettledAt,
              canEdit: Boolean(feeCollector),
            }
          : null
      }
    />
  );
}
