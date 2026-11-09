// Who is reading What's new (lib/whatsNew `Viewer`), from the database: shared by /whats-new and the
// bell's What's new notices (lib/notices).

import { and, eq, isNotNull } from 'drizzle-orm';

import { db } from '@/db';
import { accountPluginSeen, accounts, users } from '@/db/schema';
import { clanBoostLevels } from '@/lib/clanBoosts';
import { clansOfPerson } from '@/lib/myClans';
import { supporterForUser } from '@/lib/supporter';
import type { Viewer } from '@/lib/whatsNew';

/**
 * Supporter tier, every clan they belong to (a seat or a staff grant, lib/myClans) with their role
 * and the clan's boost level, and whether any character of theirs has played with the plugin. Each
 * lookup fails soft: a missing piece only makes the result less personal.
 */
export async function viewerFor(userId: number, playerId: number | null, onApex: boolean): Promise<Viewer> {
  const [supporter, myClans, pluginUser] = await Promise.all([
    supporterForUser(userId).catch(() => null),
    clansOfPerson(playerId, userId).catch(() => []),
    usesPlugin(userId, playerId).catch(() => false),
  ]);
  const levels = myClans.length
    ? await clanBoostLevels(myClans.map((c) => c.id)).catch(() => new Map<number, { level: number }>())
    : new Map<number, { level: number }>();

  return {
    signedIn: true,
    tier: supporter?.tier.id ?? null,
    clans: myClans.map((c) => ({ slug: c.slug, name: c.name, kind: c.clanKind, role: c.role, boostLevel: levels.get(c.id)?.level ?? 0 })),
    pluginUser,
    onApex,
  };
}

/** Has this person used the plugin: a device token, or any character the plugin has reported from. */
async function usesPlugin(userId: number, playerId: number | null): Promise<boolean> {
  const [token] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), isNotNull(users.pluginTokenHash)))
    .limit(1);
  if (token) return true;
  if (playerId == null) return false;
  // clan-scope: global -- a person's own characters, across every clan.
  const [seen] = await db
    .select({ id: accountPluginSeen.accountId })
    .from(accountPluginSeen)
    .innerJoin(accounts, eq(accounts.id, accountPluginSeen.accountId))
    .where(eq(accounts.playerId, playerId))
    .limit(1);
  return !!seen;
}
