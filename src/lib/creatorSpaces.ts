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

import type { EventEntry } from '@/lib/eventVisibility';
import type { FeatureKey } from '@/lib/features';

export type ClanKind = 'clan' | 'creator';

export function isClanKind(v: unknown): v is ClanKind {
  return v === 'clan' || v === 'creator';
}

/** Unknown values read as an ordinary clan — the stricter answer for entry (see outsiderNeedsApproval). */
export function clanKindOf(v: string | null | undefined): ClanKind {
  return v === 'creator' ? 'creator' : 'clan';
}

export function isCreatorSpace(clan: { kind?: string | null } | null | undefined): boolean {
  return clanKindOf(clan?.kind) === 'creator';
}

/** Modules that are always off in a creator space: they only mean something with a roster. */
export const CREATOR_ONLY_OFF: readonly FeatureKey[] = ['weekly'];

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
] as const;

export type CreatorHiddenAdminPath = (typeof CREATOR_HIDDEN_ADMIN_PATHS)[number];

/** Is this admin path one a creator space is sent away from? Matches whole path segments only. */
export function creatorHidesAdminPath(pathname: string): boolean {
  return CREATOR_HIDDEN_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
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
 *   creator space — `approval` asks; `open` never does.
 */
export function outsiderNeedsApproval(opts: { clanKind: ClanKind; entry: EventEntry; vouched: boolean }): boolean {
  if (opts.entry === 'approval') return true;
  if (opts.clanKind === 'creator') return false;
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
  for (const it of items) (clanKindOf(kindOf(it)) === 'creator' ? spaces : clans).push(it);
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
  const creator = clanKindOf(kind) === 'creator';
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
  if (clanKindOf(opts.kind) === 'creator') {
    const what = opts.eventName ? `to play in **${opts.eventName}**` : 'to play';
    return `**${opts.hostName}** said no to your request ${what}${who}. You can ask again later.`;
  }
  return (
    `**${opts.hostName}** declined your request to join as a guest${who}. ` +
    `You can still ask again later, or find another clan: ${opts.clansUrl}`
  );
}
