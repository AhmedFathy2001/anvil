import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { apexCharacter } from '@/lib/apexProfiles';
import { verifyUser } from '@/lib/auth';
import { isApexHost } from '@/lib/clanContext';
import { monthsWithData } from '@/lib/monthlyWrapped';
import { wrappedIsOpen } from '@/lib/monthlyWrappedRules';

export const dynamic = 'force-dynamic';

/**
 * /p/<rsn>/wrapped → this year's Wrapped once it's out (1 December), else their latest finished
 * month, else this year's page (which says when it comes out, and previews it for the owner).
 */
export default async function MonthlyWrappedIndex({ params }: { params: Promise<{ rsn: string }> }) {
  if (!isApexHost((await headers()).get('host'))) notFound();
  const session = await verifyUser();
  const character = await apexCharacter(decodeURIComponent((await params).rsn), session?.playerId ?? null);
  if (!character) notFound();
  const months = await monthsWithData(character.accountId);
  const year = String(new Date().getUTCFullYear());
  const target = wrappedIsOpen(year) ? year : months[0] ?? year;
  redirect(`/p/${encodeURIComponent(character.rsn)}/wrapped/${target}`);
}
