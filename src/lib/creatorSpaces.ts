// Creator spaces — the rules. Pure: no database import (tests/pure-module-imports).
//
// A creator space is a `clans` row with `kind = 'creator'`: a streamer's home for hosting events
// WITHOUT an in-game OSRS clan behind it. It reuses everything a clan has that is about running an
// event — the board, the wizard, sign-ups, staff — and drops everything that is a claim about a real
// clan in the game: no in-game name, no roster sync and its nags, no weeklies (they enter "the
// roster", and a creator has none), no member counts.
//
// The three decisions that differ from a clan, and why:
//
//   WHO MAY MAKE ONE — anybody signed in, one each. A clan has five because people run alts' clans
//     and test clans; a creator space is a person's own page, and one is the honest number until
//     somebody needs a second.
//   WHO GETS IN — `entry: 'open'` actually means open. On a clan it means "open to the people we
//     already said yes to" (lib/eventAccess), because a seat is a row on a real clan's roster. A
//     creator space HAS no roster to protect: its seats are only ever event guests, and a stream's
//     viewers are exactly the strangers it wants. `approval` keeps the host's yes/no.
//   WHO SEES IT LISTED — nobody, until the creator says so. A clan is listed unless it opts out; a
//     creator space is unlisted unless it opts IN ("Advertise on Anvil"), because a streamer's
//     events are for their audience first and the platform directory second.

import { parseStamp } from '@/lib/dbTime';
import type { EventEntry } from '@/lib/eventVisibility';
import type { FeatureKey } from '@/lib/features';

// 'friends' is a Supporter's hidden host for private events with friends (lib/friendEventRules): NOT a
// creator space (no page, no plan, no streaming), but like one it has no in-game clan behind it, so
// its players are event players and nobody is ever on a roster there.
export type ClanKind = 'clan' | 'creator' | 'friends';

export function isClanKind(v: unknown): v is ClanKind {
  return v === 'clan' || v === 'creator' || v === 'friends';
}

/** Unknown values read as an ordinary clan — the stricter answer for entry (see outsiderNeedsApproval). */
export function clanKindOf(v: string | null | undefined): ClanKind {
  return v === 'creator' ? 'creator' : v === 'friends' ? 'friends' : 'clan';
}

/**
 * Does this event seat outsiders as EVENT players (lib/eventPlayers: one seat, this event only, never
 * a guest or roster row)? Every streamed event (streamedEvent), and every friends event — which is
 * NOT streamed: no gates, no overlay, no `!join`, no plan meter, no directory.
 */
export function seatsEventPlayers(
  clan: { kind?: string | null; streaming?: boolean | null } | null | undefined,
  event: { openToViewers?: boolean | null } | null | undefined,
): boolean {
  return clan?.kind === 'friends' || streamedEvent(clan, event);
}

export function isCreatorSpace(clan: { kind?: string | null } | null | undefined): boolean {
  return clanKindOf(clan?.kind) === 'creator';
}

// ── Streaming ────────────────────────────────────────────────────────────────────────────────────
//
// The streamer features — Twitch / Kick / YouTube channel, "Who can join?" gates, the OBS overlay's
// mark, `!join` — belong to any space that STREAMS: a creator space always, and an ordinary clan once
// an admin turns on Streaming (clans.streaming). A clan's event is only streamed when its "Who can
// join?" lets viewers in (events.openToViewers); "Members only" is the default and today's behaviour.
// Whoever joins a streamed event as an outsider gets an EVENT seat (lib/eventPlayers), never a guest one.

/** Does this space have the streamer features: a creator space, or a clan with Streaming on? */
export function streamsEvents(clan: { kind?: string | null; streaming?: boolean | null } | null | undefined): boolean {
  return isCreatorSpace(clan) || clan?.streaming === true;
}

/**
 * Is this ONE event open to viewers — gated, player-capped (players at once across the host's such events), and seating outsiders as event players?
 * Every creator-space event is; a clan's only with Streaming on AND the event set to let viewers in.
 */
