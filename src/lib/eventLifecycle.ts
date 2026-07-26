import { db } from '@/db';
import { events, teams, tiles, completions, players } from '@/db/schema';
import { eq, and, inArray, isNotNull, count } from 'drizzle-orm';
import { notifyEventStart, notifyEventEnd, notifyEventStartHeld } from '@/lib/discord';
import { computeStartReadiness, type StartReadiness } from '@/lib/eventReadiness';
import { autoGeneratePayoutsOnEnd } from '@/lib/payouts';
import { getEventRecap } from '@/lib/eventRecap';
import { processTileReveals } from '@/lib/revealEngine';
import { parseEventRules, visibleTiles } from '@/lib/eventRules';
import { log } from '@/lib/logger';

// The awards worth celebrating in the Discord end post, most-fun-first — we take the first few of
// these that actually have a winner so the embed stays punchy.
const RECAP_HIGHLIGHT_ORDER = ['mvp', 'big-baller', 'warmonger', 'speed-demon', 'boss-slayer', 'loot-goblin', 'pker', 'untouchable'];
const RECAP_HIGHLIGHT_COUNT = 5;

// While an event's scheduled start is HELD (start time reached but the event isn't startable —
// lib/eventReadiness), each cron tick nudges startDate this far ahead of now. Every start-gated
// surface (submissions, plugin event pick, federation writes, tile-edit locks, countdowns) keys off
// startDate, so pushing the date is the one mutation that consistently holds them ALL closed. Must
// exceed the 1-minute flush-notifications cadence so the date can't lapse between ticks; once the
// blockers clear, the event starts within one tick.
const START_HOLD_MS = 2 * 60 * 1000;

// Fetch the start-readiness counts for one event and classify them (lib/eventReadiness). Shared by
// the lifecycle cron, the admin start-now action, and the admin Overview banner.
export async function getEventStartReadiness(eventId: number, draftStatus: string): Promise<StartReadiness> {
  const [[teamCount], [assignedCount], [totalCount]] = await Promise.all([
    db.select({ n: count() }).from(teams).where(eq(teams.eventId, eventId)),
    db.select({ n: count() }).from(players).where(and(eq(players.eventId, eventId), isNotNull(players.teamId))),
    db.select({ n: count() }).from(players).where(eq(players.eventId, eventId)),
  ]);
  return computeStartReadiness({
    draftStatus,
    teamCount: teamCount.n,
    assignedPlayerCount: assignedCount.n,
    totalPlayerCount: totalCount.n,
  });
}

