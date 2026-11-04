// The official Anvil Kick channel (anvil_osrs) as a place to LINK a Kick account, with no streamer
// involved: anybody can type their one-time code in its chat and Anvil's webhook links them
// (lib/gates/kickDb applyKickEvent — the "no space connected this channel" branch).
//
// WHY THIS WORKS WITHOUT A USER TOKEN. Kick's POST /public/v1/events/subscriptions accepts an APP access
// token (client credentials) with `broadcaster_user_id` naming the channel (docs.kick.com/events/
// subscribe-to-events: "When using an app access token, this field is required"). So the site
// subscribes the app to chat.message.sent for the Anvil channel itself, lazily, the first time somebody
// asks for a code from settings, and re-checks at most hourly (Kick drops subscriptions after a day of
// failed deliveries). Deliveries go to the Kick app's one webhook URL, the same as every host channel.
//
// CONFIG: KICK_ANVIL_CHANNEL (slug, default anvil_osrs), or KICK_ANVIL_BROADCASTER_ID to skip the slug
// lookup. Set KICK_ANVIL_CHANNEL=off to switch the Anvil channel off: settings then say "type it in any
// connected streamer's Kick chat", which the existing gate code path already accepts.

import { kickConfig, kickAppToken, kickIdOf, type KickConfig } from '@/lib/kick';
import { kickFetch } from '@/lib/gates/kickDb';
import { log } from '@/lib/logger';

const API = 'https://api.kick.com/public/v1';
const RESOLVE_TTL_MS = 6 * 60 * 60_000;
const ENSURE_TTL_MS = 60 * 60_000;

export interface AnvilKickChannel {
  broadcasterId: string;
  slug: string;
}

let resolved: { at: number; value: AnvilKickChannel | null } | null = null;
let ensured: { at: number; ok: boolean } | null = null;
let app: { token: string; until: number } | null = null;

export function resetAnvilKickForTests(): void {
  resolved = null;
  ensured = null;
  app = null;
}

function configuredSlug(env = process.env): string | null {
  const raw = (env.KICK_ANVIL_CHANNEL ?? 'anvil_osrs').trim().toLowerCase();
  if (raw === 'off' || raw === '') return null;
  return /^[a-z0-9_-]{1,40}$/.test(raw) ? raw : null;
}

async function appTokenFor(cfg: KickConfig, force = false): Promise<string | null> {
  if (!force && app && app.until > Date.now()) return app.token;
  try {
    const t = await kickAppToken(cfg, kickFetch());
    app = { token: t.accessToken, until: Date.now() + Math.max(60, t.expiresIn - 300) * 1000 };
    return t.accessToken;
  } catch (err) {
    log.warn('kick.anvil-app-token-failed', {}, err);
    return null;
  }
}

async function call(cfg: KickConfig, path: string, init: RequestInit = {}): Promise<{ status: number; data: unknown }> {
  let token = await appTokenFor(cfg);
  if (!token) return { status: 0, data: null };
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await kickFetch()(`${API}${path}`, {
        ...init,
        headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return { status: 0, data: null };
    }
    if (res.status === 401 && attempt === 0) {
      token = await appTokenFor(cfg, true);
      if (!token) return { status: 401, data: null };
      continue;
    }
    const j = (await res.json().catch(() => null)) as { data?: unknown } | null;
    return { status: res.status, data: j?.data ?? null };
  }
  return { status: 401, data: null };
}

/** The Anvil channel's id and slug, or null when switched off, Kick is not configured, or it can't be found. */
export async function anvilKickChannel(env = process.env): Promise<AnvilKickChannel | null> {
  const cfg = kickConfig(env);
  const slug = configuredSlug(env);
  if (!cfg || !slug) return null;
  const fixedId = kickIdOf(env.KICK_ANVIL_BROADCASTER_ID?.trim());
  if (fixedId) return { broadcasterId: fixedId, slug: slug.replace(/_/g, '-') };
  if (resolved && Date.now() - resolved.at < RESOLVE_TTL_MS) return resolved.value;
  // Kick slugs swap underscores for dashes; ask for both spellings in one call.
  const q = new URLSearchParams();
  for (const s of new Set([slug, slug.replace(/_/g, '-')])) q.append('slug', s);
  const r = await call(cfg, `/channels?${q}`);
  if (r.status !== 200) return resolved?.value ?? null; // transient: keep what we had, don't cache a miss
  const row = (Array.isArray(r.data) ? r.data[0] : null) as { broadcaster_user_id?: unknown; slug?: unknown } | null;
  const id = kickIdOf(row?.broadcaster_user_id);
  const real = typeof row?.slug === 'string' && /^[a-z0-9_-]{1,40}$/.test(row.slug.toLowerCase()) ? row.slug.toLowerCase() : null;
  resolved = { at: Date.now(), value: id && real ? { broadcasterId: id, slug: real } : null };
  return resolved.value;
}

/** Is this broadcaster the Anvil channel? Cheap after the first call (cached). */
export async function isAnvilKickChannel(broadcasterId: string): Promise<boolean> {
  const ch = await anvilKickChannel().catch(() => null);
  return !!ch && ch.broadcasterId === broadcasterId;
}

/**
 * Make sure the app is subscribed to chat in the Anvil channel. True when it is (or now is). Checked
 * at most hourly; a failure is re-tried on the next call after a minute.
 */
export async function ensureAnvilKickChat(force = false): Promise<boolean> {
  const cfg = kickConfig();
  if (!cfg) return false;
  if (!force && ensured && Date.now() - ensured.at < (ensured.ok ? ENSURE_TTL_MS : 60_000)) return ensured.ok;
  const ch = await anvilKickChannel();
  if (!ch) {
    ensured = { at: Date.now(), ok: false };
    return false;
  }
  const list = await call(cfg, `/events/subscriptions?broadcaster_user_id=${encodeURIComponent(ch.broadcasterId)}`);
  const has =
    list.status === 200 &&
    Array.isArray(list.data) &&
    list.data.some((x) => {
      const s = x as { event?: unknown; name?: unknown; broadcaster_user_id?: unknown };
      return (s.event ?? s.name) === 'chat.message.sent' && kickIdOf(s.broadcaster_user_id) === ch.broadcasterId;
    });
  let ok = has;
  if (!has) {
    const r = await call(cfg, '/events/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ broadcaster_user_id: Number(ch.broadcasterId), method: 'webhook', events: [{ name: 'chat.message.sent', version: 1 }] }),
    });
    ok = r.status >= 200 && r.status < 300;
    if (!ok) log.warn('kick.anvil-subscribe-failed', { status: r.status });
  }
  ensured = { at: Date.now(), ok };
  return ok;
}
