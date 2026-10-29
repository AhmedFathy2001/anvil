// The end-of-event Discord tidy-up an event (or its clan) asked for (lib/discordPostPolicy
// resolveEventRoles): take the player role back when the event ends, and delete the team channels
// and roles at the end or some days after. Rides the lifecycle tick; events.discord_cleanup records
// each step so it runs once.

import { and, eq, isNotNull, ne, or, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { events } from '@/db/schema';
import { cleanupDueAt } from '@/lib/discordPostPolicy';
import { teardownTeamDiscord, unassignSharedRoles } from '@/lib/discord-teams';
import { teardownEventServer, usesEventServer } from '@/lib/eventDiscord';
import { loadEventRoleSettings } from '@/lib/eventDiscordPrefs';
import { log } from '@/lib/logger';

export async function runDiscordCleanups(nowMs: number = Date.now()): Promise<void> {
  // clan-scope: global -- the lifecycle tick is cron-driven and spans clans by design.
  const due = await db
    .select({ id: events.id, clanId: events.clanId, endDate: events.endDate, step: events.discordCleanup })
    .from(events)
    .where(and(eq(events.endNotified, 1), isNotNull(events.endDate), or(isNull(events.discordCleanup), ne(events.discordCleanup, 'all'))));

  for (const event of due) {
    try {
      const roles = await loadEventRoleSettings(event.id, event.clanId);
      const teardownAt = cleanupDueAt(roles, event.endDate);
      let step = event.step;

      if (roles.removePlayerRoleAtEnd && step == null) {
        const r = await unassignSharedRoles(event.id);
        log.info('event-discord-cleanup.player-role', { eventId: event.id, ok: r.ok, removed: r.bingoRemoved });
        step = 'roles';
        await db.update(events).set({ discordCleanup: step }).where(eq(events.id, event.id));
      }

      if (teardownAt != null && nowMs >= teardownAt) {
        const r = (await usesEventServer(event.id)) ? await teardownEventServer(event.id) : await teardownTeamDiscord(event.id);
        log.info('event-discord-cleanup.teardown', { eventId: event.id, ok: r.ok });
        await db.update(events).set({ discordCleanup: 'all' }).where(eq(events.id, event.id));
      } else if (teardownAt == null && !roles.removePlayerRoleAtEnd) {
        // Nothing asked for: settle it so the sweep stops looking. A later change to the event's
        // settings after it ended is a manual job (the Teams tab still has the buttons).
        await db.update(events).set({ discordCleanup: 'all' }).where(eq(events.id, event.id));
      }
    } catch (error) {
      log.warn('event-discord-cleanup.fail', { eventId: event.id }, error);
    }
  }
}
