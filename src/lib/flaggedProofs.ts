import { and, count, eq, gt, isNotNull, isNull, or } from 'drizzle-orm';
import { db } from '@/db';
import { events, submissions, tiles } from '@/db/schema';

/** How long after a board ends its unchecked flags still ask for attention. */
export const FLAGGED_PROOF_WINDOW_MS = 30 * 86_400_000;

/**
 * Flagged proofs (submissions.flaggedReason) waiting on staff, per board of this clan.
 *
 * Running boards, and ones that ended within the window — settling flags is part of paying out, and
 * an old one nobody cleared shouldn't nag forever. One query for the dashboard's "What needs you"
 * and the sidebar's badge, so the two can't disagree; /admin/proofs lists the same window.
 */
export async function flaggedProofBoards(
  clanId: number,
  now = Date.now(),
): Promise<{ eventId: number; name: string; count: number }[]> {
  const rows = await db
    .select({ eventId: events.id, name: events.name, c: count() })
    .from(submissions)
    .innerJoin(tiles, eq(submissions.tileId, tiles.id))
    .innerJoin(events, eq(tiles.eventId, events.id))
    .where(
      and(
        eq(events.clanId, clanId),
        isNotNull(submissions.flaggedReason),
        or(isNull(events.endDate), gt(events.endDate, new Date(now - FLAGGED_PROOF_WINDOW_MS).toISOString())),
      ),
    )
    .groupBy(events.id);
  return rows.map((r) => ({ eventId: r.eventId, name: r.name, count: Number(r.c) }));
}
