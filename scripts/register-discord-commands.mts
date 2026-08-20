/**
 * Register Anvil's slash commands with a Discord application.
 *
 *   npx tsx scripts/register-discord-commands.mts                 # global (every server, ~1h to appear)
 *   npx tsx scripts/register-discord-commands.mts --guild 1234…   # one server, instantly
 *   npx tsx scripts/register-discord-commands.mts --clear         # remove them again
 *
 * Token comes from DISCORD_BOT_TOKEN, or ANVIL_SHARED_BOT_TOKEN for the managed shared app.
 *
 * GLOBAL vs GUILD matters:
 *   - The shared Anvil app serves every managed clan, so its commands are registered GLOBALLY once
 *     by the operator. Registering per-guild there would mean a write per clan, forever.
 *   - A self-host or bring-your-own-bot clan registers against its own app. `--guild` is the one to
 *     use while testing: global registration is cached by Discord for up to an hour, and waiting an
 *     hour to see a typo is how an afternoon disappears.
 *
 * Registration is a PUT of the full set: whatever is in COMMAND_DEFINITIONS becomes exactly what
 * exists, and anything previously registered and since removed disappears. That's deliberate — it
 * makes this script idempotent and stops a renamed command lingering in members' autocomplete.
 *
 * NOTE: the bot must have been invited with the `applications.commands` scope for its commands to
 * appear in a server. A bot invited with `bot` alone registers fine here and then shows nothing —
 * see the invite link builder in /api/admin/discord/bot, which now requests both.
 */

import { COMMAND_DEFINITIONS } from '../src/lib/discordCommandDefs.ts';

const API = 'https://discord.com/api/v10';

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

const token = process.env.DISCORD_BOT_TOKEN || process.env.ANVIL_SHARED_BOT_TOKEN;
if (!token) {
  console.error('Set DISCORD_BOT_TOKEN (or ANVIL_SHARED_BOT_TOKEN) first.');
  process.exit(1);
}

const guildId = arg('--guild');
const clear = process.argv.includes('--clear');

async function rest(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
}

const meRes = await rest('/applications/@me');
if (!meRes.ok) {
  console.error(`Could not identify the application (${meRes.status}). Is the bot token valid?`);
  process.exit(1);
}
const app = (await meRes.json()) as { id: string; name: string };

const path = guildId ? `/applications/${app.id}/guilds/${guildId}/commands` : `/applications/${app.id}/commands`;
const body = clear ? [] : COMMAND_DEFINITIONS;

const res = await rest(path, { method: 'PUT', body: JSON.stringify(body) });
if (!res.ok) {
  console.error(`Registration failed (${res.status}):`, await res.text().catch(() => ''));
  process.exit(1);
}

const registered = (await res.json()) as { name: string; options?: { name: string }[] }[];
const scope = guildId ? `guild ${guildId} (live immediately)` : 'globally (up to ~1h to appear)';
console.log(`${app.name}: ${registered.length} command(s) ${clear ? 'cleared' : 'registered'} ${scope}`);
for (const c of registered) {
  console.log(`  /${c.name}${c.options?.length ? ` — ${c.options.map((o) => o.name).join(', ')}` : ''}`);
}
