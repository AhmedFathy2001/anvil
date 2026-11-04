// "Live now" for connected accounts on profiles. No database import (tests/connected-accounts.test.ts
// runs it against a mocked fetch).
//
//   Twitch — Helix GET /streams?user_id=…&user_id=… (≤100 per call) on an APP token (client
//            credentials; no user involved). One call answers a whole page.
//   Kick   — GET /public/v1/channels?broadcaster_user_id=… (≤50) on Kick's app token; `stream.is_live`.
//            Also gives the real channel slug for the profile link.
//   YouTube — not offered: the only "is this channel live" read is search.list (100 quota units a call),
//            far too dear for a profile view.
//
// Every answer is cached per id for LIVE_TTL_MS (one profile view → at most one call per platform per
// minute, however many people look), lookups are BATCHED (only ids missing from the cache are asked
// for), and a failure is "not live" — the badge is decoration and must never break a profile.

import type { FetchLike } from '@/lib/twitch';

export const LIVE_TTL_MS = 60_000;

export interface LiveInfo {
  live: boolean;
  /** Kick only: the channel's real slug. */
  slug?: string | null;
}

type Entry = { at: number; info: LiveInfo };

export class LiveCache {
  private map = new Map<string, Entry>();
  constructor(private ttl = LIVE_TTL_MS, private max = 5000) {}
  get(key: string, now = Date.now()): LiveInfo | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (now - e.at > this.ttl) {
      this.map.delete(key);
      return undefined;
    }
    return e.info;
  }
  set(key: string, info: LiveInfo, now = Date.now()): void {
    if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value as string);
    this.map.set(key, { at: now, info });
  }
  clear(): void {
    this.map.clear();
  }
}

export const liveCache = new LiveCache();

let fetchImpl: FetchLike = (input, init) => fetch(input, init);
export function setLiveFetchForTests(f: FetchLike | null): void {
  fetchImpl = f ?? ((input, init) => fetch(input, init));
  liveCache.clear();
  appTokens.clear();
}

// ── App tokens (client credentials), in memory only ─────────────────────────────────────────────

const appTokens = new Map<string, { token: string; until: number }>();

async function appToken(kind: 'twitch' | 'kick', url: string, clientId: string, clientSecret: string): Promise<string | null> {
  const hit = appTokens.get(kind);
  if (hit && hit.until > Date.now()) return hit.token;
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }).toString(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token?: unknown; expires_in?: unknown };
    if (typeof j.access_token !== 'string' || !j.access_token) return null;
    const ttl = Number(j.expires_in);
    appTokens.set(kind, { token: j.access_token, until: Date.now() + Math.max(60, Number.isFinite(ttl) ? ttl - 300 : 3000) * 1000 });
    return j.access_token;
  } catch {
    return null;
  }
}

function forgetAppToken(kind: 'twitch' | 'kick'): void {
  appTokens.delete(kind);
}

// ── Twitch ───────────────────────────────────────────────────────────────────────────────────────

const TWITCH_ID = /^\d{1,20}$/;

/** Which of these Twitch user ids are streaming right now. Batched + cached; never throws. */
export async function twitchLive(ids: string[], env: Record<string, string | undefined> = process.env): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  const want = [...new Set(ids.filter((id) => TWITCH_ID.test(id)))];
  const ask: string[] = [];
  for (const id of want) {
    const c = liveCache.get(`twitch:${id}`);
    if (c) out.set(id, c.live);
    else ask.push(id);
  }
  const clientId = env.TWITCH_CLIENT_ID?.trim();
  const secret = env.TWITCH_CLIENT_SECRET?.trim();
  if (ask.length === 0 || !clientId || !secret) {
    for (const id of ask) out.set(id, false);
    return out;
  }
  for (let i = 0; i < ask.length; i += 100) {
    const chunk = ask.slice(i, i + 100);
    const live = await twitchStreams(chunk, clientId, secret);
    for (const id of chunk) {
      const v = live?.has(id) ?? false;
      out.set(id, v);
      // A failed call is cached too (as not live), so an outage costs one call a minute, not one a view.
      liveCache.set(`twitch:${id}`, { live: v });
    }
  }
  return out;
}

