// Notices from Anvil: who one is for, what it may link to, and how it reads in each place. Pure — the
// database half is lib/notices.
//
// WHY THE LINK RULE IS STRICT. A notice is something the operator wrote, but it is shown with Anvil's
// name on it, and in the plugin it would be remote content inside a RuneLite panel, which the Plugin
// Hub reviewers read closely. So: the plugin never gets a link at all (only a fixed "open your inbox
// on Anvil"), and the site inbox only links to Anvil's own pages or a Discord invite — never a file.

import type { SupporterTierId } from '@/lib/supporterTiers';

export const TITLE_MAX = 80;
export const BODY_MAX = 600;
export const LINK_LABEL_MAX = 30;

export const NOTICE_LEVELS = ['info', 'important'] as const;
export type NoticeLevel = (typeof NOTICE_LEVELS)[number];

const TIER_RANK: Record<SupporterTierId, number> = { supporter: 1, champion: 2, patron: 3 };

/** Who a notice is for. */
export type Audience =
  | { kind: 'everyone' }
  | { kind: 'admins' } // owners and admins of any clan
  | { kind: 'supporters'; tier: SupporterTierId } // that tier or better
  | { kind: 'clan'; clanId: number } // that clan's owners and admins
  | { kind: 'user'; userId: number };

export function parseAudience(raw: string | null | undefined): Audience | null {
  const s = (raw ?? '').trim();
  if (s === 'everyone' || s === 'admins') return { kind: s };
  if (s === 'supporters') return { kind: 'supporters', tier: 'supporter' };
  const [head, tail] = s.split(':');
  if (head === 'tier' && (tail === 'supporter' || tail === 'champion' || tail === 'patron')) return { kind: 'supporters', tier: tail };
  const id = Number(tail);
  if (!Number.isInteger(id) || id <= 0 || String(id) !== tail) return null;
  if (head === 'clan') return { kind: 'clan', clanId: id };
  if (head === 'user') return { kind: 'user', userId: id };
  return null;
}

export function audienceKey(a: Audience): string {
  switch (a.kind) {
    case 'everyone':
    case 'admins':
      return a.kind;
    case 'supporters':
      return a.tier === 'supporter' ? 'supporters' : `tier:${a.tier}`;
    case 'clan':
      return `clan:${a.clanId}`;
    case 'user':
      return `user:${a.userId}`;
  }
}

/** What we know about one person, enough to say whether a notice is for them. */
export interface ReaderFacts {
  userId: number;
  /** Clans where they're an owner or admin. */
  staffClanIds: number[];
  tier: SupporterTierId | null;
}

export function noticeIsFor(a: Audience, f: ReaderFacts): boolean {
  switch (a.kind) {
    case 'everyone':
      return true;
    case 'admins':
      return f.staffClanIds.length > 0;
    case 'supporters':
      return !!f.tier && TIER_RANK[f.tier] >= TIER_RANK[a.tier];
    case 'clan':
      return f.staffClanIds.includes(a.clanId);
    case 'user':
      return f.userId === a.userId;
  }
}

/** Live: not withdrawn and not past its end. */
export function noticeLive(n: { withdrawnAt: string | Date | null; expiresAt: string | Date | null }, now = Date.now()): boolean {
  if (n.withdrawnAt) return false;
  if (n.expiresAt && new Date(n.expiresAt).getTime() <= now) return false;
  return true;
}

// Things a notice must never point at: anything that downloads.
const FILE_EXT = /\.(exe|msi|jar|zip|rar|7z|gz|tar|dmg|pkg|apk|bat|cmd|ps1|sh|scr|dll|iso|bin|js|vbs)$/i;

/**
 * A notice's link, made safe, or null when it isn't allowed. Accepts a site path ("/settings"), a page
 * on one of `siteHosts` (the apex and its subdomains), or a Discord invite / channel / profile.
 * Returns what to store: a site path stays a path, everything else a full https URL.
 */
export function safeNoticeLink(raw: string | null | undefined, siteHosts: string[]): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  if (s.startsWith('/') && !s.startsWith('//')) {
    const path = s.split(/[?#]/)[0];
    return FILE_EXT.test(path) || s.length > 300 ? null : s;
  }
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  if (FILE_EXT.test(u.pathname)) return null;
  const host = u.hostname.toLowerCase();
  const onSite = siteHosts.some((h) => host === h || host.endsWith(`.${h}`));
  const discord =
    host === 'discord.gg' ||
    ((host === 'discord.com' || host === 'www.discord.com') && /^\/(invite|channels|users)\//.test(u.pathname));
  return onSite || discord ? u.toString() : null;
}

export function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/** The plugin login brief's line for a notice: text only. */
export function noticeBriefLine(n: { title: string }): string {
  return clip(`From Anvil: ${n.title}`, 120);
}

/** A notice as a DM: the title bold, the body, and the link spelled out (Discord renders it). */
export function noticeDmContent(n: { title: string; body: string; linkUrl: string | null }, origin: string): string {
  const link = n.linkUrl ? (n.linkUrl.startsWith('/') ? `${origin}${n.linkUrl}` : n.linkUrl) : null;
  return [`**${clip(n.title, TITLE_MAX)}**`, n.body.trim(), link].filter(Boolean).join('\n\n').slice(0, 1900);
}

// ---- "Where did you find Anvil?" -------------------------------------------------------------------

export const FOUND_VIA = [
  { id: 'plugin-hub', label: 'RuneLite Plugin Hub' },
  { id: 'friend', label: 'A friend or clanmate' },
  { id: 'discord', label: 'A Discord server' },
  { id: 'reddit', label: 'Reddit' },
  { id: 'streamer', label: 'A streamer or video' },
  { id: 'search', label: 'Google / search' },
  { id: 'other', label: 'Somewhere else' },
] as const;
export type FoundVia = (typeof FOUND_VIA)[number]['id'];

export function parseFoundVia(raw: unknown, note: unknown): { foundVia: FoundVia | null; note: string | null } {
  const id = FOUND_VIA.find((o) => o.id === raw)?.id ?? null;
  const n = typeof note === 'string' ? clip(note, 120) : '';
  return { foundVia: id, note: id && n ? n : null };
}

export function foundViaLabel(id: string | null | undefined): string | null {
  return FOUND_VIA.find((o) => o.id === id)?.label ?? null;
}
