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

export type StreamPlatform = 'twitch' | 'kick';

export const STREAM_LINK_KEYS: Record<StreamPlatform, string> = {
  twitch: 'creator_twitch_url',
  kick: 'creator_kick_url',
};

const STREAM_HOSTS: Record<StreamPlatform, readonly string[]> = {
  twitch: ['twitch.tv', 'www.twitch.tv', 'm.twitch.tv'],
  kick: ['kick.com', 'www.kick.com'],
};

const STREAM_NAMES: Record<StreamPlatform, string> = { twitch: 'Twitch', kick: 'Kick' };

export type StreamLinkResult = { ok: true; url: string | null } | { ok: false; error: string };

/**
 * Check a channel link. Empty is fine (both are optional) and comes back as null.
 *
 * https only, on that platform's own host, with a channel name in the path — so a link labelled
 * "Twitch" on a creator's page can only ever go to Twitch. Stored without query or fragment.
 */
export function checkStreamLink(platform: StreamPlatform, raw: string | null | undefined): StreamLinkResult {
  const s = (raw ?? '').trim();
  if (!s) return { ok: true, url: null };
  const name = STREAM_NAMES[platform];
  const bad = { ok: false as const, error: `${name} link must look like https://${STREAM_HOSTS[platform][0]}/yourchannel` };
  if (s.length > 200) return bad;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return bad;
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return bad;
  if (!STREAM_HOSTS[platform].includes(u.hostname.toLowerCase())) return bad;
  const channel = u.pathname.split('/').filter(Boolean)[0] ?? '';
  if (!/^[A-Za-z0-9_-]{2,40}$/.test(channel)) return bad;
  return { ok: true, url: `https://${STREAM_HOSTS[platform][0]}/${channel}` };
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
