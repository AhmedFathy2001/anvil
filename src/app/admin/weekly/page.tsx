import { requireClan } from '@/lib/clanContext';
import { verifyFeeCollector } from '@/lib/auth';
import { clanHasCoffer, getCofferBalance } from '@/lib/coffer';
import WeeklyManagementClient from './WeeklyManagementClient';

export const dynamic = 'force-dynamic';

export default async function WeeklyPage() {
  // The create form offers a prize ladder, which needs three facts the client cannot ask for
  // itself: what the coffer holds, whether it has ever held anything, and whether this person is
  // allowed to spend it. A moderator schedules competitions; only a treasurer prices them.
  const clan = await requireClan();
  const [balance, hasCoffer, feeCollector] = await Promise.all([
    getCofferBalance(clan.id),
    clanHasCoffer(clan.id),
    verifyFeeCollector(),
  ]);

  return (
    <WeeklyManagementClient
      cofferAvailable={balance.available}
      hasCoffer={hasCoffer}
      canSetPrizes={Boolean(feeCollector)}
    />
  );
}
