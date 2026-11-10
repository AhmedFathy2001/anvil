// A clan's "Moments": the wall of what its members did lately, on its public page (PublicClanHome).
//
// The same two sources the members' week view reads (lib/homeView), over a longer window: milestones
// (99s, max total, KC and XP thresholds) and collection-log slots we WITNESSED being unlocked —
// `firstSeenAt` is only set when the plugin or a sync caught the unlock happening, so a member's first
// sync never floods the wall with their back catalogue. Members only (a current seat in THIS clan): a
// guest's drops are their own clan's news. The labels and the order are lib/clanMomentsRules.

import { and, desc, eq, gte, isNotNull, isNull, lte } from 'drizzle-orm';

import { db } from '@/db';
import { clanRoster, memberClogItems, memberMilestones } from '@/db/schema';
import { clogItemLabels } from '@/lib/clogDataset';
import { milestoneSentence } from '@/lib/homeView';
import { competitionIconUrl, itemIconUrl } from '@/lib/tileIcons';
import { momentLabel, orderMoments, type Moment } from '@/lib/clanMomentsRules';

/** How far back the wall looks. A quiet clan still has something to show; an old drop is not "lately". */
const WINDOW_DAYS = 21;
/** Rows read from each source before ordering. */
const READ = 40;

export async function clanMoments(clanId: number, now = new Date(), limit = 9): Promise<Moment[]> {
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000).toISOString();
  const nowIso = now.toISOString();
  const seat = (accountCol: typeof memberMilestones.accountId | typeof memberClogItems.accountId) =>
    and(eq(clanRoster.accountId, accountCol), eq(clanRoster.clanId, clanId), eq(clanRoster.kind, 'member'), isNull(clanRoster.leftAt));

  const [milestones, unlocks] = await Promise.all([
    db
      .select({
        rsn: clanRoster.rsn,
        kind: memberMilestones.kind,
        metric: memberMilestones.metric,
        threshold: memberMilestones.threshold,
        at: memberMilestones.noticedAt,
      })
      .from(memberMilestones)
      // clan-scope: this clan -- the roster join keeps only accounts holding a member seat here.
      .innerJoin(clanRoster, seat(memberMilestones.accountId))
      .where(and(gte(memberMilestones.noticedAt, since), lte(memberMilestones.noticedAt, nowIso)))
      .orderBy(desc(memberMilestones.noticedAt))
      .limit(READ),
    db
      .select({
        rsn: clanRoster.rsn,
        itemId: memberClogItems.itemId,
        pageName: memberClogItems.pageName,
        kc: memberClogItems.kcAtUnlock,
        at: memberClogItems.firstSeenAt,
      })
      .from(memberClogItems)
      // clan-scope: this clan -- the roster join keeps only accounts holding a member seat here.
      .innerJoin(clanRoster, seat(memberClogItems.accountId))
      .where(and(isNotNull(memberClogItems.firstSeenAt), gte(memberClogItems.firstSeenAt, since), lte(memberClogItems.firstSeenAt, nowIso)))
      .orderBy(desc(memberClogItems.firstSeenAt))
      .limit(READ),
  ]);

  const names = unlocks.length ? clogItemLabels() : new Map<number, string>();
  const all: Moment[] = [
    ...milestones.map((m) => ({
      rsn: m.rsn ?? 'Someone',
      text: milestoneSentence(m.kind, m.metric, m.threshold),
      iconUrl: m.metric ? competitionIconUrl(m.kind === 'kc' ? 'boss' : 'skill', m.metric) : null,
      at: m.at,
      ...momentLabel({ kind: 'milestone', milestone: m.kind, threshold: m.threshold }),
    })),
    ...unlocks.map((u) => ({
      rsn: u.rsn ?? 'Someone',
      // Named from the shipped catalogue, falling back to the page for a brand-new unique (lib/homeView).
      text: `${names.get(u.itemId) ?? `a ${u.pageName} item`}${u.kc != null ? ` at ${u.kc.toLocaleString()} KC` : ''}`,
      iconUrl: itemIconUrl(u.itemId),
      at: u.at!,
      ...momentLabel({ kind: 'clog', pageName: u.pageName }),
    })),
  ];
  return orderMoments(all, limit);
}
