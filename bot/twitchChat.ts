// ─────────────────────────────────────────────────────────────────────────────────────────────────
// anvil-twitch-bot: answers `!join` in the Twitch chat of creator spaces that switched it on.
//
// Twitch's current chat-bot path, not IRC (legacy):
//   READ  — EventSub `channel.chat.message` over a WebSocket (wss://eventsub.wss.twitch.tv/ws), one
//           subscription per channel, condition { broadcaster_user_id, user_id: <bot> }, created with
//           the bot account's USER token (scope user:read:chat).
//   SEND  — POST /helix/chat/messages { broadcaster_id, sender_id, message, reply_parent_message_id }
//           with the same user token (scope user:write:chat).
// (To wear Twitch's "Chat Bot" badge instead, send with an APP token: that needs user:bot from the bot
//  account and channel:bot from each broadcaster — which the creator's Twitch link can ask for.)
//
// It holds no database access. Which channels to sit in and what to say there both come from the
// site (api/internal/twitch-bot, lib/twitchBot/channels), so every rule about a space's opt-in, its
// PROVED channel and its joinable event is the site's alone. Shared bits: src/lib/twitchBot/wire.
//
// Its own container off the site image, like the push server:
//   node --experimental-strip-types bot/twitchChat.ts        (npm run bot:twitch)
// Env: TWITCH_BOT_CLIENT_ID, TWITCH_BOT_CLIENT_SECRET, TWITCH_BOT_REFRESH_TOKEN (the bot account's,
// with user:read:chat + user:write:chat), PLAYER_SESSION_SECRET (the site's — the internal pass
// derives from it), SITE_INTERNAL_URL (http://anvil-site:3000). Optional: TWITCH_BOT_COOLDOWN_MS.
// Without the three TWITCH_BOT_* values it logs that it is off and exits 0.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

import {
  ReplyLimiter,
  botSecret,
  cleanChatMessage,
  joinTriggerOf,
  type BotChannelsAnswer,
  type BotJoinAnswer,
} from '../src/lib/twitchBot/wire.ts';

const EVENTSUB_WS = 'wss://eventsub.wss.twitch.tv/ws';
const HELIX = 'https://api.twitch.tv/helix';
const ID = 'https://id.twitch.tv/oauth2';
/** How often the channel list is re-read from the site (a host flipping the switch). */
const SYNC_MS = 5 * 60_000;

const clientId = process.env.TWITCH_BOT_CLIENT_ID ?? '';
const clientSecret = process.env.TWITCH_BOT_CLIENT_SECRET ?? '';
let refreshToken = process.env.TWITCH_BOT_REFRESH_TOKEN ?? '';
const secret = process.env.PLAYER_SESSION_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-player-secret');
const site = (process.env.SITE_INTERNAL_URL || 'http://anvil-site:3000').replace(/\/$/, '');

function log(event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...fields }));
}

if (!clientId || !clientSecret || !refreshToken) {
  log('bot.disabled', { reason: 'TWITCH_BOT_CLIENT_ID, TWITCH_BOT_CLIENT_SECRET and TWITCH_BOT_REFRESH_TOKEN are not all set' });
  process.exit(0);
}
if (!secret) {
  log('bot.disabled', { reason: 'PLAYER_SESSION_SECRET is required' });
  process.exit(1);
}
const sitePass = botSecret(secret);
const limiter = new ReplyLimiter({ channelMs: Number(process.env.TWITCH_BOT_COOLDOWN_MS) || undefined });

// ── Tokens ───────────────────────────────────────────────────────────────────────────────────────

let accessToken = '';
let botUserId = '';

