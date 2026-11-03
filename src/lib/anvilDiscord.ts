// The Anvil Discord: supporter roles and "new supporter" posts in Anvil's OWN server.
//
// Everything here acts through the platform's own bot (sharedBotToken) — never a clan's bot — in the
// one guild the owner set on /staff/discord. Three things:
//   - roles: each Supporter tier has a role there, plus an optional shared "Anvil Subscriber" role;
//     a person who signed in with Discord and is in that server wears the role of the tier in force
//     (paid, or earned through invites). The decision is pure (lib/anvilDiscordRoles); this is the IO.
//   - a "new supporters" webhook: one post when a membership starts (not a trial, not a renewal).
//   - when: right after any change to someone's supporter state (fire-and-forget, never failing the
//     Gumroad webhook), and an hourly sweep from the lifecycle tick for expiries and late joiners.
// Beta never posts or changes roles: it shares the real Anvil Discord with production.

import { and, asc, eq, gt, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { supporterSubscriptions, users } from '@/db/schema';
import {
  ANVIL_ROLE_KEYS,
  ANVIL_ROLE_NAMES,
  anvilRoleColor,
  botStanding,
  isRealDiscordId,
  planAnvilRoles,
  type AnvilRoleIds,
  type AnvilRoleKey,
} from '@/lib/anvilDiscordRoles';
import { discordRest, sharedBotToken, type DiscordGuildMember, type DiscordRole } from '@/lib/discord-roles';
import { isSafeAutomatedRole } from '@/lib/discordRoleSafety';
import { isDiscordWebhookTarget } from '@/lib/discordWebhookUrl';
import { log } from '@/lib/logger';
import { getPlatformSetting, isPreview, setPlatformSetting } from '@/lib/platformSettings';
import { apexOrigin } from '@/lib/seo';
import { supporterForUser } from '@/lib/supporter';
import { SUPPORTER_TIERS, type SupporterTierId } from '@/lib/supporterTiers';

export const ANVIL_GUILD_KEY = 'anvil_discord_guild_id';
export const ANVIL_SUPPORTERS_WEBHOOK_KEY = 'anvil_discord_supporters_webhook';
export const ANVIL_ROLES_ENABLED_KEY = 'anvil_discord_roles_enabled';
const ROLE_KEY = (k: AnvilRoleKey) => `anvil_discord_role_${k}`;
const SWEEP_AT_KEY = 'anvil_discord_role_sweep_at';
const SWEEP_CURSOR_KEY = 'anvil_discord_role_sweep_cursor';

const SWEEP_EVERY_MS = 60 * 60 * 1000;
const SWEEP_BATCH = 100;
const AUDIT = { 'X-Audit-Log-Reason': 'Anvil Supporter roles' };
/** Manage Roles: the only permission the bot needs here. */
export const ANVIL_BOT_PERMISSIONS = '268435456';

export interface AnvilDiscordConfig {
  guildId: string | null;
  webhook: string | null;
  rolesEnabled: boolean;
  roleIds: AnvilRoleIds;
}

export async function loadAnvilDiscordConfig(): Promise<AnvilDiscordConfig> {
  const [guildId, webhook, enabled, ...ids] = await Promise.all([
    getPlatformSetting(ANVIL_GUILD_KEY),
    getPlatformSetting(ANVIL_SUPPORTERS_WEBHOOK_KEY),
    getPlatformSetting(ANVIL_ROLES_ENABLED_KEY),
    ...ANVIL_ROLE_KEYS.map((k) => getPlatformSetting(ROLE_KEY(k))),
  ]);
  const roleIds: AnvilRoleIds = {};
  ANVIL_ROLE_KEYS.forEach((k, i) => (roleIds[k] = ids[i]));
  return { guildId, webhook, rolesEnabled: enabled === '1', roleIds };
}

// =============================================================================
// Bot status and role creation (the staff page)
// =============================================================================

export interface AnvilRoleStatus {
  key: AnvilRoleKey;
  name: string;
  id: string | null;
  /** Why the bot can't hand this role out, or null when it can. */
  problem: string | null;
}

export interface AnvilBotStatus {
  hasToken: boolean;
  bot: { id: string; name: string } | null;
  inGuild: boolean;
  canManageRoles: boolean;
  roles: AnvilRoleStatus[];
  inviteUrl: string | null;
  error: string | null;
}

async function botUser(token: string): Promise<{ id: string; name: string } | null> {
  const res = await discordRest(token, '/users/@me');
  if (!res.ok) return null;
  const me = (await res.json()) as { id: string; username: string };
  return { id: me.id, name: me.username };
}

/** The guild's roles and the bot's own member record, or null when the bot isn't in it. */
async function guildView(token: string, guildId: string, botId: string): Promise<{ roles: DiscordRole[]; botRoles: string[] } | null> {
  const memberRes = await discordRest(token, `/guilds/${guildId}/members/${botId}`);
  if (!memberRes.ok) return null;
  const member = (await memberRes.json()) as DiscordGuildMember;
  const rolesRes = await discordRest(token, `/guilds/${guildId}/roles`);
  if (!rolesRes.ok) return null;
  return { roles: (await rolesRes.json()) as DiscordRole[], botRoles: member.roles ?? [] };
}

function roleProblem(role: DiscordRole | undefined, topPosition: number, guildId: string): string | null {
  if (!role) return 'Not in the server any more: create the roles again.';
  if (!isSafeAutomatedRole(role, guildId)) return 'Carries moderation permissions, so Anvil will not hand it out. Remove them in Discord.';
  if (role.position >= topPosition) return "Sits above the bot's highest role: drag the bot's role above it in Server Settings → Roles.";
  return null;
}

export async function anvilBotStatus(): Promise<AnvilBotStatus> {
  const cfg = await loadAnvilDiscordConfig();
  const token = sharedBotToken();
  const roles: AnvilRoleStatus[] = ANVIL_ROLE_KEYS.map((key) => ({ key, name: ANVIL_ROLE_NAMES[key], id: cfg.roleIds[key] ?? null, problem: null }));
  const base: AnvilBotStatus = { hasToken: !!token, bot: null, inGuild: false, canManageRoles: false, roles, inviteUrl: null, error: null };
  if (!token) return { ...base, error: 'This deployment has no Discord bot token (DISCORD_BOT_TOKEN).' };
  try {
    const bot = await botUser(token);
    if (!bot) return { ...base, error: 'Discord refused the bot token.' };
    const inviteUrl =
      `https://discord.com/oauth2/authorize?client_id=${bot.id}&scope=bot&permissions=${ANVIL_BOT_PERMISSIONS}` +
      (cfg.guildId ? `&guild_id=${cfg.guildId}&disable_guild_select=true` : '');
    if (!cfg.guildId) return { ...base, bot, inviteUrl };
    const view = await guildView(token, cfg.guildId, bot.id);
    if (!view) return { ...base, bot, inviteUrl };
    const standing = botStanding(view.botRoles, view.roles, cfg.guildId);
    return {
      ...base,
      bot,
      inviteUrl,
      inGuild: true,
      canManageRoles: standing.canManageRoles,
      roles: roles.map((r) =>
        r.id ? { ...r, problem: roleProblem(view.roles.find((g) => g.id === r.id), standing.topPosition, cfg.guildId!) } : r,
      ),
    };
  } catch (err) {
    log.warn('anvil-discord.status-failed', {}, err);
    return { ...base, error: 'Could not reach Discord.' };
  }
}

/**
 * Make sure each Anvil role exists: keep a stored one that is still there, adopt one already named
 * so (only when it carries no moderation powers), else create it with no permissions, the tier's
 * colour, not hoisted. The Subscriber role only when asked; without it, it is no longer managed.
 */
export async function ensureAnvilRoles(includeSubscriber: boolean): Promise<{ ok: true; roleIds: AnvilRoleIds } | { ok: false; error: string }> {
  const token = sharedBotToken();
  const cfg = await loadAnvilDiscordConfig();
  if (!token) return { ok: false, error: 'This deployment has no Discord bot token.' };
  if (!cfg.guildId) return { ok: false, error: 'Set the Anvil server id first.' };
  const guildId = cfg.guildId;
  const rolesRes = await discordRest(token, `/guilds/${guildId}/roles`);
  if (!rolesRes.ok) return { ok: false, error: 'The bot cannot see that server: invite it first.' };
  const existing = (await rolesRes.json()) as DiscordRole[];
  const out: AnvilRoleIds = {};
  for (const key of ANVIL_ROLE_KEYS) {
    if (key === 'subscriber' && !includeSubscriber) {
      out[key] = null;
      continue;
    }
    const stored = cfg.roleIds[key];
    const name = ANVIL_ROLE_NAMES[key];
    const found =
      existing.find((r) => r.id === stored) ??
      existing.find((r) => r.name.toLowerCase() === name.toLowerCase() && isSafeAutomatedRole(r, guildId));
    if (found) {
      out[key] = found.id;
      continue;
    }
    const res = await discordRest(token, `/guilds/${guildId}/roles`, {
      method: 'POST',
      headers: AUDIT,
      // permissions '0' explicitly: left out, Discord copies @everyone's onto the role.
      body: JSON.stringify({ name, permissions: '0', color: anvilRoleColor(key), hoist: false, mentionable: false }),
    });
    if (!res.ok) {
      log.warn('anvil-discord.create-role-failed', { key, status: res.status });
      await saveRoleIds(out);
      return { ok: false, error: res.status === 403 ? 'The bot lacks Manage Roles in that server.' : `Discord refused to create ${name}.` };
    }
    out[key] = ((await res.json()) as DiscordRole).id;
  }
  await saveRoleIds(out);
  return { ok: true, roleIds: out };
}

async function saveRoleIds(ids: AnvilRoleIds): Promise<void> {
  for (const key of ANVIL_ROLE_KEYS) {
    if (key in ids) await setPlatformSetting(ROLE_KEY(key), ids[key] ?? null);
  }
}

// =============================================================================
// Role sync
// =============================================================================

export type SyncOutcome = 'off' | 'no-discord' | 'not-in-server' | 'unchanged' | 'changed' | 'failed';

/** One member's roles brought in line with their tier. Never throws. */
async function syncMember(token: string, cfg: AnvilDiscordConfig, discordId: string, tier: SupporterTierId | null): Promise<SyncOutcome> {
  const guildId = cfg.guildId!;
  const res = await discordRest(token, `/guilds/${guildId}/members/${discordId}`);
  if (res.status === 404) return 'not-in-server';
  if (!res.ok) {
    log.warn('anvil-discord.get-member-failed', { status: res.status });
    return 'failed';
  }
  const member = (await res.json()) as DiscordGuildMember;
  const plan = planAnvilRoles(tier, member.roles ?? [], cfg.roleIds);
  if (plan.add.length === 0 && plan.remove.length === 0) return 'unchanged';
  let failed = false;
  for (const [method, ids] of [['PUT', plan.add], ['DELETE', plan.remove]] as const) {
    for (const roleId of ids) {
      const r = await discordRest(token, `/guilds/${guildId}/members/${discordId}/roles/${roleId}`, { method, headers: AUDIT });
      if (!r.ok) {
        failed = true;
        log.warn('anvil-discord.role-change-failed', { method, status: r.status });
      }
    }
  }
  return failed ? 'failed' : 'changed';
}

function rolesLive(cfg: AnvilDiscordConfig): boolean {
  return cfg.rolesEnabled && !!cfg.guildId && ANVIL_ROLE_KEYS.some((k) => !!cfg.roleIds[k]);
}

/** Bring one login's Anvil roles in line with their supporter state now. Never throws. */
export async function syncAnvilSupporterRoles(userId: number): Promise<SyncOutcome> {
  try {
    if (isPreview()) return 'off';
    const token = sharedBotToken();
    const cfg = await loadAnvilDiscordConfig();
    if (!token || !rolesLive(cfg)) return 'off';
    const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { discordId: true } });
    if (!isRealDiscordId(user?.discordId)) return 'no-discord';
    const state = await supporterForUser(userId);
    return await syncMember(token, cfg, user.discordId, state?.tier.id ?? null);
  } catch (err) {
    log.warn('anvil-discord.sync-failed', { userId }, err);
    return 'failed';
  }
}

