// Connected accounts — the pure half: which platforms, how each link is shown, who may see it, and
// the Medal profile parsing and verification code. No database import (tests/connected-accounts.test.ts).
//
// WHAT "CONNECTED" MEANS PER PLATFORM (the database half is lib/connectedAccounts):
//
//   twitch   — Twitch OAuth with NO scopes (lib/twitch, the same viewer flow the entry gates use). The
//              token proves who they are and is revoked at once. Verified.
//   youtube  — Google sign-in (lib/gates/youtube, mode 'link'): the channel the token speaks for,
//              token revoked at once. Verified.
//   kick     — a one-time code typed in the official Anvil Kick channel's chat (or any connected
//              streamer's), seen by Anvil's signed webhook (lib/gates/kickAnvilChannel). Verified.
//   medal    — Medal.tv has no OAuth and no public profile API (see lib/medal). The person enters
//              their profile; it is UNVERIFIED until they put their Anvil code in the title of one of
//              their latest public clips and Anvil reads it back through Medal's API (needs
//              MEDAL_API_KEY). Unverified links are clearly labelled and hidden from profiles by default.
//
// One platform account per Anvil login (unique indexes on every link table; Medal's only once verified,
// so nobody can squat somebody else's Medal profile by typing it in).

import crypto from 'crypto';

export const PLATFORMS = ['twitch', 'youtube', 'kick', 'medal'] as const;
export type Platform = (typeof PLATFORMS)[number];

export function isPlatform(v: unknown): v is Platform {
  return typeof v === 'string' && (PLATFORMS as readonly string[]).includes(v);
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  twitch: 'Twitch',
  youtube: 'YouTube',
  kick: 'Kick',
  medal: 'Medal',
};

/** One link as a page may show it. Every string has been through the sanitizers below. */
export interface ConnectedLink {
  platform: Platform;
  /** What the chip reads: @login, the channel title, the Kick username, the Medal name. */
  handle: string;
  /** https URL on the platform's own host, built here from a sanitized id/handle — never stored input. */
  url: string | null;
  verified: boolean;
  /** The person's "show on my profile" choice (default: on when verified, off when not). */
  showOnProfile: boolean;
  /** Platform-side id, for the live lookups. Never rendered. */
  platformId: string | null;
}

export function defaultShowOnProfile(verified: boolean): boolean {
  return verified;
}

/** The stored choice, or the default for this link's verified state. */
export function resolveShowOnProfile(stored: boolean | null | undefined, verified: boolean): boolean {
  return typeof stored === 'boolean' ? stored : defaultShowOnProfile(verified);
}

/**
 * What a profile shows. The owner sees everything they linked (so they can tell what strangers see);
 * everybody else sees only links the owner chose to show — and never an unverified one unless it
 * carries its "not verified" label, which the component always renders for `verified: false`.
 */
export function visibleLinks(links: ConnectedLink[], viewerIsOwner: boolean): ConnectedLink[] {
  return viewerIsOwner ? links : links.filter((l) => l.showOnProfile);
}

// ── Sanitizers ───────────────────────────────────────────────────────────────────────────────────

/** Display text from a platform: no control / zero-width / bidi characters, trimmed, capped. */
export function cleanHandle(v: unknown, max = 60): string {
  return String(v ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '')
    .trim()
    .slice(0, max);
}

const TWITCH_LOGIN = /^[a-z0-9_]{1,25}$/;
const YT_CHANNEL = /^UC[A-Za-z0-9_-]{22}$/;
const KICK_SLUG = /^[a-z0-9_-]{1,40}$/;
const MEDAL_ID = /^[0-9]{1,15}$/;
const MEDAL_NAME = /^[A-Za-z0-9_.-]{2,32}$/;

export function twitchUrl(login: string): string | null {
  return TWITCH_LOGIN.test(login) ? `https://www.twitch.tv/${login}` : null;
}

export function youtubeUrl(channelId: string): string | null {
  return YT_CHANNEL.test(channelId) ? `https://www.youtube.com/channel/${channelId}` : null;
}

/**
 * Kick's channel slug for a username: lowercase, and Kick turns underscores into dashes in slugs.
 * The live lookup (lib/connectedLive) returns the real slug and wins when it has one.
 */
