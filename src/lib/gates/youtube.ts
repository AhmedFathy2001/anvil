// YouTube — the OAuth round trip, the Data API v3 reads the entry gates need, and the YouTube half of
// the gate words. No database import, so it is tested with a mocked fetch (tests/youtube-gates.test.ts).
//
// WHAT YOUTUBE LETS A THIRD-PARTY APP CHECK (Data API v3, checked 2026-11):
//
//   subscriber?  subscriptions.list?mine=true&forChannelId=<host>   — VIEWER's token, youtube.readonly,
//                1 unit. There is no host-side "does X subscribe to me": mySubscribers only pages the
//                host's (public, capped) subscriber list. So the viewer proves it once, here.
//   member?      members.list (youtube.channel-memberships.creator) is RESTRICTED — "Reach out to your
//                Google or YouTube representative to request access". Not usable by Anvil today.
//                Instead the viewer types a short code in the host's LIVE chat, and the chat message's
//                authorDetails.isChatSponsor (= channel member) answers it, read on the HOST's token:
//                liveBroadcasts.list?broadcastStatus=active (1 unit) + liveChatMessages.list (5 units).
//
// Both proofs are point-in-time and kept for a day (lib/gates/youtubeDb). The viewer's token is used
// for its two reads and revoked at once — never stored. The host's token (youtube.readonly only) is
// stored encrypted with lib/secretBox under YOUTUBE_TOKEN_KEY, refreshed, and marked broken when Google
// refuses the refresh.
//
// CONFIGURED = YOUTUBE_CLIENT_ID + YOUTUBE_CLIENT_SECRET + YOUTUBE_REDIRECT_URI + YOUTUBE_TOKEN_KEY
// (≥32 chars). Missing any → every YouTube option is hidden and no YouTube route does anything.

import crypto from 'crypto';

import type { EntryGates, GateRule } from '@/lib/entryGates';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const API = 'https://www.googleapis.com/youtube/v3';

/** The one scope Anvil asks for, of viewer and host alike: read-only YouTube. */
export const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface YoutubeConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenKey: string;
}

export function youtubeConfig(env: Record<string, string | undefined> = process.env): YoutubeConfig | null {
  const clientId = env.YOUTUBE_CLIENT_ID?.trim();
  const clientSecret = env.YOUTUBE_CLIENT_SECRET?.trim();
  const redirectUri = env.YOUTUBE_REDIRECT_URI?.trim();
  const tokenKey = env.YOUTUBE_TOKEN_KEY?.trim();
  if (!clientId || !clientSecret || !redirectUri || !tokenKey || tokenKey.length < 32) return null;
  return { clientId, clientSecret, redirectUri, tokenKey };
}

export function youtubeConfigured(env?: Record<string, string | undefined>): boolean {
  return youtubeConfig(env) !== null;
}

// ── Gate rules (pure; lib/entryGates calls these) ────────────────────────────────────────────────

export type YoutubeRule = Extract<GateRule, { kind: 'youtube-sub' | 'youtube-member' }>;

export function isYoutubeRule(r: GateRule): r is YoutubeRule {
  return r.kind === 'youtube-sub' || r.kind === 'youtube-member';
}

export function usesYoutube(gates: EntryGates | null | undefined): boolean {
  return !!gates?.anyOf.some(isYoutubeRule);
}

export function youtubeRuleLabel(rule: YoutubeRule, channelTitle: string | null | undefined): string {
  const ch = channelTitle || 'the host';
  return rule.kind === 'youtube-sub' ? `subscribers of ${ch} on YouTube` : `members of ${ch} on YouTube`;
}

/** Why a YouTube question could not be answered (cf. TwitchUnknown). */
export type YoutubeUnknown =
  /** YOUTUBE_* env not set. */
  | 'off'
  /** The host has not connected their channel, or Google refused its token. */
  | 'host-missing'
  /** No proof on file (never checked, or older than a day). */
  | 'unchecked';

export type YoutubeAnswer = { state: 'ok'; value: boolean } | { state: YoutubeUnknown };

/** The step a failed YouTube rule adds to the join card, and which button it needs. */
export function youtubeStep(
  rule: YoutubeRule,
  a: YoutubeAnswer,
  channelTitle: string | null | undefined,
): { step: string; verify?: true; chatCode?: true } {
  const ch = channelTitle || 'the host';
  if (a.state === 'off' || a.state === 'host-missing') {
    return { step: 'The host’s YouTube connection isn’t working — let them know' };
  }
  if (rule.kind === 'youtube-sub') {
    return a.state === 'unchecked'
      ? { step: `Check your YouTube subscription to ${ch}`, verify: true }
      : { step: `Subscribe to ${ch} on YouTube, then check again`, verify: true };
  }
  return a.state === 'unchecked'
    ? { step: `While ${ch} is live, type your Anvil code in the YouTube chat from your linked account (members only)`, chatCode: true }
    : { step: `Become a member of ${ch} on YouTube, then type your code in a live chat again`, chatCode: true };
}

