// The event chat's rules, pure (tests/event-chat.test.ts): what a message may say, how fast a person
// and a whole board may talk, and when slow mode switches itself on. lib/eventChat applies them.
//
// The chat is private to a board's participants, so this is house-keeping, not public moderation:
// keep a thousand-player board readable, keep links and gold sellers out, and let the host's staff
// step in.

import type { SupporterTierId } from './supporterTiers.ts';

export const MAX_BODY = 200;

/** Least time between one person's messages, normally. */
export const PERSON_GAP_MS = 1_500;
/** Slow mode's gap per person. */
export const SLOW_GAP_MS = 10_000;
/** A board saying more than this in WINDOW_MS turns slow mode on by itself. */
export const BUSY_PER_WINDOW = 80;
export const WINDOW_MS = 10_000;
/** How long self-set slow mode stays on after the rush. */
export const SLOW_HOLD_MS = 60_000;

/** Days after an event ends that its chat is kept, for a late report. */
export const KEEP_DAYS = 7;

const CONTROL = new RegExp("[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u206f\\ufeff]", "g");
const LINK = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]{2,}\.(?:com|net|org|gg|io|co|me|xyz|ru|cc|tv|ly|to|app|site|shop|store)\b/i;
// The phrases a gold seller's line is made of. Deliberately narrow: "selling" alone is a normal word
// on a board full of drops.
const GOLD_SELLER = /\b(?:cheap|fast|safe)\s+(?:gp|gold|osrs\s*gold)\b|\b(?:buy|sell)\w*\s+(?:osrs\s+)?gold\b|\b\d+\s*(?:\$|usd)\s*(?:\/|per)\s*m\b|\brs(?:gold|2gp)\b/i;

// Game and Swing markup (<col=ff0000>, <img=1>, <html>…): text that a renderer could take for a tag
// is dropped, never shown as formatting. The plugin escapes what it draws too; this is the other side.
const TAG = /<\/?[a-z][^<>]*>/gi;
// Stacked combining marks ("zalgo") after the first two on a letter.
const ZALGO = /(\p{M}{2})\p{M}+/gu;
// One character repeated past six ("aaaaaaaaaa", "!!!!!!!!!!!!") — kept, but only six of it.
const RUNS = /(.)\1{6,}/gu;

export type BodyCheck = { ok: true; body: string } | { ok: false; reason: string };

/**
 * Text as it may be stored and shown. Order matters, each step on what the one before left: fold
 * full-width and styled letters to plain ones; drop invisible and control characters; drop tags until
 * none are left (a tag hidden inside another reappears when the inner one goes); only then cap stacked
 * marks, so nothing removed later can split a stack the cap already counted.
 */
