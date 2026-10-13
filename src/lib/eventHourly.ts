import { db } from '@/db';
import { eventHourSnapshots, events } from '@/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { loadBoard } from '@/lib/eventDigest';
import { effectiveStatsForPlayers } from '@/lib/liveStats';
import { log } from '@/lib/logger';
import { dueHour, hourTuple, stampMs, type HourSnapshotData } from '@/lib/eventDay';

// The hourly progress row (lib/eventDay HourSnapshotData): taken on the lifecycle tick, once per
// running event per hour since its start. One indexed lookup per running event per minute, and one
// small insert per event per hour — nothing else touches the database until a row is due.

/** Record the due hour for every running event. Never throws. */
export async function runHourlySnapshots(nowMs = Date.now()): Promise<void> {
  // clan-scope: global -- the lifecycle cron walks every clan's events; each row belongs to its own event.
  const running = await db
    .select()
    .from(events)
    .where(and(eq(events.startNotified, 1), eq(events.endNotified, 0)));
  for (const event of running) {
    if (event.forceEndedAt) continue;
    try {
      await snapshotEventHour(event, nowMs);
    } catch (err) {
      log.warn('event-hourly.failed', { eventId: event.id, err: String(err) });
    }
  }
}

async function snapshotEventHour(event: typeof events.$inferSelect, nowMs: number): Promise<void> {
  const startMs = stampMs(event.startDate);
  const endMs = stampMs(event.endDate);
  if (startMs == null || endMs == null) return;
  const hour = dueHour(nowMs, startMs, endMs);
  if (hour == null) return;

  const [latest] = await db
    .select({ hourIndex: eventHourSnapshots.hourIndex })
    .from(eventHourSnapshots)
    .where(eq(eventHourSnapshots.eventId, event.id))
    .orderBy(desc(eventHourSnapshots.hourIndex))
    .limit(1);
  if (latest && latest.hourIndex >= hour) return;

  // A box that was down for a few hours records the hour it came back in, not a backfill of hours it
  // never saw — a gap in the curve is honest; three identical points pretending to be history isn't.
  const { eventPlayers, scored } = await loadBoard(event);
  const statsNow = await effectiveStatsForPlayers(eventPlayers);
  const data: HourSnapshotData = {
    p: Object.fromEntries(eventPlayers.map((p) => [String(p.id), hourTuple(p, statsNow.get(p.id))])),
    t: Object.fromEntries(scored.map((s) => [String(s.teamId), s.score])),
  };
  await db
    .insert(eventHourSnapshots)
    .values({ eventId: event.id, hourIndex: hour, takenAt: new Date(nowMs).toISOString(), data: JSON.stringify(data) })
    .onConflictDoNothing();
}
