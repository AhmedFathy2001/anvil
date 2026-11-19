import { sql, type SQL } from 'drizzle-orm';

import { db } from '@/db';
import { discordRest, sharedBotToken } from '@/lib/discord-roles';
import { log } from '@/lib/logger';

// Which Discord servers the Anvil bot is in, set beside the server each clan saved.
//
// Discord is the only one who knows the first half (the bot's own guild list); the second is each
// clan's `discord_guild_id` setting. Put together they answer two things staff could not see: a
// server the bot sits in that no clan is linked to, and a clan whose saved server the bot is NOT in,
// where roles and team channels fail without anyone being told. A clan running its own bot (a
// `discord_bot_token` of its own) is not judged by Anvil's bot.

export interface BotGuild {
  id: string;
  name: string;
  /** Discord's approximate member count; null when it did not say. */
  members: number | null;
}

export interface ClanServers {
  /** False when Discord could not be asked (no token, or it refused): nothing below is then known. */
  known: boolean;
  servers: (BotGuild & { clans: { id: number; name: string }[] })[];
  /** Clans on Anvil's bot whose saved server it is not in. */
  missing: { id: number; name: string; guildId: string }[];
}

const TTL_MS = 10 * 60_000;
let memo: { at: number; value: BotGuild[] | null } | null = null;

/** The bot's servers, asked of Discord at most every ten minutes. Null when it cannot be asked. */
export async function botGuilds(now: number = Date.now()): Promise<BotGuild[] | null> {
  if (memo && now - memo.at < TTL_MS) return memo.value;
  const token = sharedBotToken();
  let value: BotGuild[] | null = null;
  if (token) {
    try {
      // 200 is Discord's page size; one page is every server until the bot is in more than that.
      const res = await discordRest(token, '/users/@me/guilds?limit=200&with_counts=true');
      if (res.ok) {
        const list = (await res.json()) as { id: string; name: string; approximate_member_count?: number }[];
        if (Array.isArray(list)) value = list.map((g) => ({ id: String(g.id), name: String(g.name), members: g.approximate_member_count ?? null }));
      } else log.warn('bot-guilds.read-fail', { status: res.status });
    } catch (err) {
      log.warn('bot-guilds.read-fail', {}, err);
    }
  }
  memo = { at: now, value };
  return value;
}

async function rows<T>(query: SQL): Promise<T[]> {
  const res = await db.execute(query);
  return ((res as unknown as { rows?: T[] }).rows ?? (res as unknown as T[])) as T[];
}

/** Pure: the bot's servers and each clan's saved one, joined. */
export function joinClanServers(guilds: BotGuild[] | null, saved: { id: number; name: string; guildId: string; ownBot: boolean }[]): ClanServers {
  if (!guilds) return { known: false, servers: [], missing: [] };
  const byGuild = new Map<string, { id: number; name: string }[]>();
  for (const c of saved) byGuild.set(c.guildId, [...(byGuild.get(c.guildId) ?? []), { id: c.id, name: c.name }]);
  const inGuild = new Set(guilds.map((g) => g.id));
  return {
    known: true,
    servers: guilds
      .map((g) => ({ ...g, clans: byGuild.get(g.id) ?? [] }))
      .sort((a, b) => (b.members ?? 0) - (a.members ?? 0) || a.name.localeCompare(b.name)),
    missing: saved.filter((c) => !c.ownBot && !inGuild.has(c.guildId)).map((c) => ({ id: c.id, name: c.name, guildId: c.guildId })),
  };
}

export async function clanServers(): Promise<ClanServers> {
  // clan-scope: global -- the platform's own view of every clan's saved server. The bot token's
  // value never leaves the database: only whether a clan has one of its own.
  const [guilds, saved] = await Promise.all([
    botGuilds(),
    rows<Record<string, unknown>>(sql`
      select c.id, c.name, trim(g.value) as guild_id,
             exists (select 1 from settings t where t.clan_id = c.id and t.key = 'discord_bot_token' and coalesce(trim(t.value), '') <> '') as own_bot
        from clans c join settings g on g.clan_id = c.id and g.key = 'discord_guild_id'
       where coalesce(trim(g.value), '') <> ''
    `),
  ]);
  return joinClanServers(
    guilds,
    saved.map((r) => ({ id: Number(r.id), name: String(r.name), guildId: String(r.guild_id), ownBot: r.own_bot === true || r.own_bot === 't' })),
  );
}
