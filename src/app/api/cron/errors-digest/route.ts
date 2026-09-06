import { NextResponse } from 'next/server';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clans, errorEvents } from '@/db/schema';
import { timingSafeStrEqual } from '@/lib/auth';
import { buildDigest, type DigestRow } from '@/lib/errorDigest';
import { pruneErrorEvents } from '@/lib/errorEvents';
import { sendOpsWebhook } from '@/lib/opsWebhook';
import { log } from '@/lib/logger';

// What broke since the last time anyone looked.
//
// Hourly. Reads the failures that have happened since the previous digest, posts them to the
// operator's channel, records what it reported, and prunes what nobody has seen for a month.
//
// SILENT WHEN THERE IS NOTHING TO SAY. An hourly "0 errors" trains everybody to ignore the channel,
// which costs precisely the alarm this exists to raise — so a quiet hour posts nothing at all and
// returns `{ posted: false }` for the cron log to record.
//
// The reported counts are written back EVEN IF the post failed to send. That is deliberate and it is
// the safer direction: a Discord outage would otherwise have the next digest re-report everything,
// and a digest that cries wolf about an hour-old resolved incident is worse than one that misses an
// hour. `/staff/errors` still has the complete picture either way.

export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production' && !CRON_SECRET) {
    return NextResponse.json(
      { error: 'Server misconfigured: CRON_SECRET is required in production' },
      { status: 500 },
    );
  }
  const authHeader = request.headers.get('authorization');
  const hasValidSecret = !!CRON_SECRET && timingSafeStrEqual(authHeader ?? '', `Bearer ${CRON_SECRET}`);
  const devBypass = !CRON_SECRET && request.headers.get('x-vercel-cron') === '1';
  if (!hasValidSecret && !devBypass) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // clan-scope: global -- the operator's digest spans every clan by definition; that is what makes
  // it the platform's alarm rather than one clan's.
  const rows = await db
    .select({
      id: errorEvents.id,
      fingerprint: errorEvents.fingerprint,
      name: errorEvents.name,
      message: errorEvents.message,
      path: errorEvents.path,
      source: errorEvents.source,
      release: errorEvents.release,
      clanSlug: clans.slug,
      count: errorEvents.count,
      notifiedCount: errorEvents.notifiedCount,
      firstSeenAt: errorEvents.firstSeenAt,
      lastSeenAt: errorEvents.lastSeenAt,
    })
    .from(errorEvents)
    .leftJoin(clans, eq(clans.id, errorEvents.clanId))
    .where(
      and(
        // Something happened since the last digest…
        gt(errorEvents.count, errorEvents.notifiedCount),
        // …and nobody has already ticked it off. A resolved row that recurs clears its own
        // resolvedAt on the next occurrence (lib/errorEvents), so this cannot hide a live problem.
        isNull(errorEvents.resolvedAt),
      ),
    )
    .orderBy(desc(errorEvents.lastSeenAt))
    .limit(200);

  const embed = buildDigest(rows as DigestRow[]);
  let posted = false;
  if (embed) {
    posted = await sendOpsWebhook(embed);
    // Mark everything READ, including what the embed had no room to name — the overflow is counted
    // in the footer and lives on /staff/errors, and re-reporting it next hour would be noise.
    await db
      .update(errorEvents)
      .set({
        notifiedCount: sql`${errorEvents.count}`,
        notifiedAt: sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')`,
      })
      .where(and(gt(errorEvents.count, errorEvents.notifiedCount), isNull(errorEvents.resolvedAt)));
  }

  const pruned = await pruneErrorEvents();
  log.info('errors-digest.tick', { failures: rows.length, posted, pruned });

  return NextResponse.json({ ok: true, failures: rows.length, posted, pruned });
}