/** Run the sweep from the top on the next tick (roles just turned on, or "Sync everyone now"). */
export async function requestAnvilRoleSweep(): Promise<void> {
  await setPlatformSetting(SWEEP_CURSOR_KEY, null);
  await setPlatformSetting(SWEEP_AT_KEY, null);
}

/**
 * The hourly sweep: everyone who has ever held a membership, in batches across ticks, so a term that
 * ran out loses its role and someone who joined the server after paying gains theirs. Driven by the
 * lifecycle tick every minute; does nothing until an hour has passed or a sweep is part-way through.
 */
export async function sweepAnvilSupporterRoles(now = Date.now()): Promise<number> {
  if (isPreview()) return 0;
  const token = sharedBotToken();
  const cfg = await loadAnvilDiscordConfig();
  if (!token || !rolesLive(cfg)) return 0;
  const cursorRaw = await getPlatformSetting(SWEEP_CURSOR_KEY);
  if (cursorRaw == null) {
    const last = Number(await getPlatformSetting(SWEEP_AT_KEY));
    if (Number.isFinite(last) && now - last < SWEEP_EVERY_MS) return 0;
  }
  const cursor = Number(cursorRaw) || 0;
  const batch = await db
    .selectDistinct({ id: users.id, discordId: users.discordId })
    .from(users)
    .innerJoin(supporterSubscriptions, eq(supporterSubscriptions.userId, users.id))
    .where(gt(users.id, cursor))
    .orderBy(asc(users.id))
    .limit(SWEEP_BATCH);
  let changed = 0;
  for (const u of batch) {
    if (!isRealDiscordId(u.discordId)) continue;
    try {
      const state = await supporterForUser(u.id);
      if ((await syncMember(token, cfg, u.discordId, state?.tier.id ?? null)) === 'changed') changed++;
    } catch (err) {
      log.warn('anvil-discord.sweep-member-failed', { userId: u.id }, err);
    }
  }
  if (batch.length === SWEEP_BATCH) {
    await setPlatformSetting(SWEEP_CURSOR_KEY, String(batch[batch.length - 1].id));
  } else {
    await setPlatformSetting(SWEEP_CURSOR_KEY, null);
    await setPlatformSetting(SWEEP_AT_KEY, String(now));
  }
  return changed;
}

