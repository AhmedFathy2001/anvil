import { maskRaceTilesForSession } from '@/lib/raceHideAheadDb';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';

import { db } from '@/db';
import { events, tiles } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { atLeast } from '@/lib/clanRoles';
import { withoutParts } from '@/lib/combo';
import { isCreatorSpace, streamsEvents } from '@/lib/creatorSpaces';
import { requireEventForPage } from '@/lib/eventScope';
import type { SettingsKind } from '@/lib/eventSettingsTabs';

/**
 * What every settings tab starts from: the event (scoped to this clan — ids are global and this one
 * came from the URL), the host, the viewer's say, and which shape of settings this host has
 * (lib/eventSettingsTabs). Tabs load anything heavier themselves, so a tab costs only what it shows.
 */
export async function loadSettings(rawId: string) {
  const id = parseInt(rawId, 10);
  await requireEventForPage(id);
  const [event, session, clan] = await Promise.all([db.query.events.findFirst({ where: eq(events.id, id) }), verifyUser(), requireClan()]);
  if (!event) notFound();
  const kind: SettingsKind = { creator: isCreatorSpace(clan), streams: streamsEvents(clan) };
  return { id, event, session, clan, kind, isAdmin: atLeast(session?.role, 'admin') };
}

/** The board's own tiles (combo parts left out), for the tabs that read them. */
export async function boardTiles(eventId: number) {
  const rows = withoutParts(await db.select().from(tiles).where(eq(tiles.eventId, eventId)));
  // "Also hide from event staff" (lib/raceHideAhead): staff who can't see through get locked "?" cells.
  // clan-scope: this clan -- every settings page scoped the id first (requireEventForPage in loadSettings).
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  return event ? maskRaceTilesForSession(event, rows) : rows;
}
