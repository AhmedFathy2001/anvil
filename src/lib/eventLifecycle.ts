import { db } from '@/db';
import { events, teams, tiles, completions } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { notifyEventStart, notifyEventEnd } from '@/lib/discord';
import { autoGeneratePayoutsOnEnd } from '@/lib/payouts';
import { log } from '@/lib/logger';

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

  // Events whose start time has passed but haven't been announced yet.
  for (const event of allEvents) {
    if (event.startDate && event.startDate <= now && !event.startNotified) {
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
      // classic events tally raw completed-tile counts.
      const pointsMode = event.scoringMode === 'points';
      const scoredTiles = eventTiles.filter((t) => !t.optional);
      const weightById = new Map(scoredTiles.map((t) => [t.id, pointsMode ? (t.points ?? 0) : 1]));
      const totalScore = scoredTiles.reduce((sum, t) => sum + (pointsMode ? (t.points ?? 0) : 1), 0);

      const standings = eventTeams.map((team) => {
        const teamScore = eventCompletions
          .filter((c) => c.teamId === team.id && weightById.has(c.tileId))
          .reduce((sum, c) => sum + (weightById.get(c.tileId) || 0), 0);
        return { teamName: team.name, tilesCompleted: teamScore };
      });

      log.info('event-lifecycle.end', { eventId: event.id });
      await notifyEventEnd({
        eventId: event.id,
        eventName: event.name,
        standings,
        totalTiles: pointsMode ? totalScore : scoredTiles.length,
        unit: pointsMode ? 'pts' : 'tiles',
      });

      // Auto-build the payout rows from the configured prize-per-placement structure and final
      // standings. No-op when no structure is set or payouts already exist. Non-critical.
      await autoGeneratePayoutsOnEnd(event.id).catch(() => {});
    }
  }
}
