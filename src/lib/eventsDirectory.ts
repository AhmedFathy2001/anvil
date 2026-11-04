// The public events directory — anvilosrs.com/events. The rules. Pure: no database import
// (tests/pure-module-imports); lib/eventsDirectoryDb does the one read.
//
// WHAT IT IS: every event a host has ASKED strangers to be pointed at, clans and creator spaces
// alike, while it is upcoming or live. The ask is per event — `events.advertised`, the "Advertise on
// Anvil" switch in the event's settings. A creator space's space-level "Advertise on Anvil" only
// preselects that switch for the space's new events; it never lists an event on its own.
//
// TWO CONSENTS, NEITHER IMPLIED BY THE OTHER: the host advertised it, AND a signed-out stranger may
// already read it (lib/eventAccess canSeeEvent — `public`, or `clan` on a public clan). Advertising
// an invite-only board, or one on a members-only clan, would be pointing people at a locked door,
// so those never list whatever the switch says. Suspended clans and platform-hidden ones (the tile
// lab is born hidden) never list either.
//
// UNDATED EVENTS: a clan's board with no start date is a draft and never lists. A STREAMED event's
// is the opposite — sign-ups are open and it "starts when the host starts it", on stream — so a
// creator space's (or a Streaming clan's viewer event, lib/creatorSpaces streamedEvent) lists while
// its sign-ups are open, by the same rule its space page uses (creatorEventPlacement → 'open').

import { atLeast } from '@/lib/clanRoles';
import { parseStamp } from '@/lib/dbTime';
import { gatesApply, gatesSummary, parseGates } from '@/lib/entryGates';
import { EVENT_MODES, modeKeyFor, type EventMode } from '@/lib/eventModes';
import { featuredListing } from '@/lib/creatorPlans';
import { planOf, planRank } from '@/lib/plans';
import { clanHrefFor } from '@/lib/clanScopedPaths';
import { creatorEventPlacement, streamedEvent } from '@/lib/creatorSpaces';

export const DIRECTORY_PAGE_SIZE = 24;
/** "Starting soon" = opens within this long. */
export const STARTING_SOON_MS = 7 * 86_400_000;

export type HostKind = 'clan' | 'creator';
/**
 * Who may join, for somebody who has never met the host:
 *   open     — a creator space's `open` event with no gates: sign in and play.
 *   gated    — a creator space's gates (Twitch followers, a Discord role…): meet one and play.
 *   approval — the host says yes first. Every clan event is this for a stranger (lib/eventAccess:
 *              a seat is a roster row, so a human answers), as is any `approval` event.
 *   members  — the clan takes no guests at all; worth knowing before you click.
 */
export type JoinKind = 'open' | 'gated' | 'approval' | 'members';

/** One row as the database hands it over: the event, its host, and its player count. */
export interface DirectoryRow {
  eventId: number;
  name: string;
  iconUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  forceEndedAt: string | null;
  signupOpensAt: string | null;
  signupDeadline: string | null;
  format: string | null;
  scoringMode: string | null;
  rules: string | null;
  teamPlacement: string | null;
  entry: string | null;
  entryGates: string | null;
  hostSlug: string;
  hostName: string;
  hostLogoUrl: string | null;
  hostKind: string | null;
  hostPlan: string | null;
  hostGuestPolicy: string | null;
  twitchLogin: string | null;
  players: number;
  /** Optional so older callers/tests stay valid: the event lets viewers in, and its clan streams. */
  visibility?: string | null;
  openToViewers?: boolean | null;
  hostStreaming?: boolean | null;
}

/** A card, ready to draw. */
export interface DirectoryEvent {
  eventId: number;
  name: string;
  iconUrl: string | null;
  /** The event page inside its host — where the cross-clan entry flow already lives. */
  href: string;
  hostSlug: string;
  hostName: string;
  hostLogoUrl: string | null;
  hostKind: HostKind;
  mode: EventMode;
  formatLabel: string;
  /** Every player is their own team. */
  solo: boolean;
  /** Null only on an `open` event. */
  startDate: string | null;
  endDate: string | null;
  startMs: number | null;
  endMs: number | null;
  live: boolean;
  /** Undated and taking players now: "starts when the host starts it" (streamed events only). */
  open: boolean;
  players: number;
  join: JoinKind;
  joinLabel: string;
  /** Sign-ups are open right now (same window as lib/apexHome discoverEvents). */
  takingEntries: boolean;
  featured: boolean;
}

/**
 * A paid host gets a small ordering boost: a creator space on Silver or up (the `featured-listing`
 * perk, lib/creatorPlans) or a clan on any paid plan. Only ever re-orders inside its group.
 */
export function isFeaturedHost(kind: string | null | undefined, plan: string | null | undefined): boolean {
  if (kind === 'creator') return featuredListing(kind, plan);
  return planRank(planOf(plan)) > 0;
}

/** May this role flip an event's "Advertise on Anvil" switch? Admins of the host, nobody else. */
export function mayAdvertiseEvents(role: string | null | undefined): boolean {
  return atLeast(role, 'admin');
}

