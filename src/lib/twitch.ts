// Twitch — the OAuth round trip and the two Helix reads the entry gates need. No database import, so
// it is tested with a mocked fetch (tests/entry-gates.test.ts).
//
// WHOSE TOKEN ASKS. Both checks run on the BROADCASTER's token, which the host grants once when they
// connect their channel:
//
//   follows?    GET /helix/channels/followers?broadcaster_id=…&user_id=…   moderator:read:followers
//   subscribed? GET /helix/subscriptions?broadcaster_id=…&user_id=…        channel:read:subscriptions
//
// The alternative — each viewer granting user:read:follows + user:read:subscriptions and Anvil
// keeping a refreshable token for every viewer — stores thousands of credentials to answer a
// question the host's one token answers for all of them. So a viewer's link asks for NO scopes: the
// token proves who they are (GET /helix/users), is revoked straight away, and only their Twitch id
// and login are kept. Fewer secrets at rest, nothing for a viewer to un-grant, and a viewer's link
// never goes stale.
//
// CONFIGURED = TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET + TWITCH_REDIRECT_URI + TWITCH_TOKEN_KEY (≥32
// chars; encrypts the host's tokens and signs the OAuth state). Missing any → every Twitch option is
// hidden from the host, and no Twitch route does anything.

import crypto from 'crypto';

const AUTHORIZE_URL = 'https://id.twitch.tv/oauth2/authorize';
const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const REVOKE_URL = 'https://id.twitch.tv/oauth2/revoke';
const HELIX = 'https://api.twitch.tv/helix';

/** What the host's channel token must carry. */
export const HOST_SCOPES = ['moderator:read:followers', 'channel:read:subscriptions'] as const;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface TwitchConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenKey: string;
}

export function twitchConfig(env: Record<string, string | undefined> = process.env): TwitchConfig | null {
  const clientId = env.TWITCH_CLIENT_ID?.trim();
  const clientSecret = env.TWITCH_CLIENT_SECRET?.trim();
  const redirectUri = env.TWITCH_REDIRECT_URI?.trim();
  const tokenKey = env.TWITCH_TOKEN_KEY?.trim();
  if (!clientId || !clientSecret || !redirectUri || !tokenKey || tokenKey.length < 32) return null;
  return { clientId, clientSecret, redirectUri, tokenKey };
}

export function twitchConfigured(env?: Record<string, string | undefined>): boolean {
  return twitchConfig(env) !== null;
}

// ── OAuth state ──────────────────────────────────────────────────────────────────────────────────
//
// The state is SIGNED and carries who started it, for what, and where to return. The callback also
// requires the nonce cookie set by /start and the same logged-in user, so a state lifted from one
// browser is useless in another, and an old one expires.

export type LinkMode = 'viewer' | 'host';

export interface TwitchState {
  /** users.id of whoever pressed the button. */
  u: number;
  m: LinkMode;
  /** Host mode: the creator space being connected. */
  c: number | null;
  /** Site-relative path to come back to (re-sanitized at the callback). */
  r: string;
  /** Clan host to come back to, re-resolved against the clans table at the callback. */
  h: string | null;
  /** Matches the nonce cookie. */
  n: string;
  /** Expiry, ms since epoch. */
  e: number;
}

export const STATE_TTL_MS = 10 * 60_000;

/** Set by /api/auth/twitch/start, required by the callback, scoped to /api/auth/twitch. */
export const TWITCH_NONCE_COOKIE = 'twitch_oauth_nonce';

function stateKey(tokenKey: string): Buffer {
  // Derived, so the encryption key itself is never used as an HMAC key.
  return crypto.createHash('sha256').update(`anvil-twitch-state:${tokenKey}`).digest();
}

export function signState(state: TwitchState, tokenKey: string): string {
  const body = Buffer.from(JSON.stringify(state)).toString('base64url');
  const mac = crypto.createHmac('sha256', stateKey(tokenKey)).update(body).digest('base64url');
  return `${body}.${mac}`;
}

