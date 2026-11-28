// Discord attachment links (cdn.discordapp.com/attachments/…, media.discordapp.net/attachments/…) carry
// a signed expiry (`ex=`, hex unix seconds) and stop loading about a day after they were handed out. A
// member's pasted proof or guide image then shows broken. Where such a link is RENDERED it goes through
// /api/discord-image, which hands back the link itself while it is good and a freshly signed one from
// Discord once it has expired (app/api/discord-image/route.ts). Stored data is never rewritten.
//
// ONLY LINKS WE HANDED OUT. Re-signing is done with our bot, so an open endpoint would let anyone have
// our bot re-sign any attachment (one from a server the bot is in, say). Each proxied link therefore
// carries `sig`, an HMAC of its host and path under a server-only key (lib/displayImageServer), and
// the route refreshes nothing without a valid one.
//
// Pure: the route, the server helper and the tests read it.

const HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net']);

/** A Discord attachment link we may refresh, parsed; null for anything else. */
export function discordAttachment(raw: string | null | undefined): URL | null {
  if (!raw || typeof raw !== 'string') return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  if (!HOSTS.has(url.hostname.toLowerCase())) return null;
  if (!/^\/(?:ephemeral-)?attachments\/\d+\/\d+\/[^/]+$/.test(url.pathname)) return null;
  return url;
}

/** When a signed Discord link stops working (epoch ms), from its `ex=`; null when it carries none. */
export function discordExpiry(url: URL): number | null {
  const ex = url.searchParams.get('ex');
  if (!ex || !/^[0-9a-f]{1,12}$/i.test(ex)) return null;
  return parseInt(ex, 16) * 1000;
}

/** Still good for at least this long: hand the link out as it is. */
export const DISCORD_LINK_GRACE_MS = 60 * 60 * 1000;

/** Does this link need a fresh signature before it is shown? Unsigned (old-style) links never expire. */
export function discordLinkStale(url: URL, nowMs: number): boolean {
  const ex = discordExpiry(url);
  return ex != null && ex - nowMs < DISCORD_LINK_GRACE_MS;
}

/** The cache key for one attachment: the link without its signature. */
export function discordAttachmentKey(url: URL): string {
  return `${url.hostname.toLowerCase()}${url.pathname}`;
}

/** What `sig` covers: the attachment itself (host and path), not its expiring query. */
export function imageSigPayload(url: URL): string {
  return `discord-image:${discordAttachmentKey(url)}`;
}

/** The proxied link for a Discord attachment, with its signature; anything else as it is. */
export function proxiedImageUrl<T extends string | null | undefined>(raw: T, sign: (payload: string) => string): T | string {
  const url = discordAttachment(raw);
  return url ? `/api/discord-image?u=${encodeURIComponent(raw as string)}&sig=${sign(imageSigPayload(url))}` : raw;
}