export function clean(raw: string, opts: { keepRuns?: boolean } = {}): string {
  let text = String(raw ?? '').normalize('NFKC').replace(CONTROL, '');
  for (let prev = ''; prev !== text; ) {
    prev = text;
    text = text.replace(TAG, '');
  }
  return text
    .normalize('NFD')
    .replace(ZALGO, '$1')
    .normalize('NFC')
    .replace(RUNS, opts.keepRuns ? '$&' : '$1$1$1$1$1$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A sender's name as shown beside their line (a participant name, or staff's Discord name). */
export function cleanName(raw: string | null | undefined): string {
  return clean(raw ?? '').slice(0, 32) || 'Player';
}

/** Clean a message and say whether it may be sent. Staff may post links. A relayed game line keeps
 *  its repeated letters: the game already let it through as typed. */
export function checkBody(raw: string, opts: { staff: boolean; keepRuns?: boolean }): BodyCheck {
  const body = clean(raw, { keepRuns: opts.keepRuns });
  if (!body) return { ok: false, reason: 'Type something first.' };
  if (body.length > MAX_BODY) return { ok: false, reason: `Keep it under ${MAX_BODY} characters.` };
  if (GOLD_SELLER.test(body)) return { ok: false, reason: 'That looks like a gold advert.' };
  if (!opts.staff && LINK.test(body)) return { ok: false, reason: 'Links are for the host and mods.' };
  return { ok: true, body };
}

/** One board's recent sends, newest last, and when it last went slow by itself. */
export interface BoardPace {
  sends: number[];
  slowUntil: number;
}

export function newPace(): BoardPace {
  return { sends: [], slowUntil: 0 };
}

/** Whether the board is in slow mode right now (set by the host, or by itself after a rush). */
export function isSlow(pace: BoardPace, now: number, hostSlow = false): boolean {
  return hostSlow || pace.slowUntil > now;
}

/**
 * Record a send on the board and switch slow mode on when it's a rush. Mutates and returns `pace`.
 * The window is trimmed here, so a quiet board holds nothing.
 */
export function recordSend(pace: BoardPace, now: number): BoardPace {
  pace.sends.push(now);
  while (pace.sends.length && pace.sends[0] <= now - WINDOW_MS) pace.sends.shift();
  if (pace.sends.length > BUSY_PER_WINDOW) pace.slowUntil = now + SLOW_HOLD_MS;
  return pace;
}

/**
 * Each person's own pace, by their Anvil Supporter tier: a player without one waits 5s between
 * messages, a Supporter 3s, a Champion 1s, a Patron not at all. Enforced on the server (sendChat), and
 * shown under the message box (chatPaceHint) so nobody is surprised by it.
 */
export const TIER_GAP_MS: Record<SupporterTierId | 'none', number> = { none: 5_000, supporter: 3_000, champion: 1_000, patron: 0 };

export function personGapMs(tier: SupporterTierId | null | undefined): number {
  return TIER_GAP_MS[tier ?? 'none'] ?? TIER_GAP_MS.none;
}

/**
 * How long this person must still wait, 0 when they may send. Staff never wait. `gapMs` is their own
 * pace (personGapMs); a board in slow mode makes everyone wait at least SLOW_GAP_MS, Patrons too.
 */
export function waitFor(lastSentAt: number | undefined, now: number, slow: boolean, staff: boolean, gapMs: number = PERSON_GAP_MS): number {
  if (staff || lastSentAt == null) return 0;
  const gap = slow ? Math.max(SLOW_GAP_MS, gapMs) : gapMs;
  return Math.max(0, lastSentAt + gap - now);
}

/**
 * Who a chat "staff" is, for the words under the message box: the event's own staff (the host
 * clan's moderators and up) or Anvil's platform staff who hold no job in that clan.
 */
export type ChatStaffKind = 'event' | 'platform';

/**
 * The line under the message box: the viewer's own wait, or the board's slow mode when it's on.
 * `staff`: false for a player; `true` / 'event' for the host clan's moderators and up; 'platform' for
 * Anvil staff who aren't staff of the host clan.
 */
export function chatPaceHint(opts: { tier: SupporterTierId | null | undefined; slow: boolean; staff: boolean | ChatStaffKind }): string {
  if (opts.staff === 'platform') return 'no slow mode (Anvil staff)';
  if (opts.staff && opts.tier) return 'no slow mode (staff Supporter)';
  if (opts.slow) return `slow mode ${Math.round(Math.max(SLOW_GAP_MS, personGapMs(opts.tier)) / 1000)}s (busy chat)`;
  const gap = personGapMs(opts.tier);
  if (gap === 0) return 'no slow mode (Patron)';
  const s = `slow mode ${Math.round(gap / 1000)}s`;
  return opts.tier ? s : `${s} · Supporters chat faster`;
}

/**
 * Who skips slow mode and the flood guard: Anvil's platform staff, and event staff who are
 * Supporters. Event staff without a tier wait like everyone else (the owner's call).
 */
export function paceExempt(staff: ChatStaffKind | null | undefined, tier: SupporterTierId | null | undefined): boolean {
  return staff === 'platform' || (staff === 'event' && !!tier);
}

/** Most messages one person may send in BURST_WINDOW_MS, whatever their tier: a flood guard. */
export const BURST_MAX = 10;
export const BURST_WINDOW_MS = 10_000;

/** A mute still in force. `until` null = the rest of the event. */
export function muteActive(until: string | null | undefined, now: number, parse: (s: string) => number | null): boolean {
  if (until == null) return true;
  const t = parse(until);
  return t == null || t > now;
}

// ── Timeouts and bans ────────────────────────────────────────────────────────────────────────────
//
// One model for the plugin's right-click "Ban" and the site's moderation page (lib/eventChat
// sanctionChat): one event_chat_mutes row per person per board, a 'timeout' with an expiry or a 'ban'
// until lifted.
//
// WHO MAY SANCTION WHOM. Staff are exempt from slow mode and the flood guard, but NOT from bans:
// a sanction binds whoever it is on, staff included. What protects staff is who may impose it: only
// someone who strictly outranks them in this event's chat (chatRank). So a moderator can time out a
// player but not another moderator; an admin can time out a moderator; the clan owner can sanction
// its admins; Anvil platform staff outrank everyone in the clan. Peers can't sanction each other and
// nobody can sanction (or un-sanction) themselves. Lifting follows the same rule as imposing.

export type ChatSanctionKind = 'timeout' | 'ban';

export interface ChatSanction {
  kind: string;
  /** A timeout's expiry, as stored; null for a ban. */
  until: string | null;
}

export type ChatBlock = { kind: 'ban' } | { kind: 'timeout'; msLeft: number };

/**
 * Does this sanction stop the person talking right now? A timeout whose expiry has passed no longer
 * blocks (the row may linger until lifted or swept; it means nothing). A ban blocks until lifted. An
 * unreadable expiry, or a "timeout" with none, is treated as a ban: when in doubt, keep them out.
 */
export function sanctionBlock(s: ChatSanction | null | undefined, now: number, parse: (v: string) => number | null): ChatBlock | null {
  if (!s) return null;
  if (s.kind !== 'timeout' || s.until == null) return { kind: 'ban' };
  const t = parse(s.until);
  if (t == null) return { kind: 'ban' };
  return t > now ? { kind: 'timeout', msLeft: t - now } : null;
}

/** "12 minutes", "3 hours", "2 days": the time left on a timeout, rounded up. */
export function timeLeftText(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  const plural = (n: number, unit: string) => `${n} more ${unit}${n === 1 ? '' : 's'}`;
  if (min < 60) return plural(min, 'minute');
  const hours = Math.ceil(min / 60);
  if (hours < 48) return plural(hours, 'hour');
  return plural(Math.ceil(hours / 24), 'day');
}

/** What a blocked person is told, by sendChat and in place of the plugin's message box. */
export function sanctionMessage(b: ChatBlock): string {
  if (b.kind === 'ban') return 'You’ve been removed from this event’s chat.';
  return `You’re timed out of this event’s chat for ${timeLeftText(b.msLeft)}.`;
}

/** The moderation page's quick timeouts. */
export const TIMEOUT_PRESETS_MIN = { '5m': 5, '1h': 60, '24h': 1_440 } as const;
/** The longest custom timeout: past this, it's a ban. */
export const MAX_TIMEOUT_MIN = 30 * 1_440;

/** A timeout's length in minutes, from a preset or a custom number; null when it isn't one. */
export function timeoutMinutes(raw: unknown): number | null {
  if (typeof raw === 'string' && raw in TIMEOUT_PRESETS_MIN) return TIMEOUT_PRESETS_MIN[raw as keyof typeof TIMEOUT_PRESETS_MIN];
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return null;
  const m = Math.round(n);
  return m >= 1 && m <= MAX_TIMEOUT_MIN ? m : null;
}

/** A moderator's reason, as stored: cleaned like a chat line, capped. */
export const MAX_REASON = 200;
export function cleanReason(raw: unknown): string | null {
  const r = clean(typeof raw === 'string' ? raw : '').slice(0, MAX_REASON);
  return r || null;
}

/**
 * Standing in one event's chat: 0 a player, then the host clan's rank (moderator and treasurer 1,
 * admin 2, owner 3, from lib/clanRoles rankOf), and Anvil platform staff above all of them (4).
 */
export const PLATFORM_CHAT_RANK = 4;
export function chatRank(clanRank: number, platformStaff: boolean): number {
  return Math.max(clanRank >= 1 ? clanRank : 0, platformStaff ? PLATFORM_CHAT_RANK : 0);
}

/** May someone at `actorRank` time out, ban or lift someone at `targetRank`? Staff only, strictly above. */
export function canSanction(actorRank: number, targetRank: number): boolean {
  return actorRank >= 1 && actorRank > targetRank;
}

// ── Channels ─────────────────────────────────────────────────────────────────────────────────────
//
// A board's chat has three kinds of channel, one per line (event_chat_messages.channel):
//   'all'        everyone on the board (and its staff) reads and talks
//   'team:<id>'  one team's own channel: its players, plus the host's staff and Anvil staff
//   'announce'   the host's staff post, everyone reads
// Timeouts and bans close every channel; a pause closes 'all' and the teams' (staff still talk).

export type ChatChannel = 'all' | 'announce' | `team:${number}`;

/** A channel as stored or asked for; null when it isn't one. */
export function parseChannel(raw: unknown): ChatChannel | null {
  if (raw === 'all' || raw === 'announce') return raw;
  const m = typeof raw === 'string' ? /^team:([1-9]\d{0,9})$/.exec(raw) : null;
  return m ? `team:${Number(m[1])}` : null;
}

export function channelTeam(ch: ChatChannel): number | null {
  return ch.startsWith('team:') ? Number(ch.slice(5)) : null;
}

/** Who's asking, as far as the channel rules care (lib/eventChat ChatAccess carries these). */
export interface ChannelViewer {
  member: boolean;
  /** The host's staff (moderator and up) or Anvil staff. */
  staff: boolean;
  /** Standing in the chat (chatRank): 1 and up is staff. */
  rank: number;
  teamId: number | null;
  /**
   * Event staff who play on a team and chose "Only my team's chat": other teams' channels are closed
   * to them as to any player. Their staff powers elsewhere (announcements, pause, moderation) stay.
   */
  ownTeamOnly?: boolean;
}

/** Reading: 'all' and 'announce' for anyone on the board; a team's channel for that team and staff. */
export function canReadChannel(v: ChannelViewer, ch: ChatChannel): boolean {
  if (!v.member) return false;
  const team = channelTeam(ch);
  return team == null || (v.staff && !v.ownTeamOnly) || v.teamId === team;
}

/**
 * Who is offered "Only my team's chat": the event's own staff (the host clan's moderators and up)
 * who also hold a seat on one of its teams. Anvil staff with no job there, and staff without a team,
 * have no team of their own to narrow to.
 */
export function canChooseOwnTeamChat(v: { staffKind: ChatStaffKind | null; teamId: number | null; solo?: boolean }): boolean {
  return v.staffKind === 'event' && v.teamId != null && !v.solo;
}

/** The switch's words: what pressing it does. */
export function ownTeamChatLabel(on: boolean): { label: string; tip: string } {
  return on
    ? { label: 'See every team’s chat', tip: 'Read and answer in every team’s chat again' }
    : { label: 'Only my team’s chat', tip: 'Hide other teams’ chats while you play' };
}

/** Posting: announcements need staff rank; a team's channel its own players (staff may answer there). */
export function canPostChannel(v: ChannelViewer, ch: ChatChannel): boolean {
  if (ch === 'announce') return v.member && v.rank >= 1;
  return canReadChannel(v, ch);
}

/** Does the host's pause close this channel for this person? Never staff; never announcements. */
export function pausedFor(ch: ChatChannel, paused: boolean, staff: boolean): boolean {
  return paused && !staff && ch !== 'announce';
}

/** The read-only line in place of the box on Announcements, for everyone below staff. */
export const ANNOUNCE_READ_ONLY = 'Only the host and mods post here';
export const ANNOUNCE_READ_ONLY_SUB = 'Reply in My team or All teams.';

/** What stands in place of the plugin's message box: a line, an optional second one, coral when it's theirs. */
export interface ChatLock {
  locked: string;
  sub?: string;
  /** Their own timeout or ban (coral), not the board's pause or a read-only channel (grey). */
  warn?: boolean;
}

/** "9m", "3h", "2d": a timeout's time left, rounded up, for the box. */
export function shortLeft(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  if (min < 60) return `${min}m`;
  const hours = Math.ceil(min / 60);
  return hours < 48 ? `${hours}h` : `${Math.ceil(hours / 24)}d`;
}

export function sanctionLock(b: ChatBlock): ChatLock {
  return b.kind === 'ban'
    ? { locked: 'You’ve been removed from this event’s chat', sub: 'You can still read along.', warn: true }
    : { locked: `You’re timed out · ${shortLeft(b.msLeft)} left`, sub: 'You can still read along.', warn: true };
}

/** The box's lock for one person on one channel: their sanction first, then a read-only channel, then the pause. */
export function lockFor(ch: ChatChannel, o: { block: ChatBlock | null; paused: boolean; staff: boolean; rank: number }): ChatLock | null {
  if (o.block) return sanctionLock(o.block);
  if (ch === 'announce' && o.rank < 1) return { locked: ANNOUNCE_READ_ONLY, sub: ANNOUNCE_READ_ONLY_SUB };
  if (pausedFor(ch, o.paused, o.staff)) return { locked: 'The host has paused chat.' };
  return null;
}

// ── The game chatbox ─────────────────────────────────────────────────────────────────────────────
//
// The plugin also prints each event chat line in the game chatbox, as "[<tag> · Team] Name: text"
// ("[Team] Name: text" for a player on one live board). Built whole here so the plugin only prints
// what it is handed (it is near the hub's size cap): the tag, the channel's word and the colours.

/** Longest chat tag: room in the chatbox for the line itself. */
export const CHAT_TAG_MAX = 12;

/** A host's chat tag as it may be stored: cleaned, at most CHAT_TAG_MAX, or null (derive it). */
export function cleanChatTag(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = clean(raw).replace(/[[\]·|]/g, '').trim().slice(0, CHAT_TAG_MAX).trim();
  return t || null;
}

/**
 * A board's tag from its name: a leading "The" and the clan's own name dropped, then as many whole
 * words as fit in CHAT_TAG_MAX ("The AFK Spot Winter Bingo" by "The AFK Spot" → "Winter Bingo"); when
 * not even the first word fits, the words' initials ("Grandmasterclass Throwdown" → "GT").
 */
export function deriveChatTag(eventName: string, clanName?: string | null): string {
  const strip = (s: string) => s.replace(/^the\s+/i, '').trim();
  let name = clean(eventName).replace(/[[\]·|]/g, ' ').replace(/\s+/g, ' ').trim();
  const clan = clanName ? strip(clean(clanName)) : '';
  name = strip(name);
  if (clan && name.toLowerCase().startsWith(clan.toLowerCase()) && name.length > clan.length) {
    name = strip(name.slice(clan.length).replace(/^(?:['’]s?)?[\s\-–—:|]+/, ' ').trim());
  }
  const words = name.split(' ').filter(Boolean);
  let out = '';
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > CHAT_TAG_MAX) break;
    out = next;
  }
  if (!out) out = words.map((w) => w[0]).join('').slice(0, CHAT_TAG_MAX).toUpperCase();
  return out || 'Event';
}

/** The tag a board's lines wear: the host's own, else derived. */
export function chatTagOf(stored: string | null | undefined, eventName: string, clanName?: string | null): string {
  return cleanChatTag(stored) ?? deriveChatTag(eventName, clanName);
}

/** The channel's word in the chatbox. */
export function chatboxChannelLabel(channel: string): string {
  return channel === 'announce' ? 'Announcements' : channel === 'all' ? 'All' : 'Team';
}

/** Text as the game draws it: '<' and '>' would open a chat tag, so they go as the game's escapes. */
export function gameText(s: string): string {
  return s.replace(/[<>]/g, (c) => (c === '<' ? '<lt>' : '<gt>'));
}

/** Colours of the prefix, by channel; Announcements is gold, line and all. */
const CHATBOX_COLOR: Record<string, string> = { team: '57c785', all: '7fc8ff', announce: 'ffb54d' };

/**
 * One event chat line for the chatbox, both ways: `cb` with the board's tag, `cb1` without it (the
 * plugin prints `cb1` when the player is on one live board only).
 */
export function chatboxLines(tag: string, channel: string, who: string, body: string): { cb: string; cb1: string } {
  const kind = channel === 'announce' ? 'announce' : channel === 'all' ? 'all' : 'team';
  const col = CHATBOX_COLOR[kind];
  const label = chatboxChannelLabel(channel);
  // First letter capitalised, as the game does its own chat lines.
  const text = gameText(body.charAt(0).toUpperCase() + body.slice(1));
  const rest = ` ${gameText(who)}: ${kind === 'announce' ? `<col=${col}>${text}</col>` : text}`;
  return { cb: `<col=${col}>[${gameText(tag)} · ${label}]</col>${rest}`, cb1: `<col=${col}>[${label}]</col>${rest}` };
}