export function streamedEvent(
  clan: { kind?: string | null; streaming?: boolean | null } | null | undefined,
  event: { openToViewers?: boolean | null } | null | undefined,
): boolean {
  if (isCreatorSpace(clan)) return true;
  return clan?.streaming === true && event?.openToViewers === true;
}


/**
 * Modules that are always off in a creator space, switch hidden too: weeklies need a roster, the
 * coffer is a clan's gp and the Clan Hall card sits on a clan's public page. A new space is made
 * with all three off (lib/clanCreate CREATOR_FEATURES_OFF); this keeps them off.
 */
export const CREATOR_ONLY_OFF: readonly FeatureKey[] = ['weekly', 'coffer', 'clanHall'];

// ── Admin pages a creator space does not have ──────────────────────────────────────────────────

/**
 * Admin pages that only mean something for an in-game clan: the weekly competitions, the roster's
 * review queue, who may join the clan, in-game clan events, the gp coffer and the in-game setup
 * wizard. A creator space's menu never lists them (app/admin/layout builds a short one), and this
 * list is what turns a typed-in address away too — app/admin/layout checks it on every load and each
 * page checks its own entry (lib/creatorGuard), so the menu and the guard read one list.
 *
 * Prefixes: everything below an entry goes with it. The old addresses that only redirect into one of
 * these (/admin/verifications, /admin/clan/needs-review, /admin/clan/policy) are listed so they go
 * straight to the dashboard instead of taking two hops.
 */
export const CREATOR_HIDDEN_ADMIN_PATHS = [
  '/admin/weekly',
  '/admin/events/weekly',
  '/admin/clan-events',
  '/admin/coffer',
  '/admin/setup',
  '/admin/people/needs-review',
  '/admin/people/access',
  '/admin/verifications',
  '/admin/clan/needs-review',
  '/admin/clan/policy',
  // Co-hosting is between in-game clans: a creator space neither invites clans nor is invited.
  '/admin/cohosted',
] as const;

export type CreatorHiddenAdminPath = (typeof CREATOR_HIDDEN_ADMIN_PATHS)[number];

