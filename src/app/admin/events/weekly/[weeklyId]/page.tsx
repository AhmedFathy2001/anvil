import { notFound } from 'next/navigation';
import { requireClan } from '@/lib/clanContext';
import { getWeeklyCounts, getWeeklyRow, getWeeklyStandings } from '@/lib/weeklyWorkspace';
import { weeklyStage } from '@/lib/weeklyStage';
import { verifyFeeCollector } from '@/lib/auth';
import { getCofferBalance, clanHasCoffer, getWeeklyPool } from '@/lib/coffer';
import { parseWeeklyPrizes } from '@/lib/weeklyPrizes';
import WeeklyHomeClient from './WeeklyHomeClient';
import HuntAdminClient, { type HuntAttention } from './HuntAdminClient';
import { huntPrizeBoard, huntStandings } from '@/lib/itemHuntDb';
import { buildHuntView } from '@/lib/itemHuntView';
import { huntStat } from '@/lib/itemHunt';
import { SKILL_LABELS } from '@/lib/constants';
import { idParam } from '@/lib/routeIds';

export const dynamic = 'force-dynamic';

export default async function WeeklyHomePage({ params }: { params: Promise<{ weeklyId: string }> }) {
  const { weeklyId } = await params;
  const id = idParam(weeklyId);

  // Whose competition is this? The id came from the URL.
  const clan = await requireClan();
  const comp = await getWeeklyRow(clan.id, id);
  if (!comp) notFound();

  const [standings, counts, balance, hasCoffer, feeCollector, pool] = await Promise.all([
    getWeeklyStandings(id),
    getWeeklyCounts(id),
    getCofferBalance(clan.id),
    clanHasCoffer(clan.id),
    verifyFeeCollector(),
    getWeeklyPool(id),
  ]);
  // What this ladder is already holding. The editor adds it back to `available` so the warning is
  // about gp the ladder would still need — otherwise re-saving an unchanged 5m ladder reads as
  // over-promising against a pot its own hold had just emptied.
  const held = pool?.status === 'reserved' ? Math.abs(pool.amount) : 0;

  // The card is ALWAYS rendered. It used to hide itself when the clan had no coffer rows, which got
  // the audience exactly backwards: `clanHasCoffer` means "has moved gp at least once", so the only
  // people who saw the prize editor were the ones already using it, and a clan setting up its first
  // one found a page with nothing on it and no word about why. An empty coffer is a sentence to say,
  // not a control to withhold.
  const prizes = parseWeeklyPrizes(comp.prizes);

  // An item hunt has its own home: the drops staff have to decide about, "Add a drop", "End now and
  // post results", and the standings by its rule (lib/itemHuntDb). Not a table of gains.
  if (comp.type === 'hunt') {
    const hunt = await huntStandings(comp);
    if (!hunt) notFound();
    const view = buildHuntView(comp, hunt);
    const stat = huntStat(hunt.config);
    const number = (kc: number | null, xp: number | null, skill: string | null) =>
      kc != null ? `${kc.toLocaleString()} kc` : xp != null ? `${xp.toLocaleString()} ${SKILL_LABELS[skill ?? ''] ?? ''} XP`.replace(/\s+/g, ' ') : null;
    const prizeHolds = (await huntPrizeBoard(comp, hunt.participants, prizes.places.length))?.holds ?? [];
    const seen = new Set<number>();
    const attention: HuntAttention[] = [];
    const push = (id: number, why: HuntAttention['why']) => {
      const d = hunt.all.find((r) => r.id === id);
      if (!d || seen.has(id)) return;
      seen.add(id);
      // The site's own reading is only comparable when the hunt tracks that same stat.
      const site = stat?.type === 'boss' ? number(d.siteKc, null, null) : stat?.type === 'skill' ? number(null, d.siteXp, stat.metric) : null;
      const mismatch =
        (d.kc != null && d.siteKc != null && stat?.type === 'boss' && !stat.metric.includes(',') && d.kc < d.siteKc) ||
        (d.xp != null && d.siteXp != null && stat?.type === 'skill' && d.xp < d.siteXp);
      attention.push({
        id: d.id,
        rsn: d.rsn,
        itemId: d.itemId,
        itemName: d.itemName,
        source: d.source,
        occurredAt: d.occurredAt,
        why,
        reason: d.flagReason,
        stated: number(d.kc, d.xp, d.statSkill),
        site,
        mismatch,
        screenshotUrl: d.screenshotUrl,
        note: d.note,
      });
    };
    for (const d of hunt.pending) push(d.id, d.status === 'pending' ? 'proof' : 'held');
    for (const d of hunt.awaiting) push(d.id, 'deciding');
    for (const d of prizeHolds) push(d.id, 'prize');
    const asItStands = view.rows
      .filter((r) => r.count > 0)
      .slice(0, 3)
      .map((r) => `${r.rank}. ${r.rsn} (${r.count} ${r.count === 1 ? 'drop' : 'drops'})`);
    return (
      <HuntAdminClient
        competitionId={comp.id}
        title={comp.title}
        view={view}
        attention={attention}
        entrants={hunt.participants.map((p) => ({ id: p.id, rsn: p.rsn })).sort((a, b) => a.rsn.localeCompare(b.rsn))}
        asItStands={asItStands}
        prizes={{ initial: prizes, cofferAvailable: balance.available + held, held: held > 0, settledAt: comp.prizesSettledAt, canEdit: Boolean(feeCollector), hasCoffer }}
        prizesWaiting={comp.status === 'completed' && !comp.prizesSettledAt && prizeHolds.length > 0}
      />
    );
  }

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
        selectedOnly: comp.hostEntrants === 'selected',
      }}
      stage={weeklyStage(comp)}
      standings={standings}
      counts={counts}
      prizes={{
        initial: prizes,
        cofferAvailable: balance.available + held,
        held: held > 0,
        settledAt: comp.prizesSettledAt,
        canEdit: Boolean(feeCollector),
        hasCoffer,
      }}
    />
  );
}
