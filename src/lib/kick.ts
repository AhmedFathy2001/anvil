// Kick — OAuth 2.1 (PKCE), the few public-API calls Anvil makes, and webhook signature checks. No
// database import, so it is tested with a mocked fetch (tests/kick-gates.test.ts).
//
// WHAT KICK'S API CAN AND CANNOT DO (docs.kick.com, github.com/KickEngineering/KickDevDocs):
//
//   - There is NO "does X follow / subscribe to Y" lookup. Followers and subscribers only arrive as
//     WEBHOOK events (channel.followed, channel.subscription.new|renewal|gifts), from the moment a
//     subscription exists, and chat messages (chat.message.sent) carry the sender's badges. So Anvil
//     REMEMBERS what Kick tells it (lib/gates/kickDb) instead of asking.
//   - Webhooks are signed: RSA (PKCS#1 v1.5, SHA-256) over `${message id}.${timestamp}.${raw body}`,
//     Kick's public key from GET /public/v1/public-key (fetched, never hardcoded — it may rotate).
//   - Kick subscriptions have no tiers in the API, so a Kick sub gate is "any sub".
//   - There is no unfollow event: a recorded follow stands.
//
// THE HOST'S TOKEN. Connecting a channel grants user:read + channel:read (who they are and their
// channel slug), events:subscribe (webhooks for their channel) and chat:write ("allow chat bots to
// post in your chat" — how `!join` replies, see lib/gates/kickChat).
//
// CONFIGURED = KICK_CLIENT_ID + KICK_CLIENT_SECRET + KICK_REDIRECT_URI + a token key of ≥32 chars
// (KICK_TOKEN_KEY, else TWITCH_TOKEN_KEY). Missing any → every Kick option is hidden.

import crypto from 'crypto';

const ID_HOST = 'https://id.kick.com';
const API = 'https://api.kick.com/public/v1';

/** What the host's channel token must carry. */
export const KICK_HOST_SCOPES = ['user:read', 'channel:read', 'events:subscribe', 'chat:write'] as const;

/** The webhook events Anvil subscribes a connected channel to. */
export const KICK_EVENTS = [
  'chat.message.sent',
  'channel.followed',
  'channel.subscription.new',
  'channel.subscription.renewal',
  'channel.subscription.gifts',
] as const;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface KickConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenKey: string;
}

export function kickConfig(env: Record<string, string | undefined> = process.env): KickConfig | null {
  const clientId = env.KICK_CLIENT_ID?.trim();
  const clientSecret = env.KICK_CLIENT_SECRET?.trim();
  const redirectUri = env.KICK_REDIRECT_URI?.trim();
  const tokenKey = (env.KICK_TOKEN_KEY?.trim() || env.TWITCH_TOKEN_KEY?.trim()) ?? '';
  if (!clientId || !clientSecret || !redirectUri || tokenKey.length < 32) return null;
  return { clientId, clientSecret, redirectUri, tokenKey };
}

export function kickConfigured(env?: Record<string, string | undefined>): boolean {
  return kickConfig(env) !== null;
}

// ── OAuth state + PKCE ───────────────────────────────────────────────────────────────────────────
//
// Only the HOST does OAuth (viewers prove themselves with a chat code). The state is signed and names
// who pressed the button, which space, where to return, and a nonce that must match an httpOnly
// cookie set by /start. The PKCE verifier is DERIVED from the nonce with a server-only key, so it is
// never stored and never seen by the browser.

export interface KickState {
  /** users.id of whoever pressed the button. */
  u: number;
  /** The creator space being connected. */
  c: number;
  /** Site-relative path to come back to (re-sanitized at the callback). */
  r: string;
  /** Clan host to come back to, re-resolved against the clans table at the callback. */
  h: string | null;
  /** Matches the nonce cookie. */
  n: string;
  /** Expiry, ms since epoch. */
  e: number;
}

export const KICK_STATE_TTL_MS = 10 * 60_000;
export const KICK_NONCE_COOKIE = 'kick_oauth_nonce';

function derivedKey(tokenKey: string, label: string): Buffer {
  return crypto.createHash('sha256').update(`anvil-kick-${label}:${tokenKey}`).digest();
}

