// Bans that outlive a deleted account (`banned_discord_ids`, drizzle/0266).
//
// lib/erasePerson writes a row here for each ban still in force when somebody deletes their
// account: the Discord id, which ban, the date, and a clan's own reason. Nothing else about the
// person is kept, and no blank login or person stands in for them.
//
// This file is the other half: what those rows DO.
//   platform  that Discord account is refused at sign-in, exactly as a banned login is.
//   clan      the first time that Discord account signs in again, the ban is put back on the new
//             person as an ordinary clan_bans row and the row here is deleted. From then on every
//             existing check (lib/clanBans isBannedFromClan) enforces it; nothing else reads this table.
// Staff see a row as "Deleted account" and lift it by deleting it.

import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, bannedDiscordIds, clanAuditLog, clanBans, clanMemberships } from '@/db/schema';
import { liftClanBan } from '@/lib/clanBans';
import { clanSeat } from '@/lib/seatScope';

/** Is this Discord account barred from the platform by a ban kept from a deleted account? */
export async function discordIdPlatformBanned(discordId: string | null | undefined): Promise<boolean> {
  if (!discordId) return false;
  const [row] = await db
    .select({ id: bannedDiscordIds.id })
    .from(bannedDiscordIds)
    .where(and(eq(bannedDiscordIds.discordId, discordId), eq(bannedDiscordIds.scope, 'platform')))
    .limit(1);
  return row != null;
}

/**
 * Put every clan ban kept for this Discord account back on the person who just signed in with it,
 * and delete the kept rows. Returns how many were put back. One transaction: a ban is never in
 * neither place.
 *
 * Called on every sign-in (lib/discord-login), before anything that could seat the person, so a
 * returning account is banned again before it can join.
 */
export async function reattachClanBans(discordId: string | null | undefined, playerId: number | null | undefined): Promise<number> {
  if (!discordId || playerId == null) return 0;
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(bannedDiscordIds)
      .where(and(eq(bannedDiscordIds.discordId, discordId), eq(bannedDiscordIds.scope, 'clan')))
      .for('update');
    for (const row of rows) {
      if (row.clanId == null) continue;
      await tx
        .insert(clanBans)
        // The clan's original date, reason and (if they still exist) who set it. Already banned
        // there again by other means = the live ban stands and this one is simply dropped.
        .values({ clanId: row.clanId, playerId, reason: row.reason, bannedByUserId: row.bannedByUserId, bannedAt: row.bannedAt })
        .onConflictDoNothing();
      await tx.delete(bannedDiscordIds).where(eq(bannedDiscordIds.id, row.id));
      await tx.insert(clanAuditLog).values({
        clanId: row.clanId,
        eventType: 'clan_ban_restored',
        actorUserId: null,
        newValue: JSON.stringify({ playerId }),
        notes: 'a ban on a deleted account applies again: the same Discord account signed in',
      });
    }
    return rows.length;
  });
}

/**
 * A ban with nobody on the roster to show it beside, as clan staff see it: no name and no Discord id.
 *   deleted   the account was deleted and has not signed in since (a banned_discord_ids row)
 *   returned  a live clan ban on a person with no character on this clan's roster: the usual case is
 *             a deleted account whose Discord account signed in again and got its ban back
 */
export interface DeletedAccountBan {
  id: number;
  kind: 'deleted' | 'returned';
  bannedAt: string;
  reason: string | null;
}

/** Live clan bans on people who hold no roster seat (past or present) in this clan. */
async function unseatedClanBans(clanId: number) {
  const live = await db
    .select({ id: clanBans.id, playerId: clanBans.playerId, bannedAt: clanBans.bannedAt, reason: clanBans.reason })
    .from(clanBans)
    .where(and(eq(clanBans.clanId, clanId), isNull(clanBans.liftedAt)));
  if (live.length === 0) return [];
  // The roster page lists departed seats too, and shows the ban beside them: only people with no
  // seat row at all here are missing from it.
  const seated = new Set(
    (
      await db
        .selectDistinct({ playerId: accounts.playerId })
        .from(clanMemberships)
        .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
        .where(and(eq(clanMemberships.clanId, clanId), clanSeat(), inArray(accounts.playerId, live.map((b) => b.playerId))))
    ).map((r) => r.playerId),
  );
  return live.filter((b) => !seated.has(b.playerId));
}

