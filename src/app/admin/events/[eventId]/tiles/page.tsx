import { db } from '@/db';
import { requireEventForPage } from '@/lib/eventScope';
import { requireClan } from '@/lib/clanContext';
import { events, tiles, eventParticipants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import TilesClient from './TilesClient';
import { getTierBands } from '@/lib/pluginConfig';
import { verifyUser } from '@/lib/auth';
import { eventEditLocked } from '@/lib/eventLock';
import { parseEventRules, hasMissions } from '@/lib/eventRules';
import { eventAxes, supportsMissions } from '@/lib/eventAxes';
import { atLeast } from '@/lib/clanRoles';
import { getCofferBalance } from '@/lib/coffer';

export const dynamic = 'force-dynamic';

export default async function EventTilesPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const clan = await requireClan();
  const { eventId } = await params;
  const id = parseInt(eventId, 10);

  // Whose event is this? Ids are global and this one came from the URL.
  await requireEventForPage(id);
  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) notFound();

  const [eventTiles, tierBands, user, eventPlayers] = await Promise.all([
    db.select().from(tiles).where(eq(tiles.eventId, id)),
    getTierBands(clan.id),
    verifyUser(),
    db.select({ teamId: eventParticipants.teamId }).from(eventParticipants).where(eq(eventParticipants.eventId, id)),
  ]);

  // Does this board actually have multi-person teams? Team-shaped tile options (Team Total vs Solo,
  // shared-kill credit, minimum teammates) describe nothing on an individual ladder, so the editor
  // drops them there. Every other format is team play by definition; a ladder only counts as team
  // play once some team really holds more than one player.
  const playersPerTeam = new Map<number, number>();
  for (const p of eventPlayers) {
    if (p.teamId != null) playersPerTeam.set(p.teamId, (playersPerTeam.get(p.teamId) ?? 0) + 1);
  }
  const axes = eventAxes(event);
  // Whether team-shaped tile options mean anything: an individual board only becomes team play once
  // some team really holds more than one player.
  const teamPlay = axes.competitors === 'teams' || [...playersPerTeam.values()].some((n) => n > 1);

  // TWO QUESTIONS, and collapsing them into one is what made this page go quiet. `supportsMissions`
  // asks whether the board could ever carry a mission — a shape question, permanent. `hasMissions`
  // asks whether the host has turned them on, which is a setting they can change in a second.
  //
  // Both were ANDed into one flag, and a false flag hid the mission control entirely. So a host who
  // had not saved the Missions panel — or had, and was looking at a board that could carry them —
  // got no toggle and no reason: "I can't add missions" with nothing on screen to argue with. The
  // shape question decides whether the control exists; the setting decides whether it is usable,
  // and says what to do about it.
  const missionsAllowed = supportsMissions(axes);
  const missionsEnabled = missionsAllowed && hasMissions(parseEventRules(event.rules));

  // What the coffer can cover, so a mission prize can be authored against a real number instead of
  // a hope. Only read where missions are actually on offer — every other board pays no gp.
  const coffer = missionsEnabled ? await getCofferBalance(clan.id) : null;

  return (
    <TilesClient
      event={event}
      tiles={eventTiles}
      tierBands={tierBands}
      isAdmin={atLeast(user?.role, 'admin')}
      editLocked={eventEditLocked(event)}
      teamPlay={teamPlay}
      missionsAllowed={missionsAllowed}
      missionsEnabled={missionsEnabled}
      cofferAvailable={coffer?.available ?? null}
    />
  );
}
