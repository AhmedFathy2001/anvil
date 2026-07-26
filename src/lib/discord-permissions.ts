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
const VIEW_CHANNEL = BigInt(1) << BigInt(10);
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
