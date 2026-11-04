// Stream highlights — the Twitch calls, as the Anvil bot. No database import; tested with a mocked
// fetch (tests/highlights.test.ts).
//
// EVERY CALL HERE USES THE BOT'S OWN USER TOKEN (the Anvil_OSRS account, TWITCH_BOT_*), never a host's
// or a viewer's. Creating a clip needs `clips:edit` on the token of whoever clips; any logged-in user
// may clip a live channel unless the broadcaster restricted clipping, so the bot clips the way a
// viewer would. The reads (is it live? its archives? the clip?) need no scope at all.
//
//   live?        GET  /helix/streams?user_id=…
//   clip         POST /helix/clips?broadcaster_id=…         clips:edit   → 202 { data: [{ id }] }
//   the clip     GET  /helix/clips?id=…                     ready once Twitch has processed it
//   the VOD      GET  /helix/videos?user_id=…&type=archive
//
// Outbound only to id.twitch.tv and api.twitch.tv, with ids that come from our own rows (a connected
// channel's broadcaster id, a linked viewer's Twitch id) and are re-checked as digits here.

import {
  parseTwitchDuration,
  safeClipUrl,
  safeThumbnailUrl,
  type TwitchArchive,
} from '@/lib/highlights/rules';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const ID = 'https://id.twitch.tv/oauth2';
const HELIX = 'https://api.twitch.tv/helix';
const TWITCH_ID = /^\d{1,20}$/;
const CLIP_ID = /^[A-Za-z0-9_-]{1,120}$/;

/** The scope a clip needs. */
export const CLIP_SCOPE = 'clips:edit';

export interface BotConfig {
  clientId: string;
  clientSecret: string;
  /** The env seed; the stored (possibly rotated) one wins while the seed is unchanged. */
  refreshSeed: string;
  /** Encrypts the cached tokens. Null → held in memory only. */
  tokenKey: string | null;
}

/** TWITCH_BOT_CLIENT_ID + TWITCH_BOT_CLIENT_SECRET + TWITCH_BOT_REFRESH_TOKEN, or null (highlights off). */
export function botConfig(env: Record<string, string | undefined> = process.env): BotConfig | null {
  const clientId = env.TWITCH_BOT_CLIENT_ID?.trim();
  const clientSecret = env.TWITCH_BOT_CLIENT_SECRET?.trim();
  const refreshSeed = env.TWITCH_BOT_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshSeed) return null;
  const key = env.TWITCH_TOKEN_KEY?.trim();
  return { clientId, clientSecret, refreshSeed, tokenKey: key && key.length >= 32 ? key : null };
}

// ── Tokens ───────────────────────────────────────────────────────────────────────────────────────

export interface BotTokenSet {
  accessToken: string;
  /** Twitch may hand back a new one; null = keep using the old. */
  refreshToken: string | null;
  expiresIn: number;
}

export class BotAuthError extends Error {
  constructor(
    message: string,
    /** Twitch refused (revoked / bad refresh token), rather than failing to answer. */
    readonly refused: boolean,
  ) {
    super(message);
    this.name = 'BotAuthError';
  }
}

