// Kick entry gates — the pure half: link codes, reading Kick's webhook payloads, how long a fact
// counts, and what a Kick rule tells the viewer. No database (tests/kick-gates.test.ts).
//
// HOW A VIEWER PROVES THEMSELVES. Kick has no "does X follow/sub to Y" endpoint and no identity-only
// OAuth worth asking a viewer for, so the viewer presses "Get Kick code" on Anvil, gets ANVIL-7F3K9Q
// (bound to their Anvil login, ten minutes, single use) and types it in the host's Kick chat. Kick
// sends the message to Anvil's webhook with the sender's Kick id and badges, so one line proves
// "this Kick account is this Anvil login" AND, if a subscriber badge is on it, "subscribed now".
//
// FOLLOWS come from channel.followed events, which Kick only sends from when the host connected —
// or from a code typed in a chat the host says is followers-only (only followers can type there).

import type { GateContext } from '@/lib/entryGates';
import { cleanKickName, kickIdOf } from '@/lib/kick';

export type KickRule = { kind: 'kick-follow' } | { kind: 'kick-sub' };
export type KickKind = KickRule['kind'];

export function isKickKind(k: unknown): k is KickKind {
  return k === 'kick-follow' || k === 'kick-sub';
}

// ── Codes ────────────────────────────────────────────────────────────────────────────────────────

/** No 0/O, 1/I/L, U: read off a screen and typed into a chat, they get confused. 30 symbols. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export const KICK_CODE_LEN = 6;
export const KICK_CODE_TTL_MS = 10 * 60_000;

/** ANVIL-XXXXXX from a random source (crypto in production; injectable for tests). */
export function makeKickCode(randomBytes: (n: number) => Uint8Array): string {
  const out: string[] = [];
  while (out.length < KICK_CODE_LEN) {
    for (const b of randomBytes(16)) {
      // Reject the tail so every symbol is equally likely (256 = 8×30 + 16).
      if (b >= 240) continue;
      out.push(ALPHABET[b % ALPHABET.length]);
      if (out.length === KICK_CODE_LEN) break;
    }
  }
  return `ANVIL-${out.join('')}`;
}

const CODE_IN_TEXT = new RegExp(`(?:^|[^A-Za-z0-9])ANVIL-([${ALPHABET}]{${KICK_CODE_LEN}})(?![A-Za-z0-9])`, 'i');

/** The first link code in a chat line, normalised — or null. Case-insensitive; anywhere in the line. */
export function findKickCode(text: unknown): string | null {
  if (typeof text !== 'string' || text.length > 2000) return null;
  const m = CODE_IN_TEXT.exec(text.toUpperCase());
  return m ? `ANVIL-${m[1]}` : null;
}

export function isKickCode(v: unknown): v is string {
  return typeof v === 'string' && new RegExp(`^ANVIL-[${ALPHABET}]{${KICK_CODE_LEN}}$`).test(v);
}

// ── Facts ────────────────────────────────────────────────────────────────────────────────────────

/** A sub badge seen in chat counts this long: Kick subs are monthly, plus a little grace. */
export const KICK_BADGE_SUB_MS = 35 * 24 * 60 * 60_000;
/** Grace past the expiry Kick reported on a sub event (renewals can land a little late). */
export const KICK_SUB_GRACE_MS = 3 * 24 * 60 * 60_000;
/** The longest a single fact may claim, whatever a payload says. */
const KICK_SUB_MAX_MS = 400 * 24 * 60 * 60_000;

/** Until when a subscription event makes someone a sub: Kick's expires_at + grace, else a badge's span. */
export function subUntilFrom(expiresAt: unknown, now: number): number {
  const t = typeof expiresAt === 'string' ? Date.parse(expiresAt) : NaN;
  if (Number.isFinite(t) && t > now) return Math.min(t + KICK_SUB_GRACE_MS, now + KICK_SUB_MAX_MS);
  return now + KICK_BADGE_SUB_MS;
}

export interface KickFacts {
  followedAt: string | null;
  subUntil: string | null;
}

export function factsSay(f: KickFacts | null, now: number): { follows: boolean; sub: boolean } {
  if (!f) return { follows: false, sub: false };
  const until = f.subUntil ? Date.parse(f.subUntil) : NaN;
  return { follows: !!f.followedAt, sub: Number.isFinite(until) && until > now };
}

// ── Webhook payloads ────────────────────────────────────────────────────────────────────────────

export interface KickPerson {
  id: string;
  name: string;
}

export type KickEvent =
  | {
      type: 'chat';
      broadcasterId: string;
      sender: KickPerson;
      /** Subscriber badge on the message. */
      subscriber: boolean;
      content: string;
      messageId: string | null;
    }
  | { type: 'follow'; broadcasterId: string; follower: KickPerson }
  | { type: 'sub'; broadcasterId: string; subscribers: KickPerson[]; expiresAt: string | null };

