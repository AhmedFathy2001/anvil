import { db } from '@/db';
import { completions, eventParticipants, events, moments, submissions, tiles } from '@/db/schema';
import { and, eq, inArray, ne, or } from 'drizzle-orm';
import { eventHasStarted } from '@/lib/completionGate';

export interface ClearedPreStartActivity {
  completions: number;
  submissions: number;
  moments: number;
  participantCounters: number;
}

/**
 * Remove activity that cannot legitimately exist before an event's first start.
 *
 * The lifecycle calls this only while startNotified is still false. That distinction matters: an
 * organiser may reschedule an event that genuinely ran, and moving its startDate later must never
 * erase history. A never-started board, however, has no valid submissions, completions, moments or
 * recap counters. Clearing those rows also frees the team/tile unique key so the real completion can
 * be inserted after the whistle.
 *
 * NEVER AFTER THE WHISTLE. `startNotified` flips on the lifecycle tick AFTER the start time, and
 * proofs are accepted from the start time itself (lib/completionGate eventHasStarted). In between,
 * the flag still says "never started" while real activity is arriving, so the callers' flag check is
 * not enough: this asks the clock, here, and touches nothing once the start has passed.
 */
export async function clearPreStartEventActivity(eventId: number, now: number = Date.now()): Promise<ClearedPreStartActivity> {
  return db.transaction(async (tx) => {
    // clan-scope: global -- the event named by the caller, by id.
    const [event] = await tx.select({ startDate: events.startDate }).from(events).where(eq(events.id, eventId)).limit(1);
    if (!event || eventHasStarted(event, now)) {
      return { completions: 0, submissions: 0, moments: 0, participantCounters: 0 };
    }

    const eventTiles = await tx.select({ id: tiles.id }).from(tiles).where(eq(tiles.eventId, eventId));
    const tileIds = eventTiles.map((tile) => tile.id);

    const removedCompletions = tileIds.length
      ? await tx.delete(completions).where(inArray(completions.tileId, tileIds)).returning({ id: completions.id })
      : [];
    const removedSubmissions = tileIds.length
      ? await tx.delete(submissions).where(inArray(submissions.tileId, tileIds)).returning({ id: submissions.id })
      : [];
    const removedMoments = await tx
      .delete(moments)
      .where(eq(moments.eventId, eventId))
      .returning({ id: moments.id });
    const resetParticipants = await tx
      .update(eventParticipants)
      .set({ deaths: 0, lootGpGained: 0, pvpKills: 0, biggestHit: 0, minutesPlayed: 0, caTasks: 0 })
      .where(
        and(
          eq(eventParticipants.eventId, eventId),
          or(
            ne(eventParticipants.deaths, 0),
            ne(eventParticipants.lootGpGained, 0),
            ne(eventParticipants.pvpKills, 0),
            ne(eventParticipants.biggestHit, 0),
            ne(eventParticipants.minutesPlayed, 0),
            ne(eventParticipants.caTasks, 0),
          ),
        ),
      )
      .returning({ id: eventParticipants.id });

    return {
      completions: removedCompletions.length,
      submissions: removedSubmissions.length,
      moments: removedMoments.length,
      participantCounters: resetParticipants.length,
    };
  });
}