// ── The live-chat code (member gate) ─────────────────────────────────────────────────────────────
//
// STATELESS: HMAC(user, host channel) — the same person always gets the same code for the same host,
// nothing to store or expire. The code only names WHICH Anvil login a chat message speaks for; the
// membership is read from the message's author. Typing someone else's code helps only them, and only
// if the typer is a member — the same as lending an account, which the one-channel-per-event claim
// (event_gate_claims, platform 'youtube') already bounds.

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I

export function chatCode(userId: number, hostChannelId: string, tokenKey: string): string {
  const mac = crypto
    .createHmac('sha256', crypto.createHash('sha256').update(`anvil-youtube-chat:${tokenKey}`).digest())
    .update(`${userId}:${hostChannelId}`)
    .digest();
  let out = '';
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[mac[i] % CODE_ALPHABET.length];
  return `ANVIL-${out}`;
}

/** Does this chat text carry the code? Case, spaces and the dash are forgiven (phones autocorrect). */
export function messageHasCode(text: unknown, code: string): boolean {
  if (typeof text !== 'string') return false;
  const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return norm(text.slice(0, 500)).includes(norm(code));
}

export interface ChatSighting {
  channelId: string;
  displayName: string;
  /** authorDetails.isChatSponsor — a channel member. */
  member: boolean;
}

/** The NEWEST chat message carrying the code — only from `fromChannel` when given — if any. */
export function findCodeInChat(items: unknown, code: string, fromChannel?: string): ChatSighting | null {
  if (!Array.isArray(items)) return null;
  for (let i = items.length - 1; i >= 0; i--) {
    const m = items[i] as {
      snippet?: { type?: unknown; textMessageDetails?: { messageText?: unknown }; displayMessage?: unknown };
      authorDetails?: { channelId?: unknown; displayName?: unknown; isChatSponsor?: unknown };
    };
    if (m?.snippet?.type !== 'textMessageEvent') continue;
    const text = m.snippet.textMessageDetails?.messageText ?? m.snippet.displayMessage;
    if (!messageHasCode(text, code)) continue;
    const channelId = m.authorDetails?.channelId;
    if (!isChannelId(channelId)) continue;
    if (fromChannel !== undefined && channelId !== fromChannel) continue;
    return { channelId, displayName: cleanTitle(m.authorDetails?.displayName), member: m.authorDetails?.isChatSponsor === true };
  }
  return null;
}

// ── OAuth state ──────────────────────────────────────────────────────────────────────────────────
//
// Signed; carries who started it, for what, and where to return. The callback also requires the
// nonce cookie set by /start and the same logged-in user (as lib/twitch).

export type YoutubeLinkMode = 'viewer' | 'host';

export interface YoutubeState {
  /** users.id of whoever pressed the button. */
  u: number;
  m: YoutubeLinkMode;
  /** Host: the creator space being connected. Viewer: the EVENT whose host they are checking against. */
  c: number;
  /** Site-relative path to come back to (re-sanitized at the callback). */
  r: string;
  /** Clan host to come back to, re-resolved against the clans table at the callback. */
  h: string | null;
  n: string;
  e: number;
}

export const STATE_TTL_MS = 10 * 60_000;
export const YOUTUBE_NONCE_COOKIE = 'youtube_oauth_nonce';

function stateKey(tokenKey: string): Buffer {
  return crypto.createHash('sha256').update(`anvil-youtube-state:${tokenKey}`).digest();
}

export function signState(state: YoutubeState, tokenKey: string): string {
  const body = Buffer.from(JSON.stringify(state)).toString('base64url');
  const mac = crypto.createHmac('sha256', stateKey(tokenKey)).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function verifyState(token: string | null | undefined, tokenKey: string, now = Date.now()): YoutubeState | null {
  if (typeof token !== 'string' || token.length > 2048) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, mac] = parts;
  const expected = crypto.createHmac('sha256', stateKey(tokenKey)).update(body).digest();
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  let s: YoutubeState;
  try {
    s = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!s || typeof s !== 'object') return null;
  if (!Number.isInteger(s.u) || s.u <= 0) return null;
  if (s.m !== 'viewer' && s.m !== 'host') return null;
  if (!Number.isInteger(s.c) || s.c <= 0) return null;
  if (typeof s.r !== 'string' || typeof s.n !== 'string' || s.n.length < 16) return null;
  if (s.h != null && typeof s.h !== 'string') return null;
  if (typeof s.e !== 'number' || s.e <= now) return null;
  return s;
}

