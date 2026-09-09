import { notFound } from 'next/navigation';

import { requireClan } from '@/lib/clanContext';
import { getWeeklyRow } from '@/lib/weeklyWorkspace';
import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import WeeklySettingsPanel from '../WeeklySettingsPanel';

export const dynamic = 'force-dynamic';

/**
 * A competition's own Settings tab — the counterpart to a board's.
 *
 * Renaming, re-dating and deleting used to be a modal on the retired /admin/weekly list. Everything
 * else about a competition already lived here, so changing its dates meant leaving the workspace,
 * finding it again in a second list, and editing it there.
 */
export default async function WeeklySettingsPage({ params }: { params: Promise<{ weeklyId: string }> }) {
  const { weeklyId } = await params;
  const id = parseInt(weeklyId, 10);

  // Whose competition is this? The id came from the URL.
  const clan = await requireClan();
  const comp = await getWeeklyRow(clan.id, id);
  if (!comp) notFound();

  const session = await verifyUser();

  return (
    <WeeklySettingsPanel
      comp={{
        id: comp.id,
        title: comp.title,
        startDate: comp.startDate,
        endDate: comp.endDate,
        status: comp.status,
      }}
      // A moderator schedules and runs competitions; throwing away the standings of one is a
      // different kind of act, and it is the same bar a board's delete sits behind.
      canDelete={atLeast(session?.role, 'admin')}
    />
  );
}
