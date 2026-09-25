// Two person records, one human.
//
// The site mints a PERSON for a character the moment a roster sync sees it, so an unclaimed name has
// something to accumulate history against, and another when a human signs in with Discord. They
// become one when the character is claimed — until then the same human is two rows, one holding the
// characters and the seats, the other holding the login. An operator looking at that reasonably
// concludes identity is broken.
//
// Claiming used to leave the emptied row behind on purpose: a person is referenced by clan_bans and
// event_invites with ON DELETE CASCADE, so a tidy-up whose guard was wrong would silently delete a
// ban. That reasoning was right about the danger and wrong about the conclusion — the answer is to
// MOVE what the row carries before deleting it, which is what this does, rather than to leave litter
// in the one tool an operator uses to check that identity merged.
//
// EVERY TABLE THAT NAMES A PERSON IS HANDLED HERE. There are five, and the list is load-bearing: a
// table added later and forgotten would be silently cascade-deleted by the delete at the end.
//
//   accounts.player_id            NOT NULL, cascade   → moved
//   users.player_id               nullable, set null  → moved
//   clan_bans.player_id           NOT NULL, cascade   → moved, duplicates lifted (see below)
//   clan_join_requests.player_id  nullable, set null  → moved
//   event_invites.player_id       nullable, cascade   → moved, duplicates dropped
//
// tests/merge-people.test.ts builds a row in each of them and checks the count afterwards, so the
// list above stays honest.

import { and, eq, isNull, inArray, sql } from 'drizzle-orm';

import { db } from '@/db';
import {
  accounts,
  clanAuditLog,
  clanBans,
  clanJoinRequests,
  eventInvites,
  players,
  users,
} from '@/db/schema';
import type { DbExecutor } from '@/lib/roster';

export type MergeResult =
  | {
      ok: true;
      /** What moved, for the operator log and the confirmation. */
      moved: { accounts: number; logins: number; bans: number; joinRequests: number; invites: number };
      /** A live ban the target already had, so the duplicate was lifted rather than moved. */
      duplicateBansLifted: number;
      duplicateInvitesDropped: number;
    }
  | { ok: false; error: string };

/**
 * Fold `sourcePlayerId` into `targetPlayerId` and delete the source.
 *
 * The target survives, so it is the one to keep: the login's person in the ordinary case, because a
 * login is the thing a human signs in as and cannot be re-minted from a roster sync.
 */
export async function mergePeople(input: {
  sourcePlayerId: number;
  targetPlayerId: number;
  /** The operator, for the log. Null for the automatic merge that follows a claim. */
  actorUserId?: number | null;
  /** How this merge came about, written into the audit entry. */
  reason?: string;
}): Promise<MergeResult> {
  return db.transaction((tx) => mergePeopleWith(tx, input));
}

