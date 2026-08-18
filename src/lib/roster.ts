// Reading a clan's roster.
//
// `clanRoster` is a VIEW, and Drizzle's relational API (db.query.*) only covers tables — so the
// findFirst/findMany shape the codebase uses everywhere has to be spelled out. These two functions
// are that spelling and nothing more.
//
// NEITHER ONE SCOPES BY CLAN. They cannot: whether a lookup means "this seat on this clan's roster"
// or "this account, wherever it plays" is a question only the caller can answer, and answering it
// wrong is how one clan reads another's roster. Pass the clan filter in the `where` when the answer
// is the former. The clan-scope lint rule flags calls that look like they forgot.

import { and, eq, type SQL } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, clanRoster, players } from '@/db/schema';

export type RosterSeat = typeof clanRoster.$inferSelect;

/** The first roster seat matching `where`, or undefined. Add a clan filter unless you mean any clan. */
export async function findRosterSeat(where: SQL | undefined): Promise<RosterSeat | undefined> {
  const [seat] = await db.select().from(clanRoster).where(where).limit(1);
  return seat;
}

/** Every roster seat matching `where`. Add a clan filter unless you mean any clan. */
export async function findRosterSeats(where: SQL | undefined): Promise<RosterSeat[]> {
  return db.select().from(clanRoster).where(where);
}

/**
 * Update the ACCOUNT sitting in a roster seat, given only the seat.
 *
 * Writes never go through the view, so a caller holding a seat id and wanting to change something
 * about the account — its verification, its rename history, its hiscores state — has to get from the
 * seat to the account first. This is that hop, as a subquery, so it stays one statement.
 *
 * If you already have the seat row in hand, skip this and update `accounts` by `seat.accountId`
 * directly; naming the table you mean is clearer than a helper that hides it.
 */
export async function updateAccountOfSeat(
  seatId: number,
  patch: Partial<typeof accounts.$inferInsert>,
): Promise<void> {
  await db
    .update(accounts)
    .set(patch)
    .where(
      eq(
        accounts.id,
        db.select({ id: clanMemberships.accountId }).from(clanMemberships).where(eq(clanMemberships.id, seatId)),
      ),
    );
}

/**
 * The account for an RSN, creating it if this is the first time anyone has seen it.
 *
 * GLOBAL, deliberately. An OSRS account is one account no matter how many clans list it, so this
 * does not take a clan and must not be given one — that is what makes a rename in one clan visible
 * in every other, and what stops the hiscores sweep polling the same account once per clan.
 *
 * A brand-new account gets a person of its own. Nobody has claimed it yet, but every account has an
 * owner from the moment it exists, so claiming later merges two people rather than inventing one.
 */
export async function findOrCreateAccount(input: {
  rsn: string;
  rsnNormalized: string;
  accountHash?: string | null;
}): Promise<typeof accounts.$inferSelect> {
  // Hash first: it survives renames, so it identifies the account when the name no longer does.
  if (input.accountHash) {
    const [byHash] = await db.select().from(accounts).where(eq(accounts.accountHash, input.accountHash)).limit(1);
    if (byHash) return byHash;
  }
  const [byRsn] = await db.select().from(accounts).where(eq(accounts.rsnNormalized, input.rsnNormalized)).limit(1);
  if (byRsn) {
    // Anchor it to the hash now that we have one, so the next rename is still recognisable.
    if (input.accountHash && !byRsn.accountHash) {
      await db.update(accounts).set({ accountHash: input.accountHash }).where(eq(accounts.id, byRsn.id));
      return { ...byRsn, accountHash: input.accountHash };
    }
    return byRsn;
  }

  const [person] = await db.insert(players).values({ displayName: input.rsn }).returning();
  const [created] = await db
    .insert(accounts)
    .values({
      playerId: person.id,
      rsn: input.rsn,
      rsnNormalized: input.rsnNormalized,
      accountHash: input.accountHash ?? null,
    })
    .returning();
  return created;
}

/**
 * The seat this account holds on this clan's roster, creating it if absent. Returns the seat id.
 *
 * DEFAULTS TO GUEST, and nothing here can change that but an explicit `kind`. Membership is granted:
 * only the in-game roster sync and an admin may seat someone as a member, so every other path —
 * verifying an account, linking a plugin, signing up for an event — lands here as a guest.
 */
export async function findOrCreateSeat(
  clanId: number,
  accountId: number,
  options: { kind?: 'member' | 'guest'; source?: 'roster' | 'admin' | 'application' } = {},
): Promise<number> {
  const [existing] = await db
    .select({ id: clanMemberships.id })
    .from(clanMemberships)
    .where(and(eq(clanMemberships.clanId, clanId), eq(clanMemberships.accountId, accountId)))
    .limit(1);
  if (existing) return existing.id;

  const [seat] = await db
    .insert(clanMemberships)
    .values({
      clanId,
      accountId,
      kind: options.kind ?? 'guest',
      source: options.source ?? 'application',
    })
    .returning({ id: clanMemberships.id });
  return seat.id;
}

/**
 * Detach the account in this seat from whoever owns it.
 *
 * Not a null: every account has an owner, because an account nobody has claimed is still somebody's
 * — we just don't know whose yet. So unlinking hands it to a person of its own, exactly the state a
 * roster entry starts in before anyone signs in, and a later claim merges the two people rather than
 * finding an orphan.
 *
 * Also clears `isPrimary`, since "my main account" means nothing once it is not mine.
 */
export async function unclaimAccountOfSeat(seatId: number): Promise<void> {
  const [seat] = await db
    .select({ accountId: clanRoster.accountId, rsn: clanRoster.rsn })
    .from(clanRoster)
    .where(eq(clanRoster.id, seatId))
    .limit(1);
  if (!seat) return;

  const [person] = await db.insert(players).values({ displayName: seat.rsn }).returning();
  await db.update(accounts).set({ playerId: person.id, isPrimary: 0 }).where(eq(accounts.id, seat.accountId));
}