export async function refreshBotToken(cfg: BotConfig, refresh: string, f: FetchLike): Promise<BotTokenSet> {
  let res: Response;
  try {
    res = await f(`${ID}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
      }).toString(),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new BotAuthError('Twitch token endpoint unreachable', false);
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) throw new BotAuthError(`Twitch refused (${res.status})`, true);
  if (!res.ok) throw new BotAuthError(`Twitch token endpoint failed (${res.status})`, false);
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof j.access_token !== 'string' || !j.access_token) throw new BotAuthError('Twitch sent no token', false);
  return {
    accessToken: j.access_token,
    refreshToken: typeof j.refresh_token === 'string' && j.refresh_token ? j.refresh_token : null,
    expiresIn: typeof j.expires_in === 'number' ? j.expires_in : 3600,
  };
}

export interface BotIdentity {
  userId: string;
  login: string;
  scopes: string[];
}

/** Who the token is and what it may do (GET /oauth2/validate). Null when Twitch says it is no good. */
export async function validateBotToken(token: string, f: FetchLike): Promise<BotIdentity | null> {
  const res = await f(`${ID}/validate`, { headers: { Authorization: `OAuth ${token}` }, signal: AbortSignal.timeout(15_000) });
  if (res.status === 401) return null;
  if (!res.ok) throw new BotAuthError(`Twitch validate failed (${res.status})`, false);
  const j = (await res.json().catch(() => ({}))) as { user_id?: unknown; login?: unknown; scopes?: unknown };
  if (typeof j.user_id !== 'string' || !TWITCH_ID.test(j.user_id)) return null;
  return {
    userId: j.user_id,
    login: typeof j.login === 'string' ? j.login : '',
    scopes: Array.isArray(j.scopes) ? j.scopes.filter((s): s is string => typeof s === 'string') : [],
  };
}

export function canClip(scopes: string[]): boolean {
  return scopes.includes(CLIP_SCOPE);
}

// ── Helix ────────────────────────────────────────────────────────────────────────────────────────

export type ApiResult<T> = { ok: true; value: T } | { ok: false; reason: 'unauthorized' | 'forbidden' | 'not-live' | 'rate-limited' | 'error' };

async function helix(cfg: BotConfig, token: string, path: string, f: FetchLike, init: RequestInit = {}): Promise<Response | null> {
  try {
    return await f(`${HELIX}${path}`, {
      ...init,
      headers: { 'Client-Id': cfg.clientId, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return null;
  }
}

function failure(res: Response | null): ApiResult<never> {
  if (!res) return { ok: false, reason: 'error' };
  if (res.status === 401) return { ok: false, reason: 'unauthorized' };
  if (res.status === 403) return { ok: false, reason: 'forbidden' };
  if (res.status === 429) return { ok: false, reason: 'rate-limited' };
  return { ok: false, reason: 'error' };
}

async function dataOf(res: Response): Promise<Record<string, unknown>[]> {
  const j = (await res.json().catch(() => null)) as { data?: unknown } | null;
  return Array.isArray(j?.data) ? (j!.data as Record<string, unknown>[]) : [];
}

export interface LiveStream {
  /** ISO — when this broadcast went live. */
  startedAt: string;
}

/** The channel's live stream, or null when it is offline. */
export async function getLiveStream(cfg: BotConfig, token: string, broadcasterId: string, f: FetchLike): Promise<ApiResult<LiveStream | null>> {
  if (!TWITCH_ID.test(broadcasterId)) return { ok: false, reason: 'error' };
  const res = await helix(cfg, token, `/streams?${new URLSearchParams({ user_id: broadcasterId, type: 'live' })}`, f);
  if (!res?.ok) return failure(res);
  const live = (await dataOf(res)).find((s) => s?.type === 'live' || s?.type === undefined);
  if (!live) return { ok: true, value: null };
  return { ok: true, value: { startedAt: typeof live.started_at === 'string' ? live.started_at : new Date().toISOString() } };
}

/** Ask Twitch to cut a clip of the last ~30 s. Returns the clip's id; it is not ready yet. */
export async function createClip(cfg: BotConfig, token: string, broadcasterId: string, f: FetchLike): Promise<ApiResult<string>> {
  if (!TWITCH_ID.test(broadcasterId)) return { ok: false, reason: 'error' };
  const res = await helix(cfg, token, `/clips?${new URLSearchParams({ broadcaster_id: broadcasterId })}`, f, { method: 'POST' });
  // 404: "the broadcaster is not live" (or clipping is off for the channel).
  if (res?.status === 404) return { ok: false, reason: 'not-live' };
  if (!res?.ok) return failure(res);
  const id = (await dataOf(res))[0]?.id;
  return typeof id === 'string' && CLIP_ID.test(id) ? { ok: true, value: id } : { ok: false, reason: 'error' };
}

export interface ClipInfo {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  durationS: number | null;
}

/** A clip by id once Twitch has processed it; null while it is still being made (or it failed). */
export async function getClip(cfg: BotConfig, token: string, clipId: string, f: FetchLike): Promise<ApiResult<ClipInfo | null>> {
  if (!CLIP_ID.test(clipId)) return { ok: false, reason: 'error' };
  const res = await helix(cfg, token, `/clips?${new URLSearchParams({ id: clipId })}`, f);
  if (!res?.ok) return failure(res);
  const c = (await dataOf(res)).find((x) => x?.id === clipId);
  if (!c) return { ok: true, value: null };
  const url = safeClipUrl(c.url);
  if (!url) return { ok: true, value: null };
  return {
    ok: true,
    value: {
      id: clipId,
      url,
      thumbnailUrl: safeThumbnailUrl(c.thumbnail_url),
      durationS: typeof c.duration === 'number' && Number.isFinite(c.duration) ? c.duration : null,
    },
  };
}

/** The channel's recent archives (past broadcasts, the current one included while live). */
export async function getArchives(cfg: BotConfig, token: string, broadcasterId: string, f: FetchLike): Promise<ApiResult<TwitchArchive[]>> {
  if (!TWITCH_ID.test(broadcasterId)) return { ok: false, reason: 'error' };
  const q = new URLSearchParams({ user_id: broadcasterId, type: 'archive', first: '10' });
  const res = await helix(cfg, token, `/videos?${q}`, f);
  if (!res?.ok) return failure(res);
  const out: TwitchArchive[] = [];
  for (const v of await dataOf(res)) {
    if (typeof v?.id !== 'string' || !TWITCH_ID.test(v.id)) continue;
    if (typeof v.created_at !== 'string' || parseTwitchDuration(v.duration) == null) continue;
    out.push({ id: v.id, createdAt: v.created_at, duration: v.duration as string });
  }
  return { ok: true, value: out };
}

// ── The clip's life ──────────────────────────────────────────────────────────────────────────────

export type ClipOutcome =
  | { ok: true; clip: ClipInfo }
  | { ok: false; reason: 'not-live' | 'forbidden' | 'unauthorized' | 'rate-limited' | 'error' | 'timeout' };

export interface ClipTiming {
  /** Wait before the first look: Twitch takes ~15 s to process a clip. */
  firstLookMs: number;
  /** Between looks. */
  pollMs: number;
  /** Give up this long after asking. */
  deadlineMs: number;
}

export const CLIP_TIMING: ClipTiming = { firstLookMs: 15_000, pollMs: 10_000, deadlineMs: 60_000 };

/**
 * Create a clip, then look it up until it is ready or the deadline passes. `token()` is asked fresh
 * each time so a refresh in between (another clip's 401) is picked up.
 */
export async function makeClip(opts: {
  cfg: BotConfig;
  token: () => Promise<string | null>;
  broadcasterId: string;
  f: FetchLike;
  sleep: (ms: number) => Promise<void>;
  timing?: ClipTiming;
}): Promise<ClipOutcome> {
  const timing = opts.timing ?? CLIP_TIMING;
  const t1 = await opts.token();
  if (!t1) return { ok: false, reason: 'unauthorized' };
  const made = await createClip(opts.cfg, t1, opts.broadcasterId, opts.f);
  if (!made.ok) return { ok: false, reason: made.reason };
  let waited = 0;
  let wait = timing.firstLookMs;
  while (waited + wait <= timing.deadlineMs) {
    await opts.sleep(wait);
    waited += wait;
    const t = await opts.token();
    if (!t) return { ok: false, reason: 'unauthorized' };
    const got = await getClip(opts.cfg, t, made.value, opts.f);
    if (got.ok && got.value) return { ok: true, clip: got.value };
    if (!got.ok && got.reason !== 'error' && got.reason !== 'rate-limited') return { ok: false, reason: got.reason };
    wait = timing.pollMs;
  }
  return { ok: false, reason: 'timeout' };
}
