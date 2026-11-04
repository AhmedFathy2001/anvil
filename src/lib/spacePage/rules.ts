// A space page's promotional content (creator branding, panels, schedule, featured), the pure half:
// limits, cleaning, the link and wording policy, linkify, clip links and the schedule's time maths.
// No database and no React, so the tests and client components can import it.
//
// THE BRAND GUARDRAIL. Anvil is never to be associated with anything Jagex's rules forbid promoting:
// real-world trading (gold, items, accounts), paid account services, bots and unapproved clients,
// private servers, gambling, and fake "free membership" giveaways. So, on the SERVER:
//   - every link is https, to a real host name (no IPs, ports or credentials), and not on the
//     blocklist (promo_blocked_domains: the domain and all of its subdomains; shorteners and link hubs
//     are on it so it cannot be routed around), nor a host name that spells out the trade itself;
//   - every title, body, bio and label is checked for the obvious phrases, and refused in plain words;
//   - images are only ever our own uploads (the route writes the URL; nothing typed is rendered);
//   - text is stored and rendered as text. Only https URLs that pass the same policy at RENDER time
//     (the blocklist may have grown since) become links.

import type { MediaLimits } from '../profileMediaRules.ts';
import { addLocalDays, dayKeyFields, isValidTimeZone, localDayKey, zonedTimeToUtcMs } from '../zonedTime.ts';

export const PANELS_MAX = 8;
export const PANEL_TITLE_MAX = 40;
export const PANEL_BODY_MAX = 600;
export const BIO_MAX = 500;
export const SLOT_LABEL_MAX = 40;
export const SLOTS_MAX = 14;
export const LINK_MAX = 500;
export const FEATURED_TITLE_MAX = 80;

/** Shown in the editor, and the first sentence of every refusal. */
export const POLICY_NOTE = "Promotions must follow Jagex's rules — no gold/account selling, gambling, bots or private servers.";

// ── Images ───────────────────────────────────────────────────────────────────────────────────────

export type SpaceMediaKind = 'logo' | 'banner' | 'panel';

/**
 * The upload checks (lib/profileMediaProcess: magic bytes, size, dimensions and frame budget from the
 * header, then a decode and re-encode to WebP with the metadata gone). The logo and banner may move,
 * as a clan's may; a panel image is always a still (its first frame).
 */
export const SPACE_MEDIA_LIMITS: Record<SpaceMediaKind, MediaLimits> = {
  logo: {
    maxBytes: 4 * 1024 * 1024,
    minWidth: 64,
    minHeight: 64,
    maxSide: 2048,
    maxFrames: 300,
    maxTotalPixels: 60_000_000,
    out: { width: 512, height: 512, fit: 'cover' },
  },
  banner: {
    maxBytes: 6 * 1024 * 1024,
    minWidth: 600,
    minHeight: 150,
    maxSide: 4096,
    maxFrames: 300,
    maxTotalPixels: 160_000_000,
    out: { width: 1500, height: 750, fit: 'inside' },
  },
  panel: {
    maxBytes: 3 * 1024 * 1024,
    minWidth: 120,
    minHeight: 60,
    maxSide: 4096,
    maxFrames: 300,
    maxTotalPixels: 160_000_000,
    out: { width: 640, height: 640, fit: 'inside' },
  },
};

export const SPACE_MEDIA_ANIMATED: Record<SpaceMediaKind, boolean> = { logo: true, banner: true, panel: false };

/**
 * Is this one of this space's own page images: our media host, under the space's own prefix
 * (`c/<slug>/space/<uuid>.webp`)? Anything else is never rendered — a row that somehow holds another
 * server's URL shows no picture rather than pointing every visitor's browser at it.
 */