async function twitchStreams(ids: string[], clientId: string, secret: string, retried = false): Promise<Set<string> | null> {
  const token = await appToken('twitch', 'https://id.twitch.tv/oauth2/token', clientId, secret);
  if (!token) return null;
  const q = new URLSearchParams({ first: '100' });
  for (const id of ids) q.append('user_id', id);
  try {
    const res = await fetchImpl(`https://api.twitch.tv/helix/streams?${q}`, {
      headers: { 'Client-Id': clientId, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 401 && !retried) {
      forgetAppToken('twitch');
      return twitchStreams(ids, clientId, secret, true);
    }
    if (!res.ok) return null;
    const j = (await res.json()) as { data?: { user_id?: unknown; type?: unknown }[] };
    return new Set((j.data ?? []).filter((s) => s?.type === 'live' && typeof s.user_id === 'string').map((s) => s.user_id as string));
  } catch {
    return null;
  }
}

// ── Kick ─────────────────────────────────────────────────────────────────────────────────────────

const KICK_ID = /^[0-9]{1,20}$/;
const KICK_SLUG = /^[a-z0-9_-]{1,40}$/;

/** Live state and real slug of these Kick user ids. Batched + cached; never throws. */
export async function kickLive(ids: string[], env: Record<string, string | undefined> = process.env): Promise<Map<string, LiveInfo>> {
  const out = new Map<string, LiveInfo>();
  const want = [...new Set(ids.filter((id) => KICK_ID.test(id)))];
  const ask: string[] = [];
  for (const id of want) {
    const c = liveCache.get(`kick:${id}`);
    if (c) out.set(id, c);
    else ask.push(id);
  }
  const clientId = env.KICK_CLIENT_ID?.trim();
  const secret = env.KICK_CLIENT_SECRET?.trim();
  if (ask.length === 0 || !clientId || !secret) {
    for (const id of ask) out.set(id, { live: false, slug: null });
    return out;
  }
  for (let i = 0; i < ask.length; i += 50) {
    const chunk = ask.slice(i, i + 50);
    const got = await kickChannels(chunk, clientId, secret);
    for (const id of chunk) {
      const v = got?.get(id) ?? { live: false, slug: null };
      out.set(id, v);
      liveCache.set(`kick:${id}`, v);
    }
  }
  return out;
}

async function kickChannels(ids: string[], clientId: string, secret: string, retried = false): Promise<Map<string, LiveInfo> | null> {
  const token = await appToken('kick', 'https://id.kick.com/oauth/token', clientId, secret);
  if (!token) return null;
  const q = new URLSearchParams();
  for (const id of ids) q.append('broadcaster_user_id', id);
  try {
    const res = await fetchImpl(`https://api.kick.com/public/v1/channels?${q}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 401 && !retried) {
      forgetAppToken('kick');
      return kickChannels(ids, clientId, secret, true);
    }
    if (!res.ok) return null;
    const j = (await res.json()) as { data?: { broadcaster_user_id?: unknown; slug?: unknown; stream?: { is_live?: unknown } }[] };
    const m = new Map<string, LiveInfo>();
    for (const c of j.data ?? []) {
      const id = typeof c?.broadcaster_user_id === 'number' || typeof c?.broadcaster_user_id === 'string' ? String(c.broadcaster_user_id) : '';
      if (!KICK_ID.test(id)) continue;
      const slug = typeof c.slug === 'string' && KICK_SLUG.test(c.slug.toLowerCase()) ? c.slug.toLowerCase() : null;
      m.set(id, { live: c.stream?.is_live === true, slug });
    }
    return m;
  } catch {
    return null;
  }
}