export function signKickState(state: KickState, tokenKey: string): string {
  const body = Buffer.from(JSON.stringify(state)).toString('base64url');
  const mac = crypto.createHmac('sha256', derivedKey(tokenKey, 'state')).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function verifyKickState(token: string | null | undefined, tokenKey: string, now = Date.now()): KickState | null {
  if (typeof token !== 'string' || token.length > 2048) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, mac] = parts;
  const expected = crypto.createHmac('sha256', derivedKey(tokenKey, 'state')).update(body).digest();
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  let s: KickState;
  try {
    s = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!s || typeof s !== 'object') return null;
  if (!Number.isInteger(s.u) || s.u <= 0 || !Number.isInteger(s.c) || s.c <= 0) return null;
  if (typeof s.r !== 'string' || typeof s.n !== 'string' || s.n.length < 16) return null;
  if (s.h != null && typeof s.h !== 'string') return null;
  if (typeof s.e !== 'number' || s.e <= now) return null;
  return s;
}

export function newKickNonce(): string {
  return crypto.randomBytes(18).toString('base64url');
}

/** RFC 7636 verifier for this nonce: 43 base64url chars, reproducible only with the server key. */
export function pkceVerifier(nonce: string, tokenKey: string): string {
  return crypto.createHmac('sha256', derivedKey(tokenKey, 'pkce')).update(nonce).digest('base64url');
}

export function pkceChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function kickAuthorizeUrl(cfg: KickConfig, state: string, challenge: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: KICK_HOST_SCOPES.join(' '),
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  });
  return `${ID_HOST}/oauth/authorize?${params.toString()}`;
}

// ── Tokens ───────────────────────────────────────────────────────────────────────────────────────

export interface KickTokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  scope: string[];
}

export class KickAuthError extends Error {
  constructor(
    message: string,
    /** Kick said no (bad code, revoked refresh token) rather than failing to answer. */
    readonly refused: boolean,
  ) {
    super(message);
    this.name = 'KickAuthError';
  }
}

function readTokenSet(j: Record<string, unknown>): KickTokenSet {
  if (typeof j.access_token !== 'string' || !j.access_token) throw new KickAuthError('Kick sent no token', false);
  const exp = Number(j.expires_in);
  const scope = Array.isArray(j.scope)
    ? j.scope.filter((s): s is string => typeof s === 'string')
    : typeof j.scope === 'string'
      ? j.scope.split(/\s+/).filter(Boolean)
      : [];
  return {
    accessToken: j.access_token,
    refreshToken: typeof j.refresh_token === 'string' && j.refresh_token ? j.refresh_token : null,
    expiresIn: Number.isFinite(exp) && exp > 0 ? exp : 3600,
    scope,
  };
}

async function tokenRequest(cfg: Pick<KickConfig, 'clientId' | 'clientSecret'>, form: Record<string, string>, f: FetchLike): Promise<KickTokenSet> {
  let res: Response;
  try {
    res = await f(`${ID_HOST}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, ...form }).toString(),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw new KickAuthError(`Kick token endpoint unreachable: ${(err as Error).message}`, false);
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) throw new KickAuthError(`Kick refused (${res.status})`, true);
  if (!res.ok) throw new KickAuthError(`Kick token endpoint failed (${res.status})`, false);
  return readTokenSet((await res.json()) as Record<string, unknown>);
}

export function exchangeKickCode(cfg: KickConfig, code: string, verifier: string, f: FetchLike = fetch): Promise<KickTokenSet> {
  return tokenRequest(cfg, { grant_type: 'authorization_code', code, redirect_uri: cfg.redirectUri, code_verifier: verifier }, f);
}

export function refreshKickToken(cfg: Pick<KickConfig, 'clientId' | 'clientSecret'>, refresh: string, f: FetchLike = fetch): Promise<KickTokenSet> {
  return tokenRequest(cfg, { grant_type: 'refresh_token', refresh_token: refresh }, f);
}

/** App access token (client credentials) — used to drop a channel's webhook subscriptions. */
export function kickAppToken(cfg: KickConfig, f: FetchLike = fetch): Promise<KickTokenSet> {
  return tokenRequest(cfg, { grant_type: 'client_credentials' }, f);
}

/** Best-effort revoke. Never throws. */
export async function revokeKickToken(token: string, f: FetchLike = fetch): Promise<void> {
  try {
    const q = new URLSearchParams({ token, token_hint_type: 'access_token' });
    await f(`${ID_HOST}/oauth/revoke?${q}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  } catch {
    // ignore — it expires on its own
  }
}

export function hasKickHostScopes(scope: string[]): boolean {
  return KICK_HOST_SCOPES.every((s) => scope.includes(s));
}

// ── Public API ───────────────────────────────────────────────────────────────────────────────────

/** Kick user ids are integers; carried as decimal strings. */
export function isKickUserId(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9]{1,20}$/.test(v);
}

