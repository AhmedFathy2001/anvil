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

import { and, eq, isNull, sql, type SQL } from 'drizzle-orm';

import { db } from '@/db';
import { resolveClanFromRequest } from '@/lib/clanContext';
import { accounts, clanMemberships, clanRoster, players, users } from '@/db/schema';

export type RosterSeat = typeof clanRoster.$inferSelect;

/** The first roster seat matching `where`, or undefined. Add a clan filter unless you mean any clan. */
export async function findRosterSeat(where: SQL | undefined): Promise<RosterSeat | undefined> {
  // clan-scope: global -- the caller supplies the filter, including the clan when it means one.
  const [seat] = await db.select().from(clanRoster).where(where).limit(1);
  return seat;
}

/** Every roster seat matching `where`. Add a clan filter unless you mean any clan. */
export async function findRosterSeats(where: SQL | undefined): Promise<RosterSeat[]> {
  // clan-scope: global -- the caller supplies the filter, including the clan when it means one.
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

/**
 * The person behind a login, or null if there is no such login.
 *
 * For code that is handed a USER id — a plugin token resolves to one, so do the admin routes that
 * act on a named user — and needs to ask about account ownership. users.id and players.id are
 * separate sequences: passing the user id straight into a player_id comparison matches whichever
 * unrelated person happens to share the number, which is silent and wrong rather than empty.
 *
 * Request handlers holding a session should use `session.playerId` and skip this entirely.
 */
export async function personOf(userId: number | null | undefined): Promise<number | null> {
  if (userId == null) return null;
  const [row] = await db.select({ playerId: users.playerId }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.playerId ?? null;
}

/**
 * This login's seats IN ONE CLAN.
 *
 * The clan argument is required, and that is the whole point of this function's shape. Without it
 * the condition was `eq(playerId, …)` alone — every seat this person holds anywhere — and its
 * callers are clan-side routes acting on behalf of one clan. An admin of clan A passing a seat id
 * from clan B got a match whenever the same person owned both, which is how
 * `admin/users/[id]/characters/[memberId]` could unclaim another clan's row.
 *
 * The `false` matters too. `eq(playerId, null)` is not valid SQL and a sentinel id would be a guess,
 * but the real risk is the shape this replaced: passing the user id straight in, which matched
 * whichever unrelated person happened to share the number. "No person, therefore no seats" is the
 * only honest answer.
 */
export async function seatsOwnedBy(clanId: number, userId: number | null | undefined): Promise<SQL> {
  const playerId = await personOf(userId);
  if (playerId == null) return sql`false`;
  return and(eq(clanRoster.clanId, clanId), eq(clanRoster.playerId, playerId))!;
}

/**
 * This login's seats EVERYWHERE, across every clan.
 *
 * Named awkwardly on purpose. Almost every caller wants the clan-scoped one above, so the safe call
 * is the short one and reaching across clans has to be spelled out — the reverse of the arrangement
 * that produced the bug.
 *
 * Legitimate uses are the ones answering a question about the PERSON rather than about a clan:
 * resolving which of their own accounts a plugin request is for, or listing someone their own
 * characters. Anything acting on behalf of a clan wants `seatsOwnedBy`.
 */
export async function seatsOwnedByAnywhere(userId: number | null | undefined): Promise<SQL> {
  const playerId = await personOf(userId);
  return playerId == null ? sql`false` : eq(clanRoster.playerId, playerId);
}

/**
 * The person behind a login, creating one if this login somehow has none.
 *
 * For the CLAIM paths, where the answer decides who ends up owning an OSRS account. Reads can
 * tolerate "no person, therefore no rows"; a write cannot, because the alternatives are refusing a
 * legitimate claim or — far worse — writing the user id into player_id and handing the account to an
 * unrelated person who happens to share the number.
 */
export async function personOfOrCreate(userId: number): Promise<number> {
  const existing = await personOf(userId);
  if (existing != null) return existing;

  const [login] = await db.select({ displayName: users.displayName }).from(users).where(eq(users.id, userId)).limit(1);
  const [person] = await db.insert(players).values({ displayName: login?.displayName ?? null }).returning({ id: players.id });
  await db.update(users).set({ playerId: person.id }).where(eq(users.id, userId));
  return person.id;
}

/**
 * An account nobody has claimed.
 *
 * NOT `player_id IS NULL`, which is what this used to be and can no longer be true: every account
 * has a person from the moment it exists, so that an unclaimed roster entry has an identity to
 * accumulate history against and a later claim MERGES two people rather than filling in a blank.
 *
 * What "unclaimed" means now is that no login has asserted ownership, which is exactly what
 * `claimed_at` records. Used as the concurrency guard on the auto-link paths, where the point is
 * that a second claim arriving at the same time must lose rather than overwrite — a guard that
 * silently never matches would not refuse those writes, it would refuse ALL of them.
 */
export const UNCLAIMED_ACCOUNT = isNull(accounts.claimedAt);

/**
 * The roster seat with this id, but only if this clan owns it.
 *
 * The counterpart to eventInClan, for the same reason: seat ids are global and reach the admin
 * routes from the URL, so `/api/admin/clan/42` names a seat on whichever roster happens to hold id
 * 42. These are WRITE paths — rename, promote, demote, ban — so the failure is not a clan reading
 * another's roster but editing it.
 */
export async function seatInClan(clanId: number, seatId: number): Promise<RosterSeat | null> {
  if (!Number.isInteger(seatId)) return null;
  const [seat] = await db
    .select()
    .from(clanRoster)
    .where(and(eq(clanRoster.clanId, clanId), eq(clanRoster.id, seatId)))
    .limit(1);
  return seat ?? null;
}

/** The same, resolving the clan from the request's host. */
export async function seatForRequest(request: Request, seatId: number): Promise<RosterSeat | null> {
  const clan = await resolveClanFromRequest(request);
  if (!clan) return null;
  return seatInClan(clan.id, seatId);
}

/**
 * The login belonging to a person, or null if they have never signed in.
 *
 * The reverse of personOf, for the paths that act on a USER — applying a pending site role, say —
 * starting from a roster seat, which names a person rather than a login.
 */
export async function loginOf(playerId: number | null | undefined): Promise<number | null> {
  if (playerId == null) return null;
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.playerId, playerId)).limit(1);
  return row?.id ?? null;
}
