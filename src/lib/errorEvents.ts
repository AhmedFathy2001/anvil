// Recording what broke.
//
// THIS CODE RUNS WHILE THE APP IS ALREADY FAILING, which sets every rule below. It must not throw,
// must not await anything the request is waiting on, and must not assume the database is reachable —
// a recorder that dies on a broken connection pool goes silent at exactly the moment it is needed,
// and one that throws turns a handled 500 into an unhandled one.
//
// So: every path is wrapped, stdout always gets the line whether or not the row lands, and the
// write is fired without being awaited by the caller.

import { and, eq, isNull, lt, sql } from 'drizzle-orm';

import { db } from '@/db';
import { errorEvents } from '@/db/schema';
import { APP_VERSION } from '@/lib/serverInfo';
import { fingerprintOf, normalizePath, scrubErrorText, trimStack, truncateMessage } from '@/lib/errorFingerprint';
import { log } from '@/lib/logger';

export interface CapturedError {
  name: string;
  message: string;
  stack?: string | null;
  path?: string | null;
  method?: string | null;
  /** Next's context: 'render' | 'route' | 'action' | 'middleware', plus the router it came from. */
  source?: string | null;
  clanId?: number | null;
}

/**
 * A LOOP MUST NOT BECOME A WRITE LOOP.
 *
 * The failure mode this exists for: a broken render on a page something polls, firing hundreds of
 * times a minute. Every one of those is the same row, and issuing an upsert per occurrence would
 * have the recorder add load to a database that may already be the thing that is struggling.
 *
 * So each failure gets at most one write per window; occurrences in between are counted in memory
 * and folded into the next write.
 *
 * The trade: a failure that stops occurring loses whatever had accumulated since its last write, and
 * a process restart loses the same. That is the right direction for this table — it is answering
 * "what is wrong and how bad", not billing anybody — but it is a real undercount and worth knowing
 * when reading a small number.
 */
const WRITE_WINDOW_MS = 15_000;

/** Bounded so a pathological spread of distinct failures cannot grow this without limit. */
const MAX_TRACKED = 500;

/**
 * Keyed by (fingerprint, clan), NOT by fingerprint — the same key the row is unique on.
 *
 * Keyed on the fingerprint alone, one clan's occurrence silently suppressed every other clan's for
 * the whole window: the same bug hitting four clans wrote one row and the other three were dropped
 * rather than deferred, because their write never happened and nothing remembered them. Caught by
 * firing the same failure at the apex and at a clan and finding a single row.
 */
const pending = new Map<string, { extra: number; lastWrite: number }>();

function writeKey(fingerprint: string, clanId: number | null | undefined): string {
  return `${fingerprint}\u0000${clanId ?? ''}`;
}

/**
 * Record a failure. Never throws, never rejects — callers may ignore the promise, and do.
 *
 * The stdout line happens FIRST and unconditionally: it is the fallback that works when the database
 * is the casualty, and it is what a self-hoster tailing `docker logs` already relies on.
 */
export async function recordError(err: CapturedError): Promise<void> {
  const name = err.name || 'Error';
  // Bound parameter values and constraint-detail values never reach the log, the row or the digest
  // (lib/errorFingerprint scrubErrorText). The stack's own first lines repeat the message, so it is
  // scrubbed the same way; its frames are untouched.
  const message = truncateMessage(scrubErrorText(err.message) || 'Unknown error');
  const stack = err.stack ? scrubErrorText(err.stack) : err.stack;
  const path = normalizePath(err.path);

  try {
    log.error('app.error', { path, method: err.method, source: err.source, clanId: err.clanId }, {
      name,
      message,
      stack,
    });
  } catch {
    /* logging must not be the thing that throws */
  }

  try {
    const fingerprint = fingerprintOf({ name, message, stack, path: err.path });
    const key = writeKey(fingerprint, err.clanId);
    const now = Date.now();
    const seen = pending.get(key);

    if (seen && now - seen.lastWrite < WRITE_WINDOW_MS) {
      seen.extra += 1;
      return;
    }

    const increment = 1 + (seen?.extra ?? 0);
    if (pending.size >= MAX_TRACKED && !seen) pending.clear();
    pending.set(key, { extra: 0, lastWrite: now });

    // clan-scope: global -- an error is recorded for whichever clan the failing request was for,
    // which is carried in the row rather than filtered on; an apex failure belongs to no clan.
    await db
      .insert(errorEvents)
      .values({
        fingerprint,
        clanId: err.clanId ?? null,
        name,
        message,
        stack: trimStack(stack),
        path,
        method: err.method ?? null,
        source: err.source ?? null,
        release: APP_VERSION,
        count: increment,
      })
      .onConflictDoUpdate({
        target: [errorEvents.fingerprint, errorEvents.clanId],
        set: {
          count: sql`${errorEvents.count} + ${increment}`,
          lastSeenAt: sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`,
          // The newest occurrence wins for the mutable detail: a fix that changed the release should
          // show the release it is still happening on, not the one it started on.
          release: APP_VERSION,
          stack: trimStack(stack),
          message,
          // COMING BACK UN-RESOLVES IT. Someone ticked this off; it happened again; that is new
          // information and the digest should say so rather than staying quiet because of a tick.
          resolvedAt: null,
          resolvedByUserId: null,
        },
      });
  } catch (writeErr) {
    // The database is a plausible casualty of whatever we are recording. The stdout line above
    // already landed, so this is genuinely recoverable — say so once, quietly, and carry on.
    try {
      log.warn('app.error-record-failed', {}, writeErr);
    } catch {
      /* nothing left to try */
    }
  }
}

/**
 * Fire-and-forget, for a caller that must not wait — which is all of them.
 *
 * `void` on the promise plus a catch, because an unhandled rejection from the error recorder would
 * be a genuinely absurd way to take a process down.
 */
export function captureError(err: CapturedError): void {
  void recordError(err).catch(() => {});
}

/**
 * Forget failures nobody has seen for a while.
 *
 * This table answers "what is wrong now". A row last seen six weeks ago is either fixed or was never
 * worth a row, and keeping it makes the surface that should show today's problems look like an
 * archive. Run from the digest cron, so it needs no schedule of its own.
 */
export async function pruneErrorEvents(olderThanDays = 30): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);
  // clan-scope: global -- retention spans the platform; it is not one clan's decision.
  const deleted = await db
    .delete(errorEvents)
    .where(and(lt(errorEvents.lastSeenAt, cutoff), isNull(errorEvents.resolvedAt)))
    .returning({ id: errorEvents.id });
  return deleted.length;
}

/** Mark one row handled. Returns false when it named nothing. */
export async function resolveErrorEvent(id: number, userId: number): Promise<boolean> {
  // clan-scope: global -- addressed by its own primary key by a platform operator.
  const rows = await db
    .update(errorEvents)
    .set({
      resolvedAt: sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`,
      resolvedByUserId: userId,
    })
    .where(eq(errorEvents.id, id))
    .returning({ id: errorEvents.id });
  return rows.length > 0;
}
