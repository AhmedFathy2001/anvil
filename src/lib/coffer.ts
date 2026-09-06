import { db } from '@/db';
import { cofferEntries, clanRoster, type CofferEntry } from '@/db/schema';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { foldBalance, type CofferBalance } from '@/lib/cofferMath';
import { announceCofferMovement } from '@/lib/cofferFeed';

/**
 * Tell the coffer channel, without making the ledger wait for Discord.
 *
 * Deliberately not awaited by its callers: the row is already written and committed, and a slow or
 * dead webhook must not hold up the request that filed a donation. `announceCofferMovement` never
 * throws, so there is nothing here for an unhandled rejection to catch.
 */
function announce(clanId: number, row: CofferEntry | null | undefined): void {
  if (!row) return;
  void getCofferBalance(clanId)
    .then((b) => announceCofferMovement(clanId, row, b.available))
    .catch(() => {});
}

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
  announce(args.clanId, row);
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
  announce(args.clanId, row);
  return row ?? null;
}

/**
 * A donation staff are RECORDING rather than approving, credited to one member or several.
 *
 * Two things it is not. It is not `fileDonation`, which is a member's claim about their own gift and
 * waits for somebody to believe it — a treasurer typing this IS the approval, so the rows land
 * approved. And it is not an adjustment, which belongs to nobody: the whole point of naming the
 * donors is that the coffer page's top-donor list is the only thanks most of them get, and gp that
 * arrived as "the clan" thanks nobody.
 *
 * Several people is ONE ROW EACH, not one row with a list. A donation from three people is three
 * donations that happened to arrive together — it is what the ledger already means by a donation,
 * what the top-donor sum already counts, and it survives one of them later being disputed.
 */