// Fires the one-time "event started" / "event ended" Discord posts for any event whose
// scheduled start/end time has passed. Both posts are guarded by an atomic flag flip
// (startNotified / endNotified) — only the caller that wins the 0→1 flip sends — so this is
// safe to run from multiple crons and can never double-post.
//
// Run every minute from the flush-notifications cron so scheduled starts/ends are timely.
// (They used to be checked only inside the hourly stats cron, so a start scheduled at, say,
// 3:05 wasn't announced until 4:00 — up to ~an hour late.) The hourly stats cron calls this
// too, purely as a backstop.
export async function processEventLifecycleNotifications(): Promise<void> {
  const allEvents = await db.select().from(events);
  const now = new Date().toISOString();

  // Events whose start time has passed (or is imminent) but haven't been announced yet.
  for (const event of allEvents) {
    if (!event.startDate || event.startNotified || event.forceEndedAt) continue;
    const dueAt = Date.parse(event.startDate);
    // Only IMMINENT starts are examined — within the hold horizon. Checking (and holding) slightly
    // BEFORE the start moment matters: it means a blocked event's startDate is pushed ahead while
    // it is still in the future, so the date never actually lapses and no startDate-gated surface
    // (submissions, plugin event pick, tile-edit locks, countdowns) ever briefly sees "started".
    if (Number.isNaN(dueAt) || dueAt - Date.now() > START_HOLD_MS) continue;

    // START SAFEGUARD: the clock alone doesn't start an event. If it isn't startable (draft still
    // in progress / no teams assigned — lib/eventReadiness), HOLD the start: keep nudging startDate
    // ahead of now each tick, and warn the Discord bingo channel exactly once (startHoldNotified
    // latch). The event then starts automatically within one tick of the blockers clearing — no
    // admin re-scheduling needed.
    const readiness = await getEventStartReadiness(event.id, event.draftStatus).catch(
      (): StartReadiness => ({ ready: true, blockers: [], unassignedPlayerCount: 0 }),
    );
    if (!readiness.ready) {
      const heldUntil = new Date(Date.now() + START_HOLD_MS).toISOString();
      // startNotified re-checked in the WHERE so a concurrent tick that just announced (and a
      // start-now that just fired) can never have its real start date clobbered by a stale hold.
      await db
        .update(events)
        .set({ startDate: heldUntil })
        .where(and(eq(events.id, event.id), eq(events.startNotified, 0)));
      const flipped = await db
        .update(events)
        .set({ startHoldNotified: 1 })
        .where(and(eq(events.id, event.id), eq(events.startHoldNotified, 0)))
        .returning({ id: events.id });
      if (flipped.length > 0) {
        log.warn('event-lifecycle.start-held', { eventId: event.id, blockers: readiness.blockers });
        await notifyEventStartHeld({
          eventName: event.name,
          scheduledStart: event.startDate,
          blockers: readiness.blockers,
        }).catch(() => {});
      } else {
        log.info('event-lifecycle.start-still-held', { eventId: event.id, blockers: readiness.blockers });
      }
      continue;
    }

    // Ready, but the start moment itself hasn't arrived yet (we looked ahead) — announce when it does.
    if (event.startDate > now) continue;

    const flipped = await db
      .update(events)
      .set({ startNotified: 1 })
      .where(and(eq(events.id, event.id), eq(events.startNotified, 0)))
      .returning({ id: events.id });
    if (flipped.length > 0) {
      log.info('event-lifecycle.start', { eventId: event.id });
      await notifyEventStart({
        eventId: event.id,
        eventName: event.name,
        startDate: event.startDate,
        endDate: event.endDate,
      });
    }
  }

  // Events whose end time has passed but haven't been announced yet.
  for (const event of allEvents) {
    if (event.endDate && event.endDate < now && !event.endNotified) {
      const flipped = await db
        .update(events)
        .set({ endNotified: 1 })
        .where(and(eq(events.id, event.id), eq(events.endNotified, 0)))
        .returning({ id: events.id });
      if (flipped.length === 0) continue;

      const eventTeams = await db.select().from(teams).where(eq(teams.eventId, event.id));
      const eventTiles = await db.select().from(tiles).where(eq(tiles.eventId, event.id));
      const eventTileIds = eventTiles.map((t) => t.id);
      const eventCompletions = eventTileIds.length > 0
        ? await db.select().from(completions).where(inArray(completions.tileId, eventTileIds))
        : [];

      // Points-scoring events tally summed point weights of non-optional tiles;
      // classic events tally raw completed-tile counts. Rule-modified completions (first
      // bonus / decay) score their frozen awardedPoints; reveal-policy events count only
      // tiles that actually went live in the total (never-revealed tiles were never in play).
      const rules = parseEventRules(event.rules);
      const pointsMode = event.scoringMode === 'points';
      const scoredTiles = visibleTiles(rules, eventTiles).filter((t) => !t.optional);
      const weightById = new Map(scoredTiles.map((t) => [t.id, pointsMode ? (t.points ?? 0) : 1]));
      const totalScore = scoredTiles.reduce((sum, t) => sum + (pointsMode ? (t.points ?? 0) : 1), 0);

      const standings = eventTeams.map((team) => {
        const teamScore = eventCompletions
          .filter((c) => c.teamId === team.id && weightById.has(c.tileId))
          .reduce(
            (sum, c) => sum + (pointsMode && c.awardedPoints != null ? c.awardedPoints : weightById.get(c.tileId) || 0),
            0,
          );
        return { teamName: team.name, tilesCompleted: teamScore };
      });

      // Fun superlatives for the end post (MVP, biggest drop, most kills, …). Best-effort — a recap
      // hiccup must never block the actual "event ended" announcement.
      let superlatives: { emoji: string; title: string; winner: string; valueLabel: string }[] | undefined;
      try {
        const recap = await getEventRecap(event.id);
        if (recap && recap.awards.length > 0) {
          const byKey = new Map(recap.awards.map((a) => [a.key, a]));
          superlatives = RECAP_HIGHLIGHT_ORDER.map((k) => byKey.get(k))
            .filter((a): a is NonNullable<typeof a> => !!a)
            .slice(0, RECAP_HIGHLIGHT_COUNT)
            .map((a) => ({ emoji: a.emoji, title: a.title, winner: a.winner.name, valueLabel: a.winner.valueLabel }));
        }
      } catch (err) {
        log.warn('event-lifecycle.recap-failed', { eventId: event.id, err: String(err) });
      }

      log.info('event-lifecycle.end', { eventId: event.id });
      await notifyEventEnd({
        eventId: event.id,
        eventName: event.name,
        standings,
        totalTiles: pointsMode ? totalScore : scoredTiles.length,
        unit: pointsMode ? 'pts' : 'tiles',
        superlatives,
      });

      // Auto-build the payout rows from the configured prize-per-placement structure and final
      // standings. No-op when no structure is set or payouts already exist. Non-critical.
      await autoGeneratePayoutsOnEnd(event.id).catch(() => {});
    }
  }

  // Reveal-policy events: flip due tiles live (scheduled/interval draws) and reconcile the bounty
  // rotation. After the start loop above, so on the tick an event begins the "event started" post
  // lands before its first tile reveal. Never throws past its own catch.
  await processTileReveals().catch(() => {});
}
