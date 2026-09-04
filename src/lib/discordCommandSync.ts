// Keeping Discord's copy of the command tree in step with this build's.
//
// Slash commands live in TWO places: the definitions in lib/discordCommandDefs, and whatever
// Discord currently has registered for the application. Nothing keeps those in step on its own — a
// command added in code simply never appears, and one removed lingers in members' autocomplete
// pointing at a handler that no longer exists. Both failures are silent, which is the worst kind:
// the bot looks fine and the command just isn't there.
//
// So registration is a reconcile, not a setup step. It's a full-set PUT (whatever we send becomes
// exactly what exists), which makes it idempotent and safe to re-run on every boot and every time a
// clan connects a bot — no diffing, no drift, and a failed attempt heals itself next time.
//
// WHO RUNS IT. A managed clan is on the SHARED Anvil application, whose commands the control plane
// owns and registers once globally. Every clan container re-registering that same application would
// be N redundant writes racing each other for no benefit, so this refuses to run on a shared token.
// Only a clan with its own bot — self-hosted, or bring-your-own on a managed instance — registers.

import { buildLocalizedCommands } from '@/lib/discordCommandDefs';
import { sharedBotToken } from '@/lib/discord-roles';
import { getBotTokenOnly, getBotTokenSource } from '@/lib/discord-roles';
import { log } from '@/lib/logger';
import { db } from '@/db';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';

const API = 'https://discord.com/api/v10';

/** Where the last successful sync landed, so a guild change can clean up after itself. */
const SYNCED_SCOPE_KEY = 'discord_commands_synced_scope';

export interface CommandSyncResult {
  ok: boolean;
  /** 'guild' is instant; 'global' takes up to an hour to propagate. */
  scope?: 'guild' | 'global';
  count?: number;
  reason?: string;
}

/**
 * PLATFORM-LEVEL CACHE, deliberately not the settings table.
 *
 * `settings` is keyed (clan_id, key) — every row belongs to a clan. These values do not: they
 * describe the SHARED Discord application that serves every clan, and instrumentation.ts reads one
 * at boot where there is no clan to name. Storing them under some clan's id would make one clan's
 * row silently authoritative for all of them.
 *
 * A process cache is honest about that. Both values derive from env (the bot token), so a cold
 * process re-derives rather than losing anything, and the real fix — a platform_settings table —
 * belongs with the rest of the platform surface rather than inside a merge.
 */
const platformCache = new Map<string, string | null>();

async function readSetting(key: string): Promise<string | null> {
  return platformCache.get(key) ?? null;
}

async function writeSetting(key: string, value: string | null): Promise<void> {
  platformCache.set(key, value);
}

async function put(token: string, path: string, body: unknown): Promise<Response | null> {
  return fetch(`${API}${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
}

/**
 * Register this clan's commands with its own Discord application.
 *
 * Guild-scoped when the clan has a server configured, because guild commands are live the instant
 * they're written while global ones take up to an hour — an admin who connects a bot and sees
 * nothing for an hour concludes it's broken. Global is the fallback for a clan that hasn't picked a
 * server yet. Never both: Discord shows a guild command and a global one of the same name twice.
 *
 * Best-effort by contract. Every caller is a side path (a settings save, a boot hook) that must not
 * fail because Discord is having a bad day; the next boot re-runs it.
 */
export async function syncClanCommands(): Promise<CommandSyncResult> {
  const token = sharedBotToken();
  // The control plane owns the shared application's commands (see the note at the top).
  if (!token) return { ok: false, reason: 'no-bot-token' };

  const resolved = token;
  if (!resolved) return { ok: false, reason: 'no-bot-token' };

  const appRes = await fetch(`${API}/applications/@me`, {
    headers: { Authorization: `Bot ${resolved}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!appRes?.ok) return { ok: false, reason: `app-lookup-${appRes?.status ?? 'unreachable'}` };
  const app = (await appRes.json().catch(() => null)) as { id?: string } | null;
  if (!app?.id) return { ok: false, reason: 'app-lookup-malformed' };

  // Settings only — an env fallback here would register this clan's commands into the operator's
  // guild. See clanGuildId.
  const guildId = (await readSetting('discord_guild_id'))?.trim() || '';
  const scope: 'guild' | 'global' = guildId ? 'guild' : 'global';
  const path = guildId
    ? `/applications/${app.id}/guilds/${guildId}/commands`
    : `/applications/${app.id}/commands`;

  // Descriptions carry every language we have, so Discord's own picker is localized too — the
  // member reading a Danish answer also sees a Danish description before they run the command.
  const res = await put(resolved, path, await buildLocalizedCommands());
  if (!res?.ok) {
    const detail = res ? `${res.status}: ${await res.text().catch(() => '')}`.slice(0, 300) : 'unreachable';
    log.warn('discord-commands.sync-failed', { scope, detail });
    return { ok: false, scope, reason: detail };
  }

  // A clan that moved servers leaves its commands behind in the old one, still listed and now
  // answering about a clan that isn't there. Clearing is a PUT of an empty set — same call, no body.
  const previous = await readSetting(SYNCED_SCOPE_KEY);
  if (previous && previous !== `guild:${guildId}` && previous.startsWith('guild:')) {
    const staleGuild = previous.slice('guild:'.length);
    await put(resolved, `/applications/${app.id}/guilds/${staleGuild}/commands`, []);
  }
  await writeSetting(SYNCED_SCOPE_KEY, guildId ? `guild:${guildId}` : 'global');

  const registered = (await res.json().catch(() => [])) as unknown[];
  log.info('discord-commands.synced', { scope, count: registered.length });
  return { ok: true, scope, count: registered.length };
}

/** Fire-and-forget wrapper for the side paths (settings save, boot). Never throws, never blocks. */
export function syncClanCommandsInBackground(trigger: string): void {
  void syncClanCommands()
    .then((r) => {
      if (!r.ok && r.reason !== 'shared-bot' && r.reason !== 'no-bot-token') {
        log.warn('discord-commands.sync-skipped', { trigger, reason: r.reason });
      }
    })
    .catch((e) => log.warn('discord-commands.sync-threw', { trigger, error: (e as Error).message }));
}