/** The state, if its signature holds, it has not expired, and it is well formed. Null otherwise. */
export function verifyState(token: string | null | undefined, tokenKey: string, now = Date.now()): TwitchState | null {
  if (typeof token !== 'string' || token.length > 2048) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, mac] = parts;
  const expected = crypto.createHmac('sha256', stateKey(tokenKey)).update(body).digest();
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  let s: TwitchState;
  try {
    s = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!s || typeof s !== 'object') return null;
  if (!Number.isInteger(s.u) || s.u <= 0) return null;
  if (s.m !== 'viewer' && s.m !== 'host') return null;
  if (s.m === 'host' && (!Number.isInteger(s.c) || (s.c as number) <= 0)) return null;
  if (typeof s.r !== 'string' || typeof s.n !== 'string' || s.n.length < 16) return null;
  if (s.h != null && typeof s.h !== 'string') return null;
  if (typeof s.e !== 'number' || s.e <= now) return null;
  return s;
}

export function newNonce(): string {
  return crypto.randomBytes(18).toString('base64url');
}

export function authorizeUrl(cfg: TwitchConfig, mode: LinkMode, state: string): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    // A viewer grants nothing but "this is me"; the host grants the two reads (see the top).
    scope: mode === 'host' ? HOST_SCOPES.join(' ') : '',
    state,
  });
  // The host may be switching channels; make Twitch show the account it is about to use.
  if (mode === 'host') params.set('force_verify', 'true');
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

// ── Tokens ───────────────────────────────────────────────────────────────────────────────────────

export interface TwitchTokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  scope: string[];
}

export class TwitchAuthError extends Error {
  constructor(
    message: string,
    /** Twitch said no (bad code, revoked refresh token) rather than failing to answer. */
    readonly refused: boolean,
  ) {
    super(message);
    this.name = 'TwitchAuthError';
  }
}

function readTokenSet(j: Record<string, unknown>): TwitchTokenSet {
  if (typeof j.access_token !== 'string' || !j.access_token) throw new TwitchAuthError('Twitch sent no token', false);
  return {
    accessToken: j.access_token,
    refreshToken: typeof j.refresh_token === 'string' ? j.refresh_token : null,
    expiresIn: typeof j.expires_in === 'number' ? j.expires_in : 3600,
    scope: Array.isArray(j.scope) ? j.scope.filter((s): s is string => typeof s === 'string') : [],
  };
}

async function tokenRequest(cfg: TwitchConfig, form: Record<string, string>, f: FetchLike): Promise<TwitchTokenSet> {
  const res = await f(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, ...form }).toString(),
  });
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    throw new TwitchAuthError(`Twitch refused (${res.status})`, true);
  }
  if (!res.ok) throw new TwitchAuthError(`Twitch token endpoint failed (${res.status})`, false);
  return readTokenSet((await res.json()) as Record<string, unknown>);
}

export function exchangeCode(cfg: TwitchConfig, code: string, f: FetchLike = fetch): Promise<TwitchTokenSet> {
  return tokenRequest(cfg, { code, grant_type: 'authorization_code', redirect_uri: cfg.redirectUri }, f);
}

export function refreshToken(cfg: TwitchConfig, refresh: string, f: FetchLike = fetch): Promise<TwitchTokenSet> {
  return tokenRequest(cfg, { grant_type: 'refresh_token', refresh_token: refresh }, f);
}

/** Best-effort: a viewer's token has done its one job. Never throws. */
export async function revokeToken(cfg: TwitchConfig, token: string, f: FetchLike = fetch): Promise<void> {
  try {
    await f(REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: cfg.clientId, token }).toString(),
    });
  } catch {
    // ignore — it expires on its own
  }
}

export function hasHostScopes(scope: string[]): boolean {
  return HOST_SCOPES.every((s) => scope.includes(s));
}

// ── Helix ────────────────────────────────────────────────────────────────────────────────────────

