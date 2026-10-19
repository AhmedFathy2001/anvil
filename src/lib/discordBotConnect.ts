import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { clans, clanStaff, users } from '@/db/schema';
import { atLeast } from '@/lib/clanRoles';
import { discordUserCanManageGuild } from '@/lib/discord-permissions';
import type { DiscordTokenSet } from '@/lib/discord-oauth';
import { GuildAlreadyClaimedError, oauthConnectAvailable, writeBotConnection } from '@/lib/discordGuildBinding';
import { syncClanCommandsInBackground } from '@/lib/discordCommandSync';

export type BotConnectResult =
  | { ok: true; clanSlug: string; guildName: string | null }
  | { ok: false; clanSlug: string | null; error: string };

/**
 * Finish "Connect your Discord server": bind the server the bot was just added to.
 *
 * Every input that could be forged is re-derived here rather than trusted:
 *   - the SERVER comes from Discord's token response (exchanged server-side with the client secret),
 *     never from the redirect's query string;
 *   - the CLAN id comes from a cookie, but the Discord account that approved the screen has to be an
 *     Anvil user who is an admin of that clan — a forged cookie gets nothing;
 *   - Discord only lets someone add a bot where they have Manage Server, and that is checked again
 *     through the bot, exactly as the manual server-ID path checks it;
 *   - a server another clan already holds a verified claim on is refused (writeBotConnection).
 */
export async function finishBotConnect(input: {
  clanIdCookie: string | undefined;
  tokenSet: DiscordTokenSet;
  discordUserId: string;
}): Promise<BotConnectResult> {
  const clanId = Number(input.clanIdCookie);
  if (!Number.isInteger(clanId) || clanId <= 0) return { ok: false, clanSlug: null, error: 'connect-expired' };
  const clan = await db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { id: true, slug: true } });
  if (!clan) return { ok: false, clanSlug: null, error: 'connect-expired' };
  const fail = (error: string): BotConnectResult => ({ ok: false, clanSlug: clan.slug, error });

  const user = await db.query.users.findFirst({
    where: eq(users.discordId, input.discordUserId),
    columns: { id: true, banned: true },
  });
  if (!user || user.banned) return fail('not-admin');
  const staff = await db.query.clanStaff.findFirst({
    where: and(eq(clanStaff.clanId, clan.id), eq(clanStaff.userId, user.id)),
    columns: { role: true },
  });
  if (!staff || !atLeast(staff.role, 'admin')) return fail('not-admin');

  const guild = input.tokenSet.guild;
  if (!guild?.id) return fail('no-server');

  const conn = await oauthConnectAvailable(clan.id);
  if (!conn) return fail('no-shared-bot');
  const permission = await discordUserCanManageGuild(conn.token, guild.id, input.discordUserId);
  if (!permission.ok) return fail('cant-manage');

  try {
    await writeBotConnection(clan.id, { guildId: guild.id });
  } catch (e) {
    if (e instanceof GuildAlreadyClaimedError) return fail('claimed');
    throw e;
  }
  // Best-effort, like the manual path: Discord being slow must not undo a proven binding.
  syncClanCommandsInBackground('guild-changed', clan.id);
  return { ok: true, clanSlug: clan.slug, guildName: guild.name };
}
