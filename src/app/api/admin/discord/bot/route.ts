import { NextResponse } from 'next/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { settings, users } from '@/db/schema';
import { requireClan } from '@/lib/clanContext';
import { getSetting } from '@/lib/settings';
import { verifyUser } from '@/lib/auth';
import { atLeast } from '@/lib/clanRoles';
import {
  clanGuildId,
  discordRest,
  getBotTokenOnly,
  getBotTokenSource,
  isSharedBotAvailable,
  sharedBotToken,
} from '@/lib/discord-roles';
import { botGuildStatus, discordUserCanManageGuild } from '@/lib/discord-permissions';
import { syncClanCommandsInBackground } from '@/lib/discordCommandSync';

// The bot connection surface. The bot TOKEN is a secret: it's stored in the settings table under
// `discord_bot_token` when an admin brings their own, but is deliberately NOT in the settings API's
// EXPOSED_KEYS and is never returned by any endpoint here — only its resolved source + a validated
// "connected as" name are surfaced. The (non-secret) guild ID is co-located here since it's the
// other half of the bot connection.


async function readGuildId(clanId: number): Promise<string> {
  // No env fallback — see clanGuildId. This surface is where the leak was visible: it reported a
  // clan as connected to the operator's guild before that clan had chosen one.
  return clanGuildId(clanId);
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
// Messages, Embed Links, Attach Files, Read Message History — and for guides: Manage Threads (a bot
// can't delete even its own forum post without it), Send Messages in Threads, and Change Nickname
// (the per-server bot name, lib/discordIdentity).
const INVITE_PERMISSIONS = '293064526864';

// Ready-made "add the bot to my server" link. guild_id pre-selects the configured server so the
// admin can't add it to the wrong one; without a server ID yet, Discord asks them to pick.
//
// BOTH scopes are requested. `bot` is what lets it post and manage channels; `applications.commands`
// is what makes its slash commands (/bingo …) appear in the server's command list. They're granted
// independently, so a bot invited before commands existed is in the server, working, and shows no
// commands at all — with nothing in the UI to explain why. Re-opening this link and re-authorizing
// adds the missing scope; it doesn't kick the bot, reset its permissions, or disturb its channels.
function buildInviteUrl(clientId: string, guildId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'bot applications.commands',
    permissions: INVITE_PERMISSIONS,
  });
  if (guildId) {
    params.set('guild_id', guildId);
    params.set('disable_guild_select', 'true');
  }
  // URLSearchParams renders the space in `bot applications.commands` as `+`. Percent-encode it back:
  // `%20` is what Discord's own generator emits, and it's the form the onboarding wizard's invite
  // (Anvil.Admin lib/onboardOAuth) already settled on. Nothing else here can contain a literal `+`
  // (an id, a permissions bitfield, a boolean), so the blanket replace is safe.
  return `https://discord.com/oauth2/authorize?${params.toString().replace(/\+/g, '%20')}`;
}

// Assemble the status the UI renders — resolved token source + a live "connected as" check, never
// the token itself.
async function buildStatus(clanId: number) {
  const source = await getBotTokenSource(clanId);
  // Token-only resolution: the bot must be identifiable (and invitable) BEFORE a server ID is set.
  const resolved = await getBotTokenOnly(clanId);
  const bot = resolved ? await fetchBotUser(resolved.token) : null;
  const guildId = await readGuildId(clanId);
  const verifiedGuildId = (await getSetting(clanId, 'discord_guild_verified_id'))?.trim() || '';
  const guildVerified = !!guildId && verifiedGuildId === guildId;

  // A working token says nothing about whether the bot was ever invited to THIS clan's server —
  // with a shared bot the token is always valid, so membership is the only honest signal.
  const guild =
    resolved && bot && guildVerified
      ? await botGuildStatus(resolved.token, bot.id, guildId)
      : { inGuild: null, guildName: null, missingPermissions: [] as string[] };

  return {
    source,
    configured: source !== 'none',
    // null when there's no token to check; true/false when there is.
    tokenValid: resolved ? bot !== null : null,
    botUser: bot?.name ?? null,
    guildId,
    // A legacy/unverified id is display-only. getBotCredentials refuses it, so no bot-driven
    // feature can act in that server until a Discord manager proves the binding.
    guildVerified,
    // null = unknown (no token / no server ID / Discord unreachable), false = not invited.
    inGuild: guild.inGuild,
    guildName: guild.guildName,
    missingPermissions: guild.missingPermissions,
    // Do not preselect a server Anvil has not proved belongs to this clan. A legacy/forged ID is
    // inert and the ordinary invite lets the Discord manager choose the real server themselves.
    inviteUrl: bot ? buildInviteUrl(bot.id, guildVerified ? guildId : '') : null,
    sharedAvailable: isSharedBotAvailable(),
  };
}