export interface TwitchUser {
  id: string;
  login: string;
  /** 'affiliate' | 'partner' | '' — only the first two can have subscribers. */
  broadcasterType: string;
}

export function canHaveSubs(broadcasterType: string | null | undefined): boolean {
  return broadcasterType === 'affiliate' || broadcasterType === 'partner';
}

const TWITCH_ID = /^\d{1,20}$/;
const TWITCH_LOGIN = /^[a-z0-9_]{1,25}$/;

function helix(cfg: TwitchConfig, token: string, path: string, f: FetchLike): Promise<Response> {
  return f(`${HELIX}${path}`, { headers: { 'Client-Id': cfg.clientId, Authorization: `Bearer ${token}` } });
}

/** Who this token belongs to. Throws on anything but a well-formed answer. */
export async function fetchUser(cfg: TwitchConfig, token: string, f: FetchLike = fetch): Promise<TwitchUser> {
  const res = await helix(cfg, token, '/users', f);
  if (!res.ok) throw new TwitchAuthError(`Twitch /users failed (${res.status})`, res.status === 401);
  const j = (await res.json()) as { data?: { id?: unknown; login?: unknown; broadcaster_type?: unknown }[] };
  const u = j.data?.[0];
  const id = typeof u?.id === 'string' ? u.id : '';
  const login = typeof u?.login === 'string' ? u.login.toLowerCase() : '';
  if (!TWITCH_ID.test(id) || !TWITCH_LOGIN.test(login)) throw new TwitchAuthError('Twitch sent an odd user', false);
  const bt = u?.broadcaster_type;
  return { id, login, broadcasterType: bt === 'affiliate' || bt === 'partner' ? bt : '' };
}

/**
 * The answer to one broadcaster-token read: a value, "the token is no good" (refresh and retry), or
 * "Twitch did not answer" (an outage — fail closed, do not cache).
 */
export type HelixResult<T> = { ok: true; value: T } | { ok: false; reason: 'unauthorized' | 'error' };

async function broadcasterRead(
  cfg: TwitchConfig,
  token: string,
  path: string,
  f: FetchLike,
): Promise<HelixResult<unknown[]>> {
  let res: Response;
  try {
    res = await helix(cfg, token, path, f);
  } catch {
    return { ok: false, reason: 'error' };
  }
  if (res.status === 401) return { ok: false, reason: 'unauthorized' };
  if (!res.ok) return { ok: false, reason: 'error' };
  const j = (await res.json().catch(() => null)) as { data?: unknown } | null;
  return { ok: true, value: Array.isArray(j?.data) ? j!.data : [] };
}

/** Does `userId` follow `broadcasterId`? */
export async function followsChannel(
  cfg: TwitchConfig,
  broadcasterToken: string,
  broadcasterId: string,
  userId: string,
  f: FetchLike = fetch,
): Promise<HelixResult<boolean>> {
  const q = new URLSearchParams({ broadcaster_id: broadcasterId, user_id: userId });
  const r = await broadcasterRead(cfg, broadcasterToken, `/channels/followers?${q}`, f);
  if (!r.ok) return r;
  return { ok: true, value: r.value.some((row) => (row as { user_id?: unknown })?.user_id === userId) };
}

/** `userId`'s subscription tier to `broadcasterId` as Twitch's raw string, or null when not subscribed. */
export async function subscriptionTier(
  cfg: TwitchConfig,
  broadcasterToken: string,
  broadcasterId: string,
  userId: string,
  f: FetchLike = fetch,
): Promise<HelixResult<string | null>> {
  const q = new URLSearchParams({ broadcaster_id: broadcasterId, user_id: userId });
  const r = await broadcasterRead(cfg, broadcasterToken, `/subscriptions?${q}`, f);
  if (!r.ok) return r;
  const row = r.value.find((x) => (x as { user_id?: unknown })?.user_id === userId) as { tier?: unknown } | undefined;
  return { ok: true, value: typeof row?.tier === 'string' ? row.tier : null };
}