/**
 * The switch's starting position on a NEW event. A creator space that advertises itself on Anvil
 * (`public_showcase = 'on'`) gets its new events pre-ticked; everyone else starts unticked.
 */
export function defaultAdvertised(kind: string | null | undefined, showcase: string | null | undefined): boolean {
  return kind === 'creator' && showcase === 'on';
}

function joinOf(row: DirectoryRow): { join: JoinKind; label: string } {
  const creator = row.hostKind === 'creator';
  if (!creator && row.hostGuestPolicy === 'closed') return { join: 'members', label: 'Clan members only' };
  if (row.entry === 'approval' || !creator) return { join: 'approval', label: 'Ask to join · the host approves' };
  const gates = parseGates(row.entryGates);
  if (gatesApply(row.hostKind, gates)) {
    return { join: 'gated', label: gatesSummary(gates, { twitchLogin: row.twitchLogin, hostName: row.hostName }) };
  }
  return { join: 'open', label: 'Anyone can join' };
}

/**
 * May an UNDATED event list as "Open to join"? Only a streamed one (a creator space's, or a Streaming
 * clan's viewer event), placed in the space page's 'open' group, with sign-ups open right now. Every
 * other undated event is a draft.
 */
export function listsUndated(row: DirectoryRow, now: number = Date.now()): boolean {
  if (row.startDate && parseStamp(row.startDate) != null) return false;
  const host = { kind: row.hostKind, streaming: row.hostStreaming ?? false };
  if (!streamedEvent(host, { openToViewers: row.openToViewers ?? false })) return false;
  const place = creatorEventPlacement(
    { visibility: row.visibility ?? 'public', startDate: null, endDate: row.endDate, forceEndedAt: row.forceEndedAt },
    { staff: false, now },
  );
  if (place?.group !== 'open') return false;
  const opens = parseStamp(row.signupOpensAt);
  const deadline = parseStamp(row.signupDeadline);
  return (opens == null || opens <= now) && (deadline == null || deadline > now);
}

/** A row into a card, or null when it is not something to list right now (a draft, or over). */
export function toDirectoryEvent(row: DirectoryRow, now: number = Date.now()): DirectoryEvent | null {
  if (row.forceEndedAt) return null;
  const parsedStart = parseStamp(row.startDate);
  const startMs = row.startDate ? parsedStart : null;
  // No start date is a draft, not an event anyone can plan around — unless it is a streamed event
  // whose sign-ups are open (listsUndated).
  const open = startMs == null && listsUndated(row, now);
  if (startMs == null && !open) return null;
  const endMs = parseStamp(row.endDate);
  if (endMs != null && endMs <= now) return null;

  const mode = modeKeyFor(row.format, row.scoringMode, row.rules);
  const live = startMs != null && startMs <= now;
  const opens = parseStamp(row.signupOpensAt);
  const deadline = parseStamp(row.signupDeadline);
  const { join, label } = joinOf(row);
  return {
    eventId: row.eventId,
    name: row.name,
    iconUrl: row.iconUrl || row.hostLogoUrl,
    href: clanHrefFor(row.hostSlug, `/events/${row.eventId}`),
    hostSlug: row.hostSlug,
    hostName: row.hostName,
    hostLogoUrl: row.hostLogoUrl,
    hostKind: row.hostKind === 'creator' ? 'creator' : 'clan',
    mode,
    formatLabel: EVENT_MODES.find((m) => m.key === mode)?.label ?? 'Bingo',
    solo: row.teamPlacement === 'solo',
    startDate: startMs == null ? null : row.startDate,
    endDate: row.endDate,
    startMs,
    endMs,
    live,
    open,
    players: row.players,
    join,
    joinLabel: label,
    takingEntries: !live && join !== 'members' && (deadline == null || deadline > now) && (opens == null || opens <= now),
    featured: isFeaturedHost(row.hostKind, row.hostPlan),
  };
}

// ── Filters ──────────────────────────────────────────────────────────────────────────────────────

export type WhenFilter = 'all' | 'live' | 'open' | 'soon';
export type JoinFilter = 'any' | 'open' | 'gated';
export type HostFilter = 'any' | 'clan' | 'creator';
/** A mode key, or 'solo' for every-player-for-themselves boards of any mode. */
export type FormatFilter = EventMode | 'solo' | 'any';

export interface DirectoryFilters {
  when: WhenFilter;
  format: FormatFilter;
  join: JoinFilter;
  host: HostFilter;
  page: number;
}

export const DEFAULT_FILTERS: DirectoryFilters = { when: 'all', format: 'any', join: 'any', host: 'any', page: 1 };

