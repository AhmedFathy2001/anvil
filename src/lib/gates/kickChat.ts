// `!join` in Kick chat. Kick delivers chat by webhook, so there is no bot process: the webhook route
// (api/webhooks/kick) sees `!join`, answers 200 at once, and this sends the reply after the response.
//
// WHO SPEAKS. Kick's POST /public/v1/chat has two modes:
//   type 'bot'  — with the BROADCASTER's token (chat:write, "allow chat bots to post in your chat"):
//                 posted by the app's bot account into that broadcaster's channel. No extra secret.
//   type 'user' — with a USER's token: posted as that user into any channel (broadcaster_user_id).
// Default is 'bot' via the host's own token (granted when they connected). If KICK_BOT_REFRESH_TOKEN
// is set (scripts/kick-bot-token.mjs, logged in as anvil_osrs), replies go out as that account with
// type 'user' instead — for when the Kick app is not owned by anvil_osrs. Kick rotates refresh
// tokens, so the current one lives in kick_bot_tokens (encrypted), seeded from the env value.
//
// Same rate limits as the Twitch bot (lib/twitchBot/wire ReplyLimiter): one answer per channel per
// 30 s, at most 15 sends per 30 s across all channels.

import crypto from 'crypto';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { kickBotTokens } from '@/db/schema';
import { joinReplyForClan } from '@/lib/chatBot/join';
import { hostKickToken, kickFetch } from '@/lib/gates/kickDb';
import { kickConfig, postKickChat, refreshKickToken, type KickConfig } from '@/lib/kick';
import { decryptSecret, encryptSecret } from '@/lib/secretBox';
import { log } from '@/lib/logger';
import { ReplyLimiter, cleanChatMessage } from '@/lib/twitchBot/wire';

export const kickJoinLimiter = new ReplyLimiter({ channelMs: Number(process.env.KICK_BOT_COOLDOWN_MS) || undefined });

// ── The optional bot account token ──────────────────────────────────────────────────────────────

const BOT_ROW = 'bot';
let botRefreshing: Promise<string | null> | null = null;

function seedHash(seed: string): string {
  return crypto.createHash('sha256').update(`anvil-kick-bot-seed:${seed}`).digest('hex');
}

/** The bot account's access token, or null when no bot token is configured (or Kick refused it). */
export async function kickBotToken(cfg: KickConfig, force = false): Promise<string | null> {
  const seed = process.env.KICK_BOT_REFRESH_TOKEN?.trim();
  if (!seed) return null;
  const hash = seedHash(seed);
  const row = await db.query.kickBotTokens.findFirst({ where: eq(kickBotTokens.id, BOT_ROW) });
  // A new env seed (the owner re-ran the helper) replaces whatever rotated token was stored.
  const current = row && row.seedHash === hash ? row : null;
  if (current?.accessToken && current.expiresAt && !force && Date.parse(current.expiresAt) > Date.now()) {
    try {
      return decryptSecret(current.accessToken, cfg.tokenKey);
    } catch {
      // fall through to a refresh
    }
  }
  botRefreshing ??= (async () => {
    try {
      let refresh = seed;
      if (current) {
        try {
          refresh = decryptSecret(current.refreshToken, cfg.tokenKey);
        } catch {
          refresh = seed;
        }
      }
      const set = await refreshKickToken(cfg, refresh, kickFetch());
      const now = new Date().toISOString();
      const values = {
        seedHash: hash,
        accessToken: encryptSecret(set.accessToken, cfg.tokenKey),
        refreshToken: encryptSecret(set.refreshToken ?? refresh, cfg.tokenKey),
        expiresAt: new Date(Date.now() + Math.max(0, set.expiresIn - 60) * 1000).toISOString(),
        updatedAt: now,
      };
      await db.insert(kickBotTokens).values({ id: BOT_ROW, ...values }).onConflictDoUpdate({ target: kickBotTokens.id, set: values });
      return set.accessToken;
    } catch (err) {
      log.warn('kick.bot-refresh-failed', {}, err);
      return null;
    }
  })().finally(() => {
    botRefreshing = null;
  });
  return botRefreshing;
}

// ── Sending ─────────────────────────────────────────────────────────────────────────────────────

/** Post one line in a connected channel. Never throws; logs what happened. */
export async function sendKickChat(opts: { clanId: number; broadcasterId: string; content: string; replyTo: string | null }): Promise<boolean> {
  const cfg = kickConfig();
  if (!cfg) return false;
  const content = cleanChatMessage(opts.content);
  try {
    const bot = await kickBotToken(cfg);
    if (bot) {
      let r = await postKickChat(bot, { type: 'user', content, broadcasterUserId: opts.broadcasterId, replyTo: opts.replyTo }, kickFetch());
      if (!r.ok && r.reason === 'unauthorized') {
        const again = await kickBotToken(cfg, true);
        if (again) r = await postKickChat(again, { type: 'user', content, broadcasterUserId: opts.broadcasterId, replyTo: opts.replyTo }, kickFetch());
      }
      log.info(r.ok && r.value.sent ? 'kick.replied' : 'kick.send-dropped', { broadcaster: opts.broadcasterId, via: 'bot-user' });
      return r.ok && r.value.sent;
    }
    let host = await hostKickToken(opts.clanId, cfg);
    if (!host) return false;
    let r = await postKickChat(host.token, { type: 'bot', content, replyTo: opts.replyTo }, kickFetch());
    if (!r.ok && r.reason === 'unauthorized') {
      host = await hostKickToken(opts.clanId, cfg, true);
      if (host) r = await postKickChat(host.token, { type: 'bot', content, replyTo: opts.replyTo }, kickFetch());
    }
    log.info(r.ok && r.value.sent ? 'kick.replied' : 'kick.send-dropped', { broadcaster: opts.broadcasterId, via: 'app-bot' });
    return r.ok && r.value.sent;
  } catch (err) {
    log.warn('kick.send-failed', { broadcaster: opts.broadcasterId }, err);
    return false;
  }
}

/**
 * Answer a `!join` (already checked: the channel's space has it switched on). Rate-limited here, so a
 * chat spamming `!join` costs one database read and one send per cooldown.
 */
export async function answerKickJoin(opts: { clanId: number; broadcasterId: string; replyTo: string | null }, now = Date.now()): Promise<boolean> {
  if (!kickJoinLimiter.take(`kick:${opts.broadcasterId}`, now)) return false;
  const reply = await joinReplyForClan(opts.clanId);
  return sendKickChat({ ...opts, content: reply });
}
