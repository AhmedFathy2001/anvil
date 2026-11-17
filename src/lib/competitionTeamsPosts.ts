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
import {
  ENDING_SLOT,
  dailyRecapEmbed,
  decideCompetitionPost,
  dueRecapDay,
  endingSoonDue,
  endingSoonEmbed,
  halfwayReportDue,
  momentClash,
  type CompetitionPostType,
} from '@/lib/competitionPosts';
import {
  bestDropLines,
  claimSlot,
  daySlotData,
  halfwayReport,
  lastRecapBefore,
  loadClanCompetitionPosts,
  loadCompetitionPostOverrides,
  loadPostBoard,
  postSubject,
  recapSlot,
  slotTaken,
} from '@/lib/competitionPostsRun';
import { notifyWeeklyHalfway, notifyWeeklyResults, notifyWeeklyStart, notifyWeeklyUpdate, type WeeklyGroupPost, type WeeklyHuntPost } from '@/lib/discord';
import type { DiscordEmbed } from '@/lib/discordEmbeds';
import { DAY_MS, stampMs } from '@/lib/eventDay';
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

interface Target {
  clanId: number;
  you: number | null;
}

/** Which clans hear about this competition, and which group is "theirs" in each post. */
async function targets(comp: Comp): Promise<Target[]> {
  if (competitionMode(comp.mode) !== 'clans') return [{ clanId: comp.clanId, you: null }];
  const clansRacing = await racingClans(comp);
  return clansRacing.length ? clansRacing.map((c) => ({ clanId: c.id, you: c.id })) : [{ clanId: comp.clanId, you: comp.clanId }];
}

/**
 * The clans that have this post switched on (lib/competitionPosts decideCompetitionPost): the
 * competition's own choice, then each clan's own setting. Each side of a clan-vs-clan competition
 * decides for its own server.
 */
async function targetsFor(comp: Comp, post: CompetitionPostType): Promise<Target[]> {
  const [all, override] = await Promise.all([targets(comp), loadCompetitionPostOverrides(comp)]);
  const on: Target[] = [];
  for (const t of all) {
    if (decideCompetitionPost(post, await loadClanCompetitionPosts(t.clanId), override, t.clanId === comp.clanId)) on.push(t);
  }
  return on;
}

const clanIds = async (comp: Comp, post: CompetitionPostType) => new Set((await targetsFor(comp, post)).map((t) => t.clanId));

/** Send one built post to each clan, with that clan's side marked in the group standings. */
async function sendUpdate(comp: Comp, to: Target[], embed: DiscordEmbed, what: string): Promise<void> {
  const groups = await groupPost(comp).catch(() => null);
  for (const t of to) {
    try {
      await notifyWeeklyUpdate({
        clanId: t.clanId,
        type: comp.type,
        metric: comp.metric,
        hunt: huntPost(comp),
        groups: groups ? { ...groups, you: t.you } : null,
        embed,
      });
    } catch (err) {
      log.warn(`weekly.notify-${what}-fail`, { competitionId: comp.id, clanId: t.clanId }, err);
    }
  }
}

