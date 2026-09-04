import { db } from '@/db';
import { cofferEntries, clanRoster, type CofferEntry } from '@/db/schema';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { foldBalance, type CofferBalance } from '@/lib/cofferMath';

// The clan coffer's database side. The arithmetic — what counts as money and what a balance MEANS —
// lives in lib/cofferMath so a page can render a balance without importing the database.
export * from '@/lib/cofferMath';

/**
 * The clan's balance, summed in the database. Called on every mission claim and on every coffer
 * surface, so it is one grouped query rather than a table scan in JS.
 */
export async function getCofferBalance(clanId: number): Promise<CofferBalance> {
  // clan-scope: takes the clan id its caller already settled.
  const rows = await db
    .select({
      kind: cofferEntries.kind,
      status: cofferEntries.status,
      total: sql<number>`coalesce(sum(${cofferEntries.amount}), 0)`,
    })
    .from(cofferEntries)
    .where(eq(cofferEntries.clanId, clanId))
    .groupBy(cofferEntries.kind, cofferEntries.status);
  return foldBalance(rows.map((r) => ({ kind: r.kind, status: r.status, total: Number(r.total) })));
}

// ---- Writes ------------------------------------------------------------------------------------

/**
 * A member reporting gp they handed over. Lands 'pending': it is evidence, not money, until staff
 * approve it. `amount` is trusted only as far as the approver's eyes — the proof screenshot and the
 * name on the row are what they check.
 */
export async function fileDonation(args: {
  clanId: number;
  amount: number;
  clanMemberId: number | null;
  rsn: string | null;
  createdByUserId: number | null;
  proofBlobUrl?: string | null;
  note?: string | null;
}): Promise<CofferEntry> {
  const amount = Math.max(1, Math.floor(args.amount));
  const [row] = await db
    .insert(cofferEntries)
    .values({
      clanId: args.clanId,
      kind: 'donation',
      amount,
      status: 'pending',
      clanMemberId: args.clanMemberId,
      rsn: args.rsn,
      createdByUserId: args.createdByUserId,
      proofBlobUrl: args.proofBlobUrl ?? null,
      note: args.note ?? null,
    })
    .returning();
  return row;
}

/**
 * Staff resolving a pending donation. Conditional on it still being pending, so two approvers
 * clicking at once credit the coffer once.
 */
export async function settleDonation(args: {
  clanId: number;
  entryId: number;
  approve: boolean;
  userId: number | null;
}): Promise<CofferEntry | null> {
  const [row] = await db
    .update(cofferEntries)
    .set({
      status: args.approve ? 'approved' : 'rejected',
      settledByUserId: args.userId,
      settledAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(cofferEntries.id, args.entryId),
        eq(cofferEntries.clanId, args.clanId),
        eq(cofferEntries.kind, 'donation'),
        eq(cofferEntries.status, 'pending'),
      ),
    )
    .returning();
  return row ?? null;
}

/** A staff correction: seed the pot, write off gp spent elsewhere, fix a fat-fingered donation. */
export async function recordAdjustment(args: {
  clanId: number;
  amount: number;
  userId: number | null;
  note?: string | null;
}): Promise<CofferEntry> {
  const [row] = await db
    .insert(cofferEntries)
    .values({
      clanId: args.clanId,
      kind: 'adjustment',
      amount: Math.trunc(args.amount),
      status: 'approved',
      createdByUserId: args.userId,
      settledByUserId: args.userId,
      settledAt: new Date().toISOString(),
      note: args.note ?? null,
    })
    .returning();
  return row;
}

/**
 * Reserve a prize against the coffer, or don't.
 *
 * Returns the award row when the money was there, null when it wasn't — and the caller treats null
 * as "unfunded", which is a legitimate outcome, not an error: a dry coffer does not stop missions
 * dropping, it just means the winner takes points instead of gp.
 *
 * The idempotency key is `completionId`: the settle pass re-runs over the same open missions every
 * minute and must not mint a second award for a claim it already paid for. The insert is guarded by
 * a unique index, so a duplicate loses the race in the database rather than in a check-then-write
 * window. The funds check reads the balance immediately before inserting; two claims landing in the
 * same millisecond can still over-reserve by one prize, which the treasurer sees as a negative
 * available balance rather than as silent nonsense.
 */
export async function reserveAward(args: {
  clanId: number;
  amount: number;
  eventId: number;
  tileId: number;
  completionId: number;
  place: number;
  clanMemberId: number | null;
  rsn: string | null;
  note?: string | null;
}): Promise<CofferEntry | null> {
  const amount = Math.max(0, Math.floor(args.amount));
  if (amount <= 0) return null;
  const existing = await findAwardForCompletion(args.completionId);
  if (existing) return existing.status === 'cancelled' ? null : existing;
  const balance = await getCofferBalance(args.clanId);
  if (balance.available < amount) return null;
  try {
    const [row] = await db
      .insert(cofferEntries)
      .values({
        clanId: args.clanId,
        kind: 'award',
        amount: -amount,
        status: 'reserved',
        eventId: args.eventId,
        tileId: args.tileId,
        completionId: args.completionId,
        place: args.place,
        clanMemberId: args.clanMemberId,
        rsn: args.rsn,
        note: args.note ?? null,
      })
      .returning();
    return row;
  } catch {
    // Lost the unique-index race: somebody else's insert for this completion won. Theirs stands.
    return findAwardForCompletion(args.completionId);
  }
}

