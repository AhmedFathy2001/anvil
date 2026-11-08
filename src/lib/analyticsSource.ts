// Where a visit came from, in words an owner can read.
//
// PURE — no `@/db` — because the browser and the collector both run it. What leaves the browser is a
// referrer HOST (never the URL, which can carry a search query or a profile) and the three standard
// campaign tags; this file turns those into one readable source and bounds every string on the way.

/** The viewport classes the page reports instead of a pixel size (a width is a fingerprinting bit). */
export type ViewportClass = 'phone' | 'tablet' | 'desktop';

export function viewportClass(width: unknown): ViewportClass {
  const w = typeof width === 'number' && Number.isFinite(width) ? width : 1280;
  return w < 640 ? 'phone' : w < 1024 ? 'tablet' : 'desktop';
}

export const isViewportClass = (v: unknown): v is ViewportClass => v === 'phone' || v === 'tablet' || v === 'desktop';

/** Time on page is kept between a blink and half an hour: a tab left open overnight is not "time". */
export const MAX_LEAVE_MS = 30 * 60_000;
export function clampLeaveMs(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return null;
  return Math.min(MAX_LEAVE_MS, Math.round(raw));
}

/** A hostname, lower-cased and bounded; null when the input is not one. */
export function cleanHost(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const h = raw.trim().toLowerCase().replace(/^www\./, '');
  return /^[a-z0-9]([a-z0-9.-]{0,60}[a-z0-9])?$/.test(h) && h.includes('.') ? h : null;
}

/** The host of a referrer URL, as the browser reports it. Null for none or garbage. */
export function referrerHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return cleanHost(new URL(url).hostname);
  } catch {
    return null;
  }
}

const SOURCE_RULES: [RegExp, string][] = [
  [/(^|\.)google\./, 'google'],
  [/(^|\.)(bing\.com|duckduckgo\.com|ecosia\.org|yahoo\.com|brave\.com|startpage\.com)$/, 'search'],
  [/(^|\.)(discord\.com|discordapp\.com|discord\.gg|discord\.media)$/, 'discord'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)(twitch\.tv)$/, 'twitch'],
  [/(^|\.)(kick\.com)$/, 'kick'],
  [/(^|\.)(reddit\.com|redd\.it)$/, 'reddit'],
  [/(^|\.)(runelite\.net)$/, 'runelite'],
  [/(^|\.)(oldschool\.runescape\.wiki|runescape\.wiki|runescape\.com)$/, 'osrs'],
  [/(^|\.)(twitter\.com|x\.com|t\.co)$/, 'x'],
  [/(^|\.)(facebook\.com|fb\.com|instagram\.com)$/, 'meta'],
  [/(^|\.)(github\.com)$/, 'github'],
];

export const SOURCE_LABELS: Record<string, string> = {
  direct: 'Direct',
  unknown: 'Unknown',
  google: 'Google',
  search: 'Other search',
  discord: 'Discord',
  youtube: 'YouTube',
  twitch: 'Twitch',
  kick: 'Kick',
  reddit: 'Reddit',
  runelite: 'RuneLite',
  osrs: 'OSRS site',
  x: 'X',
  meta: 'Facebook / Instagram',
  github: 'GitHub',
};

/** A tag like `utm_source=Newsletter 3` as a short lower-case key, or null. */
export function cleanTag(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return t || null;
}

export interface FirstTouchInput {
  /** The referring host, or null for none (typed address, bookmark, app). */
  host?: string | null;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  /** The `?ref=` tag: a creator or invite code. */
  ref?: string | null;
}

export interface FirstTouch {
  /** The readable key: `google`, `discord`, `ref:somecreator`, `utm:newsletter`, `direct`, or the bare host. */
  source: string;
  medium: string | null;
  campaign: string | null;
  host: string | null;
  ref: string | null;
}

/**
 * One source for a first visit. An explicit tag wins over the referrer: someone who followed a
 * tagged link from a Discord server meant to be counted under the tag. `?ref=` beats `utm_source`
 * because a creator code names a specific person, which is the finer fact.
 */
export function classifyFirstTouch(input: FirstTouchInput): FirstTouch {
  const host = cleanHost(input.host);
  const ref = cleanTag(input.ref);
  const utm = cleanTag(input.source);
  let source: string;
  if (ref) source = `ref:${ref}`;
  else if (utm) source = SOURCE_RULES.some(([, key]) => key === utm) || utm in SOURCE_LABELS ? utm : `utm:${utm}`;
  else if (host) source = SOURCE_RULES.find(([re]) => re.test(host))?.[1] ?? host;
  else source = 'direct';
  return { source, medium: cleanTag(input.medium), campaign: cleanTag(input.campaign), host, ref };
}

/** Readable name of a stored source key. */
export function sourceLabel(source: string): string {
  if (SOURCE_LABELS[source]) return SOURCE_LABELS[source];
  if (source.startsWith('ref:')) return `Creator link · ${source.slice(4)}`;
  if (source.startsWith('utm:')) return `Campaign · ${source.slice(4)}`;
  return source;
}

/** Conversions per visit as a fraction; 0 when there were no visits (never NaN or Infinity). */
export function conversionRate(conversions: number, visits: number): number {
  return visits > 0 ? conversions / visits : 0;
}

/** Do Not Track or Global Privacy Control: the browser asked not to be counted, so nothing is sent. */
export function isOptedOut(nav: { doNotTrack?: string | null; globalPrivacyControl?: boolean }): boolean {
  return nav.doNotTrack === '1' || nav.globalPrivacyControl === true;
}