export async function announceCompetitionStart(comp: Comp): Promise<void> {
  const groups = await groupPost(comp);
  for (const t of await targetsFor(comp, 'start')) {
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
  for (const t of await targetsFor(comp, 'results')) {
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
 * The halfway post, once per competition. The stamp is claimed with a conditional UPDATE before
 * anything is decided, so two overlapping ticks can't both send it, and a clan that switches the
 * report on later never gets a "halfway" at four fifths.
 *
 * Two posts share the one moment. A clan with the HALFWAY REPORT switched on gets the report
 * (standings, biggest climber, closest race, pace, best drops; lib/competitionPosts). A team or
 * clan-vs-clan competition has always posted its group standings at halfway, so a clan without the
 * switch still gets that, as before. A solo competition without the switch posts nothing, as before.
 */
export async function announceHalfwayIfDue(comp: Comp, nowMs = Date.now()): Promise<boolean> {
  if (comp.status !== 'active' || comp.halfwayPostedAt) return false;
  const solo = competitionMode(comp.mode) === 'solo';
  const startMs = stampMs(comp.startDate);
  const endMs = stampMs(comp.endDate);
  const reportDue = startMs != null && endMs != null && halfwayReportDue(nowMs, startMs, endMs);
  if (solo ? !reportDue : !pastHalfway(comp.startDate, comp.endDate, nowMs)) return false;
  const claimed = await db
    .update(weeklyCompetitions)
    .set({ halfwayPostedAt: new Date(nowMs).toISOString() })
    .where(and(eq(weeklyCompetitions.id, comp.id), isNull(weeklyCompetitions.halfwayPostedAt)))
    .returning({ id: weeklyCompetitions.id });
  if (!claimed.length) return false;

  // One post per moment (lib/competitionPosts momentClash): on a two-day competition halfway IS the
  // last 24 hours, and a clan with "ending soon" on gets that instead.
  const endingToo = reportDue && momentClash(startMs!, endMs!).endingSoon ? await clanIds(comp, 'endingSoon') : new Set<number>();
  const wantReport = reportDue ? (await targetsFor(comp, 'halfway')).filter((t) => !endingToo.has(t.clanId)) : [];
  const report = wantReport.length ? await halfwayReport(comp, nowMs).catch(() => null) : null;
  if (report) await sendUpdate(comp, wantReport, report, 'halfway');
  const reported = new Set(report ? wantReport.map((t) => t.clanId) : []);

  const groups = await groupPost(comp);
  if (!groups) return reported.size > 0;
  for (const t of await targets(comp)) {
    if (reported.has(t.clanId)) continue;
    try {
      await notifyWeeklyHalfway({
        clanId: t.clanId,
        type: comp.type,
        title: comp.title,
        metric: comp.metric,
        endDate: comp.endDate,
        groups: { ...groups, you: t.you },
      });
    } catch (err) {
      log.warn('weekly.notify-halfway-fail', { competitionId: comp.id, clanId: t.clanId }, err);
    }
  }
  return true;
}

/**
 * The daily recap: once per 24h slice from the start (lib/eventDay), for the clans that switched it
 * on. The slot row is the latch and carries the board at that moment, so the next recap shows what
 * moved since. Only the LATEST due day is ever posted: after three days of no cron, one recap covers
 * all three ("days 2–4"). A day nothing moved takes its slot and posts nothing.
 */
export async function announceDailyRecapIfDue(comp: Comp, nowMs = Date.now()): Promise<boolean> {
  if (comp.status !== 'active') return false;
  const startMs = stampMs(comp.startDate);
  const endMs = stampMs(comp.endDate);
  if (startMs == null || endMs == null) return false;
  const day = dueRecapDay(nowMs, startMs, endMs);
  if (day == null) return false;
  // One post per moment: a clan that gets "ending soon" or the halfway report as this day closes
  // does not also get the day's recap.
  const clash = momentClash(startMs, endMs, day);
  const instead = new Set([
    ...(clash.endingSoon ? await clanIds(comp, 'endingSoon') : []),
    ...(clash.halfway ? await clanIds(comp, 'halfway') : []),
  ]);
  const to = (await targetsFor(comp, 'daily')).filter((t) => !instead.has(t.clanId));
  if (to.length === 0 || (await slotTaken(comp.id, recapSlot(day)))) return false;

  const last = await lastRecapBefore(comp.id, day);
  const { board, huntDrops } = await loadPostBoard(comp);
  if (!(await claimSlot(comp.id, recapSlot(day), nowMs, daySlotData(board)))) return false;

  const fromDay = last?.day ?? 0;
  const fromMs = startMs + fromDay * DAY_MS;
  const toMs = startMs + day * DAY_MS;
  const embed = dailyRecapEmbed({
    subject: postSubject(comp),
    day,
    fromDay,
    board,
    prev: last?.data ?? null,
    bestDrops: await bestDropLines(comp, board, fromMs, toMs).catch(() => [] as string[]),
    huntDrops: huntDrops?.filter((d) => d.atMs != null && d.atMs >= fromMs && d.atMs < toMs).map((d) => d.line),
  });
  if (!embed) {
    log.info('weekly.daily-recap-quiet', { competitionId: comp.id, day });
    return false;
  }
  await sendUpdate(comp, to, embed, 'daily');
  log.info('weekly.daily-recap-posted', { competitionId: comp.id, day, clans: to.length });
  return true;
}

/** "Ending soon", once, inside the last 24 hours (never the last one), for the clans that switched it on. */
export async function announceEndingSoonIfDue(comp: Comp, nowMs = Date.now()): Promise<boolean> {
  if (comp.status !== 'active') return false;
  const startMs = stampMs(comp.startDate);
  const endMs = stampMs(comp.endDate);
  if (startMs == null || endMs == null || !endingSoonDue(nowMs, startMs, endMs)) return false;
  const to = await targetsFor(comp, 'endingSoon');
  if (to.length === 0 || !(await claimSlot(comp.id, ENDING_SLOT, nowMs))) return false;
  const { board } = await loadPostBoard(comp);
  // It stands in for the recap of the day that closes now, so it carries who moved since the last one.
  const last = await lastRecapBefore(comp.id, Number.MAX_SAFE_INTEGER);
  await sendUpdate(comp, to, endingSoonEmbed({ subject: postSubject(comp), board, prev: last?.data ?? null }), 'ending-soon');
  return true;
}
