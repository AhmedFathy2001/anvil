import { NextResponse } from 'next/server';
import { eventForRequest } from '@/lib/eventScope';
import { requireClan } from '@/lib/clanContext';
import { db } from '@/db';
import { getSetting, setSetting } from '@/lib/settings';
import { eventParticipants, events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import { getHiscoresStats } from '@/lib/hiscores';
import { assertEventEditable } from '@/lib/eventLock';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Manual stat pulls hammer the OSRS hiscores (one request per player), so they're throttled to
// one every 30 minutes per event — alongside the hourly auto-refresh cron. The last-pull time is
// persisted in `settings` (not just client state) so the cooldown survives a page refresh and is
// actually enforced server-side. `forceReset` (fixing a mis-timed baseline) bypasses the wait.
const STATS_PULL_COOLDOWN_MS = 30 * 60 * 1000;
const statsPullKey = (eventId: number) => `stats_pull_at:${eventId}`;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const clan = await requireClan();
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  // Whose event is this? Ids are global and this one came from the URL.
  if (!(await eventForRequest(request, eId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  // Finished events are read-only unless explicitly unlocked (lib/eventLock).
  const lockedResponse = await assertEventEditable(eId);
  if (lockedResponse) return lockedResponse;

  // Check for force reset flag
  const { searchParams } = new URL(request.url);
  const forceReset = searchParams.get('forceReset') === 'true';

  // 30-minute cooldown (persisted, server-enforced) — skipped for a force-reset correction.
  const cooldownKey = statsPullKey(eId);
  if (!forceReset) {
    const lastPull = await getSetting(clan.id, cooldownKey);
    if (lastPull) {
      const lastMs = new Date(lastPull).getTime();
      if (Number.isFinite(lastMs) && Date.now() - lastMs < STATS_PULL_COOLDOWN_MS) {
        return NextResponse.json(
          {
            error: 'Stats were pulled recently — please wait before pulling again.',
            nextRefresh: new Date(lastMs + STATS_PULL_COOLDOWN_MS).toISOString(),
          },
          { status: 429 },
        );
      }
    }
  }

  // Check if event has started
  const event = await db.query.events.findFirst({
    where: eq(events.id, eId),
  });
  const now = new Date();
  const eventStarted = event?.startDate && new Date(event.startDate) <= now;

  const eventPlayers = await db.query.eventParticipants.findMany({
    where: eq(eventParticipants.eventId, eId),
  });

  let snapshotted = 0;
  let refreshed = 0;
  const failed: string[] = [];
  const timestamp = now.toISOString();

  for (const player of eventPlayers) {
    try {
      const stats = await getHiscoresStats(player.name);
      const statsJson = JSON.stringify(stats);

      // A baseline is the start line, so it may only be set AT or AFTER the start — the sweep does
      // this automatically, and re-anchors anything captured too early. A manual pull before the
      // event starts therefore only WARMS cachedStats (for display); it must not set the scoring
      // baseline, or a player grinding between the pull and the whistle would have it counted. The
      // one exception is `forceReset`, the explicit admin correction of a mis-timed baseline.
      const setBaseline = forceReset || (eventStarted && !player.statsSnapshot);
      if (setBaseline) {
        await db
          .update(eventParticipants)
          .set({
            statsSnapshot: statsJson,
            snapshotAt: timestamp,
            cachedStats: statsJson,
            lastStatsFetch: timestamp,
          })
          .where(eq(eventParticipants.id, player.id));
        snapshotted++;
      } else {
        // Started event with a baseline already → refresh current; not-yet-started → warm only.
        await db
          .update(eventParticipants)
          .set({
            cachedStats: statsJson,
            lastStatsFetch: timestamp,
          })
          .where(eq(eventParticipants.id, player.id));
        refreshed++;
      }
    } catch {
      failed.push(player.name);
    }
    // Small delay to avoid rate-limiting by Jagex
    await delay(1200);
  }

  // Record the pull time so the cooldown persists across refreshes and future requests.
  await setSetting(clan.id, cooldownKey, timestamp);

  return NextResponse.json({ snapshotted, refreshed, failed, pulledAt: timestamp });
}
