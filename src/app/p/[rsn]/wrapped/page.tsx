import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { apexCharacter } from '@/lib/apexProfiles';
import { verifyUser } from '@/lib/auth';
import { isApexHost } from '@/lib/clanContext';
import { monthsWithData } from '@/lib/monthlyWrapped';
import { monthKeyOf } from '@/lib/monthlyWrappedRules';

export const dynamic = 'force-dynamic';

/** /p/<rsn>/wrapped → their latest month with anything tracked, else this month. */
export default async function MonthlyWrappedIndex({ params }: { params: Promise<{ rsn: string }> }) {
  if (!isApexHost((await headers()).get('host'))) notFound();
  const session = await verifyUser();
  const character = await apexCharacter(decodeURIComponent((await params).rsn), session?.playerId ?? null);
  if (!character) notFound();
  const months = await monthsWithData(character.accountId);
  redirect(`/p/${encodeURIComponent(character.rsn)}/wrapped/${months[0] ?? monthKeyOf(new Date())}`);
}