export function kickSlugFor(username: string): string | null {
  const s = username.trim().toLowerCase().replace(/_/g, '-');
  return KICK_SLUG.test(s) ? s : null;
}

export function kickUrl(slug: string | null): string | null {
  return slug && KICK_SLUG.test(slug) ? `https://kick.com/${slug}` : null;
}

export function medalUrl(link: { medalUserId: string | null; medalUsername: string | null }): string | null {
  if (link.medalUsername && MEDAL_NAME.test(link.medalUsername)) return `https://medal.tv/u/${link.medalUsername}`;
  if (link.medalUserId && MEDAL_ID.test(link.medalUserId)) return `https://medal.tv/users/${link.medalUserId}`;
  return null;
}

// ── Medal profile input ─────────────────────────────────────────────────────────────────────────

export type MedalProfile = { userId: string | null; username: string | null };

/**
 * What a person typed for their Medal profile → a numeric user id and/or a username. Accepts
 * `https://medal.tv/users/1234`, `medal.tv/u/name`, `https://medal.tv/u/name/clips`, a bare id or a
 * bare name. Anything on another host, or that is not one of those shapes, is null — the input is
 * never fetched and never echoed back as a URL.
 */
export function parseMedalProfile(input: unknown): MedalProfile | null {
  if (typeof input !== 'string') return null;
  const raw = input.trim();
  if (!raw || raw.length > 200 || /[\s\\]/.test(raw)) return null;
  if (MEDAL_ID.test(raw)) return { userId: raw, username: null };
  if (MEDAL_NAME.test(raw.replace(/^@/, '')) && !raw.includes('/')) return { userId: null, username: raw.replace(/^@/, '') };
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase();
  if (host !== 'medal.tv' && host !== 'www.medal.tv') return null;
  const parts = u.pathname.split('/').filter(Boolean);
  // medal.tv/<locale>/users/… and medal.tv/<locale>/u/… also exist.
  if (parts[0] && /^[a-z]{2}(-[a-z]{2})?$/i.test(parts[0]) && (parts[1] === 'users' || parts[1] === 'u')) parts.shift();
  if (parts[0] === 'users' && parts[1] && MEDAL_ID.test(parts[1])) return { userId: parts[1], username: null };
  if (parts[0] === 'u' && parts[1] && MEDAL_NAME.test(parts[1])) return { userId: null, username: parts[1] };
  return null;
}

// ── Medal verification code ─────────────────────────────────────────────────────────────────────
//
// STATELESS, like the YouTube member code: HMAC(Anvil user, Medal user id). The same person always
// gets the same code for the same Medal account, nothing to store or expire, and a code is useless
// for any other (user, Medal account) pair. It only proves anything when it shows up in a clip
// title on THAT Medal account, which only its owner can edit.

const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

export function medalCode(userId: number, medalUserId: string, key: string): string {
  const mac = crypto.createHmac('sha256', `anvil-medal-code:${key}`).update(`${userId}:${medalUserId}`).digest();
  let out = '';
  for (let i = 0; out.length < 6; i++) out += CODE_ALPHABET[mac[i] % CODE_ALPHABET.length];
  return `ANVIL-${out}`;
}

/** Does this clip title carry the code (any case, as a whole token)? */
export function titleHasCode(title: unknown, code: string): boolean {
  if (typeof title !== 'string' || title.length > 500) return false;
  const re = new RegExp(`(?:^|[^A-Za-z0-9])${code.replace('-', '\\-')}(?![A-Za-z0-9])`, 'i');
  return re.test(title);
}

/** "Credits to Name (https://medal.tv/users/123)" → { name, id } when it names this Medal user. */
export function creditsName(credits: unknown, medalUserId: string): string | null {
  if (typeof credits !== 'string' || credits.length > 500) return null;
  const m = /Credits to\s+([^()]{1,40}?)\s*\(https?:\/\/(?:www\.)?medal\.tv\/users\/(\d{1,15})\)/i.exec(credits);
  if (!m || m[2] !== medalUserId) return null;
  const name = cleanHandle(m[1], 32);
  return MEDAL_NAME.test(name) ? name : null;
}
