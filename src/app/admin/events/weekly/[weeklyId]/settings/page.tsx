import WeeklySignupPanel from '../WeeklySignupPanel';
import WeeklyTargetPanel from '../WeeklyTargetPanel';
import { competitionNotStarted } from '@/lib/competitionTeamsDb';
import { huntFormFromConfig } from '@/lib/huntForm';
import HuntSettingsPanel from '../HuntSettingsPanel';
import { parseHunt } from '@/lib/itemHunt';
import { notFound } from 'next/navigation';

import { requireClan } from '@/lib/clanContext';
import { getWeeklyRow } from '@/lib/weeklyWorkspace';
import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import WeeklySettingsPanel from '../WeeklySettingsPanel';
import WeeklyRepeatToggle from '../WeeklyRepeatToggle';
import { getWeeklyRepeat } from '@/lib/weeklyRepeat';
import { defaultWeeklyTitle } from '@/lib/weeklyRepeatPlan';
import { idParam } from '@/lib/routeIds';

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
  const id = idParam(weeklyId);

  // Whose competition is this? The id came from the URL.
  const clan = await requireClan();
  const comp = await getWeeklyRow(clan.id, id);
  if (!comp) notFound();

  // An item hunt has two settings of its own: how it ends, and who confirms its drops.
  const hunt = comp.type === 'hunt' ? parseHunt(comp.hunt) : null;
  const session = await verifyUser();
  const repeat = await getWeeklyRepeat(clan.id, comp.id);
  // "SOTW: Agility" → "Agility", for the rotation sentence.
  const rotationLabels = (repeat?.rotation ?? []).map((m) => defaultWeeklyTitle(comp.type, m).split(': ').slice(1).join(': '));

  return (
    <>
    {competitionNotStarted(comp) && (
      <WeeklyTargetPanel competitionId={comp.id} type={comp.type} metric={comp.metric} hunt={hunt ? huntFormFromConfig(hunt) : null} />
    )}
    <WeeklySignupPanel competitionId={comp.id} selfSignup={comp.selfSignup} entryFee={comp.entryFee} feesToPrizes={comp.feesToPrizes} ended={comp.status === 'completed'} canSetFee={atLeast(session?.role, 'treasurer')} />
    {hunt && <HuntSettingsPanel competitionId={comp.id} initial={{ ends: hunt.ends, confirm: hunt.confirm }} finished={comp.status === 'completed'} />}
    <WeeklyRepeatToggle competitionId={comp.id} initial={repeat} rotationLabels={rotationLabels} />
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
    </>
  );
}