export function newNonce(): string {
  return crypto.randomBytes(18).toString('base64url');
}

export function authorizeUrl(cfg: YoutubeConfig, mode: YoutubeLinkMode, state: string): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: YOUTUBE_SCOPE,
    state,
    include_granted_scopes: 'false',
  });
  if (mode === 'host') {
    // A refresh token is only issued with offline access, and only re-issued on a fresh consent.
    params.set('access_type', 'offline');
    params.set('prompt', 'consent select_account');
  } else {
    // A Google account can own several channels (brand accounts): let them pick the one they use.
    params.set('access_type', 'online');
    params.set('prompt', 'select_account');
  }
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

// ── Tokens ───────────────────────────────────────────────────────────────────────────────────────

export interface YoutubeTokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  scope: string[];
}

export class YoutubeAuthError extends Error {
  constructor(
    message: string,
    /** Google said no (bad code, revoked or expired refresh token) rather than failing to answer. */
    readonly refused: boolean,
  ) {
    super(message);
    this.name = 'YoutubeAuthError';
  }
}

async function tokenRequest(cfg: YoutubeConfig, form: Record<string, string>, f: FetchLike): Promise<YoutubeTokenSet> {
  const res = await f(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, ...form }).toString(),
  });
  // invalid_grant (400) is the revoked/expired refresh token; 401 invalid_client a bad secret.
  if (res.status === 400 || res.status === 401) throw new YoutubeAuthError(`Google refused (${res.status})`, true);
  if (!res.ok) throw new YoutubeAuthError(`Google token endpoint failed (${res.status})`, false);
  const j = (await res.json()) as Record<string, unknown>;
  if (typeof j.access_token !== 'string' || !j.access_token) throw new YoutubeAuthError('Google sent no token', false);
  return {
    accessToken: j.access_token,
    refreshToken: typeof j.refresh_token === 'string' ? j.refresh_token : null,
    expiresIn: typeof j.expires_in === 'number' ? j.expires_in : 3600,
    scope: typeof j.scope === 'string' ? j.scope.split(/\s+/).filter(Boolean) : [],
  };
}

export function exchangeCode(cfg: YoutubeConfig, code: string, f: FetchLike = fetch): Promise<YoutubeTokenSet> {
  return tokenRequest(cfg, { code, grant_type: 'authorization_code', redirect_uri: cfg.redirectUri }, f);
}

export function refreshToken(cfg: YoutubeConfig, refresh: string, f: FetchLike = fetch): Promise<YoutubeTokenSet> {
  return tokenRequest(cfg, { grant_type: 'refresh_token', refresh_token: refresh }, f);
}

/** Best-effort revoke (a viewer's token has done its job; a host disconnecting). Never throws. */
export async function revokeToken(token: string, f: FetchLike = fetch): Promise<void> {
  try {
    await f(REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    });
  } catch {
    // ignore — it expires on its own
  }
}

export function hasYoutubeScope(scope: string[]): boolean {
  return scope.includes(YOUTUBE_SCOPE);
}

// ── Data API reads ───────────────────────────────────────────────────────────────────────────────

const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;

export function isChannelId(v: unknown): v is string {
  return typeof v === 'string' && CHANNEL_ID.test(v);
}

/** A channel title / display name for display only: no control chars, at most 100. */
export function cleanTitle(v: unknown): string {
  return String(v ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 100);
}

export interface YoutubeChannel {
  id: string;
  title: string;
  /** "@handle" when the channel has one, else null. */
  handle: string | null;
}

/** A read's answer: a value, "the token is no good", "Google did not answer", or a named API refusal. */
export type ApiResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'unauthorized' | 'error' | 'quota' }
  | { ok: false; reason: 'forbidden' | 'not-found'; detail: string };

async function apiGet(token: string, path: string, f: FetchLike): Promise<ApiResult<Record<string, unknown>>> {
  let res: Response;
  try {
    res = await f(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    return { ok: false, reason: 'error' };
  }
  if (res.status === 401) return { ok: false, reason: 'unauthorized' };
  const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.ok) return { ok: true, value: j ?? {} };
  const errs = ((j?.error as { errors?: { reason?: unknown }[] } | undefined)?.errors ?? []).map((e) => String(e?.reason ?? ''));
  if (errs.some((r) => r === 'quotaExceeded' || r === 'rateLimitExceeded' || r === 'userRateLimitExceeded')) {
    return { ok: false, reason: 'quota' };
  }
  if (res.status === 403) return { ok: false, reason: 'forbidden', detail: errs[0] || 'forbidden' };
  if (res.status === 404) return { ok: false, reason: 'not-found', detail: errs[0] || 'notFound' };
  return { ok: false, reason: 'error' };
}

