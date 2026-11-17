// Reads a clan's Discord-side command settings through its bot (lib/discordCommandPermissions).
// Best effort and read-only: no bot, no access, or Discord down all read as "nothing to show".

import { describeCommandPermissions, type CommandPermissionEntry, type DiscordCommandNotes } from '@/lib/discordCommandPermissions';
import { discordRest, getBotCredentials } from '@/lib/discord-roles';
import { log } from '@/lib/logger';
import { ttlMemo } from '@/lib/ttlMemo';

async function json<T>(token: string, path: string): Promise<T | null> {
  try {
    const res = await discordRest(token, path, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function load(clanId: number): Promise<DiscordCommandNotes | null> {
  const creds = await getBotCredentials(clanId);
  if (!creds) return null;
  const app = await json<{ id?: string }>(creds.botToken, '/applications/@me');
  if (!app?.id) return null;
  const entries = await json<CommandPermissionEntry[]>(creds.botToken, `/applications/${app.id}/guilds/${creds.guildId}/commands/permissions`);
  if (!Array.isArray(entries)) {
    log.info('discord-commands.permissions-unreadable', { clanId });
    return null;
  }
  // Nothing changed in Discord: no need to ask for names.
  if (!entries.some((e) => e.permissions?.length)) return { all: null, byCommand: {} };
  const [global, guild, roles, channels] = await Promise.all([
    json<{ id: string; name: string }[]>(creds.botToken, `/applications/${app.id}/commands`),
    // A clan's own bot registers its commands on the server itself (lib/discordCommandSync).
    json<{ id: string; name: string }[]>(creds.botToken, `/applications/${app.id}/guilds/${creds.guildId}/commands`),
    json<{ id: string; name: string }[]>(creds.botToken, `/guilds/${creds.guildId}/roles`),
    json<{ id: string; name: string }[]>(creds.botToken, `/guilds/${creds.guildId}/channels`),
  ]);
  const ids = new Map<string, string>();
  for (const c of [...(global ?? []), ...(guild ?? [])]) if (c?.id && c?.name) ids.set(c.id, c.name);
  return describeCommandPermissions(entries, app.id, ids, {
    guildId: creds.guildId,
    roles: new Map((roles ?? []).map((r) => [r.id, r.name])),
    channels: new Map((channels ?? []).map((c) => [c.id, c.name])),
  });
}

/** What the clan's server has set in Discord for Anvil's commands, in words. Null = could not be read. */
export function discordCommandNotes(clanId: number): Promise<DiscordCommandNotes | null> {
  return ttlMemo(`discord-command-notes:${clanId}`, () => load(clanId).catch(() => null), 60_000);
}
