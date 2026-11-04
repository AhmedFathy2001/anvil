// A creator space's public page and players list (lib/creatorSpaces). The clan home
// (lib/clanHome) leads with members, focus and recruiting — none of which a creator space has — so
// this reads the creator, their stream links and the people who have played their events.

import { and, desc, eq, inArray, isNull, max, notInArray, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, clans, eventParticipants, events, eventSignups } from '@/db/schema';
import { PUBLIC_SHOWCASE_KEY, isClanListed } from '@/lib/clanListing';
import { getSettingMap } from '@/lib/settings';
import { STREAM_LINK_KEYS, checkStreamLink } from '@/lib/creatorSpaces';

export interface CreatorPlayer {
  accountId: number;
  rsn: string;
  /** How many of this space's events they signed up for. */
  events: number;
  lastSignedUpAt: string | null;
}

/**
 * Everybody who has signed up for one of this space's events, most recent first, pending included.
 * STAFF ONLY (the space's admin pages): it covers every event, whoever may see it.
 */
export async function creatorPlayers(clanId: number, limit = 200): Promise<CreatorPlayer[]> {
  const rows = await db
    .select({
      accountId: accounts.id,
      rsn: accounts.rsn,
      events: sql<number>`count(distinct ${eventSignups.eventId})::int`,
      lastSignedUpAt: max(eventSignups.signedUpAt),
    })
    .from(eventSignups)
    .innerJoin(events, eq(events.id, eventSignups.eventId))
    .innerJoin(clanMemberships, eq(clanMemberships.id, eventSignups.clanMemberId))
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .where(and(eq(events.clanId, clanId), isNull(clanMemberships.leftAt), notInArray(eventSignups.status, ['withdrawn', 'rejected'])))
    .groupBy(accounts.id, accounts.rsn)
    .orderBy(desc(max(eventSignups.signedUpAt)))
    .limit(limit);
  return rows.map((r) => ({ ...r, lastSignedUpAt: r.lastSignedUpAt ?? null }));
}

/**
 * The players a STRANGER may see named on the space's public page: people actually on the board
 * (an event participant) of an event a stranger may open — `public`, or `clan` while the space is
 * public; never an `invited` one. Pending sign-ups are not listed; they are not playing yet.
 */
export async function publicCreatorPlayers(clanId: number, limit = 200): Promise<CreatorPlayer[]> {
  const rows = await db
    .select({
      accountId: accounts.id,
      rsn: accounts.rsn,
      events: sql<number>`count(distinct ${eventParticipants.eventId})::int`,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(events.id, eventParticipants.eventId))
    .innerJoin(clans, eq(clans.id, events.clanId))
    .innerJoin(accounts, eq(accounts.id, eventParticipants.accountId))
    .where(
      and(
        eq(events.clanId, clanId),
        eq(clans.visibility, 'public'),
        inArray(events.visibility, ['public', 'clan']),
      ),
    )
    .groupBy(accounts.id, accounts.rsn)
    .orderBy(desc(max(eventParticipants.id)))
    .limit(limit);
  return rows.map((r) => ({ ...r, lastSignedUpAt: null }));
}

export interface CreatorLinks {
  twitch: string | null;
  kick: string | null;
}

/** The space's stream links, re-checked on read so a bad stored value never becomes a link. */
export async function creatorLinks(clanId: number): Promise<CreatorLinks> {
  const map = await getSettingMap(clanId, [STREAM_LINK_KEYS.twitch, STREAM_LINK_KEYS.kick]);
  const read = (platform: 'twitch' | 'kick') => {
    const r = checkStreamLink(platform, map.get(STREAM_LINK_KEYS[platform]));
    return r.ok ? r.url : null;
  };
  return { twitch: read('twitch'), kick: read('kick') };
}

export interface CreatorHomeView {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  bannerPosition: number | null;
  links: CreatorLinks;
  eventsRun: number;
  players: CreatorPlayer[];
  /** Null when the names are not this viewer's to see (unlisted or hidden space). */
  playerCount: number | null;
}

/**
 * The public page. The players list follows the same gate the Clan Hall card uses for names: hidden
 * by the platform → never to outsiders; and only for a space that chose to be listed ("Advertise on
 * Anvil"). The space's own staff always see it.
 */
export async function creatorHomeView(clanId: number, opts: { viewerIsStaff?: boolean } = {}): Promise<CreatorHomeView | null> {
  // clan-scope: global -- addressed by clan id (the page's own space); this reads that row.
  const clan = await db.query.clans.findFirst({ where: eq(clans.id, clanId) });
  if (!clan) return null;
  const showcase = await getSettingMap(clanId, [PUBLIC_SHOWCASE_KEY]);
  const namesVisible = !!opts.viewerIsStaff || isClanListed(clan, showcase.get(PUBLIC_SHOWCASE_KEY) ?? null);
  const [links, players, [eventRow]] = await Promise.all([
    creatorLinks(clanId),
    namesVisible ? publicCreatorPlayers(clanId) : Promise.resolve([] as CreatorPlayer[]),
    db.select({ n: sql<number>`count(*)::int` }).from(events).where(eq(events.clanId, clanId)),
  ]);
  return {
    id: clan.id,
    slug: clan.slug,
    name: clan.name,
    tagline: clan.tagline,
    logoUrl: clan.logoUrl ?? null,
    bannerUrl: clan.bannerUrl ?? null,
    bannerPosition: clan.bannerPosition ?? null,
    links,
    eventsRun: eventRow?.n ?? 0,
    players: players.slice(0, 40),
    playerCount: namesVisible ? players.length : null,
  };
}
