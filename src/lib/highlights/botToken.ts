// The Anvil bot's Twitch user token, as the SITE holds it — the token stream highlights clip with.
//
// The chat bot process (bot/twitchChat.ts) refreshes the same TWITCH_BOT_REFRESH_TOKEN for itself and
// keeps the result in memory; the site does its own refreshing here and caches the access token in
// twitch_bot_tokens, encrypted with TWITCH_TOKEN_KEY (memory only when that key is unset — never
// plaintext at rest). Twitch's refresh tokens for a confidential client don't rotate today, but the
// newest one Twitch hands back is kept anyway; seed_hash notices the owner re-running the helper
// (deploy/twitch-bot-token.mjs), and the fresh seed then wins over whatever was stored.
//
// SCOPE. Clipping needs clips:edit, which the helper only asks for since stream highlights. A token
// without it still answers the reads (live? archives?) so VOD links keep working; clipping is skipped
// quietly and platform staff see "Re-authorize the Anvil bot for clips" (/staff/highlights).

import crypto from 'crypto';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { twitchBotTokens } from '@/db/schema';
import { decryptSecret, encryptSecret } from '@/lib/secretBox';
import { getPlatformSetting, setPlatformSetting } from '@/lib/platformSettings';
import { log } from '@/lib/logger';
import {
  BotAuthError,
  botConfig,
  canClip,
  refreshBotToken,
  validateBotToken,
  type BotConfig,
  type FetchLike,
} from '@/lib/highlights/twitchApi';

const ROW = 'bot';
/** Platform setting: when the bot token was last seen WITHOUT clips:edit (ISO), or unset. */
export const BOT_NEEDS_CLIP_SCOPE_KEY = 'highlights_bot_needs_clip_scope';

let fetchImpl: FetchLike = (input, init) => fetch(input, init);
export function setBotFetchForTests(f: FetchLike | null): void {
  fetchImpl = f ?? ((input, init) => fetch(input, init));
}
export function botFetch(): FetchLike {
  return fetchImpl;
}

export interface BotAccess {
  cfg: BotConfig;
  token: string;
  botUserId: string | null;
  canClip: boolean;
}

function seedHash(seed: string): string {
  return crypto.createHash('sha256').update(`anvil-twitch-bot-seed:${seed}`).digest('hex');
}

/** Without TWITCH_TOKEN_KEY nothing is written to the table; the token lives here. */
let memory: { hash: string; token: string; refresh: string; expiresAt: number; scope: string[]; botUserId: string | null } | null = null;
let inflight: Promise<BotAccess | null> | null = null;

export function forgetBotTokenForTests(): void {
  memory = null;
  inflight = null;
}

/**
 * A usable bot token, refreshed when it has expired (or `force`, after a 401). Null when the bot is not
 * configured or Twitch refused the refresh token — highlights then stay off, quietly.
 */
export async function botAccess(force = false): Promise<BotAccess | null> {
  const cfg = botConfig();
  if (!cfg) return null;
  const hash = seedHash(cfg.refreshSeed);

  if (!force) {
    const cached = await cachedAccess(cfg, hash);
    if (cached) return cached;
  }
  inflight ??= refreshNow(cfg, hash).finally(() => {
    inflight = null;
  });
  return inflight;
}

async function cachedAccess(cfg: BotConfig, hash: string): Promise<BotAccess | null> {
  if (!cfg.tokenKey) {
    if (memory && memory.hash === hash && memory.expiresAt > Date.now()) {
      return { cfg, token: memory.token, botUserId: memory.botUserId, canClip: canClip(memory.scope) };
    }
    return null;
  }
  const row = await db.query.twitchBotTokens.findFirst({ where: eq(twitchBotTokens.id, ROW) });
  if (!row || row.seedHash !== hash || !row.accessToken || !row.expiresAt || Date.parse(row.expiresAt) <= Date.now()) return null;
  try {
    const scope = row.scope.split(' ').filter(Boolean);
    return { cfg, token: decryptSecret(row.accessToken, cfg.tokenKey), botUserId: row.botUserId, canClip: canClip(scope) };
  } catch {
    return null; // a rotated key: refresh
  }
}

async function storedRefresh(cfg: BotConfig, hash: string): Promise<string> {
  if (!cfg.tokenKey) return memory && memory.hash === hash ? memory.refresh : cfg.refreshSeed;
  const row = await db.query.twitchBotTokens.findFirst({ where: eq(twitchBotTokens.id, ROW) });
  if (!row || row.seedHash !== hash) return cfg.refreshSeed;
  try {
    return decryptSecret(row.refreshToken, cfg.tokenKey);
  } catch {
    return cfg.refreshSeed;
  }
}

async function refreshNow(cfg: BotConfig, hash: string): Promise<BotAccess | null> {
  try {
    const refresh = await storedRefresh(cfg, hash);
    const set = await refreshBotToken(cfg, refresh, fetchImpl);
    const who = await validateBotToken(set.accessToken, fetchImpl);
    if (!who) {
      log.warn('highlights.bot-token-invalid');
      return null;
    }
    const nextRefresh = set.refreshToken ?? refresh;
    const expiresAt = Date.now() + Math.max(0, set.expiresIn - 60) * 1000;
    if (cfg.tokenKey) {
      const values = {
        seedHash: hash,
        accessToken: encryptSecret(set.accessToken, cfg.tokenKey),
        refreshToken: encryptSecret(nextRefresh, cfg.tokenKey),
        expiresAt: new Date(expiresAt).toISOString(),
        scope: who.scopes.join(' '),
        botUserId: who.userId,
        updatedAt: new Date().toISOString(),
      };
      await db.insert(twitchBotTokens).values({ id: ROW, ...values }).onConflictDoUpdate({ target: twitchBotTokens.id, set: values });
    } else {
      memory = { hash, token: set.accessToken, refresh: nextRefresh, expiresAt, scope: who.scopes, botUserId: who.userId };
    }
    await noteClipScope(canClip(who.scopes));
    return { cfg, token: set.accessToken, botUserId: who.userId, canClip: canClip(who.scopes) };
  } catch (err) {
    log.warn('highlights.bot-refresh-failed', { refused: err instanceof BotAuthError && err.refused }, err);
    return null;
  }
}

/** Remember (for platform staff only) whether the bot can clip. Written only when it changes. */
async function noteClipScope(ok: boolean): Promise<void> {
  try {
    const flagged = await getPlatformSetting(BOT_NEEDS_CLIP_SCOPE_KEY);
    if (ok && flagged) await setPlatformSetting(BOT_NEEDS_CLIP_SCOPE_KEY, null);
    if (!ok && !flagged) {
      log.warn('highlights.bot-missing-clips-scope');
      await setPlatformSetting(BOT_NEEDS_CLIP_SCOPE_KEY, new Date().toISOString());
    }
  } catch {
    // a flag for a staff banner; never worth failing a clip over
  }
}

export interface BotClipStatus {
  /** TWITCH_BOT_* are set. */
  configured: boolean;
  /** The last refresh found the token without clips:edit. */
  needsReauth: boolean;
}

/** For /staff/highlights. Never the token. */
export async function botClipStatus(): Promise<BotClipStatus> {
  return { configured: botConfig() !== null, needsReauth: !!(await getPlatformSetting(BOT_NEEDS_CLIP_SCOPE_KEY)) };
}
