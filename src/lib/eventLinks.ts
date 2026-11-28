/**
 * Links from Discord posts back into the site: the pure half (no database), so the post builders
 * that use it can be tested on their own. lib/discord re-exports `siteBaseUrl`.
 *
 * Two address shapes, on purpose:
 *  - An EVENT is linked on the apex, `<base>/events/<id>`. Event ids are global and the page answers
 *    that address with a redirect to the event's own one (lib/eventScope redirectToEventAddress):
 *    the host's `/c/<slug>` or `/s/<slug>`, or the reader's own clan when they play it from an
 *    accepted co-host, after the same visibility check the page makes. One event post goes to the
 *    host's channel AND each co-host's, so one address that lands every reader on their own clan's
 *    copy beats a per-channel guess. The plugin, the slash commands and every older post use it too.
 *  - A COMPETITION (SOTW/BOTW, item hunt) has no apex redirect: its page lives only under a clan
 *    that owns it or raced in it, so it is linked under the channel's own clan (`clanPageUrl`).
 */
import { clanPathOf } from '@/lib/clanScopedPaths';
import { clamp, LIMIT, type DiscordEmbed } from '@/lib/discordEmbeds';

// Public site origin, derived from the OAuth redirect URI (cron has no request context to read a
// host header from). Used to build deep links into the app for Discord posts. Null if unconfigured.
export function siteBaseUrl(): string | null {
  const uri = process.env.DISCORD_REDIRECT_URI;
  if (!uri) return null;
  try {
    return new URL(uri).origin;
  } catch {
    return null;
  }
}

/** An event's page — the public board doubles as the leaderboard. Null when the site URL is unknown. */
export function eventPageUrl(eventId: number): string | null {
  const base = siteBaseUrl();
  return base && Number.isInteger(eventId) ? `${base}/events/${eventId}` : null;
}

/** `{ url }` for an embed about this event: its title opens the event page. Empty when the site URL is unknown. */
export function eventLink(eventId: number): Pick<DiscordEmbed, 'url'> {
  const url = eventPageUrl(eventId);
  return url ? { url } : {};
}

/** A tile post links to that tile opened on the board (the event page reads ?tile=), not just the board. */
export function eventTileUrl(eventId: number, tileId: number | null | undefined): string | null {
  const url = eventPageUrl(eventId);
  return url && tileId ? `${url}?tile=${tileId}` : url;
}

/** A page under one clan or space (`/c/<slug>…`, `/s/<slug>…`), absolute. Null when either half is unknown. */
export function clanPageUrl(clan: { slug: string | null; kind?: string | null } | null | undefined, path: string): string | null {
  const base = siteBaseUrl();
  return base && clan?.slug ? `${base}${clanPathOf({ slug: clan.slug, kind: clan.kind }, path)}` : null;
}

/**
 * The author line every event post opens with ("<event>" or "<event> · <team>"), and the event's
 * page on both the author line and the title, so a click on either opens the event. A post that
 * means somewhere more exact (a tile on the board, the starting shot) sets its own `url` after
 * spreading this, and that wins.
 */
export function eventAuthor(
  eventId: number | null | undefined,
  eventName: string,
  teamName?: string | null,
): Pick<DiscordEmbed, 'author' | 'url'> {
  const name = teamName ? `${eventName} · ${teamName}` : eventName;
  const url = eventId != null ? eventPageUrl(eventId) : null;
  return { author: { name: clamp(name, LIMIT.author), ...(url ? { url } : {}) }, ...(url ? { url } : {}) };
}