export async function recordDonations(args: {
  clanId: number;
  donors: { clanMemberId: number | null; rsn: string | null; amount: number }[];
  userId: number | null;
  note?: string | null;
}): Promise<CofferEntry[]> {
  const donors = args.donors
    .map((d) => ({ ...d, amount: Math.floor(d.amount) }))
    .filter((d) => d.amount > 0);
  if (donors.length === 0) return [];

  const now = new Date().toISOString();
  const shared = donors.length > 1 ? `${args.note ? `${args.note} — ` : ''}part of a ${donors.length}-way donation` : args.note;
  const rows = await db
    .insert(cofferEntries)
    .values(
      donors.map((d) => ({
        clanId: args.clanId,
        kind: 'donation',
        amount: d.amount,
        status: 'approved',
        clanMemberId: d.clanMemberId,
        rsn: d.rsn,
        createdByUserId: args.userId,
        settledByUserId: args.userId,
        settledAt: now,
        note: shared ?? null,
      })),
    )
    .returning();
  for (const row of rows) announce(args.clanId, row);
  return rows;
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
  announce(args.clanId, row);
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
    announce(args.clanId, row);
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
/**
 * Reserve a Skill/Boss of the Week prize against the coffer.
 *
 * Same movement as a mission award — gp leaves as `reserved` and a treasurer sends it — but keyed
 * on (competition, place) because a weekly has no completion row to be idempotent against. The
 * unique index is what actually enforces that; the pre-check just avoids the noisy insert.
 *
 * A place the pot cannot cover is still written, as `unfunded` — see below. Null means only that
 * the amount was nothing, or that another pass already owns this place.
 */
export async function reserveWeeklyAward(args: {
  clanId: number;
  amount: number;
  weeklyCompetitionId: number;
  place: number;
  clanMemberId: number | null;
  rsn: string | null;
  note?: string | null;
}): Promise<CofferEntry | null> {
  const amount = Math.max(0, Math.floor(args.amount));
  if (amount <= 0) return null;
  const existing = await db.query.cofferEntries.findFirst({
    where: and(
      eq(cofferEntries.weeklyCompetitionId, args.weeklyCompetitionId),
      eq(cofferEntries.place, args.place),
    ),
  });
  if (existing) return existing.status === 'cancelled' ? null : existing;
  // Short pot: the row is still written, as `unfunded`. A clan that promised gp and could not pay
  // should carry that on its ledger — dropping the row instead would leave the winner with nothing
  // and no record that anything was ever owed.
  const balance = await getCofferBalance(args.clanId);
  const funded = balance.available >= amount;
  try {
    const [row] = await db
      .insert(cofferEntries)
      .values({
        clanId: args.clanId,
        kind: 'award',
        amount: -amount,
        status: funded ? 'reserved' : 'unfunded',
        weeklyCompetitionId: args.weeklyCompetitionId,
        place: args.place,
        clanMemberId: args.clanMemberId,
        rsn: args.rsn,
        note: args.note ?? null,
      })
      .returning();
    announce(args.clanId, row);
    return row;
  } catch {
    // Lost the unique-index race with a concurrent settle pass. Theirs stands.
    return (
      (await db.query.cofferEntries.findFirst({
        where: and(
          eq(cofferEntries.weeklyCompetitionId, args.weeklyCompetitionId),
          eq(cofferEntries.place, args.place),
        ),
      })) ?? null
    );
  }
}

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
    announce(args.clanId, row);
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

// ---- Event prize pools -------------------------------------------------------------------------
//
// A board pays its own prizes: entry fees plus whatever the host adds, split across placements by
// lib/payouts. What it could not do was take that money out of the CLAN'S coffer — a host funding a
// bingo out of clan funds moved the gp by hand and the ledger never heard about it.
//
// So this is deliberately the dumbest movement in the file. One row per event, no places, no
// winners, no idempotency key beyond "one pool per event": the coffer commits an amount to a board
// and stops there, because the board already knows how to divide it. The gp shows as committed the
// moment it is set aside, so a second event cannot promise the same 500m, and a treasurer marks it
// paid on the coffer page like any other prize.

/** The pool row for an event, if it has one. Cancelled rows read as no pool. */
export async function getEventPool(eventId: number): Promise<CofferEntry | null> {
  // clan-scope: global -- keyed by an event id whose clan the caller has already settled.
  const row = await db.query.cofferEntries.findFirst({
    where: and(
      eq(cofferEntries.eventId, eventId),
      eq(cofferEntries.kind, 'pool'),
      inArray(cofferEntries.status, ['reserved', 'paid']),
    ),
  });
  return row ?? null;
}

/** What an event's pool is worth, as a positive number. 0 when it has none. */
export async function eventPoolGp(eventId: number): Promise<number> {
  const row = await getEventPool(eventId);
  return row ? Math.abs(row.amount) : 0;
}

export type SetPoolResult =
  | { ok: true; entry: CofferEntry | null }
  | { ok: false; error: string };

/**
 * Set (or clear) what an event takes from the coffer.
 *
 * Editing means editing the SAME row rather than stacking a second one, so a host who types 500m,
 * thinks better of it and types 300m has committed 300m — not 800m, and not two lines on the ledger
 * arguing about which is current. Clearing it cancels the row: the gp was never sent, so it comes
 * straight back to available rather than leaving a refund to be reconciled.
 *
 * Once a treasurer has marked it PAID the amount is history and this refuses. The money is gone; a
 * change of mind then is an adjustment, which is a different sentence about a different fact.
 */
export async function setEventPool(args: {
  clanId: number;
  eventId: number;
  amount: number;
  userId: number | null;
  note?: string | null;
}): Promise<SetPoolResult> {
  const amount = Math.max(0, Math.floor(args.amount));
  const existing = await getEventPool(args.eventId);
  if (existing?.status === 'paid') {
    return { ok: false, error: 'That prize money has already been paid out. Record a change as an adjustment instead.' };
  }
  const current = existing ? Math.abs(existing.amount) : 0;
  if (amount === current) return { ok: true, entry: existing };

  // Only the INCREASE has to be affordable: gp already committed to this pool is not competing with
  // itself, and a host trimming an over-promise should never be blocked for having made it.
  if (amount > current) {
    const balance = await getCofferBalance(args.clanId);
    if (balance.available < amount - current) {
      return {
        ok: false,
        error: `The coffer only has ${balance.available.toLocaleString()} gp available.`,
      };
    }
  }

  if (amount === 0 && existing) {
    const [row] = await db
      .update(cofferEntries)
      .set({ status: 'cancelled', settledByUserId: args.userId, settledAt: new Date().toISOString() })
      .where(and(eq(cofferEntries.id, existing.id), eq(cofferEntries.status, 'reserved')))
      .returning();
    announce(args.clanId, row);
    return { ok: true, entry: null };
  }
  if (amount === 0) return { ok: true, entry: null };

  if (existing) {
    const [row] = await db
      .update(cofferEntries)
      .set({ amount: -amount, note: args.note ?? existing.note })
      .where(and(eq(cofferEntries.id, existing.id), eq(cofferEntries.status, 'reserved')))
      .returning();
    announce(args.clanId, row);
    return { ok: true, entry: row ?? existing };
  }

  const [row] = await db
    .insert(cofferEntries)
    .values({
      clanId: args.clanId,
      kind: 'pool',
      amount: -amount,
      status: 'reserved',
      eventId: args.eventId,
      createdByUserId: args.userId,
      note: args.note ?? null,
    })
    .returning();
  announce(args.clanId, row);
  return { ok: true, entry: row };
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
        // Pools settle the same way an award does — a treasurer sends the gp and says so. The only
        // difference is who receives it, and that is the board's business rather than the ledger's.
        inArray(cofferEntries.kind, ['award', 'pool']),
        inArray(cofferEntries.status, args.paid ? ['reserved'] : ['reserved', 'paid']),
      ),
    )
    .returning();
  announce(args.clanId, row);
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
