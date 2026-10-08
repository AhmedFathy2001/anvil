// Pure decisions for event Discord servers (lib/eventDiscord does the I/O).
//
// DESIGN: deliberately free of any `@/` import so it runs under `node --test` with no bundler, the
// same arrangement as lib/secretBox. Everything here is "given these facts, what should happen" —
// where a team's resources go, what a DM says, how a Discord answer is read.

import crypto from 'crypto';

/**
 * Where an event's Discord lives.
 *   own    — the host's bound server (lib/discord-teams). Nothing in this module applies.
 *   joint  — a separate event server: one role per team + shared text/voice. Each clan's private
 *            planning channels go in that clan's OWN server, so admins of one clan can never read the
 *            other's plan (being admin of the event server shows nothing private).
 *   single — one server holds everything, private per-team planning included. The server may be new
 *            or either clan's; its admins can see every team's planning — the hosts' explicit choice.
 */
export type DiscordLayout = 'own' | 'joint' | 'single';
export const DISCORD_LAYOUTS: readonly DiscordLayout[] = ['own', 'joint', 'single'];

export function isDiscordLayout(v: unknown): v is DiscordLayout {
  return typeof v === 'string' && (DISCORD_LAYOUTS as readonly string[]).includes(v);
}

export type ResourcePurpose = 'event' | 'planning';

export interface TeamPlacement {
  purpose: ResourcePurpose;
  /** 'event' = the event server; 'clan' = the server bound to `clanId`. */
  server: 'event' | 'clan';
  /** Set when server === 'clan': whose server, and whose bot does the work. */
  clanId: number | null;
  /** Create private text + voice channels for this team here (on top of the team role). */
  privateChannels: boolean;
}

/**
 * Where one team's Discord resources go.
 *
 * joint: the team always gets its role in the event server (that role unlocks the shared channels).
 * Its planning goes to its clan's own server — but a DRAFTED team belongs to no clan (teams.clanId is
 * null by design), so its only possible home is the event server, as private channels there.
 */
export function planTeamPlacement(layout: DiscordLayout, team: { clanId: number | null }): TeamPlacement[] {
  if (layout === 'single') {
    return [{ purpose: 'event', server: 'event', clanId: null, privateChannels: true }];
  }
  if (layout === 'joint') {
    if (team.clanId == null) {
      return [{ purpose: 'event', server: 'event', clanId: null, privateChannels: true }];
    }
    return [
      { purpose: 'event', server: 'event', clanId: null, privateChannels: false },
      { purpose: 'planning', server: 'clan', clanId: team.clanId, privateChannels: true },
    ];
  }
  return [];
}

// Unambiguous characters only: no 0/O, 1/I/L. A code someone reads off a phone and compares by eye.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** `ANV-XXXX` — the verification code shown in both the DM and the signed-in event page. */
export function generateJoinCode(randomBytes: (n: number) => Uint8Array = crypto.randomBytes): string {
  const bytes = randomBytes(6);
  let out = '';
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `ANV-${out}`;
}

// Anything that could pass for a link. Event and team names are typed by admins; a team called
// "discord.gg/free-nitro" must not turn the bot into a phishing courier.
const LINKISH = /(https?:\/\/\S+|www\.\S+|discord(?:app)?\.(?:gg|com|io|me)\/\S*|\b[a-z0-9-]+\.(?:gg|com|net|org|io|me|xyz|ru|co|app|link|gift)\b\S*)/gi;

/**
 * Make admin-typed text safe to put in a bot DM: no links, no mentions, no markdown that could dress
 * a fake link up as a real one, and bounded length.
 */
export function sanitizeForDm(text: string, max = 80): string {
  const cleaned = text
    .replace(LINKISH, '(link removed)')
    .replace(/@(everyone|here)/gi, '$1')
    .replace(/<[@#&!:a-z0-9_]+>/gi, '')
    .replace(/[*_~`|>\[\]()\\]/g, '')
    .replace(/link removed/g, '(link removed)')
    .replace(/\s+/g, ' ')
    .trim();
  const clamped = cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
  return clamped || 'your event';
}

export interface JoinDmInput {
  eventName: string;
  teamName: string;
  /** Absolute URL of the player's event Discord page on their own clan's Anvil site. */
  pageUrl: string;
  code: string;
}

/**
 * The ONLY message the bot sends players. Fixed wording on purpose: admins can't add text to it, so
 * nobody can use the bot to send their own links. It never contains a Discord invite — the invite is
 * only shown on the signed-in page — so "a DM with a discord.gg link" is always a fake.
 */
export function buildJoinDm(input: JoinDmInput): Record<string, unknown> {
  const eventName = sanitizeForDm(input.eventName);
  const teamName = sanitizeForDm(input.teamName, 60);
  const host = (() => {
    try {
      return new URL(input.pageUrl).host;
    } catch {
      return '';
    }
  })();
  return {
    embeds: [
      {
        title: `Anvil · ${eventName}`,
        color: 0xf0c674,
        description: [
          `You're on **${teamName}**. This event has its own Discord server.`,
          '',
          `Open your Anvil event page to join it${host ? ` (on **${host}**)` : ''}. You'll be added with your team role.`,
          '',
          `Your verification code: **${input.code}**`,
          'The same code is shown on that page. If it doesn’t match, this message is not from Anvil.',
        ].join('\n'),
        footer: {
          text: 'Anvil never DMs Discord invite links and never asks for passwords, 2FA codes or QR scans.',
        },
      },
    ],
    components: [
      {
        type: 1,
        components: [{ type: 2, style: 5, label: 'Open my event page', url: input.pageUrl }],
      },
    ],
    allowed_mentions: { parse: [] },
  };
}

/**
 * Read the answer to `PUT /guilds/{g}/members/{u}/roles/{r}`.
 * 204 → they are in the server and hold the role. 404 with code 10007 (Unknown Member) → not joined
 * yet. Anything else is a real failure worth surfacing.
 */
export function classifyRolePut(status: number, code?: number): 'joined' | 'not-member' | 'error' {
  if (status >= 200 && status < 300) return 'joined';
  if (status === 404 && (code === 10007 || code === undefined)) return 'not-member';
  return 'error';
}

/** Re-check a pending member no more often than `intervalMs`. */
export function dueForRecheck(lastCheckedAt: string | null, now: Date, intervalMs: number): boolean {
  if (!lastCheckedAt) return true;
  const t = Date.parse(lastCheckedAt.includes('T') ? lastCheckedAt : `${lastCheckedAt.replace(' ', 'T')}Z`);
  if (Number.isNaN(t)) return true;
  return now.getTime() - t >= intervalMs;
}

/** An invite we created is reusable until shortly before it expires. */
export function inviteStillUsable(expiresAt: string | null, now: Date, marginMs = 10 * 60_000): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  return !Number.isNaN(t) && t - now.getTime() > marginMs;
}

/** True when an OAuth `scope` string includes guilds.join. */
export function scopeAllowsJoin(scope: string | null | undefined): boolean {
  return !!scope && scope.split(/\s+/).includes('guilds.join');
}
