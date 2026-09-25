import { and, eq, inArray, isNull, ne, or } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanAuditLog, detectedAccounts, users } from '@/db/schema';
import { findOrCreateAccount } from '@/lib/roster';
import { mergeEmptyPersonInto } from '@/lib/mergePeople';

/**
 * Attaching an OSRS account to a person, once proof exists.
 *
 * A CLAN IS NOT INVOLVED, and the schema has always said so — `accounts.verifiedAt` carries the note
 * "Global, because it is a fact about the account and not about any clan: proving ownership once
 * proves it everywhere, and nobody should have to re-prove the same RSN per clan." The routes did not
 * honour it. Both halves of the stat-delta flow called `requireClan()` and finished by seating the
 * person, so the only way to prove who you were was to be somewhere already — which is exactly the
 * thing a new arrival on the apex cannot do.
 *
 * Splitting the claim out is what makes the seat optional. Verifying from inside a clan still admits
 * you there, because that is what you meant by doing it there; verifying from the apex just tells the
 * platform which character is yours, and joining a clan later carries the proof with you.
 *
 * THREE ID-SPACE FACTS, because this is where they get mixed up:
 *   - `accounts.playerId` is a PERSON (`players.id`), never a login (`users.id`).
 *   - the two sequences diverged long ago — on the preview data not one of the sixty logins has
 *     `id = player_id` — so writing one where the other belongs lands on a real, unrelated person
 *     rather than failing.
 *   - `verifiedByUserId` genuinely IS a login: it records which staff account vouched.
 */

export type ClaimMethod = 'stat_delta' | 'plugin' | 'manual' | 'discord_name_match';

export type ClaimOutcome =
  | { ok: true; accountId: number; alreadyOurs: boolean }
  | { ok: false; code: 'owned_by_other'; error: string };

