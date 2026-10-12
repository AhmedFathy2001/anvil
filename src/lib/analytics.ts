// Recording what people do, for /staff/analytics.
//
// A RECORDER MUST NEVER COST THE REQUEST IT IS RECORDING. Every writer here returns void, is called
// without `await`, and swallows its own failure: a dropped analytics row is a rounding error on a
// chart, while an analytics insert that throws into an event-creation handler is a clan admin who
// could not create their event. Same posture as lib/errorEvents.
//
// What is written, and why it is safe to keep, is set out on the table (db/schema analyticsEvents)
// and in lib/analyticsPattern.

import { inArray, lt, sql } from 'drizzle-orm';

import { db } from '@/db';
import { analyticsEvents } from '@/db/schema';
import { boundProps } from '@/lib/analyticsPattern';
import { sessionUserIdForAnalytics } from '@/lib/auth';
import { currentClan } from '@/lib/clanContext';
import { log } from '@/lib/logger';

/**
 * The actions worth counting. A closed list rather than free strings, so a typo is a type error
 * instead of a second, quietly empty row on the dashboard.
 */
export type ActionName =
  | 'clan.created'
  | 'event.created'
  | 'event.cloned'
  | 'event.started'
  | 'tile.created'
  | 'tiles.imported'
  | 'draft.started'
  | 'draft.pick'
  | 'signup.submitted'
  | 'submission.created'
  | 'submission.removed'
  | 'weekly.created'
  | 'guide.created'
  | 'guide.copied'
  | 'auth.login'
  | 'plugin.linked'
  | 'profile.synced';

interface Who {
  clanId?: number | null;
  userId?: number | null;
  props?: Record<string, unknown> | null;
}

function insert(row: typeof analyticsEvents.$inferInsert): void {
  void db
    .insert(analyticsEvents)
    .values(row)
    .then(
      () => undefined,
      (err: unknown) => log.warn('analytics.insert-failed', { kind: row.kind, name: row.name }, err),
    );
}

/**
 * Count one feature use. Fire-and-forget: call it without `await`, after the action succeeded.
 *
 * Leave `clanId` / `userId` OUT (undefined) to have them read from the request — the clan this
 * request is for, and the signed session cookie. Pass `null` to record "none" on purpose. Most admin
 * routes only hold a boolean from their guard, and making each of them re-read the user to feed a
 * counter is how instrumentation ends up costing more than the thing it measures.
 */
export function track(name: ActionName, who: Who = {}): void {
  void (async () => {
    const userId = who.userId !== undefined ? who.userId : await sessionUserIdForAnalytics();
    const clanId =
      who.clanId !== undefined ? who.clanId : ((await currentClan().catch(() => null))?.id ?? null);
    insert({ kind: 'action', name, clanId, userId, props: boundProps(who.props) });
  })().catch((err: unknown) => log.warn('analytics.track-failed', { name }, err));
}

/** One page view. The pattern must already be scrubbed (lib/analyticsPattern.scrubPattern). */
export function trackPage(input: {
  pattern: string;
  clanId: number | null;
  userId: number | null;
  sessionId: string;
}): void {
  try {
    insert({
      kind: 'page',
      name: input.pattern,
      clanId: input.clanId,
      userId: input.userId,
      sessionId: input.sessionId,
    });
  } catch (err) {
    log.warn('analytics.page-failed', {}, err);
  }
}

// ── Plugin activity ─────────────────────────────────────────────────────────────────────────────
//
// ONE ROW PER (clan, account, day), not one per request. The plugin talks to us constantly — config
// polls, board polls, stat pushes — and logging those would make this the biggest table in the
// database to answer a question ("how many people ran the plugin today?") that needs one bit per
// person per day. The dedup is in memory, so a restart can write a second row for the same day;
// every read counts DISTINCT accounts, so that costs a few bytes and nothing on the chart.

const seenToday = new Set<string>();
let seenDay = '';
const MAX_SEEN = 50_000;

export function trackPluginDay(clanId: number | null, accountId: number | null): void {
  try {
    if (!accountId) return;
    const day = new Date().toISOString().slice(0, 10);
    if (day !== seenDay || seenToday.size > MAX_SEEN) {
      seenToday.clear();
      seenDay = day;
    }
    const key = `${clanId ?? 0}:${accountId}`;
    if (seenToday.has(key)) return;
    seenToday.add(key);
    insert({ kind: 'plugin', name: 'plugin.active', clanId, accountId });
  } catch (err) {
    log.warn('analytics.plugin-failed', {}, err);
  }
}

// ── Retention ───────────────────────────────────────────────────────────────────────────────────

/** Just over a year, so "this month against the same month last year" always has both months. */
export const RETENTION_DAYS = 400;

/**
 * Drop rows past retention, a bounded batch at a time.
 *
 * Batched because the first run after a long gap could otherwise delete millions of rows in one
 * statement while the hourly cron holds a connection; ten batches an hour clears any realistic
 * backlog within a day and costs one index range scan when there is nothing to do.
 */
export async function pruneAnalyticsEvents(olderThanDays = RETENTION_DAYS): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString().replace('T', ' ').slice(0, 19);
  let total = 0;
  for (let batch = 0; batch < 10; batch++) {
    // clan-scope: global -- retention spans the platform; it is not one clan's decision.
    const victims = db
      .select({ id: analyticsEvents.id })
      .from(analyticsEvents)
      .where(lt(analyticsEvents.ts, cutoff))
      .limit(5_000);
    const deleted = await db
      .delete(analyticsEvents)
      .where(inArray(analyticsEvents.id, victims))
      .returning({ id: sql<number>`1` });
    total += deleted.length;
    if (deleted.length < 5_000) break;
  }
  return total;
}
