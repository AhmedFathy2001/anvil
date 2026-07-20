import { NextResponse } from 'next/server';
import { db } from '@/db';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';
import {
  discordRest,
  getBotCredentials,
  getBotTokenSource,
  isSharedBotAvailable,
} from '@/lib/discord-roles';

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

// Validate a token by asking Discord who it is. Returns the bot's display name, or null if the
// token is missing/invalid.
async function fetchBotUser(token: string): Promise<string | null> {
  const res = await discordRest(token, '/users/@me');
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string; username?: string; global_name?: string };
  if (!user?.id) return null;
  return user.global_name || user.username || 'bot';
}

// Assemble the status the UI renders — resolved token source + a live "connected as" check, never
// the token itself.
async function buildStatus() {
  const source = await getBotTokenSource();
  const creds = await getBotCredentials();
  const botUser = creds ? await fetchBotUser(creds.botToken) : null;
  return {
    source,
    configured: source !== 'none',
    // null when there's no token to check; true/false when there is.
    tokenValid: creds ? botUser !== null : null,
    botUser,
    guildId: await readGuildId(),
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
