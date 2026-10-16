// Repeating weekly competitions — storage and the roll-over the weekly cron runs.
//
// Stored in the clan's `settings` rows rather than new columns, keyed by competition:
//   weekly_repeat:<id>       {"rotation":[…]|null}   this competition repeats
//   weekly_repeat_next:<id>  "<successor id>"         its successor exists (makes the roll idempotent)
// Turning repeat off on the current competition stops the series: the successor is made from the
// latest one, and only when it still says repeat.

import { and, eq, like } from 'drizzle-orm';

import { db } from '@/db';
import { settings, weeklyCompetitions } from '@/db/schema';
import { getSetting, setSetting } from '@/lib/settings';
import { setWeeklyPool } from '@/lib/coffer';
import { enrollAllPlayers } from '@/lib/weekly';
import { notifyWeeklyStart } from '@/lib/discord';
import { parseWeeklyPrizes, totalPrizeGp } from '@/lib/weeklyPrizes';
import { defaultWeeklyTitle, nextMetric, nextWindow, parseRepeat, type RepeatConfig } from '@/lib/weeklyRepeatPlan';
import { log } from '@/lib/logger';

const repeatKey = (id: number) => `weekly_repeat:${id}`;
const nextKey = (id: number) => `weekly_repeat_next:${id}`;

export async function getWeeklyRepeat(clanId: number, competitionId: number): Promise<RepeatConfig | null> {
  return parseRepeat(await getSetting(clanId, repeatKey(competitionId)));
}

export async function setWeeklyRepeat(clanId: number, competitionId: number, cfg: RepeatConfig | null): Promise<void> {
  await setSetting(clanId, repeatKey(competitionId), cfg ? JSON.stringify({ rotation: cfg.rotation }) : null);
}

/**
 * For every finished competition that repeats and has no successor yet, start the next one.
 * Called by the weekly cron after its status pass. Safe to run any number of times.
 */
export async function rollWeeklySeries(now: number = Date.now()): Promise<number> {
  // clan-scope: global -- the lifecycle tick runs over every clan, like the status pass it follows.
  const rows = await db
    .select({ clanId: settings.clanId, key: settings.key, value: settings.value })
    .from(settings)
    .where(like(settings.key, 'weekly_repeat:%'));

  let started = 0;
  for (const row of rows) {
    const cfg = parseRepeat(row.value);
    const id = Number(row.key.slice('weekly_repeat:'.length));
    if (!cfg || !Number.isInteger(id)) continue;
    if (await getSetting(row.clanId, nextKey(id))) continue;

    const prev = await db.query.weeklyCompetitions.findFirst({
      where: and(eq(weeklyCompetitions.id, id), eq(weeklyCompetitions.clanId, row.clanId)),
    });
    if (!prev || prev.status !== 'completed') continue;

    try {
      const metric = nextMetric(prev.metric, cfg);
      const win = nextWindow(prev, now);
      const nowIso = new Date(now).toISOString();
      const status = win.startDate <= nowIso ? 'active' : 'upcoming';
      const [comp] = await db
        .insert(weeklyCompetitions)
        .values({
          clanId: prev.clanId,
          type: prev.type,
          metric,
          title: defaultWeeklyTitle(prev.type, metric),
          startDate: win.startDate,
          endDate: win.endDate,
          createdById: prev.createdById,
          status,
          includeGuests: prev.includeGuests,
          prizes: prev.prizes,
        })
        .returning();
      // Claim the successor slot first, so a crash below can never make a second one.
      await setSetting(prev.clanId, nextKey(prev.id), String(comp.id));
      await setWeeklyRepeat(prev.clanId, comp.id, cfg);

      // The same prize ladder, held again — or recorded as a promise when the coffer can't cover it,
      // exactly as creating it by hand does.
      const total = prev.prizes ? totalPrizeGp(parseWeeklyPrizes(prev.prizes)) : 0;
      if (total > 0) {
        const held = await setWeeklyPool({ clanId: prev.clanId, competitionId: comp.id, amount: total, hold: true, userId: null });
        if (!held.ok) await setWeeklyPool({ clanId: prev.clanId, competitionId: comp.id, amount: total, hold: false, userId: null });
      }

      await enrollAllPlayers(comp.id);
      if (status === 'active') {
        await notifyWeeklyStart({ clanId: comp.clanId, type: comp.type, title: comp.title, metric: comp.metric, endDate: comp.endDate }).catch(() => {});
      }
      started += 1;
      log.info('weekly.repeat.started', { clanId: prev.clanId, from: prev.id, to: comp.id, metric });
    } catch (err) {
      log.warn('weekly.repeat.fail', { clanId: prev.clanId, competitionId: prev.id }, err);
    }
  }
  return started;
}