/**
 * Record a prize that could NOT be paid, so the ledger can answer the first question the winner
 * asks. It holds no money (status 'unfunded' never counts toward the balance) and is never retried:
 * the funding decision belongs to the moment the mission was claimed, and a donation that arrives an
 * hour later does not retroactively change what somebody won. Same idempotency key as a real award.
 */
export async function recordUnfundedAward(args: {
  clanId: number;
  amount: number;
  eventId: number;
  tileId: number;
  completionId: number;
  place: number;
  clanMemberId: number | null;
  rsn: string | null;
}): Promise<CofferEntry | null> {
  const existing = await findAwardForCompletion(args.completionId);
  if (existing) return existing;
  try {
    const [row] = await db
      .insert(cofferEntries)
      .values({
        clanId: args.clanId,
        kind: 'award',
        amount: -Math.max(0, Math.floor(args.amount)),
        status: 'unfunded',
        eventId: args.eventId,
        tileId: args.tileId,
        completionId: args.completionId,
        place: args.place,
        clanMemberId: args.clanMemberId,
        rsn: args.rsn,
        note: 'Coffer was empty when this was claimed',
      })
      .returning();
    return row;
  } catch {
    return findAwardForCompletion(args.completionId);
  }
}

export async function findAwardForCompletion(completionId: number): Promise<CofferEntry | null> {
  // clan-scope: global -- keyed by a completion id whose event the caller has already settled.
  const row = await db.query.cofferEntries.findFirst({
    where: and(eq(cofferEntries.completionId, completionId), eq(cofferEntries.kind, 'award')),
  });
  return row ?? null;
}

/** Treasurer sent the gp (or took it back). Conditional on the row still being in the state it left. */
export async function settleAward(args: {
  clanId: number;
  entryId: number;
  paid: boolean;
  userId: number | null;
}): Promise<CofferEntry | null> {
  const [row] = await db
    .update(cofferEntries)
    .set({
      status: args.paid ? 'paid' : 'cancelled',
      settledByUserId: args.userId,
      settledAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(cofferEntries.id, args.entryId),
        eq(cofferEntries.clanId, args.clanId),
        eq(cofferEntries.kind, 'award'),
        inArray(cofferEntries.status, args.paid ? ['reserved'] : ['reserved', 'paid']),
      ),
    )
    .returning();
  return row ?? null;
}

// ---- Reads -------------------------------------------------------------------------------------

export interface CofferLedgerRow extends CofferEntry {
  /** Roster name for the member the row is about, when they still hold a seat. */
  memberName: string | null;
}

/** The ledger, newest first. `kinds`/`statuses` narrow it for the queue views. */
export async function listCofferEntries(args: {
  clanId: number;
  kinds?: string[];
  statuses?: string[];
  limit?: number;
}): Promise<CofferLedgerRow[]> {
  const where = [eq(cofferEntries.clanId, args.clanId)];
  if (args.kinds?.length) where.push(inArray(cofferEntries.kind, args.kinds));
  if (args.statuses?.length) where.push(inArray(cofferEntries.status, args.statuses));
  // clan-scope: global -- the ledger rows are already this clan's (filtered below); the roster join
  // only puts a name on a seat one of them names, and a seat can only belong to the clan that owns
  // the row pointing at it.
  const rows = await db
    .select({ entry: cofferEntries, memberName: clanRoster.rsn })
    .from(cofferEntries)
    .leftJoin(clanRoster, eq(cofferEntries.clanMemberId, clanRoster.id))
    .where(and(...where))
    .orderBy(desc(cofferEntries.id))
    .limit(Math.min(500, Math.max(1, args.limit ?? 100)));
  return rows.map((r) => ({ ...r.entry, memberName: r.memberName ?? null }));
}

/** Who has put the most in. Approved donations only — a pending claim is not a contribution yet. */
export async function topDonors(clanId: number, limit = 10): Promise<{ rsn: string; total: number }[]> {
  // clan-scope: global -- as above: the donations are filtered to this clan, and the join only
  // resolves the name of a seat one of them already names.
  const rows = await db
    .select({
      rsn: sql<string>`coalesce(${clanRoster.rsn}, ${cofferEntries.rsn}, 'Anonymous')`,
      total: sql<number>`coalesce(sum(${cofferEntries.amount}), 0)`,
    })
    .from(cofferEntries)
    .leftJoin(clanRoster, eq(cofferEntries.clanMemberId, clanRoster.id))
    .where(and(eq(cofferEntries.clanId, clanId), eq(cofferEntries.kind, 'donation'), eq(cofferEntries.status, 'approved')))
    .groupBy(sql`coalesce(${clanRoster.rsn}, ${cofferEntries.rsn}, 'Anonymous')`)
    .orderBy(sql`sum(${cofferEntries.amount}) desc`)
    .limit(Math.min(50, Math.max(1, limit)));
  return rows.map((r) => ({ rsn: r.rsn, total: Number(r.total) }));
}

/**
 * Does this clan keep a coffer at all?
 *
 * Asked by the site nav, which only advertises the page once there is something on it — most clans
 * will never run a prize mission, and a link to an empty pot is not navigation. One indexed row
 * lookup, not a sum: existence is the whole question.
 */
export async function clanHasCoffer(clanId: number): Promise<boolean> {
  const row = await db
    .select({ id: cofferEntries.id })
    .from(cofferEntries)
    .where(eq(cofferEntries.clanId, clanId))
    .limit(1);
  return row.length > 0;
}
