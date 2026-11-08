import { notFound } from 'next/navigation';

import { loadMoney } from '@/lib/money';
import { requireOwnerPage } from '@/lib/ownerAccess';
import { listTrials } from '@/lib/ownerTrials';
import MoneyClient from './MoneyClient';

export const dynamic = 'force-dynamic';

/**
 * What Anvil earns and the trials in the pipeline. OWNER ONLY (users.is_owner): root and below get the
 * same 404 as a path that does not exist, and the same data is behind /api/staff/money/*, each
 * route guarded by requireOwnerApi. Read from stored rows only; no Gumroad call on load.
 */
export default async function StaffMoneyPage() {
  const actor = await requireOwnerPage();
  if (!actor) notFound();
  const [money, trials] = await Promise.all([loadMoney(), listTrials()]);
  return <MoneyClient money={JSON.parse(JSON.stringify(money))} trials={JSON.parse(JSON.stringify(trials))} />;
}
