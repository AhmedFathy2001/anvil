// Taking back the roles a HAND-MADE Discord link earned, when an admin removes or replaces the link.
//
// Narrow on purpose. One Discord account, one clan's own server, and only roles in that clan's
// managed set (lib/discord-roles anvilManagedRoleIds, built from the same mapping role sync uses to
// GIVE roles). Which of those are taken is decided by the pure rolesToRemoveOnUnlink
// (lib/discordRoleSafety). It never kicks, never touches a role outside the set, and never changes
// a nickname: role sync only ever SETS a nickname for a linked member and has no path that clears
// one, so there is nothing of Anvil's to undo there.
//
// The link itself is always removed first (api/admin/discord/link-member). Whatever happens here is
// reported in words, per role, and never undoes or blocks that.

import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanAuditLog } from '@/db/schema';
import { botStanding } from '@/lib/anvilDiscordRoles';
import {
  adminLinkedSeats,
  anvilManagedRoleIds,
  discordProvenForOtherSeat,
  discordRest,
  getBotCredentials,
  type DiscordGuildMember,
  type DiscordRole,
} from '@/lib/discord-roles';
import { rolesToRemoveOnUnlink, storedDiscordLink } from '@/lib/discordRoleSafety';
import { log } from '@/lib/logger';
import { seatInClan } from '@/lib/roster';

export type RoleRemoval =
  /** Discord was asked. `removed` are role names taken off; `failed` and `skipped` say why not, per role. */
  | { status: 'done'; removed: string[]; failed: { role: string; reason: string }[]; skipped: { role: string; reason: string }[] }
  /** Nothing was asked of Discord because the account still rightly holds its roles. */
  | { status: 'kept'; message: string }
  /** The account is not in the server, so it holds no roles there. */
  | { status: 'not-in-server' }
  /** Nothing could be removed: the bot is not connected, lacks permission, or the server could not be read. */
  | { status: 'refused'; message: string };

const AUDIT = { 'X-Audit-Log-Reason': 'Anvil: hand-made Discord link removed' };

const SKIP_REASON = {
  'server-owner': 'Discord does not let a bot change the server owner’s roles',
  'above-bot': 'it sits above the Anvil bot’s role in Server Settings → Roles',
} as const;

/**
 * Take this clan's Anvil-managed roles off one Discord account in the clan's own server.
 *
 * Skipped (`kept`) while the account still earns roles here some other way: a sign-in, sign-up or
 * plugin report ties it to a live seat in this clan, or another hand link by this clan still points
 * at it. Call it AFTER the link being removed has been cleared, so that link is not counted.
 */
export async function removeAnvilRolesFromAccount(clanId: number, discordUserId: string): Promise<RoleRemoval> {
  if (await discordProvenForOtherSeat(clanId, null, discordUserId)) {
    return { status: 'kept', message: 'Their roles were left: this Discord account signed in to Anvil as a member of this clan, so it still earns them.' };
  }
  if ((await adminLinkedSeats(clanId, discordUserId)).length > 0) {
    return { status: 'kept', message: 'Their roles were left: another character is still linked by hand to the same Discord account.' };
  }

  const creds = await getBotCredentials(clanId);
  if (!creds) return { status: 'refused', message: 'The Anvil bot is not connected to your server, so no roles were removed. Remove them in Discord.' };
  const { botToken, guildId } = creds;
  const cantRead = (what: string, status: number): RoleRemoval => {
    log.warn('discord-unlink.read-fail', { what, status, guildId });
    return { status: 'refused', message: `Anvil could not read your server’s ${what} (Discord ${status}), so no roles were removed. Remove them in Discord.` };
  };

  const meRes = await discordRest(botToken, '/users/@me');
  if (!meRes.ok) return cantRead('bot', meRes.status);
  const botId = ((await meRes.json()) as { id: string }).id;

  const rolesRes = await discordRest(botToken, `/guilds/${guildId}/roles`);
  if (!rolesRes.ok) return cantRead('roles', rolesRes.status);
  const guildRoles = (await rolesRes.json()) as DiscordRole[];

  const botRes = await discordRest(botToken, `/guilds/${guildId}/members/${botId}`);
  if (!botRes.ok) return cantRead('bot', botRes.status);
  const standing = botStanding(((await botRes.json()) as DiscordGuildMember).roles ?? [], guildRoles, guildId);
  if (!standing.canManageRoles) {
    return { status: 'refused', message: 'The Anvil bot does not have the Manage Roles permission in your server, so no roles were removed. Remove them in Discord.' };
  }

  const memberRes = await discordRest(botToken, `/guilds/${guildId}/members/${discordUserId}`);
  if (memberRes.status === 404) return { status: 'not-in-server' };
  if (!memberRes.ok) return cantRead('members', memberRes.status);
  const held = ((await memberRes.json()) as DiscordGuildMember).roles ?? [];

  const managed = await anvilManagedRoleIds(clanId, guildRoles);
  if (!managed) return { status: 'refused', message: 'The Anvil bot is not connected to your server, so no roles were removed. Remove them in Discord.' };

  // Not knowing the owner is not a reason to stop: Discord then answers for itself, per role.
  const guildRes = await discordRest(botToken, `/guilds/${guildId}`);
  const ownerId = guildRes.ok ? ((await guildRes.json()) as { owner_id?: string }).owner_id ?? null : null;

  const decision = rolesToRemoveOnUnlink({
    guildId,
    managedRoleIds: managed,
    heldRoleIds: held,
    guildRoles,
    botTopPosition: standing.topPosition,
    isGuildOwner: ownerId === discordUserId,
  });

  const removed: string[] = [];
  const failed: { role: string; reason: string }[] = [];
  for (const role of decision.remove) {
    const res = await discordRest(botToken, `/guilds/${guildId}/members/${discordUserId}/roles/${role.id}`, {
      method: 'DELETE',
      headers: AUDIT,
    });
    if (res.ok) removed.push(role.name);
    else {
      log.warn('discord-unlink.remove-fail', { status: res.status, roleId: role.id, guildId });
      failed.push({
        role: role.name,
        reason: res.status === 403 ? 'Discord refused: the Anvil bot is not allowed to change this role' : `Discord error ${res.status}`,
      });
    }
  }
  return {
    status: 'done',
    removed,
    failed,
    skipped: decision.skipped.map((s) => ({ role: s.name, reason: SKIP_REASON[s.reason] })),
  };
}

