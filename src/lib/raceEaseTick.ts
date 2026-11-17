// Timed easing on the minute tick (events.rules.raceEase, lib/raceEase): when a race crosses an
// easing interval, the easier options that just went live are settled (a team already past the
// easier number finishes there and then), every team's plugin is told to refetch, and one Discord
// post says which steps got easier. Each tick is announced once (events.race_ease_tick).

import { and, eq, isNotNull, isNull, lt } from 'drizzle-orm';

import { db } from '@/db';
import { events, teams, tiles } from '@/db/schema';
import { parseStamp } from '@/lib/dbTime';
import { sendEventBingoWebhook } from '@/lib/discord';
import { isEventOver } from '@/lib/eventLock';
import { parseEventRules } from '@/lib/eventRules';
import { log } from '@/lib/logger';
import { notifyTeamTiles } from '@/lib/pushNotify';
import { easeOptionsByTile, easeTick } from '@/lib/raceEase';
import { bumpEaseContext, settleEasedTiles } from '@/lib/raceEaseDb';
import { raceGraph, stepTitle } from '@/lib/raceRoutes';

export async function processRaceEasing(now: number = Date.now()): Promise<number> {
  // clan-scope: global -- the minute tick walks every running race, like the reveal engine.
  const races = await db
    .select()
    .from(events)
    .where(and(eq(events.format, 'tilerace'), isNotNull(events.startDate), isNotNull(events.rules), isNull(events.forceEndedAt)));
  let announced = 0;
  for (const event of races) {
    try {
      const rule = parseEventRules(event.rules).raceEase;
      if (!rule || isEventOver(event)) continue;
      const tick = easeTick(rule, parseStamp(event.startDate), now);
      if (tick <= event.raceEaseTick) continue;
      // Claim the tick: two workers on the same minute announce it once.
      const claimed = await db
        .update(events)
        .set({ raceEaseTick: tick })
        .where(and(eq(events.id, event.id), lt(events.raceEaseTick, tick)))
        .returning({ id: events.id });
      if (!claimed.length) continue;

      const all = await db
        .select({ id: tiles.id, position: tiles.position, raceStep: tiles.raceStep, raceNext: tiles.raceNext, parentTileId: tiles.parentTileId, mission: tiles.mission, easeLevel: tiles.easeLevel })
        .from(tiles)
        .where(eq(tiles.eventId, event.id));
      const graph = raceGraph(all.filter((t) => t.parentTileId == null));
      // What this tick opened: rank r on step s goes live at tick s + r.
      const steps = new Set<number>();
      const opened: number[] = [];
      for (const [tileId, list] of easeOptionsByTile(all)) {
        const step = graph.byId.get(tileId)?.step;
        if (step == null) continue;
        list.forEach((o, i) => {
          const at = step + i + 1;
          if (at > event.raceEaseTick && at <= tick) {
            steps.add(step);
            opened.push(o.id);
          }
        });
      }
      if (!opened.length) continue;
      bumpEaseContext(event.id);
      await settleEasedTiles(event.id);
      const teamRows = await db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, event.id));
      for (const t of teamRows) notifyTeamTiles(event.id, t.id, []);
      const names = [...steps].sort((a, b) => a - b).map((s) => stepTitle(graph, s));
      const which = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
      await sendEventBingoWebhook(
        event.clanId,
        event.id,
        {
          embeds: [
            {
              title: `${event.name}: ${which} just got easier`,
              description:
                'An easier option is now open there. Finish the tile as written or do the easier option instead; either one finishes the tile, and what your team already did still counts. Open the tile on the board or in the plugin to see it.',
              color: 0xd4a017,
            },
          ],
        },
        { post: 'reveals' },
      ).catch(() => false);
      announced++;
    } catch (error) {
      log.warn('race-ease.tick-fail', { eventId: event.id }, error);
    }
  }
  return announced;
}