/** A number or numeric string from a Kick payload → id string, or null. */
export function kickIdOf(v: unknown): string | null {
  if (typeof v === 'number' && Number.isSafeInteger(v) && v > 0) return String(v);
  if (typeof v === 'string' && isKickUserId(v) && v !== '0') return v;
  return null;
}

const SLUG = /^[a-z0-9_-]{1,40}$/;

/** Kick channel slugs as we store and show them: lowercase, [a-z0-9_-]. Anything else → null. */
export function cleanKickSlug(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return SLUG.test(s) ? s : null;
}

/** A display name from Kick, safe to store and show: no control characters, ≤ 40 chars. */
export function cleanKickName(v: unknown): string {
  return String(v ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, '')
    .trim()
    .slice(0, 40);
}

export type KickResult<T> = { ok: true; value: T } | { ok: false; reason: 'unauthorized' | 'error' };

async function api(token: string, path: string, init: RequestInit, f: FetchLike): Promise<KickResult<unknown>> {
  let res: Response;
  try {
    res = await f(`${API}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, reason: 'error' };
  }
  if (res.status === 401) return { ok: false, reason: 'unauthorized' };
  if (!res.ok) return { ok: false, reason: 'error' };
  if (res.status === 204) return { ok: true, value: null };
  const j = (await res.json().catch(() => null)) as { data?: unknown } | null;
  return { ok: true, value: j?.data ?? null };
}

export interface KickChannelOwner {
  userId: string;
  slug: string;
}

/** The token's own channel: GET /channels with no parameters (user:read + channel:read). */
export async function fetchOwnChannel(token: string, f: FetchLike = fetch): Promise<KickChannelOwner> {
  const r = await api(token, '/channels', {}, f);
  if (!r.ok) throw new KickAuthError(`Kick /channels failed (${r.reason})`, r.reason === 'unauthorized');
  const row = (Array.isArray(r.value) ? r.value[0] : null) as { broadcaster_user_id?: unknown; slug?: unknown } | null;
  const userId = kickIdOf(row?.broadcaster_user_id);
  const slug = cleanKickSlug(row?.slug);
  if (!userId || !slug) throw new KickAuthError('Kick sent an odd channel', false);
  return { userId, slug };
}

/** Subscribe the token's channel to Anvil's webhook events. Returns the subscription ids made. */
export async function subscribeChannelEvents(token: string, f: FetchLike = fetch): Promise<KickResult<string[]>> {
  const r = await api(
    token,
    '/events/subscriptions',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'webhook', events: KICK_EVENTS.map((name) => ({ name, version: 1 })) }),
    },
    f,
  );
  if (!r.ok) return r;
  const ids = (Array.isArray(r.value) ? r.value : [])
    .map((x) => (x as { subscription_id?: unknown })?.subscription_id)
    .filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length < 100);
  return { ok: true, value: ids };
}

/** Drop every webhook subscription this app holds for a broadcaster (app token). */
export async function unsubscribeChannelEvents(appToken: string, broadcasterId: string, f: FetchLike = fetch): Promise<boolean> {
  const list = await api(appToken, `/events/subscriptions?broadcaster_user_id=${encodeURIComponent(broadcasterId)}`, {}, f);
  if (!list.ok) return false;
  const ids = (Array.isArray(list.value) ? list.value : [])
    .filter((x) => kickIdOf((x as { broadcaster_user_id?: unknown })?.broadcaster_user_id) === broadcasterId)
    .map((x) => (x as { id?: unknown })?.id)
    .filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length < 100);
  if (ids.length === 0) return true;
  const q = new URLSearchParams();
  for (const id of ids) q.append('id', id);
  const del = await api(appToken, `/events/subscriptions?${q}`, { method: 'DELETE' }, f);
  return del.ok;
}

/** Kick's cap on a chat message, and a hard UTF-8 byte cap. */
export const KICK_MAX_CHAT_CHARS = 500;
const KICK_MAX_CHAT_BYTES = 2048;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /chat. `type: 'bot'` posts as the APP's bot account into the channel the token belongs to
 * (the host's token, chat:write); `type: 'user'` posts as the token's own user into
 * `broadcasterUserId` (the bot account's token).
 */
export async function postKickChat(
  token: string,
  msg: { type: 'bot' | 'user'; content: string; broadcasterUserId?: string; replyTo?: string | null },
  f: FetchLike = fetch,
): Promise<KickResult<{ sent: boolean }>> {
  let content = msg.content.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  if ([...content].length > KICK_MAX_CHAT_CHARS) content = `${[...content].slice(0, KICK_MAX_CHAT_CHARS - 1).join('')}…`;
  while (Buffer.byteLength(content, 'utf8') > KICK_MAX_CHAT_BYTES) content = content.slice(0, -1);
  const body: Record<string, unknown> = { type: msg.type, content };
  if (msg.type === 'user') {
    const b = Number(msg.broadcasterUserId);
    if (!Number.isSafeInteger(b) || b <= 0) return { ok: false, reason: 'error' };
    body.broadcaster_user_id = b;
  }
  if (msg.replyTo && UUID.test(msg.replyTo)) body.reply_to_message_id = msg.replyTo;
  const r = await api(token, '/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, f);
  if (!r.ok) return r;
  const sent = (r.value as { is_sent?: unknown } | null)?.is_sent;
  return { ok: true, value: { sent: sent !== false } };
}

// ── Webhook signatures ──────────────────────────────────────────────────────────────────────────

export const KICK_PUBLIC_KEY_URL = `${API}/public-key`;

/** The PEM from GET /public/v1/public-key ({ data: { public_key } }). Throws on anything else. */
export async function fetchKickPublicKey(f: FetchLike = fetch): Promise<string> {
  const res = await f(KICK_PUBLIC_KEY_URL, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Kick public key fetch failed (${res.status})`);
  const j = (await res.json()) as { data?: { public_key?: unknown } };
  const pem = j?.data?.public_key;
  if (typeof pem !== 'string' || !pem.includes('BEGIN PUBLIC KEY')) throw new Error('Kick public key malformed');
  return pem;
}

/**
 * Is this request signed by Kick? RSA PKCS#1 v1.5 / SHA-256 over `${messageId}.${timestamp}.${body}`,
 * the signature base64 in Kick-Event-Signature. False on anything malformed — never throws.
 */
export function verifyKickSignature(
  publicKeyPem: string,
  messageId: string,
  timestamp: string,
  rawBody: string,
  signatureB64: string,
): boolean {
  try {
    if (!messageId || !timestamp || !signatureB64 || signatureB64.length > 2048) return false;
    const sig = Buffer.from(signatureB64, 'base64');
    if (sig.length === 0) return false;
    return crypto.verify('sha256', Buffer.from(`${messageId}.${timestamp}.${rawBody}`), publicKeyPem, sig);
  } catch {
    return false;
  }
}

/** How far a webhook's Kick-Event-Message-Timestamp may be from now. Older is a replay. */
export const KICK_WEBHOOK_MAX_AGE_MS = 10 * 60_000;
const KICK_WEBHOOK_MAX_SKEW_MS = 2 * 60_000;

export function webhookTimestampOk(timestamp: string, now = Date.now()): boolean {
  if (typeof timestamp !== 'string' || timestamp.length > 64) return false;
  const t = Date.parse(timestamp);
  if (!Number.isFinite(t)) return false;
  return t <= now + KICK_WEBHOOK_MAX_SKEW_MS && now - t <= KICK_WEBHOOK_MAX_AGE_MS;
}
