// A creator space's public page and players list (lib/creatorSpaces). The clan home
// (lib/clanHome) leads with members, focus and recruiting — none of which a creator space has — so
// this reads the creator, their stream links and the people who have played their events.

import { normalizeHex } from '@/lib/artPalette';
import { and, desc, eq, inArray, isNull, max, notInArray, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import {
  accounts,
  clanKickChannels,
  clanMemberships,
  clans,
  clanStaff,
  clanTwitchChannels,
  clanYoutubeChannels,
  eventParticipants,
  events,
  eventSignups,
} from '@/db/schema';
import { PUBLIC_SHOWCASE_KEY, isClanListed } from '@/lib/clanListing';
import { getSettingMap } from '@/lib/settings';
import {
  type CreatorEventGroup,
  type VerifiedStreamLink,
  creatorEventPlacement,
  verifiedStreamLinks,
} from '@/lib/creatorSpaces';
import { loadEventCards } from '@/lib/eventCards';
import { EVENT_MODES, modeKeyFor } from '@/lib/eventModes';

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
    // A live seat — or an event player's, which closes when its event ends but is still who played.
    .where(
      and(
        eq(events.clanId, clanId),
        or(isNull(clanMemberships.leftAt), eq(clanMemberships.kind, 'event')),
        notInArray(eventSignups.status, ['withdrawn', 'rejected']),
      ),
    )
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

export type CreatorLinks = VerifiedStreamLink[];

/**
 * The space's stream links: ONLY its OAuth-connected channels (lib/creatorSpaces verifiedStreamLinks).
 * Typed links (the retired `creator_twitch_url` / `creator_kick_url` settings) are never read. Only
 * the public names are selected; the tokens never leave their tables.
 */
export async function creatorLinks(clanId: number): Promise<CreatorLinks> {
  const [twitch, kick, youtube] = await Promise.all([
    // clan-scope: clanId is the creator space whose page is being rendered.
    db.query.clanTwitchChannels.findFirst({ where: eq(clanTwitchChannels.clanId, clanId), columns: { twitchLogin: true } }),
    // clan-scope: clanId is the creator space whose page is being rendered.
    db.query.clanKickChannels.findFirst({ where: eq(clanKickChannels.clanId, clanId), columns: { kickSlug: true } }),
    // clan-scope: clanId is the creator space whose page is being rendered.
    db.query.clanYoutubeChannels.findFirst({
      where: eq(clanYoutubeChannels.clanId, clanId),
      columns: { youtubeChannelId: true, handle: true, title: true },
    }),
  ]);
  return verifiedStreamLinks({
    twitchLogin: twitch?.twitchLogin ?? null,
    kickSlug: kick?.kickSlug ?? null,
    youtube: youtube ? { channelId: youtube.youtubeChannelId, handle: youtube.handle, title: youtube.title } : null,
  });
}

/** Does this signed-in user hold a staff grant in the space? They see every event, invite-only too. */
export async function isSpaceStaff(clanId: number, userId: number | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const rows = await db
    .select({ id: clanStaff.id })
    .from(clanStaff)
    // clan-scope: clanId is the creator space whose page is being rendered.
    .where(and(eq(clanStaff.clanId, clanId), eq(clanStaff.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

// ── The space's events ──────────────────────────────────────────────────────────────────────────

export interface CreatorEventItem {
  key: string;
  id: number;
  href: string;
  name: string;
  /** "Bingo", "Tile race", "Ladder". */
  kind: string;
  /** One line under the name: teams and progress, or when it starts. */
  line: string;
  /** Leader while live, winner once finished. */
  top: { name: string; text: string } | null;
  /** The date shown on the right when there is no leader. */
  when: string | null;
  /** Invite-only: only the space's staff see it here (lib/creatorSpaces CREATOR_STAFF_ONLY_TAG). */
  staffOnly: boolean;
}

export interface CreatorEventsView {
  groups: Record<CreatorEventGroup, CreatorEventItem[]>;
  /** How many rows this viewer is shown, all groups together — what the page's header counts. */
  count: number;
}

/** Finished events listed; older ones are still reachable by link. */
const PAST_SHOWN = 30;

/**
 * The space's OWN events by the creator rules (lib/creatorSpaces creatorEventPlacement): live, open
 * to join (undated — it starts when the host starts it), coming up and finished. A clan's hub leaves
 * undated boards out, which is why a space with one open event read "1 events" over "No events yet".
 * Invite-only events only for staff. Leaders come from the same cards the clan hub draws.
 */
export async function creatorEventsView(
  clanId: number,
  opts: { viewerIsStaff?: boolean; now?: Date } = {},
): Promise<CreatorEventsView> {
  const now = opts.now ?? new Date();
  const staff = !!opts.viewerIsStaff;
  const [rows, cards] = await Promise.all([
    db
      .select({
        id: events.id,
        name: events.name,
        visibility: events.visibility,
        startDate: events.startDate,
        endDate: events.endDate,
        forceEndedAt: events.forceEndedAt,
        format: events.format,
        scoringMode: events.scoringMode,
        rules: events.rules,
      })
      .from(events)
      // clan-scope: clanId is the creator space whose page is being rendered; its own events only.
      .where(eq(events.clanId, clanId))
      .orderBy(desc(events.id)),
    loadEventCards(clanId, { includeUpcoming: true, pastLimit: PAST_SHOWN }, now).catch(() => []),
  ]);
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const groups: CreatorEventsView['groups'] = { live: [], open: [], upcoming: [], past: [] };
  let count = 0;
  for (const r of rows) {
    const place = creatorEventPlacement(r, { staff, now: now.getTime() });
    if (!place) continue;
    count += 1;
    const card = cardById.get(r.id);
    const mode = modeKeyFor(r.format, r.scoringMode, r.rules);
    const line =
      place.group === 'open'
        ? 'Starts when the host starts it'
        : card
          ? [card.chips[0], card.foot].filter(Boolean).join(' · ')
          : '';
    groups[place.group].push({
      key: `e${r.id}`,
      id: r.id,
      href: `/events/${r.id}`,
      name: r.name,
      kind: EVENT_MODES.find((m) => m.key === mode)?.label ?? 'Bingo',
      line,
      top: card?.top ? { name: card.top.name, text: `${card.top.score.toLocaleString('en-US')} ${card.top.unit}` } : null,
      when: place.group === 'past' ? (r.forceEndedAt ?? r.endDate) : r.startDate,
      staffOnly: place.staffOnly,
    });
  }
  // Soonest first for what is coming; the rest newest first (the query's order).
  groups.upcoming.sort((a, b) => (a.when ?? '').localeCompare(b.when ?? ''));
  groups.past = groups.past.slice(0, PAST_SHOWN);
  return { groups, count };
}

export interface CreatorHomeView {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  bannerPosition: number | null;
  /** The space's picked colour (lib/artPalette), or null for Anvil gold. */
  accent: string | null;
  links: CreatorLinks;
  /** Events this viewer is shown — the same number as the rows in `events` (lib/creatorSpaces). */
  eventsRun: number;
  events: CreatorEventsView;
  players: CreatorPlayer[];
  /** Null when the names are not this viewer's to see (unlisted or hidden space). */
  playerCount: number | null;
}

/**
 * The public page. The players list follows the same gate the Clan Hall card uses for names: hidden
 * by the platform → never to outsiders; and only for a space that chose to be listed ("Advertise on
 * Anvil"). The space's own staff always see it.
 */
export async function creatorHomeView(
  clanId: number,
  opts: { viewerIsStaff?: boolean; now?: Date } = {},
): Promise<CreatorHomeView | null> {
  // clan-scope: global -- addressed by clan id (the page's own space); this reads that row.
  const clan = await db.query.clans.findFirst({ where: eq(clans.id, clanId) });
  if (!clan) return null;
  const showcase = await getSettingMap(clanId, [PUBLIC_SHOWCASE_KEY]);
  const namesVisible = !!opts.viewerIsStaff || isClanListed(clan, showcase.get(PUBLIC_SHOWCASE_KEY) ?? null);
  const [links, players, eventList] = await Promise.all([
    creatorLinks(clanId),
    namesVisible ? publicCreatorPlayers(clanId) : Promise.resolve([] as CreatorPlayer[]),
    creatorEventsView(clanId, { viewerIsStaff: opts.viewerIsStaff, now: opts.now }),
  ]);
  return {
    id: clan.id,
    slug: clan.slug,
    name: clan.name,
    tagline: clan.tagline,
    logoUrl: clan.logoUrl ?? null,
    bannerUrl: clan.bannerUrl ?? null,
    bannerPosition: clan.bannerPosition ?? null,
    accent: normalizeHex(clan.accentColor),
    links,
    eventsRun: eventList.count,
    events: eventList,
    players: players.slice(0, 40),
    playerCount: namesVisible ? players.length : null,
  };
}