export function isSpaceMediaUrl(raw: string | null | undefined, slug: string, publicBase = process.env.S3_PUBLIC_BASE_URL ?? ''): raw is string {
  if (!raw) return false;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1'))) return false;
  if (u.search || u.hash || u.username || u.password) return false;
  let hostOk = u.hostname.endsWith('.blob.vercel-storage.com');
  const base = publicBase.trim().replace(/\/+$/, '');
  if (!hostOk && base) {
    try {
      const b = new URL(base);
      hostOk = u.host === b.host && u.protocol === b.protocol && u.pathname.startsWith(`${b.pathname.replace(/\/+$/, '')}/`);
    } catch {
      hostOk = false;
    }
  }
  if (!hostOk) return false;
  const esc = slug.replace(/[^a-z0-9-]/g, '');
  return new RegExp(`/c/${esc}/space/[0-9a-f-]{36}(-[A-Za-z0-9]+)?\\.webp$`).test(u.pathname);
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

// ── Text ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Plain text as stored: no control characters (line breaks kept when `multiline`), no zero-width or
 * direction-override characters (they hide words from the checks and flip text on the page), at most
 * two blank lines in a row, trimmed. Too long is refused, not cut: a cut sentence says something else.
 */
export function cleanText(raw: unknown, max: number, opts: { multiline?: boolean; field?: string } = {}): Checked<string> {
  if (raw != null && typeof raw !== 'string') return { ok: false, error: `${opts.field ?? 'That'} must be text.` };
  let s = String(raw ?? '').replace(/\r\n?/g, '\n');
  // Zero-width, BOM, bidi controls and the like.
  s = s.replace(/[​-‏‪-‮⁠-⁩﻿­]/g, '');
  s = opts.multiline
    ? s.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
    : s.replace(/[\u0000-\u001F\u007F]+/g, ' ');
  s = s.trim();
  if (s.length > max) return { ok: false, error: `${opts.field ?? 'That'} is too long — at most ${max} characters.` };
  return { ok: true, value: s };
}

// ── Wording ──────────────────────────────────────────────────────────────────────────────────────

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };

/** Lowercased words separated by single spaces; light leet undone; "r.s.p.s" / "r s p s" joined. */
export function normalizeForCheck(text: string): string {
  let s = text.toLowerCase().replace(/[​-‏‪-‮⁠-⁩﻿­]/g, '');
  // Leet only BETWEEN letters ("g0ld", "b0tting", "r5ps"), plus @ and $ inside a word ("$take"), so
  // "07", "rs3" and "55x2" survive as themselves.
  s = s.replace(/(?<=[a-z])[013457](?=[a-z])/g, (c) => LEET[c] ?? c);
  s = s.replace(/[@$](?=[a-z0-9])|(?<=[a-z0-9])[@$]/g, (c) => LEET[c] ?? c);
  s = s.replace(/[^a-z0-9]+/g, ' ').trim();
  // Spelled-out letters: "r s p s" → "rsps".
  s = s.replace(/\b(?:[a-z0-9] ){2,}[a-z0-9]\b/g, (m) => m.replace(/ /g, ''));
  return ` ${s} `;
}

const OSRS = '(?:osrs |rs |rs3 |07 |runescape |old school )?';

/**
 * The obvious phrases, by what they promote. Phrases, not single words, wherever a word alone is
 * innocent: "bot" is the Anvil bot and every Discord bot, so it is "botting", "bot client", "bots for
 * sale"; "stakes" is "high stakes", so it is "stake"/"staking".
 */
