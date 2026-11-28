import { NextResponse } from 'next/server';

import { getClientIp } from '@/lib/clientIp';
import { sharedBotToken } from '@/lib/discord-roles';
import { discordAttachment, discordAttachmentKey, discordExpiry, discordLinkStale, DISCORD_LINK_GRACE_MS } from '@/lib/displayImage';
import { log } from '@/lib/logger';
import { rateLimitByKey } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/discord-image?u=<a Discord attachment link>
//
// Sends the browser on to a working copy of a pasted Discord attachment link (lib/displayImage): the
// link itself while its signature is good, else one Discord re-signs on request
// (POST /attachments/refresh-urls, with the shared bot's token). Never fetches the image: it only
// redirects, and only ever to a Discord CDN attachment link, so it cannot be pointed anywhere else.
//
// Discord's limit is the bot's, shared with every other bot feature, so refreshes are capped per
// viewer and for the whole process, and a refreshed link is remembered until shortly before it
// expires in turn. Any failure redirects to the original link (it shows broken, as it would have).

const cache = new Map<string, { url: string; until: number }>();
const CACHE_MAX = 5_000;
/** One viewer's refreshes a minute: a gallery of old proofs is a few dozen at most. */
const PER_VIEWER = { limit: 60, windowMs: 60_000 };
/** Every refresh this process asks Discord for, a minute: well under the bot's own budget. */
const GLOBAL = { limit: 120, windowMs: 60_000 };
const TIMEOUT_MS = 5_000;

const go = (url: string, maxAge = 300) =>
  NextResponse.redirect(url, { status: 302, headers: { 'Cache-Control': `private, max-age=${maxAge}` } });

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('u');
  const link = discordAttachment(raw);
  if (!link) return NextResponse.json({ error: 'Not a Discord attachment link' }, { status: 400 });
  const now = Date.now();
  if (!discordLinkStale(link, now)) return go(link.toString());

  const key = discordAttachmentKey(link);
  const hit = cache.get(key);
  if (hit && hit.until > now) return go(hit.url);

  const token = sharedBotToken();
  if (!token) return go(link.toString(), 60);
  if (!(await rateLimitByKey('discord-image', getClientIp(request), PER_VIEWER)).ok) return go(link.toString(), 60);
  if (!(await rateLimitByKey('discord-image', 'all', GLOBAL)).ok) return go(link.toString(), 60);

  try {
    const res = await fetch('https://discord.com/api/v10/attachments/refresh-urls', {
      method: 'POST',
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ attachment_urls: [link.toString()] }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'error',
    });
    if (!res.ok) {
      log.warn('discord-image.refresh-failed', { status: res.status });
      return go(link.toString(), 60);
    }
    const body = (await res.json().catch(() => null)) as { refreshed_urls?: { original?: string; refreshed?: string }[] } | null;
    const fresh = discordAttachment(body?.refreshed_urls?.[0]?.refreshed);
    // Only ever a Discord attachment link, and the same attachment: never a redirect anywhere else.
    if (!fresh || discordAttachmentKey(fresh) !== key) return go(link.toString(), 60);
    const ex = discordExpiry(fresh);
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(key, { url: fresh.toString(), until: ex != null ? ex - DISCORD_LINK_GRACE_MS : now + 6 * 60 * 60 * 1000 });
    return go(fresh.toString());
  } catch (err) {
    log.warn('discord-image.refresh-error', { error: (err as Error).message });
    return go(link.toString(), 60);
  }
}
