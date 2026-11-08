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
import { notifyWeeklyHalfway, notifyWeeklyResults, notifyWeeklyStart, type WeeklyGroupPost } from '@/lib/discord';
import { log } from '@/lib/logger';

type Comp = typeof weeklyCompetitions.$inferSelect;

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
      });
    } catch (err) {
      log.warn('weekly.notify-start-fail', { competitionId: comp.id, clanId: t.clanId }, err);
    }
  }
}

export async function announceCompetitionResults(comp: Comp, standings: { rsn: string; gained: number }[]): Promise<void> {
  const groups = await groupPost(comp);
  for (const t of await targets(comp)) {
    try {
      await notifyWeeklyResults({
        clanId: t.clanId,
        type: comp.type,
        title: comp.title,
        metric: comp.metric,
        standings,
        groups: groups ? { ...groups, you: t.you } : null,
      });
    } catch (err) {
      log.warn('weekly.notify-results-fail', { competitionId: comp.id, clanId: t.clanId }, err);
    }
  }
}

/**
 * The halfway post, once per competition, for teams/clans mode only. The stamp is claimed with a
 * conditional UPDATE before posting, so two overlapping ticks can't both send it.
 */
export async function announceHalfwayIfDue(comp: Comp, nowMs = Date.now()): Promise<boolean> {
  if (comp.status !== 'active' || comp.halfwayPostedAt) return false;
  if (competitionMode(comp.mode) === 'solo') return false;
  if (!pastHalfway(comp.startDate, comp.endDate, nowMs)) return false;
  const claimed = await db
    .update(weeklyCompetitions)
    .set({ halfwayPostedAt: new Date(nowMs).toISOString() })
    .where(and(eq(weeklyCompetitions.id, comp.id), isNull(weeklyCompetitions.halfwayPostedAt)))
    .returning({ id: weeklyCompetitions.id });
  if (!claimed.length) return false;
  const groups = await groupPost(comp);
  if (!groups) return false;
  for (const t of await targets(comp)) {
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
