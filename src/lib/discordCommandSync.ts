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

async function readSetting(key: string): Promise<string | null> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, key) });
  return row?.value ?? null;
}

async function writeSetting(key: string, value: string | null): Promise<void> {
  const existing = await db.query.settings.findFirst({ where: eq(settings.key, key) });
  if (existing) await db.update(settings).set({ value }).where(eq(settings.key, key));
  else await db.insert(settings).values({ key, value });
}

async function listCommands(token: string, path: string): Promise<unknown[] | null> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bot ${token}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res?.ok) return null;
  const body = await res.json().catch(() => null);
  return Array.isArray(body) ? body : null;
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
 * Every registration scope that must be EMPTIED so the target scope is the only one serving.
 *
 * Discord stores guild commands and global commands separately and serves BOTH: an application
 * registered in both scopes shows every command twice in the picker, which is exactly what a clan
 * sees after connecting a bot before setting a server ID —
 *
 *   1. no server ID yet  → registered globally
 *   2. admin sets one    → registered guild-scoped
 *   3. the global copy was never removed, so now there are two of everything.
 *
 * That was the old bug: cleanup only ever looked for a stale GUILD, so the global→guild move (the
 * common one, since the server ID usually arrives after the bot) left a duplicate set behind
 * forever. `previous` is a hint, not the authority — it can be missing entirely on an instance
 * that registered by hand with scripts/register-discord-commands.mts — so the global scope is
 * always checked when targeting a guild rather than trusted to be clean.
 */
export function staleScopes(appId: string, guildId: string, previous: string | null): string[] {
  const out: string[] = [];
  // Targeting a guild: the global set, if any, is a duplicate of it.
  if (guildId) out.push(`/applications/${appId}/commands`);
  // Either target: a server we used to be bound to still has our commands, now answering about a
  // clan that isn't there.
  if (previous?.startsWith('guild:')) {
    const stale = previous.slice('guild:'.length);
    if (stale && stale !== guildId) out.push(`/applications/${appId}/guilds/${stale}/commands`);
  }
  return out;
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
  const source = await getBotTokenSource();
  // The control plane owns the shared application's commands (see the note at the top).
  if (source === 'shared') return { ok: false, reason: 'shared-bot' };
  if (source === 'none') return { ok: false, reason: 'no-bot-token' };

  const resolved = await getBotTokenOnly();
  if (!resolved) return { ok: false, reason: 'no-bot-token' };

  const appRes = await fetch(`${API}/applications/@me`, {
    headers: { Authorization: `Bot ${resolved.token}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!appRes?.ok) return { ok: false, reason: `app-lookup-${appRes?.status ?? 'unreachable'}` };
  const app = (await appRes.json().catch(() => null)) as { id?: string } | null;
  if (!app?.id) return { ok: false, reason: 'app-lookup-malformed' };

  const guildId = (await readSetting('discord_guild_id'))?.trim() || process.env.DISCORD_GUILD_ID?.trim() || '';
  const scope: 'guild' | 'global' = guildId ? 'guild' : 'global';
  const path = guildId
    ? `/applications/${app.id}/guilds/${guildId}/commands`
    : `/applications/${app.id}/commands`;

  // Descriptions carry every language we have, so Discord's own picker is localized too — the
  // member reading a Danish answer also sees a Danish description before they run the command.
  const res = await put(resolved.token, path, await buildLocalizedCommands());
  if (!res?.ok) {
    const detail = res ? `${res.status}: ${await res.text().catch(() => '')}`.slice(0, 300) : 'unreachable';
    log.warn('discord-commands.sync-failed', { scope, detail });
    return { ok: false, scope, reason: detail };
  }

  // Empty every other scope that could still be serving a copy (see staleScopes). Read before
  // writing: the common case is nothing to do, and a GET that comes back empty costs one request
  // where an unconditional PUT would rewrite state on every boot.
  const previous = await readSetting(SYNCED_SCOPE_KEY);
  for (const stalePath of staleScopes(app.id, guildId, previous)) {
    const existing = await listCommands(resolved.token, stalePath);
    if (!existing?.length) continue;
    await put(resolved.token, stalePath, []);
    log.info('discord-commands.cleared-duplicate-scope', { path: stalePath, count: existing.length });
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
