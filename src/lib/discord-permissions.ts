/**
 * Compute the bot's *effective* permission in a single channel, so the admin UI can tell them
 * "the bot can't create a webhook here" before they try (instead of only reacting to a 403).
 *
 * Manage Webhooks is almost always granted per-channel via permission overwrites, so a guild-wide
 * role check would lie — this runs Discord's actual permission algorithm for the picked channel.
 * A bot can never be the guild owner, so the owner short-circuit is omitted.
 *
 * Reuses discordRest (429 handling) from lib/discord-roles.ts.
 */
import { discordRest } from '@/lib/discord-roles';

// Permission bit flags (https://discord.com/developers/docs/topics/permissions). 64-bit — use BigInt.
// Built with the BigInt() constructor (not `1n` literals) so type-checking passes under the repo's
// ES2017 tsconfig target; the actual build (SWC) handles BigInt regardless.
const NONE = BigInt(0);
const ADMINISTRATOR = BigInt(1) << BigInt(3);
const MANAGE_CHANNELS = BigInt(1) << BigInt(4);
const VIEW_CHANNEL = BigInt(1) << BigInt(10);
const MANAGE_NICKNAMES = BigInt(1) << BigInt(27);
const MANAGE_ROLES = BigInt(1) << BigInt(28);
const MANAGE_WEBHOOKS = BigInt(1) << BigInt(29);

// Permission overwrite target types.
const OVERWRITE_ROLE = 0;
const OVERWRITE_MEMBER = 1;

export interface WebhookPermCheck {
  ok: boolean;
  reason?: string;
}

// The bot's own user id is stable for the process lifetime; cache it so a per-channel check is
// just the member + roles + channel reads.
let cachedBotUserId: string | null = null;

async function getBotUserId(botToken: string): Promise<string | null> {
  if (cachedBotUserId) return cachedBotUserId;
  const res = await discordRest(botToken, '/users/@me');
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  cachedBotUserId = user.id ?? null;
  return cachedBotUserId;
}

interface RawOverwrite {
  id: string;
  type: number; // 0 = role, 1 = member
  allow: string;
  deny: string;
}

/**
 * Can the bot create a webhook in `channelId`? Returns { ok, reason } — reason is a human message
 * when it can't (bot not in server, can't see the channel, or missing Manage Webhooks). Any Discord
 * read failure returns ok:false with a reason; callers may choose to fall back to attempting the
 * create anyway (the create surfaces the definitive 403).
 */
export async function botCanManageWebhooks(
  botToken: string,
  guildId: string,
  channelId: string,
): Promise<WebhookPermCheck> {
  const botId = await getBotUserId(botToken);
  if (!botId) return { ok: false, reason: 'Could not resolve the bot user — re-check the bot token.' };

  // The bot's roles in this guild.
  const memberRes = await discordRest(botToken, `/guilds/${guildId}/members/${botId}`);
  if (!memberRes.ok) {
    if (memberRes.status === 404) return { ok: false, reason: 'The bot is not a member of this server.' };
    return { ok: false, reason: `Could not read the bot's roles (Discord ${memberRes.status}).` };
  }
  const member = (await memberRes.json()) as { roles?: string[] };
  const memberRoleIds = new Set(member.roles ?? []);

  // Guild roles → permission bitfields.
  const rolesRes = await discordRest(botToken, `/guilds/${guildId}/roles`);
  if (!rolesRes.ok) return { ok: false, reason: `Could not read server roles (Discord ${rolesRes.status}).` };
  const roles = (await rolesRes.json()) as { id: string; permissions: string }[];
  const permById = new Map(roles.map((r) => [r.id, BigInt(r.permissions)]));

  // Base permissions: @everyone (role id == guild id) unioned with each of the bot's roles.
  let base = permById.get(guildId) ?? NONE;
  for (const rid of memberRoleIds) base |= permById.get(rid) ?? NONE;
  // Administrator grants everything and ignores channel overwrites.
  if ((base & ADMINISTRATOR) !== NONE) return { ok: true };

  // The picked channel's overwrites.
  const chRes = await discordRest(botToken, `/channels/${channelId}`);
  if (!chRes.ok) {
    if (chRes.status === 404) return { ok: false, reason: 'That channel no longer exists — reload the list.' };
    if (chRes.status === 403) return { ok: false, reason: "The bot can't see this channel." };
    return { ok: false, reason: `Could not read the channel (Discord ${chRes.status}).` };
  }
  const channel = (await chRes.json()) as { permission_overwrites?: RawOverwrite[] };
  const overwrites = channel.permission_overwrites ?? [];

  // Apply overwrites in Discord's order: @everyone, then aggregated role overwrites, then member.
  let perms = base;

  const everyone = overwrites.find((o) => o.id === guildId);
  if (everyone) perms = (perms & ~BigInt(everyone.deny)) | BigInt(everyone.allow);

  let roleAllow = NONE;
  let roleDeny = NONE;
  for (const o of overwrites) {
    if (o.type === OVERWRITE_ROLE && o.id !== guildId && memberRoleIds.has(o.id)) {
      roleAllow |= BigInt(o.allow);
      roleDeny |= BigInt(o.deny);
    }
  }
  perms = (perms & ~roleDeny) | roleAllow;

  const memberOverwrite = overwrites.find((o) => o.type === OVERWRITE_MEMBER && o.id === botId);
  if (memberOverwrite) perms = (perms & ~BigInt(memberOverwrite.deny)) | BigInt(memberOverwrite.allow);

  if ((perms & VIEW_CHANNEL) === NONE) return { ok: false, reason: "The bot can't see this channel." };
  if ((perms & MANAGE_WEBHOOKS) === NONE) {
    return { ok: false, reason: 'The bot lacks the "Manage Webhooks" permission on this channel.' };
  }
  return { ok: true };
}

