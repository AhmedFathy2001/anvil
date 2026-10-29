import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanCofferBroadcasts, clanCofferSyncEvents, clans, cofferEntries, type CofferEntry } from '@/db/schema';
import { parseCofferBroadcast, rsnKey, splitDeposit } from '@/lib/cofferBroadcastParse';
import { memberPersonOfSeat, type Tx } from '@/lib/cofferSync';

// The coffer's clan-chat line as the ledger's named record of a movement. Each plugin reports only
// its own player's line — the hub forbids sending other players' names. The line names who moved the
// coins; the coffer screen proves they arrived. It books on its own once a coffer reading shows the
// money: the mover's own reading of that movement (whichever lands first joins the other, so nothing
// is counted twice), or another member's reading of the same balance afterwards. Up to
// LINE_AUTO_MAX_GP; past that, or with no reading, a treasurer looks. A line never joins a reading
// that isn't its reporter's own — matching an amount alone would let anyone claim another member's
// (or a mobile) deposit.
//
/** The most a line and a coffer reading may book between them without a treasurer. */
export const LINE_AUTO_MAX_GP = 50_000_000;
/** How far apart a line and the mover's reading of the same movement may land. */
const SAME_MOVEMENT_MS = 120_000;
export type BroadcastResult =
  | { ok: true; outcome: 'new' | 'booked'; booked: CofferEntry[] }
  | { ok: false; error: string; status: number };
/** Coins this person has taken out of the coffer and not put back (approved custody rows). */
async function heldBy(tx: Tx, clanId: number, actorKey: string): Promise<number> {
  const [row] = await tx
    .select({ total: sql<string>`coalesce(sum(${cofferEntries.amount}), 0)` })
    .from(cofferEntries)
    .where(
      and(
        eq(cofferEntries.clanId, clanId),
        eq(cofferEntries.kind, 'withdrawal'),
        eq(cofferEntries.status, 'approved'),
        sql`lower(regexp_replace(${cofferEntries.rsn}, '[[:space:]_]+', ' ', 'g')) = ${actorKey}`,
      ),
    );
  return -Number(row?.total ?? 0);
}

export async function book(tx: Tx, clanId: number, entry: CofferEntry, how: string, settledByUserId: number | null = null): Promise<CofferEntry[]> {
  const now = new Date().toISOString();
  const settled = { status: 'approved', settledAt: now, settledByUserId, note: `Seen in clan chat — ${how}` };
  if (entry.kind !== 'donation') {
    const [row] = await tx.update(cofferEntries).set(settled).where(eq(cofferEntries.id, entry.id)).returning();
    return row ? [row] : [];
  }
  const { returned, donated } = splitDeposit(Number(entry.amount), await heldBy(tx, clanId, rsnKey(entry.rsn ?? '')));
  if (donated === 0) {
    const [row] = await tx.update(cofferEntries).set({ ...settled, kind: 'withdrawal' }).where(eq(cofferEntries.id, entry.id)).returning();
    return row ? [row] : [];
  }
  const out: CofferEntry[] = [];
  if (returned > 0) {
    const [back] = await tx
      .insert(cofferEntries)
      .values({ clanId, kind: 'withdrawal', amount: returned, status: 'approved', clanMemberId: entry.clanMemberId, rsn: entry.rsn, settledAt: now, settledByUserId, note: settled.note })
      .returning();
    if (back) out.push(back);
  }
  const [row] = await tx.update(cofferEntries).set({ ...settled, amount: donated }).where(eq(cofferEntries.id, entry.id)).returning();
  if (row) out.push(row);
  return out;
}

