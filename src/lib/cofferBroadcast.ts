import { and, asc, eq, gte, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanCofferBroadcasts, clanMemberships, clans, cofferEntries, type CofferEntry } from '@/db/schema';
import { parseCofferBroadcast, rsnKey, splitDeposit } from '@/lib/cofferBroadcastParse';
import { CORROBORATION_MAX_GP, memberPersonOfSeat, type Tx } from '@/lib/cofferSync';

// The coffer's clan-chat line as the ledger's source of movements. Every online member's plugin
// reports the line it saw; reports of the same actor, direction and amount within a couple of minutes
// are one movement. It books once two different PEOPLE have reported it — one client's word is not
// money, the same rule as the coffer-screen readings (lib/cofferSync) — and until then its entry waits
// in the treasurer's queue.
//
// A deposit is credited to the person the line names. A withdrawal is custody: the coins went to that
// person's bank and the clan still has them. Putting them back is custody coming home, not a donation,
// so a deposit is first set against what its depositor is holding (splitDeposit).

/** How far apart two people's reports of one line may land. */
const SAME_LINE_MS = 120_000;
export type BroadcastResult =
  | { ok: true; outcome: 'new' | 'seen' | 'booked' | 'repeat'; booked: CofferEntry[] }
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

async function book(tx: Tx, clanId: number, entry: CofferEntry, how: string, settledByUserId: number | null = null): Promise<CofferEntry[]> {
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

/** One plugin's report of a coffer line it saw in its clan chat. */
export async function recordCofferBroadcast(args: { clanId: number; clanMemberId: number; rsn: string; line: string; clanName: string }): Promise<BroadcastResult> {
  const parsed = parseCofferBroadcast(args.line);
  if (!parsed) return { ok: false, error: 'Not a coffer line', status: 400 };

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

    const [same] = await tx
      .select()
      .from(clanCofferBroadcasts)
      .where(
        and(
          eq(clanCofferBroadcasts.clanId, args.clanId),
          eq(clanCofferBroadcasts.actorKey, parsed.actorKey),
          eq(clanCofferBroadcasts.direction, parsed.direction),
          eq(clanCofferBroadcasts.amount, parsed.amount),
          gte(clanCofferBroadcasts.createdAt, new Date(Date.now() - SAME_LINE_MS)),
          // The same seat reporting it again is a second movement (two deposits of 519 in a row).
          sql`not (${args.clanMemberId} = any(${clanCofferBroadcasts.reporterSeats}))`,
        ),
      )
      .orderBy(asc(clanCofferBroadcasts.id))
      .limit(1);

    if (!same) {
      // Named on the entry by the seat the actor holds in this clan, when they have one.
      const [seat] = await tx
        .select({ id: clanMemberships.id })
        .from(clanMemberships)
        .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
        .where(and(eq(clanMemberships.clanId, args.clanId), eq(accounts.rsnNormalized, parsed.actorKey), isNull(clanMemberships.leftAt)))
        .limit(1);
      const [entry] = await tx
        .insert(cofferEntries)
        .values({
          clanId: args.clanId,
          kind: parsed.direction === 'deposit' ? 'donation' : 'withdrawal',
          amount: parsed.direction === 'deposit' ? parsed.amount : -parsed.amount,
          status: 'pending',
          clanMemberId: seat?.id ?? null,
          rsn: parsed.actorRsn,
          note: `Seen in clan chat by ${args.rsn}`,
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
        cofferEntryId: entry?.id ?? null,
      });
      return { ok: true as const, outcome: 'new' as const, booked: [] };
    }

    if (same.reporters.includes(me)) {
      // The same person's other client: one line, already counted.
      await tx
        .update(clanCofferBroadcasts)
        .set({ reporterSeats: [...same.reporterSeats, args.clanMemberId] })
        .where(eq(clanCofferBroadcasts.id, same.id));
      return { ok: true as const, outcome: 'repeat' as const, booked: [] };
    }

    await tx
      .update(clanCofferBroadcasts)
      .set({ reporters: [...same.reporters, me], reporterSeats: [...same.reporterSeats, args.clanMemberId] })
      .where(eq(clanCofferBroadcasts.id, same.id));
    if (same.reporters.length !== 1 || same.cofferEntryId == null || parsed.amount > CORROBORATION_MAX_GP) {
      return { ok: true as const, outcome: 'seen' as const, booked: [] };
    }
    const [entry] = await tx
      .select()
      .from(cofferEntries)
      .where(and(eq(cofferEntries.id, same.cofferEntryId), eq(cofferEntries.status, 'pending')))
      .limit(1);
    if (!entry) return { ok: true as const, outcome: 'seen' as const, booked: [] };
    return { ok: true as const, outcome: 'booked' as const, booked: await book(tx, args.clanId, entry, `corroborated by ${args.rsn}`) };
  });
}

/**
 * A treasurer confirming (or rejecting) a clan-chat line only one person reported. Books the same way
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