// ── Guild-level status ─────────────────────────────────────────────────────────────────────────
// A valid bot TOKEN says nothing about whether that bot was ever invited to *this* clan's server —
// managed clans all share one token, so "the token works" was reporting a healthy bot to clans whose
// Discord it had never joined. This resolves the question the admin actually cares about: is the bot
// in my server, and can it do its jobs there?

// Guild-wide permissions the bot needs for role sync, nickname sync and team channels. Manage
// Webhooks is deliberately NOT here: it's usually granted per-channel via an overwrite, which
// botCanManageWebhooks() checks properly at the point of use.
const REQUIRED_GUILD_PERMS: { flag: bigint; label: string }[] = [
  { flag: MANAGE_ROLES, label: 'Manage Roles' },
  { flag: MANAGE_CHANNELS, label: 'Manage Channels' },
  { flag: MANAGE_NICKNAMES, label: 'Manage Nicknames' },
];

export interface GuildStatus {
  /** true = the bot is a member, false = definitively not, null = Discord couldn't be asked. */
  inGuild: boolean | null;
  guildName: string | null;
  /** Guild-wide permissions the bot is missing. Empty when it's fine, unknown, or Administrator. */
  missingPermissions: string[];
}

export async function botGuildStatus(
  botToken: string,
  botUserId: string,
  guildId: string,
): Promise<GuildStatus> {
  const memberRes = await discordRest(botToken, `/guilds/${guildId}/members/${botUserId}`);
  if (memberRes.status === 404 || memberRes.status === 403) {
    // Unknown guild / no access — for a bot both mean "not in that server" (or a wrong server ID).
    return { inGuild: false, guildName: null, missingPermissions: [] };
  }
  if (!memberRes.ok) return { inGuild: null, guildName: null, missingPermissions: [] };

  const member = (await memberRes.json()) as { roles?: string[] };
  const memberRoleIds = new Set(member.roles ?? []);

  const [guildRes, rolesRes] = await Promise.all([
    discordRest(botToken, `/guilds/${guildId}`),
    discordRest(botToken, `/guilds/${guildId}/roles`),
  ]);

  const guildName = guildRes.ok ? ((await guildRes.json()) as { name?: string }).name ?? null : null;
  if (!rolesRes.ok) return { inGuild: true, guildName, missingPermissions: [] };

  const roles = (await rolesRes.json()) as { id: string; permissions: string }[];
  const permById = new Map(roles.map((r) => [r.id, BigInt(r.permissions)]));
  // Base permissions: @everyone (role id == guild id) unioned with each of the bot's roles.
  let perms = permById.get(guildId) ?? NONE;
  for (const rid of memberRoleIds) perms |= permById.get(rid) ?? NONE;
  if ((perms & ADMINISTRATOR) !== NONE) return { inGuild: true, guildName, missingPermissions: [] };

  const missing = REQUIRED_GUILD_PERMS.filter((p) => (perms & p.flag) === NONE).map((p) => p.label);
  return { inGuild: true, guildName, missingPermissions: missing };
}