/** Is this admin path one a creator space is sent away from? Matches whole path segments only. */
export function creatorHidesAdminPath(pathname: string): boolean {
  return CREATOR_HIDDEN_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

// ── Sections inside pages a creator space does not have ─────────────────────────────────────────

/**
 * Folded sections of Admin → Discord (their FoldSection ids, which are also the settings search's
 * anchors) that only mean something for an in-game clan: slash commands and the Clan Hall card.
 * "Roles & nicknames" (`discord-roles`) is not here: a creator keeps its ping role, and only the
 * roster's role and nickname sync inside it goes (app/admin/integrations/DiscordSettings).
 */
export const CREATOR_HIDDEN_DISCORD_SECTIONS = ['discord-clan-hall', 'discord-commands'] as const;

export function creatorHidesDiscordSection(id: string): boolean {
  return (CREATOR_HIDDEN_DISCORD_SECTIONS as readonly string[]).includes(id);
}

/**
 * Rows of Discord → "What goes where" (lib/discordFeeds ids) with nothing to post in a creator
 * space: other clans' boards, weeklies, the clan calendar, the in-game roster and the coffer.
 */
export const CREATOR_HIDDEN_FEEDS: readonly string[] = ['cohost', 'weekly', 'clanEvents', 'roster', 'coffer'];

/** Tabs of "What goes where": game-mode worlds (Leagues, DMM…) never count toward an event. */
export const CREATOR_HIDDEN_FEED_TABS: readonly string[] = ['modes'];

/**
 * Settings keys a creator space has no use for: the channels and switches of the feeds above (on
 * "Post without a bot" too), the roster's Discord role and nickname sync, and the Clan Hall card.
 * Hidden from its screens and the settings search, and refused when a request turns one ON
 * (creatorRefusedSetting). Clearing one always goes through, so nothing old gets stuck on.
 */
export const CREATOR_HIDDEN_SETTING_KEYS: readonly string[] = [
  'discord_webhook_weekly',
  'discord_webhook_clan_events',
  'discord_webhook_roster',
  'discord_webhook_coffer',
  'discord_webhook_cohost',
  'discord_cohost_posts_enabled',
  'webhook_leagues',
  'leagues_icon_url',
  'discord_role_sync_enabled',
  'discord_nickname_sync_enabled',
  'discord_nickname_overwrite',
  'discord_widget_enabled',
  'discord_widget_public_names',
  'discord_widget_embed',
];

export function creatorHidesSettingKey(key: string): boolean {
  return CREATOR_HIDDEN_SETTING_KEYS.includes(key);
}

/**
 * For a settings write from a creator space: the first hidden key it would set to something, or
 * null. A blank, null, false or 'false' value is a clear and goes through.
 */
export function creatorRefusedSetting(body: Record<string, unknown> | null | undefined): string | null {
  if (!body) return null;
  for (const key of CREATOR_HIDDEN_SETTING_KEYS) {
    const v = body[key];
    if (v === undefined || v === null || v === false) continue;
    if (typeof v === 'string' && (v.trim() === '' || v.trim() === 'false')) continue;
    return key;
  }
  return null;
}

/**
 * Entries of the admin settings search (lib/adminSettingsIndex ids) for things a creator space does
 * not have on screen, beyond the hidden pages (those go by path): the clan profile's fields (a
 * creator's settings page is its own), the clan's Lately feed, the roster's role and nickname sync,
 * commands, the Clan Hall card and game-mode channels. Webhook entries go by their key.
 */
export const CREATOR_HIDDEN_SETTINGS: readonly string[] = [
  'clan-name',
  'clan-image',
  'clan-banner',
  'clan-hook',
  'clan-tags',
  'clan-discovery',
  'clan-requirements',
  'rules-feeds',
  'discord-roles',
  'discord-clan-hall',
  'discord-commands',
  'discord-game-modes',
];

export function creatorHidesSetting(id: string): boolean {
  if (CREATOR_HIDDEN_SETTINGS.includes(id)) return true;
  return id.startsWith('webhook-') && creatorHidesSettingKey(id.slice('webhook-'.length));
}

// ── Public pages a creator space does not have ─────────────────────────────────────────────────

/**
 * Player-facing pages that only mean something for an in-game clan: the roster and member profiles,
 * the weekly competitions, the gp coffer and in-game clan events. In a creator space each sends the
 * visitor to the space's home (lib/creatorGuard creatorPublicAway), and nothing links to them.
 * Prefixes, matched on whole path segments like CREATOR_HIDDEN_ADMIN_PATHS.
 */
export const CREATOR_HIDDEN_PUBLIC_PATHS = ['/members', '/weekly', '/coffer', '/clan-events'] as const;

export type CreatorHiddenPublicPath = (typeof CREATOR_HIDDEN_PUBLIC_PATHS)[number];

export function creatorHidesPublicPath(pathname: string): boolean {
  return CREATOR_HIDDEN_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/**
 * Where a request for one of those pages goes instead: the space's home, or null to render it (an
 * ordinary clan, or a path not on the list). `prefix` is the request's clan prefix (`/c/<slug>`, or
 * '' on a space's own host, where '/' is its home).
 */
export function creatorPublicRedirect(
  pathname: string,
  clan: { kind?: string | null } | null | undefined,
  prefix: string,
): string | null {
  if (!isCreatorSpace(clan) || !creatorHidesPublicPath(pathname)) return null;
  return prefix || '/';
}

// ── The space's events list ─────────────────────────────────────────────────────────────────────
//
// A clan's events hub leaves an undated board out: there, no start date means the host is still
// building it. A creator's undated event is usually the opposite — sign-ups are open and it "starts
// when the host starts it", on stream. So a creator space lists its own events by these rules, and
// the count above the list is the number of rows the same viewer is shown.

export type CreatorEventGroup = 'live' | 'open' | 'upcoming' | 'past';

/** The groups in page order, with their headings. */
export const CREATOR_EVENT_GROUPS: readonly { key: CreatorEventGroup; title: string }[] = [
  { key: 'live', title: 'Live now' },
  { key: 'open', title: 'Open to join' },
  { key: 'upcoming', title: 'Coming up' },
  { key: 'past', title: 'Finished' },
];

/** Shown on a row only the space's staff can see (an invite-only event). */
export const CREATOR_STAFF_ONLY_TAG = 'Only you can see this';

export interface CreatorEventRow {
  visibility: string | null;
  startDate: string | null;
  endDate: string | null;
  forceEndedAt: string | null;
}

/**
 * Where one of the space's events goes on its page for this viewer, or null when it is not theirs
 * to see. Invite-only events (and any visibility nobody recognises) are never listed to anyone but
 * the space's staff, who see every event with `staffOnly` set on the ones nobody else can.
 */
export function creatorEventPlacement(
  e: CreatorEventRow,
  opts: { staff: boolean; now?: number },
): { group: CreatorEventGroup; staffOnly: boolean } | null {
  const seenByAll = e.visibility === 'public' || e.visibility === 'clan';
  if (!seenByAll && !opts.staff) return null;
  const now = opts.now ?? Date.now();
  const start = parseStamp(e.startDate);
  const end = parseStamp(e.endDate);
  let group: CreatorEventGroup;
  if (e.forceEndedAt || (end != null && end <= now)) group = 'past';
  else if (start == null) group = 'open';
  else if (start <= now) group = 'live';
  else group = 'upcoming';
  return { group, staffOnly: !seenByAll };
}

// ── What the space calls itself ─────────────────────────────────────────────────────────────────

/** What the space's home page calls itself after its name, in the tab and in search results. */
export function homeTitleSuffix(kind: string | null | undefined): string {
  return clanKindOf(kind) === 'creator' ? 'Events on Anvil' : 'OSRS Clan';
}

/** The fallback description of a space with nothing of its own written: no "roster" for a creator. */
export function spaceDescription(kind: string | null | undefined, name: string): string {
  return clanKindOf(kind) === 'creator'
    ? `Old School RuneScape events by ${name} on Anvil: bingos and races for their viewers.`
    : `Bingos, competitions and the roster for ${name}.`;
}

/** The small label over the name on the space's link card (lib/ogCard clanCard). */
export function spaceCardEyebrow(kind: string | null | undefined): string {
  return clanKindOf(kind) === 'creator' ? 'Events · on Anvil' : 'OSRS Clan · on Anvil';
}

/** What an in-game-only admin API says to a creator space. */
export const CREATOR_NOT_AVAILABLE = 'This is for in-game clans. A creator space does not have it.';

// ── Who may create one ───────────────────────────────────────────────────────────────────────────

/** How many creator spaces one person may own. A squatting bound, like MAX_OWNED in /api/clans. */
export const MAX_CREATOR_SPACES = 1;

export type CreateVerdict = { ok: true } | { ok: false; reason: 'signed-out' | 'at-cap'; message: string };

export function mayCreateCreatorSpace(opts: { signedIn: boolean; ownedCreatorSpaces: number }): CreateVerdict {
  if (!opts.signedIn) {
    return { ok: false, reason: 'signed-out', message: 'Sign in with Discord first — a space needs an owner.' };
  }
  if (opts.ownedCreatorSpaces >= MAX_CREATOR_SPACES) {
    return { ok: false, reason: 'at-cap', message: 'You already have a creator space. Get in touch if you need another.' };
  }
  return { ok: true };
}

// ── Who gets in ──────────────────────────────────────────────────────────────────────────────────

/**
 * Does an OUTSIDER (no seat in the host yet) need the host's yes before they play?
 *
 *   ordinary clan — `approval` always asks; `open` asks unless the clan already vouched for them
 *                   (invited by name, or their clan is invited / co-hosting). Unchanged.
 *   creator space — `approval` asks; `open` never does. Same for a Streaming clan's viewer event.
 */
export function outsiderNeedsApproval(opts: { clanKind: ClanKind; entry: EventEntry; vouched: boolean; streamed?: boolean }): boolean {
  if (opts.entry === 'approval') return true;
  // A Streaming clan's event open to viewers (streamedEvent) is a creator event for this purpose:
  // the viewer gets an event seat, not a place on the roster, so `open` can mean open.
  if (opts.clanKind === 'creator' || opts.clanKind === 'friends' || opts.streamed === true) return false;
  return !opts.vouched;
}

// ── Listing ──────────────────────────────────────────────────────────────────────────────────────

/** The `public_showcase` value the "Advertise on Anvil" toggle writes. */
export function showcaseValueFor(advertise: boolean): 'on' | 'off' {
  return advertise ? 'on' : 'off';
}

/**
 * Is the showcase switch on, for this kind of space?
 *
 * A clan is listed unless it said 'off' (absent row = listed). A creator space is listed only when
 * it said 'on' — absent is UNLISTED — so a space whose setting row went missing stays off the
 * directory rather than appearing on it.
 */
export function showcaseOn(kind: string | null | undefined, showcase: string | null): boolean {
  return clanKindOf(kind) === 'creator' ? showcase === 'on' : showcase !== 'off';
}

// ── Stream links ─────────────────────────────────────────────────────────────────────────────────
//
// A creator page links ONLY to channels the space has connected through that platform's OAuth
// (clan_twitch_channels, clan_kick_channels, clan_youtube_channels): signing in as the channel is the
// proof it is theirs. A typed address proved nothing (anybody could type a famous streamer's
// channel), so the old typed `creator_twitch_url` / `creator_kick_url` settings are never read or
// written any more; rows that still exist are ignored. The URL is built here from the stored login,
// slug or channel id, never from anything a person typed.

export type StreamPlatform = 'twitch' | 'kick' | 'youtube';

export interface VerifiedStreamLink {
  platform: StreamPlatform;
  /** "Twitch" / "Kick" / "YouTube". */
  label: string;
  /** What the channel is called there: the login, the slug, the @handle or the channel title. */
  handle: string;
  url: string;
}

/** What the connected-channel rows hold. A missing row (never connected, or disconnected) is null. */
export interface ConnectedChannels {
  twitchLogin?: string | null;
  kickSlug?: string | null;
  youtube?: { channelId: string; handle: string | null; title?: string | null } | null;
}

const TWITCH_LOGIN = /^[A-Za-z0-9_]{1,25}$/;
const KICK_SLUG = /^[A-Za-z0-9_-]{1,40}$/;
const YOUTUBE_HANDLE = /^@[A-Za-z0-9._-]{1,100}$/;
const YOUTUBE_CHANNEL_ID = /^UC[A-Za-z0-9_-]{10,40}$/;

/**
 * The links a creator page shows, built from its OAuth-connected channels only. A stored value that
 * does not look like that platform's name is dropped rather than put in an href.
 */
export function verifiedStreamLinks(c: ConnectedChannels): VerifiedStreamLink[] {
  const out: VerifiedStreamLink[] = [];
  const login = c.twitchLogin?.trim();
  if (login && TWITCH_LOGIN.test(login)) {
    out.push({ platform: 'twitch', label: 'Twitch', handle: login, url: `https://www.twitch.tv/${login.toLowerCase()}` });
  }
  const yt = c.youtube;
  if (yt) {
    const handle = yt.handle?.trim();
    if (handle && YOUTUBE_HANDLE.test(handle)) {
      out.push({ platform: 'youtube', label: 'YouTube', handle, url: `https://www.youtube.com/${handle}` });
    } else if (YOUTUBE_CHANNEL_ID.test(yt.channelId ?? '')) {
      const title = (yt.title ?? '').trim().slice(0, 60) || 'YouTube';
      out.push({ platform: 'youtube', label: 'YouTube', handle: title, url: `https://www.youtube.com/channel/${yt.channelId}` });
    }
  }
  const slug = c.kickSlug?.trim();
  if (slug && KICK_SLUG.test(slug)) {
    out.push({ platform: 'kick', label: 'Kick', handle: slug, url: `https://kick.com/${slug.toLowerCase()}` });
  }
  return out;
}

// ── Name and address ────────────────────────────────────────────────────────────────────────────

/** A suggested address from a display name: "Cool Streamer!" → "cool-streamer". */
export function suggestSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

// ── Setup checklist ─────────────────────────────────────────────────────────────────────────────

export interface CreatorSetupStep {
  key: 'event' | 'share' | 'discord';
  label: string;
  hint: string;
  done: boolean;
  href: string;
  /** Not counted towards "all done". */
  optional?: boolean;
}

/**
 * The creator's checklist: make an event, get someone into it, and — if they want — Discord.
 *
 * "Share the link" is done when somebody other than the staff has signed up, which is the only
 * evidence a link was shared that the database holds.
 */
export function creatorSetupSteps(opts: { eventsCount: number; outsideSignups: number; discordConnected: boolean }): CreatorSetupStep[] {
  return [
    {
      key: 'event',
      label: 'Create your first event',
      hint: 'A bingo board, a tile race or a leagues-style points list for your viewers.',
      done: opts.eventsCount > 0,
      href: '/admin/events/new',
    },
    {
      key: 'share',
      label: 'Share the link',
      hint: 'Drop the event link in your stream chat or socials. Viewers sign in with Discord and join straight away.',
      done: opts.outsideSignups > 0,
      href: '/admin/events',
    },
    {
      key: 'discord',
      label: 'Connect Discord (optional)',
      hint: 'Let Anvil post your event updates in your community server.',
      done: opts.discordConnected,
      href: '/admin/integrations',
      optional: true,
    },
  ];
}

// ── "Your clans" and "Your spaces" ──────────────────────────────────────────────────────────────

export const YOUR_CLANS_HEADING = 'Your clans';
export const YOUR_SPACES_HEADING = 'Your spaces';

export interface ClanKindGroup<T> {
  key: 'clans' | 'spaces';
  label: string;
  items: T[];
}

/**
 * A person's places, split into their in-game clans and their creator spaces. A creator space is
 * not a clan (no in-game clan behind it), so every list of "your clans" shows spaces as their own
 * group. Clans first; input order kept within each group; an empty group is left out, so somebody
 * with only spaces never sees an empty "Your clans" heading.
 */
export function groupClansAndSpaces<T>(items: readonly T[], kindOf: (item: T) => string | null | undefined): ClanKindGroup<T>[] {
  const clans: T[] = [];
  const spaces: T[] = [];
  for (const it of items) {
    const kind = clanKindOf(kindOf(it));
    // A friends host is neither: it has its own "Friends events" entry (/host/friends).
    if (kind === 'friends') continue;
    (kind === 'creator' ? spaces : clans).push(it);
  }
  const out: ClanKindGroup<T>[] = [];
  if (clans.length > 0) out.push({ key: 'clans', label: YOUR_CLANS_HEADING, items: clans });
  if (spaces.length > 0) out.push({ key: 'spaces', label: YOUR_SPACES_HEADING, items: spaces });
  return out;
}

// ── Words ────────────────────────────────────────────────────────────────────────────────────────

/**
 * What to call somebody who plays in a space they are not a member of. A clan says "guest" — it has
 * members to tell them apart from. A creator space has no members, so everyone is just a "player".
 */
export function outsiderWord(kind: string | null | undefined, plural = false): string {
  const creator = clanKindOf(kind) !== 'clan';
  if (plural) return creator ? 'players' : 'guests';
  return creator ? 'player' : 'guest';
}

/** The Discord DM somebody gets when the host says no to their request. */
export function declinedRequestText(opts: {
  kind: string | null | undefined;
  hostName: string;
  rsn?: string | null;
  eventName?: string | null;
  clansUrl: string;
}): string {
  const who = opts.rsn ? ` for **${opts.rsn}**` : '';
  if (clanKindOf(opts.kind) !== 'clan') {
    const what = opts.eventName ? `to play in **${opts.eventName}**` : 'to play';
    return `**${opts.hostName}** said no to your request ${what}${who}. You can ask again later.`;
  }
  return (
    `**${opts.hostName}** declined your request to join as a guest${who}. ` +
    `You can still ask again later, or find another clan: ${opts.clansUrl}`
  );
}
