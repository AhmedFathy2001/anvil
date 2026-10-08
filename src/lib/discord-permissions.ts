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
const MANAGE_GUILD = BigInt(1) << BigInt(5);
const VIEW_CHANNEL = BigInt(1) << BigInt(10);
const MANAGE_NICKNAMES = BigInt(1) << BigInt(27);
const MANAGE_ROLES = BigInt(1) << BigInt(28);
const MANAGE_WEBHOOKS = BigInt(1) << BigInt(29);

export interface GuildManagerCheck {
  ok: boolean;
  guildName: string | null;
  reason?: string;
}

/**
 * Prove that a Discord identity is allowed to bind a guild to an Anvil clan.
 *
 * The bot token is only transport: it lets us read the guild, member and role records. Authority
 * comes from the signed-in human being the guild owner or holding Administrator / Manage Server.
 * Merely knowing a guild id (or being an Anvil clan admin) is intentionally not enough.
 */
export async function discordUserCanManageGuild(
  botToken: string,
  guildId: string,
  discordUserId: string,
): Promise<GuildManagerCheck> {
  const [guildRes, memberRes, rolesRes] = await Promise.all([
    discordRest(botToken, `/guilds/${guildId}`),
    discordRest(botToken, `/guilds/${guildId}/members/${discordUserId}`),
    discordRest(botToken, `/guilds/${guildId}/roles`),
  ]);

  if (guildRes.status === 404 || guildRes.status === 403) {
    return { ok: false, guildName: null, reason: 'The bot is not in that Discord server.' };
  }
  if (!guildRes.ok) {
    return { ok: false, guildName: null, reason: `Discord could not verify that server (${guildRes.status}).` };
  }
  const guild = (await guildRes.json()) as { name?: string; owner_id?: string };
  const guildName = guild.name ?? null;
  if (guild.owner_id === discordUserId) return { ok: true, guildName };

  if (memberRes.status === 404 || memberRes.status === 403) {
    return { ok: false, guildName, reason: 'Your signed-in Discord account is not a member of that server.' };
  }
  if (!memberRes.ok || !rolesRes.ok) {
    const status = !memberRes.ok ? memberRes.status : rolesRes.status;
    return { ok: false, guildName, reason: `Discord could not verify your server permissions (${status}).` };
  }

  const member = (await memberRes.json()) as { roles?: string[] };
  const roleIds = new Set(member.roles ?? []);
  const roles = (await rolesRes.json()) as { id: string; permissions: string }[];
  let permissions = NONE;
  for (const role of roles) {
    if (role.id === guildId || roleIds.has(role.id)) permissions |= BigInt(role.permissions);
  }
  if ((permissions & (ADMINISTRATOR | MANAGE_GUILD)) !== NONE) return { ok: true, guildName };
  return {
    ok: false,
    guildName,
    reason: 'Your signed-in Discord account needs Administrator or Manage Server in that server.',
  };
}

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

// ── General per-channel check ──────────────────────────────────────────────────────────────────
// The same algorithm as botCanManageWebhooks, split so a caller that already holds the guild's
// channel list (which carries every channel's overwrites) can judge ALL of them for the cost of the
// three reads here, instead of three reads per channel. Guides use it to grey out channels the bot
// can't post in and to refuse a bulk post before it creates half a category.

export const PERM = {
  MANAGE_CHANNELS,
  MANAGE_ROLES,
  VIEW_CHANNEL,
  SEND_MESSAGES: BigInt(1) << BigInt(11),
  MANAGE_MESSAGES: BigInt(1) << BigInt(13),
  EMBED_LINKS: BigInt(1) << BigInt(14),
  READ_MESSAGE_HISTORY: BigInt(1) << BigInt(16),
  MANAGE_THREADS: BigInt(1) << BigInt(34),
  SEND_MESSAGES_IN_THREADS: BigInt(1) << BigInt(38),
} as const;