/**
 * The bans this clan holds that its roster cannot show: on accounts that have since been deleted,
 * and on a returned account that has no character here. Oldest first.
 */
export async function deletedAccountClanBans(clanId: number): Promise<DeletedAccountBan[]> {
  const kept = await db
    .select({ id: bannedDiscordIds.id, bannedAt: bannedDiscordIds.bannedAt, reason: bannedDiscordIds.reason })
    .from(bannedDiscordIds)
    .where(and(eq(bannedDiscordIds.clanId, clanId), eq(bannedDiscordIds.scope, 'clan')))
    .orderBy(asc(bannedDiscordIds.bannedAt), asc(bannedDiscordIds.id));
  const returned = await unseatedClanBans(clanId);
  return [
    ...kept.map((b) => ({ ...b, kind: 'deleted' as const })),
    ...returned.map((b) => ({ id: b.id, kind: 'returned' as const, bannedAt: b.bannedAt, reason: b.reason })),
  ];
}

/**
 * Lift one. 'deleted': the kept row is deleted, so that Discord account can sign in and join like
 * anyone else. 'returned': the ordinary clan ban is lifted (lib/clanBans liftClanBan).
 */
export async function liftDeletedAccountClanBan(
  clanId: number,
  id: number,
  byUserId: number,
  kind: DeletedAccountBan['kind'] = 'deleted',
): Promise<boolean> {
  if (kind === 'returned') {
    // Only a ban this list shows: this clan's, live, on a person with no seat here.
    const ban = (await unseatedClanBans(clanId)).find((b) => b.id === id);
    return ban ? liftClanBan(clanId, ban.playerId, byUserId) : false;
  }
  const [row] = await db
    .delete(bannedDiscordIds)
    // The clan is part of the match: the id arrived in a request, and another clan's ban is not this clan's to lift.
    .where(and(eq(bannedDiscordIds.id, id), eq(bannedDiscordIds.clanId, clanId), eq(bannedDiscordIds.scope, 'clan')))
    .returning({ id: bannedDiscordIds.id });
  if (!row) return false;
  await db
    .insert(clanAuditLog)
    .values({
      clanId,
      eventType: 'clan_unbanned',
      actorUserId: byUserId,
      newValue: JSON.stringify({ deletedAccount: true }),
      notes: 'ban on a deleted account lifted',
    })
    .catch(() => {});
  return true;
}

/** Platform bans kept from deleted accounts, for /staff. Platform staff see the Discord id: it is all there is. */
export async function deletedAccountPlatformBans(): Promise<{ id: number; bannedAt: string; reason: string | null; discordId: string }[]> {
  // clan-scope: global -- the platform's own bans, which belong to no clan.
  return db
    .select({ id: bannedDiscordIds.id, bannedAt: bannedDiscordIds.bannedAt, reason: bannedDiscordIds.reason, discordId: bannedDiscordIds.discordId })
    .from(bannedDiscordIds)
    .where(eq(bannedDiscordIds.scope, 'platform'))
    .orderBy(asc(bannedDiscordIds.bannedAt), asc(bannedDiscordIds.id));
}

export async function liftDeletedAccountPlatformBan(id: number, byUserId: number): Promise<boolean> {
  // clan-scope: global -- the platform's own bans, which belong to no clan.
  const [row] = await db
    .delete(bannedDiscordIds)
    .where(and(eq(bannedDiscordIds.id, id), eq(bannedDiscordIds.scope, 'platform')))
    .returning({ id: bannedDiscordIds.id });
  if (!row) return false;
  await db
    .insert(clanAuditLog)
    .values({
      clanId: null,
      eventType: 'platform_unbanned',
      actorUserId: byUserId,
      newValue: JSON.stringify({ deletedAccount: true, reason: 'ban on a deleted account' }),
      notes: 'platform ban on a deleted account lifted',
    })
    .catch(() => {});
  return true;
}
