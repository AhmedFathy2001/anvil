// A player's opt-in `guilds.join` grant, stored so the bot can add them to an event server with their
// team role in one call (lib/eventDiscord). Encrypted at rest with lib/secretBox under
// DISCORD_TOKEN_KEY; with no key configured nothing is stored and players use the invite flow.
//
// The access token is a bearer credential for that player's Discord account within the granted scopes
// (identify, email, guilds.join), so it is only ever decrypted here and only ever sent to Discord.

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { userDiscordTokens } from '@/db/schema';
import { decryptSecret, encryptSecret } from '@/lib/secretBox';
import { refreshTokenSet, type DiscordTokenSet } from '@/lib/discord-oauth';
import { scopeAllowsJoin } from '@/lib/eventDiscordPlan';
import { log } from '@/lib/logger';

function tokenKey(): string | null {
  const key = process.env.DISCORD_TOKEN_KEY?.trim();
  return key && key.length >= 32 ? key : null;
}

/**
 * Whether grants can be KEPT for later (the key is configured). Without it auto-join still works at
 * the moment a player allows it — the callback uses the fresh token and discards it.
 */
export function grantStorageAvailable(): boolean {
  return tokenKey() !== null;
}

/** Persist a fresh grant. No-op (false) without guilds.join in scope or without a key. */
export async function storeJoinGrant(userId: number, set: DiscordTokenSet): Promise<boolean> {
  const key = tokenKey();
  if (!key || !scopeAllowsJoin(set.scope)) return false;
  const expiresAt = new Date(Date.now() + Math.max(0, set.expiresIn - 60) * 1000).toISOString();
  const values = {
    accessToken: encryptSecret(set.accessToken, key),
    refreshToken: set.refreshToken ? encryptSecret(set.refreshToken, key) : null,
    expiresAt,
    scope: set.scope,
    updatedAt: new Date().toISOString(),
  };
  await db
    .insert(userDiscordTokens)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: userDiscordTokens.userId, set: values });
  return true;
}

/** True when this user has a stored, usable-looking join grant. */
export async function hasJoinGrant(userId: number): Promise<boolean> {
  if (!tokenKey()) return false;
  const row = await db.query.userDiscordTokens.findFirst({
    where: eq(userDiscordTokens.userId, userId),
    columns: { scope: true },
  });
  return !!row && scopeAllowsJoin(row.scope);
}

/** Forget a grant (revoked upstream, or the player turned it off). */
export async function dropJoinGrant(userId: number): Promise<void> {
  await db.delete(userDiscordTokens).where(eq(userDiscordTokens.userId, userId));
}

/**
 * A live access token carrying guilds.join, refreshing it when expired. Null when there is none, the
 * key is missing, or Discord refused the refresh (the grant is then dropped so we stop trying).
 */
export async function joinAccessToken(userId: number): Promise<string | null> {
  const key = tokenKey();
  if (!key) return null;
  const row = await db.query.userDiscordTokens.findFirst({ where: eq(userDiscordTokens.userId, userId) });
  if (!row || !scopeAllowsJoin(row.scope)) return null;
  try {
    if (Date.parse(row.expiresAt) > Date.now()) return decryptSecret(row.accessToken, key);
    if (!row.refreshToken) {
      await dropJoinGrant(userId);
      return null;
    }
    const refreshed = await refreshTokenSet(decryptSecret(row.refreshToken, key));
    // Discord may not echo scope on refresh; the grant's scope is unchanged by a refresh.
    await storeJoinGrant(userId, { ...refreshed, scope: refreshed.scope || row.scope });
    return refreshed.accessToken;
  } catch (err) {
    log.warn('discord-user-tokens.refresh-fail', { userId }, err);
    await dropJoinGrant(userId).catch(() => {});
    return null;
  }
}
