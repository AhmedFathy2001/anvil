// Repeating weekly competitions — storage and the roll-over the weekly cron runs.
//
// Stored in the clan's `settings` rows rather than new columns, keyed by competition:
//   weekly_repeat:<id>       {"rotation":[…]|null}   this competition repeats
//   weekly_repeat_next:<id>  "<successor id>"         its successor exists (makes the roll idempotent);
//                            "claim:<ms>" while a roll is making it (lib/weeklyRepeatPlan)
// Turning repeat off on the current competition stops the series: the successor is made from the
// latest one, and only when it still says repeat.

import { parsePrizeCurrency } from '@/lib/competitionGame';
import { parseHunt, serializeHunt } from '@/lib/itemHunt';
import { and, eq, isNull, like } from 'drizzle-orm';

import { db } from '@/db';
import { settings, weeklyCompetitions } from '@/db/schema';
import { getSetting, invalidateSettings, setSetting } from '@/lib/settings';
import { setWeeklyPool } from '@/lib/coffer';
import { enrollAllPlayers } from '@/lib/weekly';
import { announceCompetitionStart } from '@/lib/competitionTeamsPosts';
import { competitionMode } from '@/lib/competitionTeams';
import { autoBalanceTeams, carryOverSelectedEntrants, carryOverTeamSetup } from '@/lib/competitionTeamsDb';
import { parseWeeklyPrizes, totalPrizeGp } from '@/lib/weeklyPrizes';
import { defaultWeeklyTitle, nextMetric, nextWindow, parseRepeat, successorClaim, successorMarkerState, type RepeatConfig } from '@/lib/weeklyRepeatPlan';
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
    const marker = await getSetting(row.clanId, nextKey(id));
    const markerState = successorMarkerState(marker, now);
    if (markerState === 'taken') continue;

    const prev = await db.query.weeklyCompetitions.findFirst({
      where: and(eq(weeklyCompetitions.id, id), eq(weeklyCompetitions.clanId, row.clanId)),
    });
    if (!prev || prev.status !== 'completed') continue;

    // CLAIM THE SUCCESSOR SLOT FIRST, in the database, so two overlapping cron ticks cannot both
    // make one (and hold the prize pool twice). The marker used to be written after the insert,
    // which left exactly that gap. Insert-if-absent, or a compare-and-swap over a claim a dead run
    // left behind: either way only one caller gets a row back.
    const claim = successorClaim(now);
    const mine = and(eq(settings.clanId, prev.clanId), eq(settings.key, nextKey(prev.id)));
    const claimed =
      markerState === 'stale' && marker
        ? await db.update(settings).set({ value: claim }).where(and(mine, eq(settings.value, marker))).returning({ key: settings.key })
        : await db
            .insert(settings)
            .values({ clanId: prev.clanId, key: nextKey(prev.id), value: claim })
            // A row left holding null is still nobody's: take it. Anything else is someone's claim.
            .onConflictDoUpdate({ target: [settings.clanId, settings.key], set: { value: claim }, setWhere: isNull(settings.value) })
            .returning({ key: settings.key });
    invalidateSettings(prev.clanId);
    if (claimed.length === 0) continue;

    try {
      const metric = nextMetric(prev.metric, cfg);
      // An item hunt that ended on its first drop repeats from the end it was planned to have.
      const hunt = prev.type === 'hunt' ? parseHunt(prev.hunt) : null;
      const win = nextWindow({ startDate: prev.startDate, endDate: hunt?.plannedEnd ?? prev.endDate }, now);
      const nowIso = new Date(now).toISOString();
      const status = win.startDate <= nowIso ? 'active' : 'upcoming';
      // The competition and the marker naming it land together or not at all, so a claim that is
      // still a claim always means "no successor yet" and is safe to take over.
      const comp = await db
        .transaction(async (tx) => {
          const [made] = await tx
            .insert(weeklyCompetitions)
            .values({
              clanId: prev.clanId,
              type: prev.type,
              metric,
              // A hunt keeps its name and its rules: there is no metric to rotate through.
              title: prev.type === 'hunt' ? prev.title : defaultWeeklyTitle(prev.type, metric),
              hunt: hunt ? serializeHunt({ ...hunt, plannedEnd: null }) : null,
              startDate: win.startDate,
              endDate: win.endDate,
              createdById: prev.createdById,
              status,
              includeGuests: prev.includeGuests,
              prizes: prev.prizes,
              mode: prev.mode,
              teamLateJoin: prev.teamLateJoin,
              // "Selected people" stays selected: without this the next week went back to sweeping
              // the whole roster in, and the organiser's list lasted exactly one week.
              hostEntrants: prev.hostEntrants,
              // A sign-up competition stays one, at the same fee; each week is entered (and paid) afresh.
              selfSignup: prev.selfSignup,
              entryFee: prev.entryFee,
              feesToPrizes: prev.feesToPrizes,
              feeGatesPrize: prev.feeGatesPrize,
              // Which game counts and what it pays in carry over: a Hardcore Worlds week stays one.
              countsOn: prev.countsOn,
              prizeCurrency: prev.prizeCurrency,
              // The same role pinged each week.
              pingRoleId: prev.pingRoleId,
              pingOnStart: prev.pingOnStart,
              pingOnEnd: prev.pingOnEnd,
            })
            .returning();
          const kept = await tx
            .update(settings)
            .set({ value: String(made.id) })
            .where(and(mine, eq(settings.value, claim)))
            .returning({ key: settings.key });
          if (kept.length === 0) throw new Error('weekly repeat: successor claim was lost');
          return made;
        })
        .catch(async (err) => {
          // Nothing was made: give the slot back so the next tick can try again.
          await db.delete(settings).where(and(mine, eq(settings.value, claim))).catch(() => {});
          throw err;
        })
        .finally(() => invalidateSettings(prev.clanId));
      await setWeeklyRepeat(prev.clanId, comp.id, cfg);

      // The same prize ladder, held again — or recorded as a promise when the coffer can't cover it,
      // exactly as creating it by hand does.
      const total = prev.prizes ? totalPrizeGp(parseWeeklyPrizes(prev.prizes)) : 0;
      if (total > 0) {
        const currency = parsePrizeCurrency(prev.prizeCurrency);
        const held = await setWeeklyPool({ clanId: prev.clanId, competitionId: comp.id, amount: total, hold: true, userId: null, currency });
        if (!held.ok) await setWeeklyPool({ clanId: prev.clanId, competitionId: comp.id, amount: total, hold: false, userId: null, currency });
      }

      // Same format as last week: teams carried over (then re-balanced), clans re-invited.
      await carryOverTeamSetup(prev, comp);
      // ...and with the same selected people, where the organiser picked them (a no-op otherwise).
      await carryOverSelectedEntrants(prev, comp);
      await enrollAllPlayers(comp.id);
      if (competitionMode(comp.mode) === 'teams') await autoBalanceTeams(comp).catch(() => null);
      if (status === 'active') {
        await announceCompetitionStart(comp).catch(() => {});
      }
      started += 1;
      log.info('weekly.repeat.started', { clanId: prev.clanId, from: prev.id, to: comp.id, metric });
    } catch (err) {
      log.warn('weekly.repeat.fail', { clanId: prev.clanId, competitionId: prev.id }, err);
    }
  }
  return started;
}
