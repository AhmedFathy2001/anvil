import { sql } from 'drizzle-orm';

import { db } from '@/db';
import { log } from '@/lib/logger';

/**
 * Tell listening plugins (push/server.ts) that a team's tiles moved, for a write the database
 * triggers can't see (migration 0149): a live stat push lands on the member's account, not on any
 * event row, yet it moves that team's stat tiles. Fire-and-forget — a lost hint only means the
 * plugin's slow poll picks the change up instead.
 */
export function notifyTeamTiles(eventId: number, teamId: number, tileIds: number[]): void {
  const ids = tileIds.length > 0 ? tileIds : [null];
  void Promise.all(
    ids.map((i) =>
      db.execute(sql`select pg_notify('anvil_push', ${JSON.stringify({ k: 'stats', e: eventId, t: teamId, i })})`),
    ),
  ).catch((err: unknown) => log.warn('push-notify.failed', { message: (err as Error).message }));
}
