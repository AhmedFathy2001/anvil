// Changing what a competition is ABOUT before it starts: the skills or bosses of a SOTW/BOTW, the
// efficiency measure, or what an item hunt hunts.
//
// Nothing has been counted yet, so the change is safe: the new target is checked exactly as at
// creation, and every entrant's starting value is cleared so the sweep reads it again for the new
// target (a baseline read for Mining means nothing for Zulrah). Once it has started the target is
// fixed: gains already counted would stop meaning anything.

import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, playerSnapshots, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { EFFICIENCY_METRICS, weeklyMetricLabel } from '@/lib/constants';
import { competitionNotStarted } from '@/lib/competitionTeamsDb';
import { defaultHuntTitle, huntFromInput, huntTargetsLabel, killsOfForItems, parseHunt, serializeHunt } from '@/lib/itemHunt';
import { checkWeeklyMetric } from '@/lib/weeklyMetricInput';
import { defaultWeeklyTitle } from '@/lib/weeklyRepeatPlan';

type Competition = typeof weeklyCompetitions.$inferSelect;
export type RetargetResult = { ok: true; competition: Competition } | { ok: false; error: string };

const HUNT_AUTO_TITLE = /^(item|pet) hunt: /i;

export async function retargetCompetition(comp: Competition, input: Record<string, unknown>, by: { userId: number }): Promise<RetargetResult> {
  if (!competitionNotStarted(comp)) {
    return { ok: false, error: 'This competition has started, so what it counts is fixed. End it and create a new one to change that.' };
  }
  const updates: Partial<Competition> = {};
  let was: string;
  let now: string;

  if (comp.type === 'hunt') {
    const checked = huntFromInput(input.hunt);
    if (!checked.ok) return { ok: false, error: checked.error };
    const config = checked.config;
    // The same two rules as at creation (api/admin/weekly POST).
    if (config.v === 1 && config.target === 'items') config.killsOf = killsOfForItems(config.items) ?? config.killsOf;
    if (config.killsOf) config.xpSkill = null;
    updates.hunt = serializeHunt(config);
    updates.metric = huntTargetsLabel(config);
    // A title nobody wrote follows the target; one somebody wrote stays.
    if (HUNT_AUTO_TITLE.test(comp.title)) updates.title = defaultHuntTitle(config);
    was = huntTargetsLabel(parseHunt(comp.hunt) ?? config);
    now = updates.metric;
  } else {
    const type = typeof input.type === 'string' ? input.type : comp.type;
    if (type !== 'skill' && type !== 'boss' && type !== 'efficiency') {
      return { ok: false, error: 'A skill, boss or efficiency competition can switch between those three. For an item hunt, create a new competition.' };
    }
    let metric = typeof input.metric === 'string' ? input.metric : '';
    if (type === 'efficiency') {
      if (!EFFICIENCY_METRICS.some((m) => m.key === metric)) return { ok: false, error: 'Pick hours played or hours bossed.' };
    } else {
      const checked = checkWeeklyMetric(type, metric);
      if (!checked.ok) return { ok: false, error: checked.error };
      metric = checked.metric;
    }
    if (type === comp.type && metric === comp.metric) return { ok: true, competition: comp };
    updates.type = type;
    updates.metric = metric;
    if (comp.title === defaultWeeklyTitle(comp.type, comp.metric)) updates.title = defaultWeeklyTitle(type, metric);
    was = weeklyMetricLabel(comp.type, comp.metric) || comp.metric;
    now = weeklyMetricLabel(type, metric) || metric;
  }

  const competition = await db.transaction(async (tx) => {
    const [row] = await tx.update(weeklyCompetitions).set(updates).where(eq(weeklyCompetitions.id, comp.id)).returning();
    // Starting values read for the old target mean nothing for the new one: the sweep reads them again.
    await tx.update(weeklyParticipants).set({ baselineValue: null, currentValue: null, baselineParts: null, currentParts: null, huntBaseline: null, huntCurrent: null }).where(eq(weeklyParticipants.competitionId, comp.id));
    await tx.delete(playerSnapshots).where(eq(playerSnapshots.weeklyCompetitionId, comp.id));
    await tx.insert(clanAuditLog).values({
      clanId: comp.clanId,
      eventType: 'competition_target_changed',
      actorUserId: by.userId > 0 ? by.userId : null,
      oldValue: JSON.stringify({ competitionId: comp.id, type: comp.type, target: was }),
      newValue: JSON.stringify({ competitionId: comp.id, type: row.type, target: now }),
      notes: `Competition "${row.title}"`,
    });
    return row;
  });
  return { ok: true, competition };
}