export async function GET() {
  const clan = await requireClan();
  const actor = await verifyUser();
  if (!actor || !atLeast(actor.role, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(await buildStatus(clan.id));
}

// PUT { botToken?, guildId? }
//   guildId  — set or clear the (non-secret) Discord server ID.
//   botToken — a non-empty value is validated with Discord and stored as the BYO override; an empty
//              string clears it, reverting to the env / shared bot.
export async function PUT(request: Request) {
  const clan = await requireClan();
  const actor = await verifyUser();
  if (!actor || !atLeast(actor.role, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { botToken, guildId } = body as Record<string, unknown>;

  if (botToken !== undefined && typeof botToken !== 'string') {
    return NextResponse.json({ error: 'botToken must be a string.' }, { status: 400 });
  }
  if (guildId !== undefined && typeof guildId !== 'string') {
    return NextResponse.json({ error: 'guildId must be a string.' }, { status: 400 });
  }

  const trimmedToken = typeof botToken === 'string' ? botToken.trim() : null;
  const targetGuildId = typeof guildId === 'string' ? guildId.trim() : null;

  if (targetGuildId && !/^\d{15,22}$/.test(targetGuildId)) {
    return NextResponse.json({ error: 'Enter a valid numeric Discord server ID.' }, { status: 400 });
  }

  // Resolve the token that would be active AFTER this write. Validation happens before any setting
  // is persisted, so a rejected token or foreign guild can never leave a half-saved connection.
  const currentResolved = await getBotTokenOnly(clan.id);
  const effectiveToken =
    trimmedToken === null
      ? currentResolved?.token ?? null
      : trimmedToken || sharedBotToken();

  if (typeof botToken === 'string') {
    if (trimmedToken) {
      const botUser = await fetchBotUser(trimmedToken);
      if (!botUser) {
        return NextResponse.json(
          { error: 'That bot token was rejected by Discord — double-check you copied the whole token.' },
          { status: 400 },
        );
      }
    }
  }

  if (targetGuildId) {
    if (!effectiveToken) {
      return NextResponse.json(
        { error: 'Connect a Discord bot before binding a server.' },
        { status: 400 },
      );
    }
    const row = await db.query.users.findFirst({
      where: eq(users.id, actor.userId),
      columns: { discordId: true },
    });
    if (!row?.discordId) {
      return NextResponse.json(
        { error: 'Sign in with Discord before binding a Discord server.' },
        { status: 403 },
      );
    }
    const permission = await discordUserCanManageGuild(effectiveToken, targetGuildId, row.discordId);
    if (!permission.ok) {
      return NextResponse.json(
        { error: permission.reason || 'Discord did not confirm that you can manage that server.' },
        { status: 403 },
      );
    }
  }

  class GuildAlreadyClaimedError extends Error {}
  try {
    await db.transaction(async (tx) => {
      if (targetGuildId) {
        // Serialize claims for this guild. The settings table is keyed by (clan,key), so this lock
        // closes the race between checking a value and inserting it for two different clans.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`anvil-discord-guild:${targetGuildId}`}))`);
        const verifiedClaims = tx
          .select({ clanId: settings.clanId })
          .from(settings)
          .where(
            and(
              eq(settings.key, 'discord_guild_verified_id'),
              eq(settings.value, targetGuildId),
            ),
          );
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
        if (claims.some((claim) => claim.clanId !== clan.id)) throw new GuildAlreadyClaimedError();
      }

      const write = async (key: string, value: string | null) => {
        await tx
          .insert(settings)
          .values({ clanId: clan.id, key, value })
          .onConflictDoUpdate({ target: [settings.clanId, settings.key], set: { value } });
      };
      if (typeof botToken === 'string') await write('discord_bot_token', trimmedToken || null);
      if (typeof guildId === 'string') {
        await write('discord_guild_id', targetGuildId || null);
        // Matching ids are the capability marker read by getBotCredentials. Clearing or changing
        // the guild clears/replaces it in this same transaction—there is no usable unverified gap.
        await write('discord_guild_verified_id', targetGuildId || null);
      }
    });
  } catch (error) {
    if (error instanceof GuildAlreadyClaimedError) {
      return NextResponse.json(
        { error: 'That Discord server is already connected to another Anvil clan.' },
        { status: 409 },
      );
    }
    throw error;
  }

  if (typeof botToken === 'string' || typeof guildId === 'string') {
    // We've validated everything and committed both halves atomically. Command sync is deliberately
    // best-effort; Discord being temporarily unavailable must not roll back a proven binding.
    syncClanCommandsInBackground(typeof guildId === 'string' ? 'guild-changed' : 'bot-token-saved');
  }

  return NextResponse.json(await buildStatus(clan.id));
}