/** One plugin's report of its own player's coffer line. */
export async function recordCofferBroadcast(args: { clanId: number; clanMemberId: number; rsn: string; line: string; clanName: string }): Promise<BroadcastResult> {
  const parsed = parseCofferBroadcast(args.line);
  if (!parsed) return { ok: false, error: 'Not a coffer line', status: 400 };
  if (parsed.actorKey !== rsnKey(args.rsn)) return { ok: false, error: 'Only your own coffer lines are taken', status: 403 };
  const signed = parsed.direction === 'deposit' ? parsed.amount : -parsed.amount;

  return db.transaction(async (tx) => {
    // The same lock as the coffer-screen readings: one clan's coffer is one queue.
    await tx.execute(sql`select pg_advisory_xact_lock(1095651924, ${args.clanId})`);

    // The line came from the reporter's in-game clan chat. When this clan has its in-game name, the
    // channel has to be it — a member of two clans must not file the other one's coffer here.
    const [clan] = await tx.select({ inGameName: clans.inGameName }).from(clans).where(eq(clans.id, args.clanId)).limit(1);
    if (clan?.inGameName && rsnKey(clan.inGameName) !== rsnKey(args.clanName)) {
      return { ok: false as const, error: 'That line is from another clan’s chat', status: 409 };
    }
    const me = await memberPersonOfSeat(tx, args.clanMemberId);
    if (me == null) return { ok: false as const, error: 'Only members’ reports count', status: 403 };

    const [entry] = await tx
      .insert(cofferEntries)
      .values({
        clanId: args.clanId,
        kind: parsed.direction === 'deposit' ? 'donation' : 'withdrawal',
        amount: signed,
        status: 'pending',
        clanMemberId: args.clanMemberId,
        rsn: parsed.actorRsn,
        note: 'Seen in clan chat',
      })
      .returning();
    await tx.insert(clanCofferBroadcasts).values({
      clanId: args.clanId,
      actorRsn: parsed.actorRsn,
      actorKey: parsed.actorKey,
      direction: parsed.direction,
      amount: parsed.amount,
      reporters: [me],
      reporterSeats: [args.clanMemberId],
      cofferEntryId: entry.id,
    });

    // The mover's own coffer reading of this movement may be in already: the line takes its place.
    const [reading] = await tx
      .select({ id: clanCofferSyncEvents.id, entryId: clanCofferSyncEvents.cofferEntryId })
      .from(clanCofferSyncEvents)
      .innerJoin(cofferEntries, eq(cofferEntries.id, clanCofferSyncEvents.cofferEntryId))
      .where(
        and(
          eq(clanCofferSyncEvents.clanId, args.clanId),
          eq(clanCofferSyncEvents.amount, signed),
          eq(cofferEntries.clanMemberId, args.clanMemberId),
          gte(clanCofferSyncEvents.createdAt, new Date(Date.now() - SAME_MOVEMENT_MS)),
          eq(cofferEntries.status, 'pending'),
          sql`not exists (select 1 from ${clanCofferBroadcasts} b where b.coffer_entry_id = ${cofferEntries.id})`,
        ),
      )
      .orderBy(desc(clanCofferSyncEvents.id))
      .limit(1);
    if (reading) {
      await tx
        .update(cofferEntries)
        .set({ status: 'rejected', settledAt: new Date().toISOString(), note: 'Named by its clan-chat line' })
        .where(eq(cofferEntries.id, reading.entryId!));
      await tx.update(clanCofferSyncEvents).set({ cofferEntryId: entry.id }).where(eq(clanCofferSyncEvents.id, reading.id));
    }
    if (!reading || parsed.amount > LINE_AUTO_MAX_GP) return { ok: true as const, outcome: 'new' as const, booked: [] };
    return { ok: true as const, outcome: 'booked' as const, booked: await book(tx, args.clanId, entry, 'matched their coffer reading') };
  });
}

/**
 * This seat's clan-chat line for this coffer movement (booked or waiting) that no reading has joined
 * yet. The coffer-screen side of the join above, for when the mover's own reading lands second.
 */
export async function lineFor(tx: Tx, clanId: number, seatId: number, signedAmount: number): Promise<CofferEntry | null> {
  const [row] = await tx
    .select({ entry: cofferEntries })
    .from(clanCofferBroadcasts)
    .innerJoin(cofferEntries, eq(cofferEntries.id, clanCofferBroadcasts.cofferEntryId))
    .where(
      and(
        eq(clanCofferBroadcasts.clanId, clanId),
        // The line's own amount: a booked deposit's entry may have been cut down by custody coming home.
        eq(clanCofferBroadcasts.direction, signedAmount > 0 ? 'deposit' : 'withdrawal'),
        eq(clanCofferBroadcasts.amount, Math.abs(signedAmount)),
        eq(cofferEntries.clanMemberId, seatId),
        inArray(cofferEntries.status, ['pending', 'approved']),
        gte(clanCofferBroadcasts.createdAt, new Date(Date.now() - SAME_MOVEMENT_MS)),
        sql`not exists (select 1 from ${clanCofferSyncEvents} e where e.coffer_entry_id = ${cofferEntries.id})`,
      ),
    )
    .orderBy(asc(clanCofferBroadcasts.id))
    .limit(1);
  return row?.entry ?? null;
}

/** Whether a coffer entry is a clan-chat line's (booked with `book`, not as a reading). */
export async function isLineEntry(tx: Tx, entryId: number): Promise<boolean> {
  const [row] = await tx.select({ id: clanCofferBroadcasts.id }).from(clanCofferBroadcasts).where(eq(clanCofferBroadcasts.cofferEntryId, entryId)).limit(1);
  return !!row;
}

/**
 * A treasurer confirming (or rejecting) a clan-chat line no coffer reading confirmed (or over the limit). Books the same way
 * corroboration does, so a deposit still nets off what its depositor was holding. Null when the entry
 * isn't a pending clan-chat line of this clan — the caller then tries the other kinds.
 */
export async function settleBroadcastEntry(args: { clanId: number; entryId: number; approve: boolean; userId: number }): Promise<CofferEntry[] | null> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(1095651924, ${args.clanId})`);
    const [line] = await tx
      .select({ id: clanCofferBroadcasts.id })
      .from(clanCofferBroadcasts)
      .where(and(eq(clanCofferBroadcasts.clanId, args.clanId), eq(clanCofferBroadcasts.cofferEntryId, args.entryId)))
      .limit(1);
    if (!line) return null;
    const [entry] = await tx
      .select()
      .from(cofferEntries)
      .where(and(eq(cofferEntries.id, args.entryId), eq(cofferEntries.clanId, args.clanId), eq(cofferEntries.status, 'pending')))
      .limit(1);
    if (!entry) return [];
    if (!args.approve) {
      const [row] = await tx
        .update(cofferEntries)
        .set({ status: 'rejected', settledAt: new Date().toISOString(), settledByUserId: args.userId })
        .where(eq(cofferEntries.id, entry.id))
        .returning();
      return row ? [row] : [];
    }
    return book(tx, args.clanId, entry, 'confirmed by a treasurer', args.userId);
  });
}
