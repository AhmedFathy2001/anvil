// Wrapped: every player's and every team's end-of-event card. The rules are in
// lib/eventWrappedRules; this loads their inputs.
//
// Callers settle scope and visibility first (the event page's own gates, or the OG route's).

import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { clanRoster, eventParticipants, events, moments } from '@/db/schema';
import { resolveClanById } from '@/lib/clanContext';
import { clanVisibilityOf } from '@/lib/clanVisibility';
import { visibilityOf } from '@/lib/eventVisibility';
import { getEventLuck } from '@/lib/eventLuck';
import { getWrappedStats } from '@/lib/eventRecap';
import { shapeWrapped, type WrappedLuckRow, type WrappedPlayer, type WrappedTeam } from '@/lib/eventWrappedRules';
import { getTeamStandings } from '@/lib/statStandings';

export interface EventWrapped {
  eventId: number;
  eventName: string;
  clanId: number;
  ended: boolean;
  players: WrappedPlayer[];
  teams: WrappedTeam[];
  /** event player id → the account behind it, for the link-card cache's un-share hook. */
  accountOf: Record<number, number>;
}

/**
 * An ended event's numbers stop moving, and a Discord paste fetches the card several times over, so
 * the whole event's set is built once and reused for a while.
 */
const CACHE_MS = 10 * 60_000;
const cache = new Map<number, { at: number; value: Promise<EventWrapped | null> }>();

export function getEventWrapped(eventId: number): Promise<EventWrapped | null> {
  const hit = cache.get(eventId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = computeEventWrapped(eventId).catch((err) => {
    cache.delete(eventId);
    throw err;
  });
  cache.set(eventId, { at: Date.now(), value });
  if (cache.size > 100) cache.delete(cache.keys().next().value!);
  return value;
}

async function computeEventWrapped(eventId: number): Promise<EventWrapped | null> {
  // clan-scope: global -- takes an entity id whose caller has already settled the clan (eventScope / the OG route's gate).
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return null;

  const [stats, standings, roster, momentRows, luck] = await Promise.all([
    getWrappedStats(eventId),
    getTeamStandings(eventId, event.scoringMode),
    db
      .select({ id: eventParticipants.id, clanMemberId: eventParticipants.clanMemberId, accountId: eventParticipants.accountId })
      .from(eventParticipants)
      .where(eq(eventParticipants.eventId, eventId)),
    // clan-scope: global -- scoped by moments.eventId; a co-hosted event's moments span its clans by design.
    db
      .select({
        clanMemberId: moments.clanMemberId,
        teamId: moments.teamId,
        kind: moments.kind,
        itemId: moments.itemId,
        itemName: moments.itemName,
        valueGp: moments.valueGp,
      })
      .from(moments)
      .where(and(eq(moments.eventId, eventId), isNotNull(moments.kind))),
    getEventLuck(eventId, 500).catch(() => null),
  ]);
  if (!stats) return null;

  const playerBySeat = new Map<number, number>();
  const playerByAccount = new Map<number, number>();
  const accountOf: Record<number, number> = {};
  for (const r of roster) {
    if (r.clanMemberId != null && !playerBySeat.has(r.clanMemberId)) playerBySeat.set(r.clanMemberId, r.id);
    if (r.accountId != null) {
      accountOf[r.id] = r.accountId;
      if (!playerByAccount.has(r.accountId)) playerByAccount.set(r.accountId, r.id);
    }
  }

  const luckRows: WrappedLuckRow[] = [];
  if (luck) {
    for (const [tone, list] of [['spooned', luck.thisEvent.spooned], ['dry', luck.thisEvent.dry]] as const) {
      for (const e of list) {
        const playerId = playerByAccount.get(e.accountId);
        if (playerId == null) continue;
        luckRows.push({
          playerId,
          tone,
          itemId: e.itemId,
          itemName: e.itemName,
          obtained: e.assessment.obtained,
          expected: e.assessment.expected,
          expectedLow: e.assessment.expectedLow,
          tail: e.assessment.tail,
        });
      }
    }
  }

  const shaped = shapeWrapped({
    people: stats.people,
    awards: stats.awards,
    standings,
    moments: momentRows.map((m) => ({ ...m, playerId: playerBySeat.get(m.clanMemberId) ?? null })),
    luck: luckRows,
  });

  return {
    eventId,
    eventName: event.name,
    clanId: event.clanId,
    ended: stats.ended,
    accountOf,
    ...shaped,
  };
}

/** The card a given event player row belongs to (alts share their person's card). */
export function wrappedPlayerFor(w: EventWrapped, playerId: number): WrappedPlayer | null {
  return w.players.find((p) => p.playerIds.includes(playerId)) ?? null;
}

/** Which card's URL to use for a person: their lowest player id, so alts don't make two links. */
export function wrappedPlayerKey(p: WrappedPlayer): number {
  return Math.min(...p.playerIds);
}

/**
 * Will a pasted link show the real card? The same gate the image route applies — an `invited` event
 * or a clan that keeps to itself draws the plain Anvil card instead — so the page can say so up front.
 */
export async function wrappedCardIsPublic(event: { clanId: number; visibility: string | null }): Promise<boolean> {
  if (visibilityOf(event.visibility) === 'invited') return false;
  const clan = await resolveClanById(event.clanId);
  return !!clan && clanVisibilityOf(clan.visibility) === 'public';
}

/** The viewer's own player rows in this event, through their current seats. */
export async function viewerPlayerIds(eventId: number, viewerPlayerId: number | null | undefined): Promise<number[]> {
  if (viewerPlayerId == null) return [];
  // clan-scope: global -- the subject is a PERSON, whose seats span clans by design; scoped to the viewer's own.
  const seats = await db
    .select({ id: clanRoster.id })
    .from(clanRoster)
    .where(and(eq(clanRoster.playerId, viewerPlayerId), isNull(clanRoster.leftAt)));
  if (seats.length === 0) return [];
  const rows = await db
    .select({ id: eventParticipants.id })
    .from(eventParticipants)
    .where(and(eq(eventParticipants.eventId, eventId), inArray(eventParticipants.clanMemberId, seats.map((r) => r.id))));
  return rows.map((r) => r.id);
}
