import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { settings } from '@/db/schema';
import { invalidateSettings } from '@/lib/settings';
import { discordRest, getBotTokenOnly } from '@/lib/discord-roles';
import { getOAuthMode } from '@/lib/discord-oauth';

export class GuildAlreadyClaimedError extends Error {}

/**
 * Marks an OAuth round trip as "connect this clan's server", not a login (api/admin/discord/bot/
 * connect → api/auth/discord/callback). Holds "<clanId>:<state>" — the state ties it to one round
 * trip — and is NOT trusted for authority: the callback re-checks that the Discord account that
 * approved is an admin of that clan.
 */
export const BOT_CONNECT_COOKIE = 'discord_bot_connect';

/**
 * Write a clan's bot connection: the bring-your-own token and/or the Discord server it works in.
 *
 * `undefined` leaves a half alone; an empty string or null clears it. The server id is written with
 * its verified twin in the same transaction — getBotCredentials only trusts the pair — so callers
 * must have proved, before this, that the person binding can manage that server. Shared by the
 * Connection form (api/admin/discord/bot) and the add-the-bot OAuth return (api/auth/discord/callback).
 *
 * Throws GuildAlreadyClaimedError when another clan already holds a verified claim on the server.
 */
export async function writeBotConnection(
  clanId: number,
  change: { botToken?: string | null; guildId?: string | null },
): Promise<void> {
  const targetGuildId = change.guildId?.trim() || null;
  await db.transaction(async (tx) => {
    if (targetGuildId) {
      // Serialize claims for this guild. The settings table is keyed by (clan,key), so this lock
      // closes the race between checking a value and inserting it for two different clans.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`anvil-discord-guild:${targetGuildId}`}))`);
      const verifiedClaims = tx
        .select({ clanId: settings.clanId })
        .from(settings)
        .where(and(eq(settings.key, 'discord_guild_verified_id'), eq(settings.value, targetGuildId)));
      const claims = await tx
        .select({ clanId: settings.clanId })
        .from(settings)
        .where(
          and(
            eq(settings.key, 'discord_guild_id'),
            eq(settings.value, targetGuildId),
            inArray(settings.clanId, verifiedClaims),
          ),
        );
      if (claims.some((claim) => claim.clanId !== clanId)) throw new GuildAlreadyClaimedError();
    }

    const write = async (key: string, value: string | null) => {
      await tx
        .insert(settings)
        .values({ clanId, key, value })
        .onConflictDoUpdate({ target: [settings.clanId, settings.key], set: { value } });
    };
    if (change.botToken !== undefined) await write('discord_bot_token', change.botToken?.trim() || null);
    if (change.guildId !== undefined) {
      await write('discord_guild_id', targetGuildId);
      // Matching ids are the capability marker read by getBotCredentials. Clearing or changing
      // the guild clears/replaces it in this same transaction—there is no usable unverified gap.
      await write('discord_guild_verified_id', targetGuildId);
    }
  });
  // The writes above went through the transaction, not setSetting — drop the cached copy.
  invalidateSettings(clanId);
}

// Validate a token by asking Discord who it is. Returns the bot's id + display name, or null if the
// token is missing/invalid. The id doubles as the OAuth client_id in the invite link below (for a
// bot, application id == bot user id).
export async function fetchBotUser(token: string): Promise<{ id: string; name: string } | null> {
  const res = await discordRest(token, '/users/@me');
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string; username?: string; global_name?: string };
  if (!user?.id) return null;
  return { id: user.id, name: user.global_name || user.username || 'bot' };
}

// Permissions requested by the invite link: Manage Channels + Manage Roles + Manage Nicknames +
// Manage Webhooks (the four the features need), plus the basics to post: View Channel, Send
// Messages, Embed Links, Attach Files, Read Message History — and for guides: Manage Threads (a bot
// can't delete even its own forum post without it), Send Messages in Threads, and Change Nickname
// (the per-server bot name, lib/discordIdentity). Plus Create Invite (bit 0): an event server
// (lib/eventDiscord) needs it both for players' single-use invites and for adding opted-in players
// with guilds.join.
export const BOT_INVITE_PERMISSIONS = '293064526865';

/**
 * Can this clan connect its server by adding the bot through OAuth (buildBotConnectUrl)?
 *
 * Only with the managed bot, and only when that bot IS the login app: the round trip comes back
 * through the login's registered redirect with the login app's credentials, which work only for
 * that app. A bring-your-own bot is a different app and keeps the server-ID box. Returns the bot
 * token the callback re-checks the server with, or null.
 */
export async function oauthConnectAvailable(clanId: number): Promise<{ token: string } | null> {
  if (getOAuthMode() !== 'own') return null;
  const resolved = await getBotTokenOnly(clanId);
  if (!resolved || resolved.source === 'byo') return null;
  const bot = await fetchBotUser(resolved.token);
  return bot && bot.id === process.env.DISCORD_CLIENT_ID ? { token: resolved.token } : null;
}
