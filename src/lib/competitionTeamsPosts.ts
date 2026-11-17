/**
 * Discord posts for team / clan-vs-clan weekly competitions. A solo competition posts to its own
 * clan exactly as before; a teams competition adds the team standings; a clans competition posts
 * to EVERY racing clan's weekly webhook, each with its own side marked "you".
 */
import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { weeklyCompetitions } from '@/db/schema';
import { competitionMode, pastHalfway } from '@/lib/competitionTeams';
import { buildGroupStandings, racingClans } from '@/lib/competitionTeamsDb';
import { notifyWeeklyDaily, notifyWeeklyHalfway, notifyWeeklyResults, notifyWeeklyStart, type WeeklyGroupPost, type WeeklyHuntPost } from '@/lib/discord';
import { getSetting } from '@/lib/settings';
import { WEEKLY_DAILY_KEY, WEEKLY_HALFWAY_KEY, dailyLines, dailyWindowOpen, dayBest, dayClimber, dayWorthPosting, switchOn, type DayStart } from '@/lib/weeklyDaily';
import { huntIconUrl, huntKindWord, huntLine, parseHunt } from '@/lib/itemHunt';
import { BEST_DROPS_IN_RESULTS, bestDropLine, rankBestDrops } from '@/lib/bestDrops';
import { bestDropMoments } from '@/lib/momentsStore';
import { weeklyRsnKey } from '@/lib/weeklyRsn';
import { log } from '@/lib/logger';

type Comp = typeof weeklyCompetitions.$inferSelect;

/** How an item hunt's posts name it; null for every other kind. */
function huntPost(comp: Comp): WeeklyHuntPost | null {
  if (comp.type !== 'hunt') return null;
  const config = parseHunt(comp.hunt);
  return { kind: huntKindWord(config), line: huntLine(config, comp.metric), rule: config?.rule ?? 'first', iconUrl: huntIconUrl(config) };
}

/**
 * The top three best drops for the results post (lib/bestDrops), from people still in the standings
 * so the post names nobody the board has dropped. A hunt has none: its standings are its drops.
 */
async function resultsBestDrops(comp: Comp, standings: { rsn: string }[]): Promise<string[]> {
  if (comp.type === 'hunt') return [];
  const onBoard = new Set(standings.map((s) => weeklyRsnKey(s.rsn)));
  const ranked = rankBestDrops((await bestDropMoments(comp.id)).filter((m) => onBoard.has(weeklyRsnKey(m.rsn))));
  return ranked.slice(0, BEST_DROPS_IN_RESULTS).map(bestDropLine);
}

async function groupPost(comp: Comp): Promise<WeeklyGroupPost | null> {
  const view = await buildGroupStandings(comp);
  if (!view || view.mode === 'solo') return null;
  return {
    mode: view.mode,
    groups: view.groups.map((g) => ({ key: g.key, name: g.name, total: g.total, average: g.average, members: g.members })),
  };
}

/** Which clans hear about this competition, and which group is "theirs" in each post. */
async function targets(comp: Comp): Promise<{ clanId: number; you: number | null }[]> {
  if (competitionMode(comp.mode) !== 'clans') return [{ clanId: comp.clanId, you: null }];
  const clansRacing = await racingClans(comp);
  return clansRacing.length ? clansRacing.map((c) => ({ clanId: c.id, you: c.id })) : [{ clanId: comp.clanId, you: comp.clanId }];
}

export async function announceCompetitionStart(comp: Comp): Promise<void> {
  const groups = await groupPost(comp);
  for (const t of await targets(comp)) {
    try {
      await notifyWeeklyStart({
        clanId: t.clanId,
        type: comp.type,
        title: comp.title,
        metric: comp.metric,
        endDate: comp.endDate,
        groups: groups ? { ...groups, you: t.you } : null,
        hunt: huntPost(comp),
      });
    } catch (err) {
      log.warn('weekly.notify-start-fail', { competitionId: comp.id, clanId: t.clanId }, err);
    }
  }
}

