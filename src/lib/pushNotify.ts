import { eq, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, eventParticipants, users } from '@/db/schema';
import { log } from '@/lib/logger';

/**
 * A board just went live or stopped (its start or end, a lab session ended, extended or restarted):
 * every person playing it re-tickets their live push (lib/push/hub dispatch `p`), so the plugin
 * picks up the board now instead of on its 2-minute fallback poll. A row change on `events` alone
 * reaches only clients already listening on that board — and nobody is, before it starts or after
 * it ends. Fire-and-forget like the rest.
 */
export function notifyBoardPeople(eventId: number): void {
  void (async () => {
    const rows = await db
      .selectDistinct({ id: users.id })
      .from(eventParticipants)
      .innerJoin(accounts, eq(accounts.id, eventParticipants.accountId))
      .innerJoin(users, eq(users.playerId, accounts.playerId))
      .where(eq(eventParticipants.eventId, eventId));
    if (rows.length === 0) return;
    // pg_notify carries at most ~8 KB: a big board goes in slices.
    for (let i = 0; i < rows.length; i += 500) {
      const p = rows.slice(i, i + 500).map((r) => r.id);
      await db.execute(sql`select pg_notify('anvil_push', ${JSON.stringify({ k: 'events', e: eventId, p })})`);
    }
  })().catch((err: unknown) => log.warn('push-notify.failed', { message: (err as Error).message }));
}

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
