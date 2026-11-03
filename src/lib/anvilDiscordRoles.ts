// The Anvil Discord's supporter roles: the pure half (no database, no Discord), so tests and the
// staff page can import it. The IO half is lib/anvilDiscord.
//
// Anvil's own server gives each Supporter tier a role ("Anvil Supporter", "Anvil Champion",
// "Anvil Patron") and, optionally, one shared "Anvil Subscriber" role every tier also gets. Only
// these roles are ever touched: a role Anvil does not hold the id of is never added or removed.

import { SUPPORTER_INK } from './supporterStyle.ts';
import type { SupporterTierId } from './supporterTiers.ts';

export type AnvilRoleKey = SupporterTierId | 'subscriber';

export const ANVIL_ROLE_KEYS: AnvilRoleKey[] = ['supporter', 'champion', 'patron', 'subscriber'];

/** The role each key is created as (and found by, when it already exists). */
export const ANVIL_ROLE_NAMES: Record<AnvilRoleKey, string> = {
  supporter: 'Anvil Supporter',
  champion: 'Anvil Champion',
  patron: 'Anvil Patron',
  subscriber: 'Anvil Subscriber',
};

/** Role ids by key, as stored in platform_settings. A null/missing id is not managed. */
export type AnvilRoleIds = Partial<Record<AnvilRoleKey, string | null>>;

/**
 * Each role's Discord colour (integer RGB): the tier's default ink. The shared Subscriber role has
 * none, so the tier role's colour is the one a name shows.
 */
export function anvilRoleColor(key: AnvilRoleKey): number {
  if (key === 'subscriber') return 0;
  return parseInt(SUPPORTER_INK[key].color.slice(1), 16);
}

export interface RolePlan {
  add: string[];
  remove: string[];
}

/**
 * Which Anvil roles to add and remove for one member. `tier` is the tier in force (paid or earned
 * through invites), null when nothing is. They get their tier's role plus the Subscriber role;
 * every other Anvil role they hold comes off. Roles outside `ids` are never in either list.
 */
export function planAnvilRoles(tier: SupporterTierId | null, have: readonly string[], ids: AnvilRoleIds): RolePlan {
  const managed = new Set(ANVIL_ROLE_KEYS.map((k) => ids[k]).filter((id): id is string => !!id));
  const want = new Set<string>();
  if (tier) {
    const tierRole = ids[tier];
    if (tierRole) want.add(tierRole);
    if (ids.subscriber) want.add(ids.subscriber);
  }
  const holding = new Set(have);
  return {
    add: [...want].filter((id) => !holding.has(id)),
    remove: [...holding].filter((id) => managed.has(id) && !want.has(id)),
  };
}

/** A Discord user id worth asking about: a real snowflake, never a lab dummy or a placeholder. */
export function isRealDiscordId(id: string | null | undefined): id is string {
  return !!id && /^\d{15,22}$/.test(id);
}

const MANAGE_ROLES = BigInt(1) << BigInt(28);
const ADMINISTRATOR = BigInt(1) << BigInt(3);

export interface GuildRoleLike {
  id: string;
  name: string;
  position: number;
  permissions: string;
  managed?: boolean;
}

export interface BotStanding {
  canManageRoles: boolean;
  /** The bot's highest role position; it can only give roles strictly below this. */
  topPosition: number;
}

/** What the bot can do in the guild, from its own role ids and the guild's role list. */
export function botStanding(botRoleIds: readonly string[], guildRoles: readonly GuildRoleLike[], guildId: string): BotStanding {
  const mine = guildRoles.filter((r) => r.id === guildId || botRoleIds.includes(r.id));
  let perms = BigInt(0);
  for (const r of mine) {
    try {
      perms |= BigInt(r.permissions || '0');
    } catch {
      // unparseable: counts for nothing
    }
  }
  return {
    canManageRoles: (perms & (MANAGE_ROLES | ADMINISTRATOR)) !== BigInt(0),
    topPosition: Math.max(0, ...mine.filter((r) => r.id !== guildId).map((r) => r.position)),
  };
}