/** The channel this token speaks for. ok:true value:null = a Google account with no YouTube channel. */
export async function fetchMyChannel(token: string, f: FetchLike = fetch): Promise<ApiResult<YoutubeChannel | null>> {
  const r = await apiGet(token, '/channels?part=snippet&mine=true&maxResults=1', f);
  if (!r.ok) return r;
  const item = (r.value.items as { id?: unknown; snippet?: { title?: unknown; customUrl?: unknown } }[] | undefined)?.[0];
  if (!item) return { ok: true, value: null };
  if (!isChannelId(item.id)) return { ok: false, reason: 'error' };
  const custom = typeof item.snippet?.customUrl === 'string' ? item.snippet.customUrl.trim() : '';
  const handle = /^@[A-Za-z0-9._-]{1,100}$/.test(custom) ? custom : null;
  return { ok: true, value: { id: item.id, title: cleanTitle(item.snippet?.title) || item.id, handle } };
}

/**
 * Does the token's own channel subscribe to `hostChannelId`? The viewer's own subscriptions are
 * readable to them whatever their privacy setting; 'forbidden' (subscriptionForbidden) is still
 * handled — the callback tells them to make subscriptions public and try again.
 */
export async function subscribesTo(token: string, hostChannelId: string, f: FetchLike = fetch): Promise<ApiResult<boolean>> {
  if (!isChannelId(hostChannelId)) return { ok: false, reason: 'error' };
  const q = new URLSearchParams({ part: 'id', mine: 'true', forChannelId: hostChannelId, maxResults: '1' });
  const r = await apiGet(token, `/subscriptions?${q}`, f);
  if (!r.ok) return r;
  return { ok: true, value: Array.isArray(r.value.items) && r.value.items.length > 0 };
}

/** The live chat of the token's channel's broadcast that is live RIGHT NOW, or null if none is. */
export async function activeLiveChatId(token: string, f: FetchLike = fetch): Promise<ApiResult<string | null>> {
  // broadcastStatus is itself a "mine" filter: it only ever lists the token owner's broadcasts.
  const q = new URLSearchParams({ part: 'snippet', broadcastStatus: 'active', broadcastType: 'all', maxResults: '5' });
  const r = await apiGet(token, `/liveBroadcasts?${q}`, f);
  if (!r.ok) return r;
  const items = (r.value.items as { snippet?: { liveChatId?: unknown } }[] | undefined) ?? [];
  const id = items.map((i) => i?.snippet?.liveChatId).find((x): x is string => typeof x === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(x));
  return { ok: true, value: id ?? null };
}

/**
 * The token's channel's recent broadcasts with their actual start and end (stream highlights' VOD
 * links, lib/highlights). One unit of quota per call; callers cache it.
 */
export async function recentBroadcasts(
  token: string,
  f: FetchLike = fetch,
): Promise<ApiResult<{ id: string; actualStartTime: string | null; actualEndTime: string | null }[]>> {
  const q = new URLSearchParams({ part: 'id,snippet', broadcastStatus: 'all', broadcastType: 'all', maxResults: '10' });
  const r = await apiGet(token, `/liveBroadcasts?${q}`, f);
  if (!r.ok) return r;
  const items = (r.value.items as { id?: unknown; snippet?: { actualStartTime?: unknown; actualEndTime?: unknown } }[] | undefined) ?? [];
  const iso = (v: unknown) => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : null);
  return {
    ok: true,
    value: items
      .filter((i) => typeof i?.id === 'string' && /^[A-Za-z0-9_-]{6,20}$/.test(i.id))
      .map((i) => ({ id: i.id as string, actualStartTime: iso(i.snippet?.actualStartTime), actualEndTime: iso(i.snippet?.actualEndTime) })),
  };
}

/** The live chat's recent messages (the first page of liveChatMessages.list is the recent history). */
export async function recentChat(token: string, liveChatId: string, f: FetchLike = fetch): Promise<ApiResult<unknown[]>> {
  const q = new URLSearchParams({ liveChatId, part: 'snippet,authorDetails', maxResults: '2000' });
  const r = await apiGet(token, `/liveChat/messages?${q}`, f);
  if (!r.ok) return r;
  return { ok: true, value: Array.isArray(r.value.items) ? r.value.items : [] };
}