const PHRASES: { re: RegExp; what: string }[] = [
  // Real-world trading.
  { what: 'rwt', re: /\b(?:rwt|real world trad(?:e|es|ing|er|ers))\b/ },
  { what: 'gold selling', re: new RegExp(`\\b(?:buy|buying|sell|selling|sells|cheap|cheapest|fast) ${OSRS}(?:gold|gp|coins|items)\\b`) },
  { what: 'gold selling', re: /\b(?:gold|gp|coins) (?:for sale|shop|store|seller|sellers|for cash|for money|for paypal|for crypto|for usd)\b/ },
  { what: 'gold selling', re: /\b(?:osrs|rs|rs3|07) (?:gold|gp) (?:shop|store|seller|sellers|site)\b/ },
  { what: 'account selling', re: /\baccounts? (?:for sale|shop|store|seller|sellers|market)\b/ },
  {
    what: 'account selling',
    re: new RegExp(`\\b(?:buy|buying|sell|selling|sells) ${OSRS}(?:maxed |max |main |pure |ironman |zerker |pking |pker )?accounts?\\b`),
  },
  { what: 'account selling', re: /\b(?:maxed|max|main|pure) accounts? (?:sale|for sale|for cash)\b/ },
  // Paid account services.
  { what: 'paid services', re: /\bboosting (?:service|services|for cash|for gp)\b/ },
  {
    what: 'paid services',
    re: /\b(?:infernal cape|infernal|inferno|fire cape|firecape|quest cape|questing|quest|max cape|powerleveling|power leveling|power levelling|powerlevelling|leveling|levelling|skilling|raids|cox|tob|toa) (?:service|services)\b/,
  },
  { what: 'paid services', re: /\b(?:pk|pking|pker) for hire\b/ },
  { what: 'account sharing', re: /\baccount sharing\b|\bshare (?:my|your) (?:account|login|password)\b/ },
  // Bots, macros, cheat and unapproved clients.
  { what: 'bots', re: /\bbott(?:ing|ed|er|ers)\b/ },
  { what: 'bots', re: /\b(?:osrs|rs|rs3|runescape) bots?\b/ },
  { what: 'bots', re: /\bbots? (?:for sale|client|clients|farm|farms|farming|script|scripts)\b/ },
  { what: 'macros', re: /\bmacro(?:s|ing|er|ers)?\b/ },
  { what: 'cheat clients', re: /\b(?:script|scripting|cheat|injection|hack|hacked) clients?\b|\bauto ?clickers?\b/ },
  // Private servers.
  { what: 'private servers', re: /\b(?:rsps|pserver|pservers|private servers?)\b/ },
  // Gambling.
  { what: 'gambling', re: /\b(?:stake|staking|staker|stakers)\b/ },
  { what: 'gambling', re: /\b(?:dice|dicing|dicer|dicers|55x2)\b/ },
  { what: 'gambling', re: /\bflower ?poker\b/ },
  { what: 'gambling', re: /\b(?:casino|casinos|gamble|gambling|gambler|gamblers|lottery|lotteries|sportsbook|betting site)\b/ },
  // Fake giveaways that want a login.
  { what: 'fake giveaways', re: /\bfree (?:osrs |rs )?(?:membership|members|bonds?|gp|gold)\b/ },
  { what: 'fake giveaways', re: /\b(?:log ?in|sign ?in|enter your (?:login|password)) to (?:claim|get|receive|win)\b/ },
];

/** The first phrase of what Jagex forbids promoting found in the text, or null. */
export function forbiddenPhrase(text: string): string | null {
  const s = normalizeForCheck(text);
  for (const p of PHRASES) {
    const m = p.re.exec(s);
    if (m) return m[0].trim();
  }
  return null;
}

/** Null when the text may go up; else the plain refusal. */
export function wordingError(text: string): string | null {
  const hit = forbiddenPhrase(text);
  return hit ? `${POLICY_NOTE} Please take out “${hit}”.` : null;
}

// ── Links ────────────────────────────────────────────────────────────────────────────────────────

/** Lowercase, no trailing dot, no leading "www.". */
export function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/\.+$/, '').replace(/^www\./, '');
}

/** A domain as staff type it: "https://www.Stake.com/x" → "stake.com". Null when it is not one. */
export function normalizeDomain(raw: string): string | null {
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  if (!/^[a-z]+:\/\//.test(s)) s = `https://${s}`;
  let host: string;
  try {
    host = new URL(s).hostname;
  } catch {
    return null;
  }
  host = normalizeHost(host);
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(host)) return null;
  return host;
}

/** The blocked domain this host is, or is under; null when none. */
export function blockedBy(host: string, blocked: Iterable<string>): string | null {
  const h = normalizeHost(host);
  for (const d of blocked) {
    if (h === d || h.endsWith(`.${d}`)) return d;
  }
  return null;
}

/**
 * A host name that spells out the trade: "osrs-gold-shop.net", "buyrsgold.com", "best-rsps.org",
 * "rs3gold.com", "osrsdice.gg". Matched at the start of a label or after a hyphen, so "hoursgold" is
 * not "rs gold".
 */