/** The implementation shared by an operator merge and an account claim's transaction. */
async function mergePeopleWith(
  executor: DbExecutor,
  input: {
    sourcePlayerId: number;
    targetPlayerId: number;
    actorUserId?: number | null;
    reason?: string;
  },
): Promise<MergeResult> {
  const { sourcePlayerId, targetPlayerId } = input;
  if (sourcePlayerId === targetPlayerId) {
    return { ok: false, error: 'That is the same person.' };
  }

  const [source, target] = await Promise.all([
    executor.query.players.findFirst({ where: eq(players.id, sourcePlayerId) }),
    executor.query.players.findFirst({ where: eq(players.id, targetPlayerId) }),
  ]);
  if (!source) return { ok: false, error: 'That person no longer exists.' };
  if (!target) return { ok: false, error: 'The person to merge into no longer exists.' };

  const [sourceLogins, targetLogins] = await Promise.all([
    executor.select({ id: users.id }).from(users).where(eq(users.playerId, sourcePlayerId)),
    executor.select({ id: users.id }).from(users).where(eq(users.playerId, targetPlayerId)),
  ]);

  // TWO LOGINS, ONE PERSON is a different operation, and a worse one to get wrong. `loginOf` answers
  // "which login belongs to this person" with findFirst, so a person holding two would hand an
  // arbitrary one to the pending-role and enrolment paths. Merging a human's two Discord accounts
  // means deciding which login survives and what happens to the sessions, seats and staff grants of
  // the other — none of which this function does. It refuses instead of guessing.
  if (sourceLogins.length > 0 && targetLogins.length > 0) {
    return {
      ok: false,
      error:
        'Both of these have their own Discord login. Merging would leave one person holding two, ' +
        'which the site cannot answer questions about. Ban or delete the login that should not survive first.',
    };
  }

  const result = await (async (tx: DbExecutor) => {
    // A PLATFORM BAN MUST NOT WASH OFF. Merging a banned person into a clean one would otherwise be
    // a way to launder the ban, so it carries — and the reason with it, or the survivor would be
    // banned with nothing said about why.
    if (source.banned && !target.banned) {
      await tx
        .update(players)
        .set({ banned: source.banned, bannedReason: source.bannedReason })
        .where(eq(players.id, targetPlayerId));
    }
    // A person minted by a roster sync carries the RSN as its name; one minted by a login carries the
    // Discord name. Keep the survivor's, and take the source's only where there is nothing to keep.
    if (!target.displayName && source.displayName) {
      await tx.update(players).set({ displayName: source.displayName }).where(eq(players.id, targetPlayerId));
    }

    // Bans: one LIVE ban per (clan, person) is a partial unique index, so a clan that banned both
    // rows would collide on the move. The target's ban is the one in force; the source's duplicate is
    // LIFTED rather than deleted, because "this clan banned them in March" is an answer somebody will
    // want and a deleted row cannot give it.
    const liveTargetBans = await tx
      .select({ clanId: clanBans.clanId })
      .from(clanBans)
      .where(and(eq(clanBans.playerId, targetPlayerId), isNull(clanBans.liftedAt)));
    const targetBannedClans = liveTargetBans.map((b) => b.clanId);
    let duplicateBansLifted = 0;
    if (targetBannedClans.length > 0) {
      const dupes = await tx
        .update(clanBans)
        .set({ liftedAt: sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')` })
        .where(
          and(
            eq(clanBans.playerId, sourcePlayerId),
            isNull(clanBans.liftedAt),
            inArray(clanBans.clanId, targetBannedClans),
          ),
        )
        .returning({ id: clanBans.id });
      duplicateBansLifted = dupes.length;
    }
    const bans = await tx
      .update(clanBans)
      .set({ playerId: targetPlayerId })
      .where(eq(clanBans.playerId, sourcePlayerId))
      .returning({ id: clanBans.id });

    // Invites: unique per (event, person). An invite is an offer rather than a record of anything
    // that happened, so a duplicate is simply dropped — the target already holds one for that event.
    const targetInvites = await tx
      .select({ eventId: eventInvites.eventId })
      .from(eventInvites)
      .where(eq(eventInvites.playerId, targetPlayerId));
    let duplicateInvitesDropped = 0;
    if (targetInvites.length > 0) {
      const dropped = await tx
        .delete(eventInvites)
        .where(
          and(
            eq(eventInvites.playerId, sourcePlayerId),
            inArray(eventInvites.eventId, targetInvites.map((i) => i.eventId)),
          ),
        )
        .returning({ id: eventInvites.id });
      duplicateInvitesDropped = dropped.length;
    }
    const invites = await tx
      .update(eventInvites)
      .set({ playerId: targetPlayerId })
      .where(eq(eventInvites.playerId, sourcePlayerId))
      .returning({ id: eventInvites.id });

    // The characters, and the seats that hang off them — a seat names an ACCOUNT, so moving the
    // account moves every roster seat, sign-up and completion with it, and none of them are touched.
    const movedAccounts = await tx
      .update(accounts)
      .set({ playerId: targetPlayerId })
      .where(eq(accounts.playerId, sourcePlayerId))
      .returning({ id: accounts.id });

    // Join requests key their live-uniqueness on the ACCOUNT, not the person, so these cannot collide.
    const requests = await tx
      .update(clanJoinRequests)
      .set({ playerId: targetPlayerId })
      .where(eq(clanJoinRequests.playerId, sourcePlayerId))
      .returning({ id: clanJoinRequests.id });

    // The login last, so that if anything above throws, the human is still signed in as somebody.
    const logins = await tx
      .update(users)
      .set({ playerId: targetPlayerId })
      .where(eq(users.playerId, sourcePlayerId))
      .returning({ id: users.id });

    await tx.delete(players).where(eq(players.id, sourcePlayerId));

    return {
      moved: {
        accounts: movedAccounts.length,
        logins: logins.length,
        bans: bans.length,
        joinRequests: requests.length,
        invites: invites.length,
      },
      duplicateBansLifted,
      duplicateInvitesDropped,
    };
  })(executor);

  // `platform_`-prefixed, which is what puts it in the operator log. Merging identities is exactly
  // the kind of thing that should be answerable months later.
  await executor.insert(clanAuditLog)
    .values({
      clanId: null,
      eventType: 'platform_people_merged',
      actorUserId: input.actorUserId ?? null,
      oldValue: JSON.stringify({ playerId: sourcePlayerId, displayName: source.displayName }),
      newValue: JSON.stringify({
        playerId: targetPlayerId,
        displayName: target.displayName,
        moved: result.moved,
        reason: input.reason ?? null,
      }),
    })
    .catch(() => {});

  return { ok: true, ...result };
}

/**
 * The husk left behind by a claim: a person with no characters and no login.
 *
 * Called after an account changes hands, with the person it used to belong to. Anything still
 * attached — a ban, an invite — moves to the claimer rather than being cascade-deleted with the row,
 * which is the whole reason this goes through mergePeople instead of a delete.
 */
export async function mergeEmptyPersonInto(
  sourcePlayerId: number,
  targetPlayerId: number,
  actorUserId?: number | null,
  executor?: DbExecutor,
): Promise<void> {
  if (executor) {
    await mergeEmptyPersonIntoWith(executor, sourcePlayerId, targetPlayerId, actorUserId);
    return;
  }
  await db.transaction((tx) => mergeEmptyPersonIntoWith(tx, sourcePlayerId, targetPlayerId, actorUserId));
}

async function mergeEmptyPersonIntoWith(
  executor: DbExecutor,
  sourcePlayerId: number,
  targetPlayerId: number,
  actorUserId?: number | null,
): Promise<void> {
  if (sourcePlayerId === targetPlayerId) return;
  const [stillHasAccounts, stillHasLogin] = await Promise.all([
    executor.select({ id: accounts.id }).from(accounts).where(eq(accounts.playerId, sourcePlayerId)).limit(1),
    executor.select({ id: users.id }).from(users).where(eq(users.playerId, sourcePlayerId)).limit(1),
  ]);
  // Only an EMPTY one. A person who still owns a character is a different human as far as anything
  // here can tell, and folding them together would hand one person's characters to another.
  if (stillHasAccounts.length > 0 || stillHasLogin.length > 0) return;
  await mergePeopleWith(executor, {
    sourcePlayerId,
    targetPlayerId,
    actorUserId: actorUserId ?? null,
    reason: 'emptied by a claim',
  });
}
