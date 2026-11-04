import crypto from 'node:crypto';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// `!join` in Twitch chat — the pieces the bot process (bot/twitchChat.ts) and the site share.
//
// The bot is a small long-lived process next to the push server. It holds NO database access: it asks
// the site (api/internal/twitch-bot) which channels have the bot switched on and what to answer in
// each, so every rule about who is listed and which event is joinable lives in the site, once.
//
// Shared by both sides and run by the bot under Node's type stripping, so: imports nothing from '@/',
// no enums, no parameter properties, type-only imports marked `import type`.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** The creator-space setting that switches `!join` on ('on' | absent). The host's opt-in. */
export const CHAT_JOIN_SETTING = 'creator_twitch_chat_join';

/**
 * The bot's pass onto the site's internal route, derived from the secret the two already share — the
 * same construction as the push server's (lib/push/ticket internalSecret), under its own label, so
 * neither pass opens the other's door.
 */
export function botSecret(sessionSecret: string): string {
  return crypto.createHmac('sha256', sessionSecret).update('anvil-twitch-bot:v1').digest('base64url');
}

export type ChatCommand = 'join';

/** `!join` (any case), alone or followed by anything. `!joinme`, `! join` and mid-line mentions are not it. */
export function parseChatCommand(text: unknown): ChatCommand | null {
  if (typeof text !== 'string') return null;
  return /^!join(?:\s|$)/i.test(text.trim()) ? 'join' : null;
}

/** Twitch's own cap on a chat message. */
export const MAX_CHAT_CHARS = 500;

/** One line, no control characters, under Twitch's cap. Everything the bot sends goes through here. */
export function cleanChatMessage(s: string): string {
  const flat = s.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return flat.length > MAX_CHAT_CHARS ? `${flat.slice(0, MAX_CHAT_CHARS - 1)}…` : flat;
}

/** The answer to `!join`: the event's name and its link. Short — it is read in a fast chat. */
export function joinReplyText(eventName: string, url: string): string {
  const name = cleanChatMessage(eventName).slice(0, 80);
  return cleanChatMessage(`Join ${name} on Anvil: ${url}`);
}

/** When nothing is open: said once per cooldown like any reply, so `!join` never goes unanswered. */
export const NOTHING_OPEN_REPLY = 'No event is open to join right now — keep an eye on the stream!';

// ── Rate limits ─────────────────────────────────────────────────────────────────────────────────

/**
 * Per-channel cooldown plus a global budget.
 *
 * Per channel: one answer per `channelMs`, however many people type `!join` — a chat that spams it
 * gets the link once, which is all it needs. Global: at most `globalMax` sends per `globalWindowMs`
 * across every channel, kept well under Twitch's limit for a bot account that is not a moderator.
 */
export class ReplyLimiter {
  readonly channelMs: number;
  readonly globalMax: number;
  readonly globalWindowMs: number;
  readonly last = new Map<string, number>();
  sent: number[] = [];

  constructor(opts: { channelMs?: number; globalMax?: number; globalWindowMs?: number } = {}) {
    this.channelMs = opts.channelMs ?? 30_000;
    this.globalMax = opts.globalMax ?? 15;
    this.globalWindowMs = opts.globalWindowMs ?? 30_000;
  }

  /** True when a reply in this channel may go now — and records it. */
  take(channelId: string, now: number): boolean {
    const prev = this.last.get(channelId);
    if (prev != null && now - prev < this.channelMs) return false;
    this.sent = this.sent.filter((t) => now - t < this.globalWindowMs);
    if (this.sent.length >= this.globalMax) return false;
    this.last.set(channelId, now);
    this.sent.push(now);
    return true;
  }
}

// ── Which event `!join` points at ───────────────────────────────────────────────────────────────

export interface JoinCandidate {
  id: number;
  startDate: string | null;
  endDate: string | null;
  forceEndedAt: string | null;
  signupDeadline: string | null;
}

function stamp(s: string | null): number | null {
  if (!s) return null;
  const t = Date.parse(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);
  return Number.isFinite(t) ? t : null;
}

/**
 * The one event `!join` should send people to, or null.
 *
 * Not finished (no force-end, end not passed) and sign-ups not closed. Of those, the one running now
 * wins over one still to come (the stream is about what is live); among running ones the latest
 * start, among upcoming ones the soonest; an undated one counts as upcoming and comes last. Callers
 * pass only events a signed-out stranger may already see.
 */
export function pickJoinEvent<T extends JoinCandidate>(rows: T[], now: number): T | null {
  const open = rows.filter((e) => {
    if (e.forceEndedAt) return false;
    const end = stamp(e.endDate);
    if (end != null && end <= now) return false;
    const deadline = stamp(e.signupDeadline);
    return !(deadline != null && deadline <= now);
  });
  const rank = (e: T): [number, number, number] => {
    const start = stamp(e.startDate);
    if (start != null && start <= now) return [0, -start, -e.id];
    if (start != null) return [1, start, -e.id];
    return [2, 0, -e.id];
  };
  const sorted = [...open].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    return ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2];
  });
  return sorted[0] ?? null;
}

// ── Reading EventSub ────────────────────────────────────────────────────────────────────────────

/** A `!join` to answer: in which channel, and which message to reply to. */
export interface JoinTrigger {
  broadcasterId: string;
  messageId: string;
}

/**
 * Does this EventSub WebSocket frame ask for `!join`? Null for everything else — keepalives, other
 * subscription types, the bot's own lines (it must never answer itself), and anything malformed.
 */
export function joinTriggerOf(frame: unknown, botUserId: string): JoinTrigger | null {
  if (!frame || typeof frame !== 'object') return null;
  const f = frame as { metadata?: { message_type?: unknown }; payload?: { subscription?: { type?: unknown }; event?: Record<string, unknown> } };
  if (f.metadata?.message_type !== 'notification') return null;
  if (f.payload?.subscription?.type !== 'channel.chat.message') return null;
  const e = f.payload.event;
  if (!e) return null;
  const broadcasterId = e.broadcaster_user_id;
  const chatter = e.chatter_user_id;
  const messageId = e.message_id;
  const text = (e.message as { text?: unknown } | undefined)?.text;
  if (!isTwitchUserId(broadcasterId) || typeof messageId !== 'string' || !messageId || messageId.length > 64) return null;
  if (chatter === botUserId) return null;
  return parseChatCommand(text) ? { broadcasterId, messageId } : null;
}

// ── The site's internal answers ─────────────────────────────────────────────────────────────────

/** GET /api/internal/twitch-bot?op=channels */
export interface BotChannelsAnswer {
  channels: { broadcasterId: string }[];
}

/** GET /api/internal/twitch-bot?op=join&broadcaster=<id> — null reply = say nothing. */
export interface BotJoinAnswer {
  reply: string | null;
}

/** Twitch user ids are decimal strings. Anything else is refused before it reaches a query. */
export function isTwitchUserId(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9]{1,20}$/.test(v);
}