const SUSPICIOUS_HOST =
  /(?:^|[.-])(?:buy|cheap|sell|get|best|fast)?-?(?:rs3?|osrs|runescape|oldschool|07)-?(?:gold|gp|coins|accounts?|accs?|bots?|botting|boost|boosting|dice|dicing|gambl\w*|stak\w*|casino|market)|(?:^|[.-])(?:gold|gp)-?(?:osrs|rs3?|runescape)|rsps|(?:^|[.-])rwt|flower-?poker|(?:^|[.-])dicing/;

export function suspiciousDomain(host: string): boolean {
  const h = normalizeHost(host);
  // The last label is the TLD; it says nothing.
  const name = h.split('.').slice(0, -1).join('.');
  return SUSPICIOUS_HOST.test(name);
}

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/**
 * May a space page link here? https only, a real host name (no IP, port, credentials, localhost or
 * single-label host), not blocked and not a trade-spelling host name. Returns the URL as the browser
 * would follow it.
 */
export function checkLink(raw: unknown, blocked: Iterable<string>): Checked<string> {
  if (typeof raw !== 'string' || !raw.trim()) return { ok: false, error: 'Add a link.' };
  const s = raw.trim();
  if (s.length > LINK_MAX) return { ok: false, error: 'That link is too long.' };
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return { ok: false, error: 'That is not a link. Start it with https://' };
  }
  if (u.protocol !== 'https:') return { ok: false, error: 'Links must start with https://' };
  if (u.username || u.password || u.port) return { ok: false, error: 'That link is not allowed.' };
  const host = normalizeHost(u.hostname);
  if (!host.includes('.') || host === 'localhost' || host.endsWith('.localhost') || IPV4.test(host) || host.startsWith('[')) {
    return { ok: false, error: 'Links must go to a website by its name.' };
  }
  const by = blockedBy(host, blocked);
  if (by) return { ok: false, error: `${POLICY_NOTE} Links to ${by} aren't allowed.` };
  if (suspiciousDomain(host)) return { ok: false, error: `${POLICY_NOTE} Links to ${host} aren't allowed.` };
  return { ok: true, value: u.toString() };
}

/** URLs and bare domains in free text ("stake.com", "https://x.y/z"), trailing punctuation dropped. */
const URLISH = /\bhttps?:\/\/[^\s<>"'`]+|\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,24}(?:\/[^\s<>"'`]*)?/gi;

function trimTrailing(s: string): string {
  return s.replace(/[.,;:!?)\]}'"]+$/, '');
}

/**
 * A text's links that the policy refuses, checked by HOST — an http:// link is not made clickable,
 * but naming a blocked site in plain text still promotes it. Null when every one is fine.
 */
