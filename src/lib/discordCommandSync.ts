// Keep Discord's registered command tree in step with this build.
//
// Registration is a full-set PUT: the payload from discordCommandDefs becomes the complete command
// set for the application. The hosted platform owns one shared application, so its canonical set is
// GLOBAL. A legacy guild-scoped copy of the same command wins inside that server, though, and can
// stay stale forever even while every global PUT succeeds. Reconciliation therefore also inspects
// every connected guild and removes any guild-scoped copies left by the old one-clan deployment.
//
// The boot hook awaits this function, the deploy workflow calls the authenticated cron route and
// requires success, and the daily cron repairs later drift. All three use this exact path.

import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { settings } from '@/db/schema';
import { buildLocalizedCommands } from '@/lib/discordCommandDefs';
import { clanGuildId, getBotTokenOnly, sharedBotToken } from '@/lib/discord-roles';
import { getSetting, setSetting } from '@/lib/settings';
import { log } from '@/lib/logger';

const API = 'https://discord.com/api/v10';
const SYNCED_SCOPE_KEY = 'discord_commands_synced_scope';

export interface CommandSyncResult {
  ok: boolean;
  /** Guild commands update immediately; the platform normally uses the global scope. */
  scope?: 'guild' | 'global';
  count?: number;
  clearedGuilds?: number;
  reason?: string;
}

type Fetcher = typeof fetch;

function syncDisabled(): boolean {
  return ['0', 'false', 'no', 'off'].includes((process.env.DISCORD_COMMAND_SYNC ?? '').trim().toLowerCase());
}

async function request(
  fetcher: Fetcher,
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<Response | null> {
  return fetcher(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
}

function failure(scope: 'guild' | 'global', label: string, response: Response | null, detail = ''): CommandSyncResult {
  const suffix = response ? `${response.status}${detail ? `: ${detail}` : ''}` : 'unreachable';
  return { ok: false, scope, reason: `${label}-${suffix}`.slice(0, 300) };
}

/**
 * Reconcile one Discord application. Exported so the network contract can be tested without a DB.
 *
 * `guildId` selects an immediate guild registration (used only by a clan's own bot). With no guild,
 * the canonical global set is written and `clearGuildIds` removes legacy guild copies which would
 * otherwise shadow it.
 */
export async function reconcileDiscordCommands(
  token: string,
  options: { guildId?: string; clearGuildIds?: string[] } = {},
  fetcher: Fetcher = fetch,
): Promise<CommandSyncResult> {
  const scope: 'guild' | 'global' = options.guildId ? 'guild' : 'global';
  const appRes = await request(fetcher, token, '/applications/@me');
  if (!appRes?.ok) return failure(scope, 'app-lookup', appRes);
  const app = (await appRes.json().catch(() => null)) as { id?: string } | null;
  if (!app?.id) return { ok: false, scope, reason: 'app-lookup-malformed' };

  const path = options.guildId
    ? `/applications/${app.id}/guilds/${options.guildId}/commands`
    : `/applications/${app.id}/commands`;
  const commands = await buildLocalizedCommands();
  const registration = await request(fetcher, token, path, {
    method: 'PUT',
    body: JSON.stringify(commands),
  });
  if (!registration?.ok) {
    const detail = registration ? await registration.text().catch(() => '') : '';
    return failure(scope, 'registration', registration, detail);
  }

  const registered = (await registration.json().catch(() => [])) as unknown[];
  let clearedGuilds = 0;
  const candidates = [...new Set(options.clearGuildIds ?? [])]
    .filter((id) => /^\d{15,22}$/.test(id) && id !== options.guildId);

  // Reads are deliberate: once a legacy copy is gone, later deploys do not spend a write per clan.
  // Run the guild checks together so adding clans does not stretch a deploy linearly.
  const cleanup = await Promise.all(candidates.map(async (guildId) => {
    const guildPath = `/applications/${app.id}/guilds/${guildId}/commands`;
    const current = await request(fetcher, token, guildPath);
    if (!current?.ok) {
      const detail = current ? await current.text().catch(() => '') : '';
      return { ok: false as const, result: failure(scope, `guild-lookup-${guildId}`, current, detail) };
    }
    const rows = (await current.json().catch(() => null)) as unknown[] | null;
    if (!Array.isArray(rows)) {
      return { ok: false as const, result: { ok: false, scope, reason: `guild-lookup-${guildId}-malformed` } };
    }
    if (rows.length === 0) return { ok: true as const, cleared: false };

    const cleared = await request(fetcher, token, guildPath, { method: 'PUT', body: '[]' });
    if (!cleared?.ok) {
      const detail = cleared ? await cleared.text().catch(() => '') : '';
      return { ok: false as const, result: failure(scope, `guild-cleanup-${guildId}`, cleared, detail) };
    }
    return { ok: true as const, cleared: true };
  }));

  for (const item of cleanup) {
    if (!item.ok) return item.result;
    if (item.cleared) clearedGuilds += 1;
  }

  return { ok: true, scope, count: registered.length, clearedGuilds };
}

async function connectedGuildIds(): Promise<string[]> {
  // clan-scope: global -- the shared Discord application must clear legacy registrations in every
  // connected guild; limiting this to one clan is exactly what would leave the other shadows stale.
  const rows = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, 'discord_guild_id'));
  return [...new Set(rows.map((row) => row.value?.trim() ?? '').filter((id) => /^\d{15,22}$/.test(id)))];
}

