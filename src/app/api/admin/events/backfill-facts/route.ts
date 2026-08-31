import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { events, playerEventFacts } from '@/db/schema';
import { verifyAdmin } from '@/lib/auth';
import { resolveClanFromRequest } from '@/lib/clanContext';
import { writePlayerEventFacts } from '@/lib/playerEventFacts';
import { isEventEnded } from '@/lib/survey';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
// A backfill over every ended event; the default serverless-ish budget is not the constraint we want.
export const maxDuration = 300;

/**
 * Materialize player_event_facts for events that ended without them.
 *
 * Facts are written by the end-of-event lifecycle tick, so any bingo that finished BEFORE that
 * machinery existed has none — and the member profile then reports "0 events played" to someone with
 * years of history. There is a repo script for this, but it can't help a hosted clan: the production
 * image is a Next standalone bundle carrying only migrate.mjs, with no tsx and no scripts directory.
 * Without this endpoint the only fix was SSH into the box, which is not a thing an operator of a
 * hosted instance can or should do.
 *
 * Safe to run repeatedly: writePlayerEventFacts is an idempotent delete+insert per event, and events
 * that already have facts are skipped unless `?all=1` asks for a recompute (after an attribution fix).
 */
export async function POST(request: Request) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Scope to THIS clan. verifyAdmin() only proves admin of the clan this request is FOR, so the
  // backfill must touch only that clan's events. Unscoped, an admin of any (even free) clan could
  // recompute — delete+insert — every other clan's facts, racing their own lifecycle ticks and
  // making a 300s deployment-wide job a one-request DoS. This maintenance tool is per-clan by
  // intent (see the header); the global scan was the bug.
  const clan = await resolveClanFromRequest(request);
  if (!clan) {
    return NextResponse.json({ error: 'No clan for this host' }, { status: 400 });
  }

  const all = new URL(request.url).searchParams.get('all') === '1';
  const allEvents = await db.select().from(events).where(eq(events.clanId, clan.id));
  const existing = new Set(
    (await db.select({ eventId: playerEventFacts.eventId }).from(playerEventFacts)).map((r) => r.eventId),
  );

  const written: { id: number; name: string; rows: number }[] = [];
  const failed: { id: number; name: string; error: string }[] = [];
  let skipped = 0;

  for (const event of allEvents) {
    if (!isEventEnded(event)) continue; // a live event's facts are still moving
    if (!all && existing.has(event.id)) {
      skipped++;
      continue;
    }
    try {
      const rows = await writePlayerEventFacts(event.id, { force: all });
      written.push({ id: event.id, name: event.name, rows });
    } catch (e) {
      // One unscoreable event mustn't abort the rest — report it and carry on.
      failed.push({ id: event.id, name: event.name, error: (e as Error).message });
    }
  }

  log.info('admin.backfill-facts', {
    events: written.length,
    rows: written.reduce((sum, w) => sum + w.rows, 0),
    skipped,
    failed: failed.length,
    all,
  });

  return NextResponse.json({
    ok: true,
    written,
    skipped,
    failed,
    totalRows: written.reduce((sum, w) => sum + w.rows, 0),
  });
}