function person(v: unknown): KickPerson | null {
  const p = v as { user_id?: unknown; username?: unknown; is_anonymous?: unknown } | null;
  if (!p || typeof p !== 'object' || p.is_anonymous === true) return null;
  const id = kickIdOf(p.user_id);
  if (!id) return null;
  return { id, name: cleanKickName(p.username) || 'a Kick user' };
}

function broadcasterOf(b: Record<string, unknown>): string | null {
  return kickIdOf((b.broadcaster as { user_id?: unknown } | undefined)?.user_id);
}

/**
 * A webhook body (by Kick-Event-Type) → the few facts Anvil uses, or null for anything else or
 * malformed. Only ids, a cleaned name, the subscriber badge and the text are kept.
 */
export function parseKickEvent(type: string | null, version: string | null, body: unknown): KickEvent | null {
  if (!body || typeof body !== 'object' || (version != null && version !== '1')) return null;
  const b = body as Record<string, unknown>;
  const broadcasterId = broadcasterOf(b);
  if (!broadcasterId) return null;
  switch (type) {
    case 'chat.message.sent': {
      const sender = person(b.sender);
      if (!sender || typeof b.content !== 'string') return null;
      const badges = (b.sender as { identity?: { badges?: unknown } }).identity?.badges;
      const subscriber = Array.isArray(badges) && badges.some((x) => (x as { type?: unknown })?.type === 'subscriber');
      const mid = typeof b.message_id === 'string' && b.message_id.length <= 100 ? b.message_id : null;
      return { type: 'chat', broadcasterId, sender, subscriber, content: b.content.slice(0, 2000), messageId: mid };
    }
    case 'channel.followed': {
      const follower = person(b.follower);
      return follower ? { type: 'follow', broadcasterId, follower } : null;
    }
    case 'channel.subscription.new':
    case 'channel.subscription.renewal': {
      const s = person(b.subscriber);
      if (!s) return null;
      return { type: 'sub', broadcasterId, subscribers: [s], expiresAt: typeof b.expires_at === 'string' ? b.expires_at : null };
    }
    case 'channel.subscription.gifts': {
      const giftees = Array.isArray(b.giftees) ? b.giftees.slice(0, 500).map(person).filter((x): x is KickPerson => !!x) : [];
      if (giftees.length === 0) return null;
      return { type: 'sub', broadcasterId, subscribers: giftees, expiresAt: typeof b.expires_at === 'string' ? b.expires_at : null };
    }
    default:
      return null;
  }
}

// ── The gate's words ────────────────────────────────────────────────────────────────────────────

/** Why a Kick question could not be answered. */
export type KickUnknown = 'off' | 'host-missing' | 'viewer-unlinked' | 'error';

export type KickAnswer =
  | { state: 'ok'; follows: boolean; sub: boolean; followersOnlyChat: boolean }
  | { state: KickUnknown };

function kickChannel(ctx: GateContext): string {
  return ctx.kickSlug ?? 'the host';
}

export function kickRuleLabel(rule: KickRule, ctx: GateContext): string {
  return rule.kind === 'kick-follow' ? `followers of ${kickChannel(ctx)} on Kick` : `subscribers of ${kickChannel(ctx)} on Kick`;
}

/**
 * One Kick rule against the answer: a pass, or what the viewer should do. `code` = show the "Get
 * Kick code" button (link, or prove a follow/sub by typing a fresh code in the host's chat).
 */
export function kickRuleOutcome(
  rule: KickRule,
  a: KickAnswer,
  ctx: GateContext,
): { pass: true } | { pass: false; step: string; transient?: true; code?: true } {
  const ch = kickChannel(ctx);
  if (a.state === 'viewer-unlinked') {
    return { pass: false, step: `Link your Kick account: get a code and type it in ${ch}’s Kick chat`, code: true };
  }
  if (a.state === 'error') return { pass: false, step: 'Anvil couldn’t check Kick just now — try again in a minute', transient: true };
  if (a.state !== 'ok') return { pass: false, step: 'The host’s Kick connection isn’t working — let them know' };
  if (rule.kind === 'kick-follow') {
    if (a.follows) return { pass: true };
    return a.followersOnlyChat
      ? { pass: false, step: `Follow ${ch} on Kick, then type a fresh Anvil code in their chat`, code: true }
      : { pass: false, step: `Follow ${ch} on Kick (followed before they connected Anvil? Unfollow and follow again)` };
  }
  if (a.sub) return { pass: true };
  return { pass: false, step: `Subscribe to ${ch} on Kick — already subscribed? Type a fresh Anvil code in their chat`, code: true };
}

/** The Kick account that passed the gate already got somebody else into this event. */
export const KICK_ALREADY_USED = 'That Kick account was already used to join this event by another player.';
