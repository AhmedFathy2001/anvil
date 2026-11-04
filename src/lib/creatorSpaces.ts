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