/**
 * Reconcile commands for the platform, or for a clan with its own Discord application.
 *
 * No clan id means the deployment's shared application: one global set plus legacy guild cleanup.
 * A clan id uses a guild registration only when that clan has explicitly stored its own bot token;
 * clans using the hosted bot still belong to the platform's one global registration.
 */
export async function syncClanCommands(clanId?: number): Promise<CommandSyncResult> {
  if (syncDisabled()) return { ok: false, reason: 'disabled' };

  if (clanId != null) {
    const resolved = await getBotTokenOnly(clanId);
    if (resolved?.source === 'byo') {
      const guildId = await clanGuildId(clanId);
      if (!guildId) return { ok: false, reason: 'no-guild' };
      const previous = (await getSetting(clanId, SYNCED_SCOPE_KEY))?.trim() ?? '';
      const oldGuild = previous.startsWith('guild:') ? previous.slice('guild:'.length) : '';
      const result = await reconcileDiscordCommands(resolved.token, {
        guildId,
        clearGuildIds: oldGuild && oldGuild !== guildId ? [oldGuild] : [],
      });
      if (result.ok) await setSetting(clanId, SYNCED_SCOPE_KEY, `guild:${guildId}`);
      if (result.ok) log.info('discord-commands.synced', { scope: result.scope, count: result.count, clanId });
      else log.warn('discord-commands.sync-failed', { clanId, reason: result.reason });
      return result;
    }
  }

  const token = sharedBotToken();
  if (!token) return { ok: false, reason: 'no-bot-token' };

  let guildIds: string[];
  try {
    guildIds = await connectedGuildIds();
  } catch (error) {
    const reason = `guild-list-${(error as Error).message}`.slice(0, 300);
    log.warn('discord-commands.sync-failed', { scope: 'global', reason });
    return { ok: false, scope: 'global', reason };
  }

  const result = await reconcileDiscordCommands(token, { clearGuildIds: guildIds });
  if (result.ok) {
    log.info('discord-commands.synced', {
      scope: result.scope,
      count: result.count,
      clearedGuilds: result.clearedGuilds,
    });
  } else {
    log.warn('discord-commands.sync-failed', { scope: result.scope, reason: result.reason });
  }
  return result;
}

/** Best-effort wrapper for settings saves. Deploy and cron call the awaited function directly. */
export function syncClanCommandsInBackground(trigger: string, clanId?: number): void {
  void syncClanCommands(clanId)
    .then((result) => {
      if (!result.ok && !['disabled', 'no-bot-token', 'no-guild'].includes(result.reason ?? '')) {
        log.warn('discord-commands.sync-skipped', { trigger, reason: result.reason, clanId });
      }
    })
    .catch((error) => log.warn('discord-commands.sync-threw', {
      trigger,
      clanId,
      error: (error as Error).message,
    }));
}