export function textLinkError(text: string, blocked: Iterable<string>): string | null {
  const list = [...blocked];
  for (const m of text.matchAll(URLISH)) {
    const tok = trimTrailing(m[0]);
    let host: string;
    try {
      host = new URL(/^https?:\/\//i.test(tok) ? tok : `https://${tok}`).hostname;
    } catch {
      continue;
    }
    const h = normalizeHost(host);
    const by = blockedBy(h, list);
    if (by) return `${POLICY_NOTE} Links to ${by} aren't allowed.`;
    if (suspiciousDomain(h)) return `${POLICY_NOTE} Links to ${h} aren't allowed.`;
  }
  return null;
}

/** Wording and links together: what a save checks every text field against. */
export function contentError(text: string, blocked: Iterable<string>): string | null {
  return wordingError(text) ?? textLinkError(text, blocked);
}

export type TextSegment = { text: string; href?: undefined } | { text: string; href: string };

/**
 * Plain text cut into text and link segments, for rendering as React text nodes and <a> elements —
 * never as HTML. Only full https:// URLs that pass checkLink become links; everything else stays text.
 */
export function linkify(text: string, blocked: Iterable<string>): TextSegment[] {
  const list = [...blocked];
  const out: TextSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(/\bhttps:\/\/[^\s<>"'`]+/gi)) {
    const tok = trimTrailing(m[0]);
    const start = m.index ?? 0;
    const checked = checkLink(tok, list);
    if (!checked.ok) continue;
    if (start > last) out.push({ text: text.slice(last, start) });
    out.push({ text: tok, href: checked.value });
    last = start + tok.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

// ── Featured clip links ──────────────────────────────────────────────────────────────────────────

export type ClipPlatform = 'twitch' | 'youtube' | 'kick' | 'medal';

const CLIP_HOSTS: Record<string, ClipPlatform> = {
  'clips.twitch.tv': 'twitch',
  'twitch.tv': 'twitch',
  'm.twitch.tv': 'twitch',
  'youtube.com': 'youtube',
  'm.youtube.com': 'youtube',
  'youtu.be': 'youtube',
  'kick.com': 'kick',
  'medal.tv': 'medal',
};

/** A clip or video link on Twitch, YouTube, Kick or Medal — nothing else is featured. */
export function checkClipUrl(raw: unknown): Checked<{ url: string; platform: ClipPlatform }> {
  if (typeof raw !== 'string' || !raw.trim()) return { ok: false, error: 'Paste a clip link.' };
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, error: 'That is not a link.' };
  }
  if (raw.length > LINK_MAX || u.protocol !== 'https:' || u.username || u.password || u.port) {
    return { ok: false, error: 'Use an https:// clip link from Twitch, YouTube, Kick or Medal.' };
  }
  const platform = CLIP_HOSTS[normalizeHost(u.hostname)];
  if (!platform || u.pathname.length < 2) return { ok: false, error: 'Only Twitch, YouTube, Kick or Medal clip links can be featured.' };
  u.hash = '';
  return { ok: true, value: { url: u.toString(), platform } };
}

export function clipPlatformOf(url: string): ClipPlatform | null {
  try {
    return CLIP_HOSTS[normalizeHost(new URL(url).hostname)] ?? null;
  } catch {
    return null;
  }
}

// ── Schedule ─────────────────────────────────────────────────────────────────────────────────────

export interface SlotInput {
  weekday: number;
  minuteOfDay: number;
  label: string | null;
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export function checkSlot(raw: unknown): Checked<SlotInput> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const weekday = Number(r.weekday);
  const minuteOfDay = Number(r.minuteOfDay);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { ok: false, error: 'Pick a day.' };
  if (!Number.isInteger(minuteOfDay) || minuteOfDay < 0 || minuteOfDay >= 1440) return { ok: false, error: 'Pick a time.' };
  const label = cleanText(r.label, SLOT_LABEL_MAX, { field: 'A schedule label' });
  if (!label.ok) return label;
  return { ok: true, value: { weekday, minuteOfDay, label: label.value || null } };
}

export function checkTimeZone(raw: unknown): Checked<string> {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 64 || !isValidTimeZone(raw.trim())) {
    return { ok: false, error: 'Pick your time zone.' };
  }
  return { ok: true, value: raw.trim() };
}

/** How long after its start a slot still counts as "on now" for ordering. */
export const SLOT_GRACE_MS = 2 * 60 * 60_000;

/**
 * The next time a weekly slot starts, as a UTC instant, written as `weekday` + `minuteOfDay` wall time
 * in the host's zone. DST-correct: 19:00 in London is 19:00 UTC in winter and 18:00 UTC in summer. A
 * slot that started within the grace window is still "this one", so a running stream stays on top.
 */
export function nextSlotStart(slot: { weekday: number; minuteOfDay: number }, tz: string, now: number): number {
  const today = localDayKey(now, tz);
  for (let offset = -1; offset <= 8; offset++) {
    const key = addLocalDays(today, offset);
    const f = dayKeyFields(key);
    if (f.weekday !== slot.weekday) continue;
    const at = zonedTimeToUtcMs({ year: f.year, month: f.month, day: f.day, hour: Math.floor(slot.minuteOfDay / 60), minute: slot.minuteOfDay % 60 }, tz);
    if (at > now - SLOT_GRACE_MS) return at;
  }
  // Unreachable for a valid weekday; a week from now keeps callers total.
  return now + 7 * 86_400_000;
}

/** "Tue 7:00 PM" — an instant as a viewer's wall clock, in their zone (undefined = the runtime's). */
export function formatSlotTime(instantMs: number, viewerTz?: string, locale = 'en-US'): string {
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', hour: 'numeric', minute: '2-digit' };
  if (viewerTz) opts.timeZone = viewerTz;
  return new Intl.DateTimeFormat(locale, opts).format(instantMs);
}

/** "19:00" style for the editor. */
export function minuteToHhMm(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