// =============================================================================
// "New supporters" posts
// =============================================================================

function escapeMarkdown(s: string): string {
  return s.replace(/([\\*_~`|>#[\]()-])/g, '\\$1');
}

export function newSupporterEmbed(name: string, tier: SupporterTierId, origin: string): Record<string, unknown> {
  const t = SUPPORTER_TIERS[tier];
  return {
    title: `New Anvil ${t.name}`,
    description: `**${escapeMarkdown(name)}** just became an Anvil ${t.name}. Thank you for keeping Anvil running!`,
    color: anvilRoleColor(tier),
    thumbnail: { url: `${origin}/icons/supporter-${tier}.png` },
    url: `${origin}/supporter`,
  };
}

/**
 * Announce a membership that just started, once: claimed on supporter_subscriptions.announced_at
 * whether or not anything is posted (opted out, no webhook, beta), so a later renewal never reads as
 * new. No email, no amount: a name and a tier. Never throws.
 */
export async function announceNewSupporter(subscriptionRowId: number): Promise<boolean> {
  try {
    const [claimed] = await db
      .update(supporterSubscriptions)
      .set({ announcedAt: new Date().toISOString() })
      .where(and(eq(supporterSubscriptions.id, subscriptionRowId), isNull(supporterSubscriptions.announcedAt)))
      .returning({ userId: supporterSubscriptions.userId, tier: supporterSubscriptions.tier });
    if (!claimed || !(claimed.tier in SUPPORTER_TIERS) || isPreview()) return false;
    const hook = await getPlatformSetting(ANVIL_SUPPORTERS_WEBHOOK_KEY);
    if (!hook || !isDiscordWebhookTarget(hook)) return false;
    const user = await db.query.users.findFirst({
      where: eq(users.id, claimed.userId),
      columns: { displayName: true, discordGlobalName: true, discordUsername: true, announceSupporter: true },
    });
    if (!user?.announceSupporter) return false;
    const name = (user.displayName || user.discordGlobalName || user.discordUsername || 'Someone').slice(0, 80);
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [newSupporterEmbed(name, claimed.tier as SupporterTierId, apexOrigin())], allowed_mentions: { parse: [] } }),
    });
    if (!res.ok) log.warn('anvil-discord.announce-failed', { status: res.status });
    return res.ok;
  } catch (err) {
    log.warn('anvil-discord.announce-error', {}, err);
    return false;
  }
}

// =============================================================================
// After a supporter change (fire-and-forget)
// =============================================================================

const inFlight = new Set<Promise<unknown>>();

/**
 * Called after anything changes a person's supporter state: sync their roles and, for a membership
 * that just started, announce it. Never awaited by the caller and never throws, so Discord being slow
 * or down can't fail a Gumroad webhook. `settleAnvilDiscord` lets a test wait for it.
 */
export function afterSupporterChange(userIds: number | number[], opts: { announceRowId?: number | null } = {}): void {
  const ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])];
  const work = (async () => {
    if (opts.announceRowId != null) await announceNewSupporter(opts.announceRowId);
    for (const id of ids) await syncAnvilSupporterRoles(id);
  })().catch((err) => log.warn('anvil-discord.after-change-failed', {}, err));
  inFlight.add(work);
  void work.finally(() => inFlight.delete(work));
}

export async function settleAnvilDiscord(): Promise<void> {
  while (inFlight.size) await Promise.all([...inFlight]);
}
