import { NextResponse } from 'next/server';
import { db } from '@/db';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import {
  discordRest,
  getBotTokenOnly,
  getBotTokenSource,
  isSharedBotAvailable,
} from '@/lib/discord-roles';
import { botGuildStatus } from '@/lib/discord-permissions';

// The bot connection surface. The bot TOKEN is a secret: it's stored in the settings table under
// `discord_bot_token` when an admin brings their own, but is deliberately NOT in the settings API's
// EXPOSED_KEYS and is never returned by any endpoint here — only its resolved source + a validated
// "connected as" name are surfaced. The (non-secret) guild ID is co-located here since it's the
// other half of the bot connection.

async function upsertSetting(key: string, value: string | null): Promise<void> {
  const existing = await db.query.settings.findFirst({ where: eq(settings.key, key) });
  if (existing) {
    await db.update(settings).set({ value }).where(eq(settings.key, key));
  } else {
    await db.insert(settings).values({ key, value });
  }
}

async function readGuildId(): Promise<string> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, 'discord_guild_id') });
  return row?.value || process.env.DISCORD_GUILD_ID || '';
}

// Validate a token by asking Discord who it is. Returns the bot's id + display name, or null if the
// token is missing/invalid. The id doubles as the OAuth client_id in the invite link below (for a
// bot, application id == bot user id).
async function fetchBotUser(token: string): Promise<{ id: string; name: string } | null> {
  const res = await discordRest(token, '/users/@me');
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string; username?: string; global_name?: string };
  if (!user?.id) return null;
  return { id: user.id, name: user.global_name || user.username || 'bot' };
}

// Permissions requested by the invite link: Manage Channels + Manage Roles + Manage Nicknames +
// Manage Webhooks (the four the features need), plus the basics to post: View Channel, Send
// Messages, Embed Links, Attach Files, Read Message History.
const INVITE_PERMISSIONS = '939641872';

// Ready-made "add the bot to my server" link. guild_id pre-selects the configured server so the
// admin can't add it to the wrong one; without a server ID yet, Discord asks them to pick.
function buildInviteUrl(clientId: string, guildId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'bot',
    permissions: INVITE_PERMISSIONS,
  });
  if (guildId) {
    params.set('guild_id', guildId);
    params.set('disable_guild_select', 'true');
  }
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

// Assemble the status the UI renders — resolved token source + a live "connected as" check, never
// the token itself.
async function buildStatus() {
  const source = await getBotTokenSource();
  // Token-only resolution: the bot must be identifiable (and invitable) BEFORE a server ID is set.
  const resolved = await getBotTokenOnly();
  const bot = resolved ? await fetchBotUser(resolved.token) : null;
  const guildId = await readGuildId();

  // A working token says nothing about whether the bot was ever invited to THIS clan's server —
  // with a shared bot the token is always valid, so membership is the only honest signal.
  const guild =
    resolved && bot && guildId
      ? await botGuildStatus(resolved.token, bot.id, guildId)
      : { inGuild: null, guildName: null, missingPermissions: [] as string[] };

  return {
    source,
    configured: source !== 'none',
    // null when there's no token to check; true/false when there is.
    tokenValid: resolved ? bot !== null : null,
    botUser: bot?.name ?? null,
    guildId,
    // null = unknown (no token / no server ID / Discord unreachable), false = not invited.
    inGuild: guild.inGuild,
    guildName: guild.guildName,
    missingPermissions: guild.missingPermissions,
    inviteUrl: bot ? buildInviteUrl(bot.id, guildId) : null,
    sharedAvailable: isSharedBotAvailable(),
  };
}

export async function GET() {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await buildStatus());
}

// PUT { botToken?, guildId? }
//   guildId  — set or clear the (non-secret) Discord server ID.
//   botToken — a non-empty value is validated with Discord and stored as the BYO override; an empty
//              string clears it, reverting to the env / shared bot.
export async function PUT(request: Request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { botToken, guildId } = body as Record<string, unknown>;

  if (typeof guildId === 'string') {
    await upsertSetting('discord_guild_id', guildId.trim() || null);
  }

  if (typeof botToken === 'string') {
    const trimmed = botToken.trim();
    if (trimmed) {
      const botUser = await fetchBotUser(trimmed);
      if (!botUser) {
        return NextResponse.json(
          { error: 'That bot token was rejected by Discord — double-check you copied the whole token.' },
          { status: 400 },
        );
      }
      await upsertSetting('discord_bot_token', trimmed);
    } else {
      // Clear the BYO override → fall back to the env / shared bot.
      await upsertSetting('discord_bot_token', null);
    }
  }

  return NextResponse.json(await buildStatus());
}
