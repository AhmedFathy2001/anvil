// Is this event the one this clan means?
//
// Event ids are global and arrive from the URL, so `/events/2` on one clan's host will happily find
// another clan's event unless something asks. Nothing did: a route would take the id straight to
// tiles, teams and submissions — all of which are correctly keyed by event_id — and never establish
// whose event it was in the first place. `theafkspot/events/2` rendered Second Clan's board.
//
// ONE CHECK, AT THE TOP. Everything downstream of an event derives its clan through event_id, so a
// route that has verified the event belongs to this clan is safe for the rest of its work. That is
// the "one hop, never a copy" rule the schema is built on, and it means the guard is a single line
// per route rather than a clan filter threaded through every query in it.

import { and, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';

import { db } from '@/db';
import { events, weeklyCompetitions } from '@/db/schema';
import { requireClan, resolveClanFromRequest } from '@/lib/clanContext';
import { canSeeEvent } from '@/lib/eventAccess';
import { resolvePluginClan, verifyUser } from '@/lib/auth';

export type ScopedEvent = typeof events.$inferSelect;

/** The event with this id, but only if `clanId` owns it. */
export async function eventInClan(clanId: number, eventId: number): Promise<ScopedEvent | null> {
  if (!Number.isInteger(eventId)) return null;
  const [row] = await db
    .select()
    .from(events)
    .where(and(eq(events.clanId, clanId), eq(events.id, eventId)))
    .limit(1);
  return row ?? null;
}

/**
 * The event named by this id, for the clan this request is for, or null.
 *
 * Null covers both "no such event" and "that event is another clan's", deliberately — a caller must
 * not be able to tell the difference, or the 404 becomes a probe for which ids exist elsewhere.
 *
 * THE ADDRESS FIRST, THEN THE TOKEN. This used to ask the address alone, which was right when a
 * deployment was a clan and the Host always named one. On the canonical address nothing in the URL
 * does — so filing a submission, filing a starting shot and uploading its image, the three things a
 * client does outside `/api/plugin`, resolved to no clan and answered 404. A bearer token names a
 * person, whose seats name their clans, which is the same fallback every `/api/plugin` route uses
 * (lib/auth resolvePluginClan). Nothing widens: the event still has to belong to whichever clan
 * comes back, so a token cannot reach another clan's board.
 */
export async function eventForRequest(request: Request, eventId: number): Promise<ScopedEvent | null> {
  const clan = await resolvePluginClan(request);
  if (!clan) return null;
  return eventInClan(clan.id, eventId);
}

/** The same, for a server page: renders the not-found page rather than returning null. */
export async function requireEventForPage(eventId: number): Promise<ScopedEvent> {
  const clan = await requireClan();
  const event = await eventInClan(clan.id, eventId);
  if (!event) notFound();

  // Belonging to this clan is necessary but no longer sufficient. An event can be the clan's alone,
  // invite-only, or public, and the first two have to keep outsiders out — including outsiders who
  // guessed the id, which is why this 404s rather than explaining itself.
  const session = await verifyUser();
  if (!(await canSeeEvent({ eventId, playerId: session?.playerId ?? null }))) notFound();

  return event;
}

// ── Weekly competitions, same story ──────────────────────────────────────────────────────────
//
// SOTW/BOTW ids are global and reach the routes from the URL exactly as event ids do, so the same
// guard applies. Kept here rather than in a file of its own because it is one question — "does this
// clan own the thing this id names?" — asked about the two kinds of thing that have ids in URLs.

/** The weekly competition with this id, but only if `clanId` owns it. */
export async function competitionInClan(clanId: number, competitionId: number) {
  if (!Number.isInteger(competitionId)) return null;
  const [row] = await db
    .select()
    .from(weeklyCompetitions)
    .where(and(eq(weeklyCompetitions.clanId, clanId), eq(weeklyCompetitions.id, competitionId)))
    .limit(1);
  return row ?? null;
}

/** The competition named by this id on the requesting clan's host, or null. */
export async function competitionForRequest(request: Request, competitionId: number) {
  const clan = await resolveClanFromRequest(request);
  if (!clan) return null;
  return competitionInClan(clan.id, competitionId);
}

/** The same, for a server page: renders the not-found page rather than returning null. */
export async function requireCompetitionForPage(competitionId: number) {
  const clan = await requireClan();
  const comp = await competitionInClan(clan.id, competitionId);
  if (!comp) notFound();
  return comp;
}
