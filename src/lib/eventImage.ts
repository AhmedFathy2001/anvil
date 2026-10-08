// An event's own picture: a square icon and a wide banner, both optional.
//
// The icon falls back to the host clan's logo, and the clan's logo to the generated crest
// (components/ClanCrest), so every event always has a face. The banner has no fallback image — a
// page without one gets a tinted strip instead of somebody else's picture stretched to fit.

import { isManagedMediaUrl } from '@/lib/storage';

/**
 * Did this URL come out of our own upload endpoint?
 *
 * Rendered as `<img src>` on pages strangers read and posted into Discord, so "any URL an admin
 * typed" would point every visitor's browser at a server of somebody else's choosing. `/api/upload`
 * is the only writer of the media bucket, so anything else did not come from here. A same-origin path
 * is allowed for deployments that serve media themselves; a protocol-relative `//host` is not.
 */
export function isOwnMediaUrl(url: string): boolean {
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  return isManagedMediaUrl(url);
}

/** Validate a PATCH value: null/'' clears it, anything else must be our own media. */
export function cleanEventImageUrl(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined || raw === '') return { ok: true, value: null };
  if (typeof raw !== 'string' || raw.length > 1000) return { ok: false, error: 'Image must be an uploaded file.' };
  const url = raw.trim();
  if (!isOwnMediaUrl(url)) return { ok: false, error: 'Upload the image here; links to other sites aren’t allowed.' };
  return { ok: true, value: url };
}

/** The picture to show for an event: its own icon, else the host clan's logo, else null (crest). */
export function eventIconUrl(
  event: { iconUrl?: string | null },
  clan: { logoUrl?: string | null } | null | undefined,
): string | null {
  return event.iconUrl || clan?.logoUrl || null;
}

/** An icon Discord can fetch: only absolute https URLs work in an embed. */
export function discordIconUrl(url: string | null | undefined): string | null {
  return url && url.startsWith('https://') ? url : null;
}
