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
import { getEffectiveParticipants } from '@/lib/weekly';
import { MAIN, isHardcoreEntrant, parseCountsOn, parsePrizeCurrency } from '@/lib/competitionGame';
import { feePlaces, parseWeeklyPrizes, winnersFor } from '@/lib/weeklyPrizes';
import { weeklyFeePotGp } from '@/lib/weeklySignups';

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

/**
 * The names of this competition's Hardcore Worlds characters (rsn keys). Empty, and no read at all,
 * on a main-game competition, so those posts read exactly as they always have.
 */
async function hardcoreKeys(comp: Comp): Promise<Set<string>> {
  if (parseCountsOn(comp.countsOn) === MAIN) return new Set();
  const rows = await getEffectiveParticipants(comp.id);
  return new Set(rows.filter((p) => isHardcoreEntrant(p.hiscoresTable, comp.countsOn)).map((p) => weeklyRsnKey(p.rsn)));
}

/** "Name (HCW)" for a Hardcore Worlds character, so a mixed board says which game each one plays. */
function tagHardcore<T extends { rsn: string }>(rows: T[], hcw: Set<string>): T[] {
  if (hcw.size === 0) return rows;
  return rows.map((r) => (hcw.has(weeklyRsnKey(r.rsn)) ? { ...r, rsn: `${r.rsn} (HCW)` } : r));
}

/**
 * What each winner takes, for a competition paid in Hardcore Worlds gp: that pot is the news, so the
 * results post names it. The same ladder the settle pass pays (lib/weeklyPrizeSettle). Null on a
 * main-game gp competition, whose post stays as it was.
 */
async function hcwPrizes(comp: Comp, standings: { rsn: string; gained: number }[]): Promise<{ rsn: string; gp: number }[] | null> {
  if (parsePrizeCurrency(comp.prizeCurrency) !== 'hcw') return null;
  const ladder = parseWeeklyPrizes(comp.prizes);
  const prizes = { ...ladder, places: feePlaces(ladder.places, comp.feesToPrizes ? await weeklyFeePotGp(comp.id) : 0) };
  const won = new Map<string, number>();
  for (const w of winnersFor(prizes, standings.map((s) => ({ ...s, clanMemberId: null })))) won.set(w.rsn, (won.get(w.rsn) ?? 0) + w.gp);
  return [...won].map(([rsn, gp]) => ({ rsn, gp }));
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
        countsOn: comp.countsOn,
      });
    } catch (err) {
      log.warn('weekly.notify-start-fail', { competitionId: comp.id, clanId: t.clanId }, err);
    }
  }
}

export async function announceCompetitionResults(comp: Comp, standings: { rsn: string; gained: number }[]): Promise<void> {
  const groups = await groupPost(comp);
  const bestDrops = await resultsBestDrops(comp, standings).catch(() => [] as string[]);
  // Prizes are matched on the plain names, then both carry the HCW tag.
  const hcw = await hardcoreKeys(comp);
  const prizes = await hcwPrizes(comp, standings).catch(() => null);
  for (const t of await targets(comp)) {
    try {
      await notifyWeeklyResults({
        clanId: t.clanId,
        type: comp.type,
        title: comp.title,
        metric: comp.metric,
        standings: tagHardcore(standings, hcw),
        groups: groups ? { ...groups, you: t.you } : null,
        hunt: huntPost(comp),
        bestDrops,
        countsOn: comp.countsOn,
        prizes: prizes ? tagHardcore(prizes, hcw) : null,
        prizeCurrency: parsePrizeCurrency(comp.prizeCurrency),
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
  const standings = solo && board ? tagHardcore(await board(), await hardcoreKeys(comp)) : [];
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
    const plain = dailyLines(board, prev, weeklyRsnKey);
    if (!plain || !dayWorthPosting(plain)) return false;
    // Tagged after the lines are worked out: the day's starting ranks are keyed by the plain name.
    const lines = tagHardcore(plain, await hardcoreKeys(comp));
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