async function refresh(): Promise<void> {
  const res = await fetch(`${ID}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`token refresh failed: ${res.status}`);
  const d = (await res.json()) as { access_token: string; refresh_token?: string };
  accessToken = d.access_token;
  // Twitch may hand back a new refresh token; keep using the newest for the life of this process.
  if (d.refresh_token) refreshToken = d.refresh_token;
  const v = await fetch(`${ID}/validate`, { headers: { Authorization: `OAuth ${accessToken}` }, signal: AbortSignal.timeout(15_000) });
  if (!v.ok) throw new Error(`token validate failed: ${v.status}`);
  const info = (await v.json()) as { user_id?: string; login?: string; scopes?: string[] };
  if (!info.user_id) throw new Error('the refresh token is not a user token');
  const missing = ['user:read:chat', 'user:write:chat'].filter((s) => !info.scopes?.includes(s));
  if (missing.length) throw new Error(`the bot token is missing scopes: ${missing.join(', ')}`);
  botUserId = info.user_id;
  log('bot.token', { botUser: info.login, botUserId });
}

/** A Helix call as the bot, refreshing the token once on a 401. */
async function helix(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const res = await fetch(`${HELIX}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${accessToken}`, 'Client-Id': clientId, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401 && !retried) {
    await refresh();
    return helix(path, init, true);
  }
  return res;
}

// ── The site ─────────────────────────────────────────────────────────────────────────────────────

async function askSite<T>(query: string): Promise<T | null> {
  try {
    const res = await fetch(`${site}/api/internal/twitch-bot?${query}`, { headers: { 'x-bot-secret': sitePass }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      log('bot.site-failed', { query, status: res.status });
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    log('bot.site-failed', { query, message: (err as Error).message });
    return null;
  }
}

// ── Subscriptions ────────────────────────────────────────────────────────────────────────────────

/** broadcaster id → EventSub subscription id, for the current session. */
const subs = new Map<string, string>();
let sessionId: string | null = null;

async function sync(): Promise<void> {
  if (!sessionId) return;
  const answer = await askSite<BotChannelsAnswer>('op=channels');
  if (!answer) return; // the site is down: keep what we have rather than leave every channel
  const want = new Set(answer.channels.map((c) => c.broadcasterId));
  for (const [broadcaster, id] of subs) {
    if (want.has(broadcaster)) continue;
    await helix(`/eventsub/subscriptions?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null);
    subs.delete(broadcaster);
    log('bot.left', { broadcaster });
  }
  for (const broadcaster of want) {
    if (subs.has(broadcaster)) continue;
    const res = await helix('/eventsub/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        type: 'channel.chat.message',
        version: '1',
        condition: { broadcaster_user_id: broadcaster, user_id: botUserId },
        transport: { method: 'websocket', session_id: sessionId },
      }),
    }).catch((err: Error) => {
      log('bot.subscribe-failed', { broadcaster, message: err.message });
      return null;
    });
    if (!res) continue;
    if (!res.ok) {
      // 403 = the bot is banned/timed out there, or a join limit; it is retried on the next sync.
      log('bot.subscribe-failed', { broadcaster, status: res.status, body: (await res.text()).slice(0, 300) });
      continue;
    }
    const d = (await res.json()) as { data?: { id: string }[] };
    if (d.data?.[0]?.id) {
      subs.set(broadcaster, d.data[0].id);
      log('bot.joined', { broadcaster });
    }
  }
}

// ── Replies ──────────────────────────────────────────────────────────────────────────────────────

const recent = new Set<string>();

async function onFrame(frame: unknown): Promise<void> {
  const t = joinTriggerOf(frame, botUserId);
  if (!t) return;
  // EventSub may deliver a message twice; answer it once.
  if (recent.has(t.messageId)) return;
  recent.add(t.messageId);
  if (recent.size > 1000) recent.delete(recent.values().next().value as string);
  if (!subs.has(t.broadcasterId)) return;
  if (!limiter.take(t.broadcasterId, Date.now())) return;
  const answer = await askSite<BotJoinAnswer>(`op=join&broadcaster=${encodeURIComponent(t.broadcasterId)}`);
  if (!answer?.reply) return;
  const res = await helix('/chat/messages', {
    method: 'POST',
    body: JSON.stringify({ broadcaster_id: t.broadcasterId, sender_id: botUserId, message: cleanChatMessage(answer.reply), reply_parent_message_id: t.messageId }),
  }).catch((err: Error) => {
    log('bot.send-failed', { broadcaster: t.broadcasterId, message: err.message });
    return null;
  });
  if (!res) return;
  const d = res.ok ? ((await res.json()) as { data?: { is_sent?: boolean; drop_reason?: { code?: string } }[] }) : null;
  if (!res.ok || d?.data?.[0]?.is_sent === false) {
    log('bot.send-dropped', { broadcaster: t.broadcasterId, status: res.status, reason: d?.data?.[0]?.drop_reason?.code ?? null });
  } else {
    log('bot.replied', { broadcaster: t.broadcasterId });
  }
}