export async function announceCompetitionResults(comp: Comp, standings: { rsn: string; gained: number }[]): Promise<void> {
  const groups = await groupPost(comp);
  const bestDrops = await resultsBestDrops(comp, standings).catch(() => [] as string[]);
  for (const t of await targets(comp)) {
    try {
      await notifyWeeklyResults({
        clanId: t.clanId,
        type: comp.type,
        title: comp.title,
        metric: comp.metric,
        standings,
        groups: groups ? { ...groups, you: t.you } : null,
        hunt: huntPost(comp),
        bestDrops,
      });
    } catch (err) {
      log.warn('weekly.notify-results-fail', { competitionId: comp.id, clanId: t.clanId }, err);
    }
  }
}

/**
 * The halfway post, once per competition: the groups for teams/clans, the players for a solo one.
 * Each clan's own switch decides whether it hears it (weekly_post_halfway, on unless turned off).
 * The stamp is claimed with a conditional UPDATE before posting, so two overlapping ticks can't both send it.
 */
export async function announceHalfwayIfDue(comp: Comp, nowMs = Date.now(), board?: () => Promise<{ rsn: string; gained: number }[]>): Promise<boolean> {
  if (comp.status !== 'active' || comp.halfwayPostedAt) return false;
  const solo = competitionMode(comp.mode) === 'solo';
  // A solo board needs its standings handed in (lib/rankMoves weeklyBoard, which imports this file).
  if (solo && !board) return false;
  if (!pastHalfway(comp.startDate, comp.endDate, nowMs)) return false;
  const claimed = await db
    .update(weeklyCompetitions)
    .set({ halfwayPostedAt: new Date(nowMs).toISOString() })
    .where(and(eq(weeklyCompetitions.id, comp.id), isNull(weeklyCompetitions.halfwayPostedAt)))
    .returning({ id: weeklyCompetitions.id });
  if (!claimed.length) return false;
  const groups = solo ? null : await groupPost(comp);
  if (!solo && !groups) return false;
  const standings = solo && board ? await board() : [];
  for (const t of await targets(comp)) {
    try {
      if (!switchOn(await getSetting(t.clanId, WEEKLY_HALFWAY_KEY))) continue;
      await notifyWeeklyHalfway({
        clanId: t.clanId,
        type: comp.type,
        title: comp.title,
        metric: comp.metric,
        endDate: comp.endDate,
        groups: groups ? { ...groups, you: t.you } : null,
        standings,
        hunt: huntPost(comp),
      });
    } catch (err) {
      log.warn('weekly.notify-halfway-fail', { competitionId: comp.id, clanId: t.clanId }, err);
    }
  }
  return true;
}

/**
 * The daily post, as a new UTC day begins: the day just finished against the board as it began
 * (lib/weeklyDaily). Called by lib/rankMoves at the one moment it writes the new day's row, so it
 * runs once per competition per day. Each clan's own switch decides whether it hears it
 * (weekly_post_daily, on unless turned off). A quiet day posts nothing. Never throws.
 */
export async function announceCompetitionDay(
  comp: Comp,
  board: { rsn: string; gained: number }[],
  prev: DayStart | null,
  nowMs = Date.now(),
): Promise<boolean> {
  try {
    if (comp.status !== 'active' || !dailyWindowOpen(comp.startDate, comp.endDate, nowMs)) return false;
    const lines = dailyLines(board, prev, weeklyRsnKey);
    if (!lines || !dayWorthPosting(lines)) return false;
    const groups = await groupPost(comp);
    const dayNumber = Math.max(1, Math.round((nowMs - Date.parse(comp.startDate)) / 86_400_000));
    let sent = false;
    for (const t of await targets(comp)) {
      if (!switchOn(await getSetting(t.clanId, WEEKLY_DAILY_KEY))) continue;
      sent = (await notifyWeeklyDaily({
        clanId: t.clanId,
        type: comp.type,
        title: comp.title,
        metric: comp.metric,
        endDate: comp.endDate,
        dayNumber,
        lines,
        best: dayBest(lines),
        climber: dayClimber(lines),
        groups: groups ? { ...groups, you: t.you } : null,
        hunt: huntPost(comp),
      })) || sent;
    }
    return sent;
  } catch (err) {
    log.warn('weekly.notify-day-fail', { competitionId: comp.id }, err);
    return false;
  }
}
