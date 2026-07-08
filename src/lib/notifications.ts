import { db } from '@/db';
import { pendingNotifications, tiles, teams, events } from '@/db/schema';
import { eq, and, or, lte, sql } from 'drizzle-orm';
import { notifyMergedSubmission } from '@/lib/discord';

// Server-side debounce for bingo submission notifications. Each submission upserts a per-(tile,team)
// bucket instead of posting to Discord immediately; a flush collapses everything accrued into ONE
// merged embed. This tames the plugin's auto-submission firehose — a kill spree, or a downtime boss
// ticking one kill at a time, becomes a single post instead of one per kill. The submission row is
// always persisted first by the caller, so a lost/late notification never costs progress.
//
// Two flush triggers feed this: an opportunistic call at the end of each submission request (active
// events have constant traffic) and a per-minute cron backstop for when traffic stops. A completing
// submission flushes its own bucket immediately so "tile done!" is never delayed.

const QUIET_WINDOW_MS = 45_000;       // post once a tile+team has been quiet this long
const MAX_WINDOW_MS = 5 * 60_000;     // ...or this long since the first buffered submission, regardless

// Milestone throttle for grindy count tiles. A 4000-kill task would otherwise fire a merged
// progress post every window for days. Above LARGE_TILE_MIN we announce progress only when the
// running total crosses a MILESTONE_FRACTION step of the goal (each 25% → ~4 posts), plus the
// always-immediate completion post. Small tiles are unaffected. Every submission is still
// recorded on the site regardless — this only throttles the Discord chatter, not the scoring.
const LARGE_TILE_MIN = 25;
const MILESTONE_FRACTION = 0.25;

// Did this flush's running total cross a milestone step since the window opened? Stateless: the
// bucket carries the true running total and the amount added this window, and a suppressed window
// still advances the total, so crossings stay continuous across suppressed windows. Returns true
// (post it) when there's no goal/total to measure against, or the tile is small.
function crossesMilestone(pendingAmount: number, latestTotal: number | null, requiredAmount: number | null): boolean {
  if (latestTotal == null || requiredAmount == null || requiredAmount < LARGE_TILE_MIN) return true;
  const step = Math.max(1, requiredAmount * MILESTONE_FRACTION);
  const before = latestTotal - pendingAmount;
  return Math.floor(latestTotal / step) > Math.floor(before / step);
}

interface QueueParams {
  eventId: number;
  tileId: number;
  teamId: number;
  amount: number;
  currentTotal: number | null;
  requiredAmount: number | null;
  imageUrl: string | null;
  note: string | null;
  creditPlayerName: string | null;
  completed: boolean;
}

/**
 * Buffer one submission into its (tile, team) bucket. Returns fast; the Discord post is deferred to a
 * flush — except a completing submission, which flushes its own bucket inline so the completion post
 * is immediate.
 */
export async function queueSubmissionNotification(p: QueueParams): Promise<void> {
  const now = new Date().toISOString();
  await db
    .insert(pendingNotifications)
    .values({
      tileId: p.tileId,
      teamId: p.teamId,
      eventId: p.eventId,
      pendingAmount: p.amount,
      latestTotal: p.currentTotal,
      requiredAmount: p.requiredAmount,
      latestImageUrl: p.imageUrl,
      latestNote: p.note,
      latestCreditName: p.creditPlayerName,
      completed: p.completed ? 1 : 0,
      firstQueuedAt: now,
      lastEventAt: now,
    })
    .onConflictDoUpdate({
      target: [pendingNotifications.tileId, pendingNotifications.teamId],
      set: {
        pendingAmount: sql`${pendingNotifications.pendingAmount} + ${p.amount}`,
        latestTotal: p.currentTotal,
        requiredAmount: p.requiredAmount,
        // Keep the latest *non-null* proof, so a count-only kill ping never clears the completion
        // screenshot, and a real image always overwrites an earlier null.
        latestImageUrl: p.imageUrl ?? sql`${pendingNotifications.latestImageUrl}`,
        latestNote: p.note ?? sql`${pendingNotifications.latestNote}`,
        latestCreditName: p.creditPlayerName ?? sql`${pendingNotifications.latestCreditName}`,
        completed: p.completed ? 1 : sql`${pendingNotifications.completed}`,
        lastEventAt: now,
      },
    });

  if (p.completed) {
    await flushBucket(p.tileId, p.teamId).catch(() => {});
  }
}

/**
 * Atomically claim a bucket (delete-and-return) and post its merged embed. The delete is the claim:
 * if two flushes race (opportunistic request + cron), only the one that deletes the row posts, so a
 * bucket is never double-posted. Names/colour/type are re-joined here to keep the buffer row lean.
 */
async function flushBucket(tileId: number, teamId: number): Promise<boolean> {
  const deleted = await db
    .delete(pendingNotifications)
    .where(and(eq(pendingNotifications.tileId, tileId), eq(pendingNotifications.teamId, teamId)))
    .returning();
  if (deleted.length === 0) return false;
  const row = deleted[0];

  const tile = await db.query.tiles.findFirst({ where: eq(tiles.id, row.tileId) });
  const team = await db.query.teams.findFirst({ where: eq(teams.id, row.teamId) });
  const event = await db.query.events.findFirst({ where: eq(events.id, row.eventId) });
  if (!tile || !team || !event) return false; // tile/team/event vanished — drop the post silently

  // Throttle grindy progress chatter to milestone crossings; a completing submission always posts.
  // The bucket is already claimed (deleted) above, so a suppressed window just skips the Discord
  // post — the underlying submissions stay recorded and the running total keeps advancing.
  if (row.completed !== 1 && !crossesMilestone(row.pendingAmount, row.latestTotal, row.requiredAmount)) {
    return false;
  }

  await notifyMergedSubmission({
    eventName: event.name,
    tileLabel: tile.label,
    teamName: team.name,
    teamColor: team.color,
    tileType: tile.tileType,
    creditPlayerName: row.latestCreditName,
    pendingAmount: row.pendingAmount,
    currentTotal: row.latestTotal,
    requiredAmount: row.requiredAmount,
    note: row.latestNote,
    imageUrl: row.latestImageUrl,
    completed: row.completed === 1,
  }).catch(() => {});
  return true;
}

/**
 * Post every bucket that's due: completed, quiet for QUIET_WINDOW_MS, or older than MAX_WINDOW_MS.
 * Called opportunistically per request and by the per-minute cron. Returns how many were posted.
 */
export async function flushPendingNotifications(): Promise<number> {
  const nowMs = Date.now();
  const quietBefore = new Date(nowMs - QUIET_WINDOW_MS).toISOString();
  const maxBefore = new Date(nowMs - MAX_WINDOW_MS).toISOString();

  const due = await db
    .select({ tileId: pendingNotifications.tileId, teamId: pendingNotifications.teamId })
    .from(pendingNotifications)
    .where(
      or(
        eq(pendingNotifications.completed, 1),
        lte(pendingNotifications.lastEventAt, quietBefore),
        lte(pendingNotifications.firstQueuedAt, maxBefore),
      ),
    );

  let posted = 0;
  for (const d of due) {
    if (await flushBucket(d.tileId, d.teamId)) posted++;
  }
  return posted;
}