export const PERM_LABEL: Record<keyof typeof PERM, string> = {
  MANAGE_CHANNELS: 'Manage Channels',
  MANAGE_ROLES: 'Manage Roles',
  VIEW_CHANNEL: 'View Channel',
  SEND_MESSAGES: 'Send Messages',
  MANAGE_MESSAGES: 'Manage Messages',
  EMBED_LINKS: 'Embed Links',
  READ_MESSAGE_HISTORY: 'Read Message History',
  MANAGE_THREADS: 'Manage Threads',
  SEND_MESSAGES_IN_THREADS: 'Send Messages in Threads',
};

export type PermName = keyof typeof PERM;

export interface BotAccess {
  /** true = in the server; false = definitively not; null = Discord couldn't be asked. */
  inGuild: boolean | null;
  /** Human reason when inGuild is not true. */
  reason?: string;
  botId: string | null;
  guildId: string;
  /** Guild-level permissions (roles unioned with @everyone). */
  base: bigint;
  roleIds: Set<string>;
  admin: boolean;
}

/** Is the bot in this server, and what does it hold there before any channel overwrite? */
export async function botAccess(botToken: string, guildId: string): Promise<BotAccess> {
  const empty = { base: NONE, roleIds: new Set<string>(), admin: false, guildId };
  const botId = await getBotUserId(botToken);
  if (!botId) return { ...empty, inGuild: null, botId: null, reason: 'Could not resolve the bot user — re-check the bot token.' };
  const memberRes = await discordRest(botToken, `/guilds/${guildId}/members/${botId}`);
  if (memberRes.status === 404 || memberRes.status === 403) {
    return { ...empty, inGuild: false, botId, reason: "The bot isn't in your Discord server. Invite it from Settings → Discord first." };
  }
  if (!memberRes.ok) return { ...empty, inGuild: null, botId, reason: `Could not reach Discord (${memberRes.status}).` };
  const member = (await memberRes.json()) as { roles?: string[] };
  const roleIds = new Set(member.roles ?? []);
  const rolesRes = await discordRest(botToken, `/guilds/${guildId}/roles`);
  if (!rolesRes.ok) return { ...empty, inGuild: null, botId, roleIds, reason: `Could not read server roles (Discord ${rolesRes.status}).` };
  const roles = (await rolesRes.json()) as { id: string; permissions: string }[];
  const permById = new Map(roles.map((r) => [r.id, BigInt(r.permissions)]));
  let base = permById.get(guildId) ?? NONE;
  for (const rid of roleIds) base |= permById.get(rid) ?? NONE;
  return { inGuild: true, botId, guildId, base, roleIds, admin: (base & ADMINISTRATOR) !== NONE };
}

/** The bot's effective permissions in one channel, given that channel's overwrites. */
export function channelPermissions(access: BotAccess, overwrites: RawOverwrite[] | undefined): bigint {
  if (access.admin) return ~NONE;
  const ow = overwrites ?? [];
  let perms = access.base;
  const everyone = ow.find((o) => o.id === access.guildId);
  if (everyone) perms = (perms & ~BigInt(everyone.deny)) | BigInt(everyone.allow);
  let allow = NONE;
  let deny = NONE;
  for (const o of ow) {
    if (o.type === OVERWRITE_ROLE && o.id !== access.guildId && access.roleIds.has(o.id)) {
      allow |= BigInt(o.allow);
      deny |= BigInt(o.deny);
    }
  }
  perms = (perms & ~deny) | allow;
  const mine = ow.find((o) => o.type === OVERWRITE_MEMBER && o.id === access.botId);
  if (mine) perms = (perms & ~BigInt(mine.deny)) | BigInt(mine.allow);
  return perms;
}

/**
 * Which of `needed` the bot lacks, as labels. Without View Channel nothing else matters, so that
 * alone is reported. Exact for text, announcement and forum channels: the guild channel list carries
 * each one's effective overwrites (a category-synced channel holds a copy of its category's).
 */
export function missingPermissions(perms: bigint, needed: PermName[]): string[] {
  if ((perms & PERM.VIEW_CHANNEL) === NONE) return [PERM_LABEL.VIEW_CHANNEL];
  return needed.filter((n) => (perms & PERM[n]) === NONE).map((n) => PERM_LABEL[n]);
}

export type { RawOverwrite };
