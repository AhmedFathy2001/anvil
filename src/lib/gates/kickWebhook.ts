// Kick's webhook (api/webhooks/kick) — verification and dispatch, out of the route so it is tested.
//
// ORDER MATTERS, cheapest refusal first:
//   1. size cap and the required headers;
//   2. the timestamp within KICK_WEBHOOK_MAX_AGE_MS (an old, validly signed body is a replay);
//   3. the RSA signature over `${id}.${timestamp}.${raw body}` with Kick's public key (cached; on a
//      failure the key is refetched at most once a minute, since Kick may rotate it);
//   4. parse — and chat lines that are neither a link code nor `!join` stop HERE, before any database
//      write: most of a busy chat is neither, and a replay of one changes nothing;
//   5. the message id recorded once (kick_webhook_seen) — a redelivery or replay inside the window
//      is acknowledged and dropped;
//   6. apply. `!join` replies are returned to the route to send AFTER the response.
//
// Everything from chat is treated as hostile: ids must be integers, names are stripped of control
// and bidi characters, only a code matching ANVIL-XXXXXX is looked up, and failed codes are rate
// limited per Kick sender so nobody can guess codes by spamming a chat.

import { applyKickEvent, kickFetch, markKickMessageSeen, unmarkKickMessageSeen, type KickEventOutcome } from '@/lib/gates/kickDb';
import { findKickCode, parseKickEvent } from '@/lib/gates/kick';
import { fetchKickPublicKey, kickConfigured, verifyKickSignature, webhookTimestampOk } from '@/lib/kick';
import { log } from '@/lib/logger';
import { rateLimitByKey } from '@/lib/rate-limit';
import { parseChatCommand } from '@/lib/twitchBot/wire';

const MAX_BODY_BYTES = 64 * 1024;
const MESSAGE_ID = /^[0-9A-Za-z_-]{8,64}$/;

let cachedKey: { pem: string; at: number } | null = null;
let keyOverride: string | null = null;
/** Tests sign with their own key. */
export function setKickPublicKeyForTests(pem: string | null): void {
  keyOverride = pem;
  cachedKey = null;
}

async function publicKey(refresh: boolean): Promise<string | null> {
  if (keyOverride) return keyOverride;
  const now = Date.now();
  if (cachedKey && (!refresh || now - cachedKey.at < 60_000)) return cachedKey.pem;
  try {
    cachedKey = { pem: await fetchKickPublicKey(kickFetch()), at: now };
    return cachedKey.pem;
  } catch (err) {
    log.warn('kick.public-key-failed', {}, err);
    return cachedKey?.pem ?? null;
  }
}

export interface WebhookResult {
  status: number;
  body: Record<string, unknown>;
  /** Work for after the response (a `!join` reply). */
  after?: Extract<KickEventOutcome, { kind: 'join' }>;
}

export async function handleKickWebhook(headers: Headers, rawBody: string, now = Date.now()): Promise<WebhookResult> {
  if (!kickConfigured()) return { status: 404, body: { error: 'Not found' } };
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) return { status: 413, body: { error: 'Too large' } };

  const messageId = headers.get('kick-event-message-id') ?? '';
  const timestamp = headers.get('kick-event-message-timestamp') ?? '';
  const signature = headers.get('kick-event-signature') ?? '';
  const type = headers.get('kick-event-type');
  const version = headers.get('kick-event-version');
  if (!MESSAGE_ID.test(messageId) || !timestamp || !signature) return { status: 400, body: { error: 'Missing headers' } };
  if (!webhookTimestampOk(timestamp, now)) return { status: 400, body: { error: 'Stale' } };

  let key = await publicKey(false);
  let ok = !!key && verifyKickSignature(key, messageId, timestamp, rawBody, signature);
  if (!ok) {
    key = await publicKey(true);
    ok = !!key && verifyKickSignature(key, messageId, timestamp, rawBody, signature);
  }
  if (!ok) return { status: 401, body: { error: 'Bad signature' } };

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: 'Bad body' } };
  }
  const ev = parseKickEvent(type, version, body);
  // Authentic but not something Anvil uses: acknowledge, so Kick does not retry or disable us.
  if (!ev) return { status: 200, body: { ok: true } };

  let code: string | null = null;
  let join = false;
  if (ev.type === 'chat') {
    code = findKickCode(ev.content);
    join = !code && parseChatCommand(ev.content) === 'join';
    if (!code && !join) return { status: 200, body: { ok: true } };
    if (code) {
      const rl = await rateLimitByKey('kick-code-chat', ev.sender.id, { limit: 10, windowMs: 10 * 60_000 });
      if (!rl.ok) return { status: 200, body: { ok: true } };
    }
  }

  if (!(await markKickMessageSeen(messageId, now))) return { status: 200, body: { ok: true, duplicate: true } };
  try {
    const out = await applyKickEvent(ev, { code, join }, now);
    return out.kind === 'join' ? { status: 200, body: { ok: true }, after: out } : { status: 200, body: { ok: true } };
  } catch (err) {
    // Let Kick retry: forget we saw it.
    await unmarkKickMessageSeen(messageId).catch(() => {});
    log.warn('kick.webhook-failed', { type }, err);
    return { status: 500, body: { error: 'Failed' } };
  }
}