export async function claimAccountForPerson(input: {
  /** The PERSON claiming it. `session.playerId`, never `session.userId`. */
  playerId: number;
  rsn: string;
  rsnNormalized: string;
  method: ClaimMethod;
  accountHash?: string | null;
  /** False only for a manual-review request, where ownership is asserted but not proved yet. */
  verified?: boolean;
  /** Matched by a signal weak enough to be coincidence — a mod still has to confirm. */
  provisional?: boolean;
  /** The staff login that vouched, for a manual claim. A LOGIN id, unlike playerId above. */
  verifiedByUserId?: number | null;
  /** Written to the audit trail as the actor. Also a login id. */
  actorUserId?: number | null;
}): Promise<ClaimOutcome> {
  return db.transaction(async (tx) => {
    const account = await findOrCreateAccount({
      rsn: input.rsn,
      rsnNormalized: input.rsnNormalized,
      accountHash: input.accountHash ?? null,
    }, tx);

  // SOMEBODY ELSE'S. `claimedAt` is the test and `playerId` is not: every account has a person from
  // the moment it exists — `findOrCreateAccount` mints one so that claiming later merges two people
  // instead of inventing one — so a non-null `playerId` says nothing at all about whether a human
  // has ever claimed it. Testing the wrong one of those two is how this check came to pass for
  // every roster-synced RSN on the platform.
    if (account.claimedAt != null && account.playerId !== input.playerId) {
      return ownedByOther();
    }

    const alreadyOurs = account.playerId === input.playerId && account.claimedAt != null;
    const nowIso = new Date().toISOString();
  // Read before the move: after it, the account names the claimer and the row it came from is
  // unreachable from here.
    const previousPlayerId = account.playerId;

    const moved = await tx
      .update(accounts)
      .set({
        playerId: input.playerId,
        claimedAt: account.claimedAt ?? nowIso,
        verifiedAt: input.verified === false ? account.verifiedAt : nowIso,
        verificationMethod: input.method,
        verifiedByUserId: input.verifiedByUserId ?? null,
        provisional: input.provisional ? 1 : 0,
      })
      // A second claimant may have won after the read above. Only an unclaimed row or this same
      // person's already-owned row may move; RETURNING turns that race into a clean conflict.
      .where(
        and(
          eq(accounts.id, account.id),
          or(isNull(accounts.claimedAt), eq(accounts.playerId, input.playerId)),
        ),
      )
      .returning({ id: accounts.id });
    if (moved.length === 0) return ownedByOther();

  // Their first character becomes the primary one.
  //
  // This was `db.update(accounts).set({ isPrimary: 1 }).where(eq(clanMemberships.id, seatId))` — an
  // UPDATE on one table keyed on a column of another, with no join, which Postgres rejects outright
  // ("missing FROM-clause entry"). It ran only when the person had no primary yet, so the one case
  // it broke was somebody's FIRST character: the link committed and then the request 500'd on the
  // line after it. The most-visible path in the flow, on the least-experienced user.
    const others = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.playerId, input.playerId), eq(accounts.isPrimary, 1), ne(accounts.id, account.id)));
    if (others.length === 0) {
      await tx.update(accounts).set({ isPrimary: 1 }).where(eq(accounts.id, account.id));
    }

  // THE PERSON THIS CHARACTER USED TO BE. `findOrCreateAccount` mints one for every account a roster
  // sync sees, so until this moment the same human was two rows: one holding the characters, one
  // holding the login. This is the moment they become one.
  //
  // It used to be left behind deliberately, because a person is referenced by clan_bans and
  // event_invites with ON DELETE CASCADE and a tidy-up with a wrong guard would silently delete a
  // ban. That was right about the danger: the answer is to MOVE what it carries first, which is what
  // mergePeople does. The guard is that it merges only a row with no characters and no login left —
  // anything else is a different human.
    if (previousPlayerId != null && previousPlayerId !== input.playerId) {
      await mergeEmptyPersonInto(previousPlayerId, input.playerId, input.actorUserId ?? null, tx);
    }

    // The plugin may have raised a suggestion before the proof arrived (especially on the apex,
    // where an unclaimed roster seat cannot resolve a clan yet). Once this person owns the account,
    // that suggestion is settled and must not keep asking them to add it.
    await tx
      .delete(detectedAccounts)
      .where(
        and(
          eq(detectedAccounts.rsnNormalized, input.rsnNormalized),
          inArray(
            detectedAccounts.userId,
            tx.select({ id: users.id }).from(users).where(eq(users.playerId, input.playerId)),
          ),
        ),
      );

    await tx.insert(clanAuditLog)
      .values({
        clanId: null, // claiming a character is not any clan's act
        eventType: alreadyOurs ? 'account_reverified' : 'account_claimed',
        actorUserId: input.actorUserId ?? null,
        newValue: JSON.stringify({
          accountId: account.id,
          rsn: input.rsn,
          playerId: input.playerId,
          method: input.method,
          provisional: !!input.provisional,
        }),
      })
      .catch(() => {});

    return { ok: true, accountId: account.id, alreadyOurs };
  });
}

function ownedByOther(): ClaimOutcome {
  return {
    ok: false,
    code: 'owned_by_other',
    error: 'That character is already linked to someone else. If it is yours, ask a moderator to move it.',
  };
}

/**
 * Is this RSN claimable by this person — without spending a Hiscores call to find out?
 *
 * Asked on `accounts`, GLOBALLY. The old check ran `findRosterSeat(eq(clanRoster.rsnNormalized, …))`,
 * which can only see an account that holds a seat somewhere; an account claimed by somebody who is
 * not currently in any clan was invisible to it, and so appeared free to take. That is precisely the
 * shape this flow now creates on purpose, which turns a stale check into a way to take a character
 * off somebody who left their clan.
 */
export async function claimBlockedBy(
  rsnNormalized: string,
  playerId: number,
): Promise<{ rsn: string } | null> {
  const [row] = await db
    .select({ rsn: accounts.rsn, playerId: accounts.playerId, claimedAt: accounts.claimedAt })
    .from(accounts)
    .where(eq(accounts.rsnNormalized, rsnNormalized))
    .limit(1);
  if (!row) return null;
  if (row.claimedAt == null) return null;
  if (row.playerId === playerId) return null;
  return { rsn: row.rsn };
}
