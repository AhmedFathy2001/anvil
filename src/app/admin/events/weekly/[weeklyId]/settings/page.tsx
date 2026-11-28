import WeeklySignupPanel from '../WeeklySignupPanel';
import WeeklyTargetPanel from '../WeeklyTargetPanel';
import { competitionNotStarted } from '@/lib/competitionTeamsDb';
import { huntFormFromConfig } from '@/lib/huntForm';
import RushDeathsPanel from '../RushDeathsPanel';
import HuntSettingsPanel from '../HuntSettingsPanel';
import { huntRows, isRush, parseHunt } from '@/lib/itemHunt';
import { getEffectiveParticipants } from '@/lib/weekly';
import { notFound } from 'next/navigation';

import { requireClan } from '@/lib/clanContext';
import { getWeeklyRow } from '@/lib/weeklyWorkspace';
import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import WeeklySettingsPanel, { WeeklyGamePanel } from '../WeeklySettingsPanel';
import { WeeklyPingPanel } from '@/components/weekly/CompetitionPingFields';
import { getSetting } from '@/lib/settings';
import { getCofferBalance } from '@/lib/coffer';
import { HCW_COFFER_SETTING_KEY } from '@/lib/competitionGame';
import { parseStamp } from '@/lib/dbTime';
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
  // "Paid in" is only offered where the clan keeps a Hardcore Worlds coffer; then both pots' balances.
  const hcwCoffer = (await getSetting(clan.id, HCW_COFFER_SETTING_KEY)) === '1';
  const pots = hcwCoffer
    ? await Promise.all([getCofferBalance(clan.id, 'gp'), getCofferBalance(clan.id, 'hcw')]).then(([main, hcw]) => ({ mainAvailable: main.available, hcwAvailable: hcw.available }))
    : null;
  // The API's own rule for changing the game: the start is still ahead (or not set).
  const start = parseStamp(comp.startDate);
  const beforeStart = start === null || start > Date.now();
  // "SOTW: Agility" → "Agility", for the rotation sentence.
  const rotationLabels = (repeat?.rotation ?? []).map((m) => defaultWeeklyTitle(comp.type, m).split(': ').slice(1).join(': '));

  return (
    <>
    {competitionNotStarted(comp) && (
      <WeeklyTargetPanel competitionId={comp.id} type={comp.type} metric={comp.metric} hunt={hunt ? huntFormFromConfig(hunt) : null} />
    )}
    <WeeklySignupPanel competitionId={comp.id} selfSignup={comp.selfSignup} entryFee={comp.entryFee} feesToPrizes={comp.feesToPrizes} feeGatesPrize={comp.feeGatesPrize} ended={comp.status === 'completed'} canSetFee={atLeast(session?.role, 'treasurer')} />
    {hunt && (
      <HuntSettingsPanel
        competitionId={comp.id}
        initial={{ ends: hunt.ends, confirm: hunt.confirm }}
        finished={comp.status === 'completed'}
        rowCount={huntRows(hunt).length}
        rush={
          isRush(hunt)
            ? {
                rules: hunt.rush,
                repeat: hunt.repeat === 'first' ? 'first' : 'every',
                items: hunt.items.map((it) => ({ id: it.id, name: it.name, points: it.points ?? 0, once: !!it.once, first: !!it.first })),
                entrants: (await getEffectiveParticipants(comp.id)).map((p) => ({ id: p.id, rsn: p.rsn })),
              }
            : null
        }
      />
    )}
    {hunt && isRush(hunt) && <RushDeathsPanel competitionId={comp.id} />}
    <WeeklyRepeatToggle competitionId={comp.id} initial={repeat} rotationLabels={rotationLabels} />
    <WeeklyGamePanel
      competitionId={comp.id}
      type={comp.type}
      countsOn={comp.countsOn}
      prizeCurrency={comp.prizeCurrency}
      beforeStart={beforeStart}
      pots={pots}
      canSetCurrency={atLeast(session?.role, 'treasurer')}
      settled={Boolean(comp.prizesSettledAt)}
    />
    <WeeklyPingPanel competitionId={comp.id} initial={{ roleId: comp.pingRoleId ?? '', onStart: comp.pingOnStart, onEnd: comp.pingOnEnd }} />
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