/** One sentence (or a few) for the admin: what happened to the roles. Role names only. */
export function roleRemovalMessage(r: RoleRemoval): string {
  if (r.status === 'kept' || r.status === 'refused') return r.message;
  if (r.status === 'not-in-server') return 'They are not in your server, so there were no roles to remove.';
  const parts: string[] = [];
  if (r.removed.length) parts.push(`Roles removed: ${r.removed.join(', ')}.`);
  for (const f of r.failed) parts.push(`Not removed: ${f.role} (${f.reason}). Remove it in Discord.`);
  for (const s of r.skipped) parts.push(`Left: ${s.role} (${s.reason}).`);
  return parts.length ? parts.join(' ') : 'They held no roles Anvil gives, so nothing was removed.';
}

/** The audit line for a role removal that reached Discord. Character and role NAMES, never a Discord id. */
async function auditRolesRemoved(o: { clanId: number; seatId: number; rsn: string; actorUserId: number; removal: RoleRemoval }): Promise<void> {
  if (o.removal.status !== 'done' || (o.removal.removed.length === 0 && o.removal.failed.length === 0)) return;
  const { removed, failed } = o.removal;
  await db
    .insert(clanAuditLog)
    .values({
      clanId: o.clanId,
      clanMemberId: o.seatId,
      eventType: 'discord_roles_removed',
      actorUserId: o.actorUserId,
      oldValue: JSON.stringify({ rsn: o.rsn, roles: removed }),
      newValue: failed.length ? JSON.stringify({ notRemoved: failed.map((f) => f.role) }) : null,
      notes:
        `Roles removed from the Discord account that was linked by hand to ${o.rsn}: ${removed.join(', ') || 'none'}` +
        (failed.length ? `. Not removed: ${failed.map((f) => f.role).join(', ')}` : ''),
    })
    .catch(() => {});
}

export type UnlinkResult =
  | { ok: false; status: 404 | 409; error: string }
  | { ok: true; roles: RoleRemoval | null; message: string };

/**
 * Remove a link THIS clan's admin made by hand, and (when asked) take back the roles it earned.
 * The link goes first and stays gone whatever Discord then says about the roles.
 */
export async function removeHandLink(o: {
  clanId: number;
  clanMemberId: number;
  actorUserId: number;
  removeRoles: boolean;
}): Promise<UnlinkResult> {
  const member = await seatInClan(o.clanId, o.clanMemberId);
  if (!member) return { ok: false, status: 404, error: 'Member not found' };

  // Only a link THIS clan made. Anything else stored on the character (a sign-in's id, another
  // clan's link) is not this clan's to clear. Read first: the id is needed after it is cleared.
  const linkIsOurs = and(eq(accounts.id, member.accountId), eq(accounts.discordIdSource, 'admin'), eq(accounts.discordIdLinkedClanId, o.clanId));
  const [stored] = await db.select({ discordId: accounts.discordId }).from(accounts).where(linkIsOurs).limit(1);
  const [cleared] = stored
    ? await db.update(accounts).set(storedDiscordLink(null, null)).where(linkIsOurs).returning({ id: accounts.id })
    : [];
  if (!stored || !cleared) return { ok: false, status: 409, error: 'This member has no link made by hand here.' };

  await db
    .insert(clanAuditLog)
    .values({
      clanId: o.clanId,
      clanMemberId: member.id,
      eventType: 'discord_link_removed',
      actorUserId: o.actorUserId,
      oldValue: JSON.stringify({ rsn: member.rsn, source: 'admin' }),
      notes: `Hand-made Discord link removed from ${member.rsn}`,
    })
    .catch(() => {});

  if (!o.removeRoles || !stored.discordId) {
    return { ok: true, roles: null, message: 'Link removed. Roles they already hold stay until you remove them in Discord.' };
  }
  const removal = await takeBackRoles({ clanId: o.clanId, seatId: member.id, rsn: member.rsn, actorUserId: o.actorUserId, discordUserId: stored.discordId });
  return { ok: true, roles: removal, message: `Link removed. ${roleRemovalMessage(removal)}` };
}

/** Role removal that can never throw past its caller: the link change it follows has already happened. */
export async function takeBackRoles(o: {
  clanId: number;
  seatId: number;
  rsn: string;
  actorUserId: number;
  discordUserId: string;
}): Promise<RoleRemoval> {
  let removal: RoleRemoval;
  try {
    removal = await removeAnvilRolesFromAccount(o.clanId, o.discordUserId);
  } catch (err) {
    log.warn('discord-unlink.throw', { clanId: o.clanId }, err);
    removal = { status: 'refused', message: 'Anvil could not reach Discord, so no roles were removed. Remove them in Discord.' };
  }
  await auditRolesRemoved({ clanId: o.clanId, seatId: o.seatId, rsn: o.rsn, actorUserId: o.actorUserId, removal });
  return removal;
}