const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/** The URL query, read defensively: anything unrecognised is the default. */
export function parseFilters(q: Record<string, string | string[] | undefined>): DirectoryFilters {
  const when = one(q.when);
  const format = one(q.format);
  const join = one(q.join);
  const host = one(q.host);
  const page = Number.parseInt(one(q.page) ?? '', 10);
  return {
    when: when === 'live' || when === 'open' || when === 'soon' ? when : 'all',
    format: format === 'solo' || EVENT_MODES.some((m) => m.key === format) ? (format as FormatFilter) : 'any',
    join: join === 'open' || join === 'gated' ? join : 'any',
    host: host === 'clan' || host === 'creator' ? host : 'any',
    page: Number.isFinite(page) && page > 1 ? Math.min(page, 1000) : 1,
  };
}

/** A link to these filters with some changed. Changing a filter goes back to page 1. */
export function filterHref(f: DirectoryFilters, change: Partial<DirectoryFilters>): string {
  const next = { ...f, ...change, page: change.page ?? 1 };
  const p = new URLSearchParams();
  if (next.when !== 'all') p.set('when', next.when);
  if (next.format !== 'any') p.set('format', next.format);
  if (next.join !== 'any') p.set('join', next.join);
  if (next.host !== 'any') p.set('host', next.host);
  if (next.page > 1) p.set('page', String(next.page));
  const s = p.toString();
  return s ? `/events?${s}` : '/events';
}

export function matchesFilters(e: DirectoryEvent, f: DirectoryFilters, now: number = Date.now()): boolean {
  if (f.when === 'live' && !e.live) return false;
  if (f.when === 'open' && !e.open) return false;
  if (f.when === 'soon' && (e.live || e.startMs == null || e.startMs - now > STARTING_SOON_MS)) return false;
  if (f.format === 'solo' && !e.solo) return false;
  if (f.format !== 'any' && f.format !== 'solo' && e.mode !== f.format) return false;
  if (f.join === 'open' && e.join !== 'open') return false;
  // "Needs approval or a requirement" — everything that is not walk-in.
  if (f.join === 'gated' && e.join === 'open') return false;
  if (f.host !== 'any' && e.hostKind !== f.host) return false;
  return true;
}

/** Live, then open to join (undated), then upcoming. */
const groupRank = (e: DirectoryEvent): number => (e.live ? 0 : e.open ? 1 : 2);

/**
 * Live first, then open to join, then soonest start. Featured hosts lead WITHIN each group — a
 * featured upcoming event never outranks anything live or open.
 */
export function compareDirectory(a: DirectoryEvent, b: DirectoryEvent): number {
  return (
    groupRank(a) - groupRank(b) ||
    Number(b.featured) - Number(a.featured) ||
    (a.startMs ?? 0) - (b.startMs ?? 0) ||
    a.eventId - b.eventId
  );
}

export interface DirectoryPage {
  items: DirectoryEvent[];
  total: number;
  page: number;
  pages: number;
  /** Counts over the unfiltered list, for the filter chips. */
  liveCount: number;
  /** Undated events open to join right now. */
  openCount: number;
  /** The modes actually on offer right now, so the format filter never offers an empty shelf. */
  modes: EventMode[];
  anySolo: boolean;
}

/** Filter, sort and cut one page. */
export function directoryPage(cachedList: DirectoryEvent[], f: DirectoryFilters, now: number = Date.now()): DirectoryPage {
  // The list may be up to a minute old: settle what that minute changed — something started, or ended.
  const all = cachedList
    .filter((e) => e.endMs == null || e.endMs > now)
    .map((e) => (!e.live && e.startMs != null && e.startMs <= now ? { ...e, live: true, takingEntries: false } : e));
  const shown = all.filter((e) => matchesFilters(e, f, now)).sort(compareDirectory);
  const pages = Math.max(1, Math.ceil(shown.length / DIRECTORY_PAGE_SIZE));
  const page = Math.min(f.page, pages);
  return {
    items: shown.slice((page - 1) * DIRECTORY_PAGE_SIZE, page * DIRECTORY_PAGE_SIZE),
    total: shown.length,
    page,
    pages,
    liveCount: all.filter((e) => e.live).length,
    openCount: all.filter((e) => e.open).length,
    modes: EVENT_MODES.map((m) => m.key).filter((k) => all.some((e) => e.mode === k)),
    anySolo: all.some((e) => e.solo),
  };
}

// ── Words ────────────────────────────────────────────────────────────────────────────────────────

/** "3 days", "5h", "20 min". Rounded down to the largest unit worth saying. */
export function spanWords(ms: number): string {
  const min = Math.max(1, Math.floor(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d} days`;
}

/** What an undated streamed event says instead of a start time. */
export const OPEN_NOW_WORDS = 'Open now · starts when the host starts it';

/** "Starts in 2 days" / "Live now · ends in 5h" / "Live now" / OPEN_NOW_WORDS. */
export function whenWords(
  e: Pick<DirectoryEvent, 'live' | 'startMs' | 'endMs'> & { open?: boolean },
  now: number = Date.now(),
): string {
  if (!e.live && (e.open || e.startMs == null)) return OPEN_NOW_WORDS;
  if (!e.live) return `Starts in ${spanWords((e.startMs ?? now) - now)}`;
  return e.endMs != null ? `Live now · ends in ${spanWords(e.endMs - now)}` : 'Live now';
}
