// The event chat's rules, pure (tests/event-chat.test.ts): what a message may say, how fast a person
// and a whole board may talk, and when slow mode switches itself on. lib/eventChat applies them.
//
// The chat is private to a board's participants, so this is house-keeping, not public moderation:
// keep a thousand-player board readable, keep links and gold sellers out, and let the host's staff
// step in.

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
export function clean(raw: string): string {
  let text = String(raw ?? '').normalize('NFKC').replace(CONTROL, '');
  for (let prev = ''; prev !== text; ) {
    prev = text;
    text = text.replace(TAG, '');
  }
  return text
    .normalize('NFD')
    .replace(ZALGO, '$1')
    .normalize('NFC')
    .replace(RUNS, '$1$1$1$1$1$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A sender's name as shown beside their line (a participant name, or staff's Discord name). */
export function cleanName(raw: string | null | undefined): string {
  return clean(raw ?? '').slice(0, 32) || 'Player';
}

/** Clean a message and say whether it may be sent. Staff may post links. */
export function checkBody(raw: string, opts: { staff: boolean }): BodyCheck {
  const body = clean(raw);
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

/** How long this person must still wait, 0 when they may send. Staff never wait. */
export function waitFor(lastSentAt: number | undefined, now: number, slow: boolean, staff: boolean): number {
  if (staff || lastSentAt == null) return 0;
  const gap = slow ? SLOW_GAP_MS : PERSON_GAP_MS;
  return Math.max(0, lastSentAt + gap - now);
}

/** A mute still in force. `until` null = the rest of the event. */
export function muteActive(until: string | null | undefined, now: number, parse: (s: string) => number | null): boolean {
  if (until == null) return true;
  const t = parse(until);
  return t == null || t > now;
}