// ── The socket ───────────────────────────────────────────────────────────────────────────────────

let socket: WebSocket | null = null;
let watchdog: ReturnType<typeof setTimeout> | null = null;
let backoffMs = 1_000;

function arm(seconds: number) {
  if (watchdog) clearTimeout(watchdog);
  // No frame (not even a keepalive) for longer than Twitch promised: the connection is dead.
  watchdog = setTimeout(() => {
    log('bot.ws-silent');
    socket?.close();
  }, (seconds + 10) * 1000);
}

function connect(url: string, keepSubs: boolean) {
  const ws = new WebSocket(url);
  let welcomed = false;
  ws.addEventListener('message', (ev) => {
    let frame: { metadata?: { message_type?: string }; payload?: { session?: { id?: string; keepalive_timeout_seconds?: number; reconnect_url?: string }; subscription?: { condition?: { broadcaster_user_id?: string } } } };
    try {
      frame = JSON.parse(String(ev.data));
    } catch {
      return;
    }
    const type = frame.metadata?.message_type;
    if (type === 'session_welcome') {
      welcomed = true;
      backoffMs = 1_000;
      const old = socket;
      socket = ws;
      sessionId = frame.payload?.session?.id ?? null;
      arm(frame.payload?.session?.keepalive_timeout_seconds ?? 10);
      // A reconnect (session_reconnect) carries its subscriptions over; a fresh session has none.
      if (old && old !== ws) old.close();
      if (!keepSubs) subs.clear();
      log('bot.ws-welcome', { sessionId, carried: keepSubs });
      void sync();
      return;
    }
    if (ws !== socket) return;
    arm(frame.payload?.session?.keepalive_timeout_seconds ?? 10);
    if (type === 'session_reconnect' && frame.payload?.session?.reconnect_url) {
      log('bot.ws-reconnect');
      connect(frame.payload.session.reconnect_url, true);
      return;
    }
    if (type === 'revocation') {
      const b = frame.payload?.subscription?.condition?.broadcaster_user_id;
      if (b) subs.delete(b);
      log('bot.revoked', { broadcaster: b ?? null });
      return;
    }
    if (type === 'notification') void onFrame(frame).catch((err: Error) => log('bot.frame-failed', { message: err.message }));
  });
  ws.addEventListener('close', () => {
    if (ws !== socket && welcomed) return; // an old socket replaced by a reconnect
    if (ws !== socket && !welcomed && socket) return; // a reconnect attempt that never took
    socket = null;
    sessionId = null;
    if (watchdog) clearTimeout(watchdog);
    log('bot.ws-closed', { retryInMs: backoffMs });
    setTimeout(() => connect(EVENTSUB_WS, false), backoffMs);
    backoffMs = Math.min(backoffMs * 2, 60_000);
  });
  ws.addEventListener('error', () => {
    // 'close' follows and does the reconnecting.
  });
  if (!socket) socket = ws;
}

async function main() {
  await refresh();
  connect(EVENTSUB_WS, false);
  setInterval(() => void sync().catch((err: Error) => log('bot.sync-failed', { message: err.message })), SYNC_MS);
  // User tokens last about four hours; refresh well before, so a quiet night doesn't start with a 401.
  setInterval(() => void refresh().catch((err: Error) => log('bot.refresh-failed', { message: err.message })), 2 * 60 * 60_000);
}

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    log('bot.stop', { signal: sig });
    socket?.close();
    process.exit(0);
  });
}

main().catch((err: Error) => {
  log('bot.fatal', { message: err.message });
  process.exit(1);
});
