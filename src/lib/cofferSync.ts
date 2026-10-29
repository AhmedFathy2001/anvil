import { db } from '@/db';
import {
  accounts,
  clanCofferSyncEvents,
  clanCofferSyncState,
  clanMemberships,
  cofferEntries,
  type CofferEntry,
  type ClanCofferSyncState,
} from '@/db/schema';
import { and, desc, eq, gt, gte, inArray, lt, or, sql } from 'drizzle-orm';
import {
  confirmReading,
  decideCofferSync,
  type CofferObservation,
  type CofferSyncOutcome,
} from '@/lib/cofferSyncDecision';
import { book, isLineEntry, pendingLineFor } from '@/lib/cofferBroadcast';

export interface PhysicalCofferSyncResult {
  duplicateEvent: boolean;
  outcome: CofferSyncOutcome;
  amount: number;
  balance: number;
  ledgerEntry: CofferEntry | null;
}

export interface PhysicalCofferObservation extends CofferObservation {
  clanId: number;
  eventKey: string;
  clanMemberId: number;
  userId: number;
  rsn: string;
  pluginVersion: string | null;
}

/** Latest physical OSRS coffer balance, separate from Anvil's available/reserved ledger balance. */
export async function getPhysicalCofferState(clanId: number): Promise<ClanCofferSyncState | null> {
  const [row] = await db
    .select()
    .from(clanCofferSyncState)
    .where(eq(clanCofferSyncState.clanId, clanId))
    .limit(1);
  return row ?? null;
}

/** Recent physical observations for the admin audit surface. */
export async function listPhysicalCofferEvents(clanId: number, limit = 20) {
  return db
    .select()
    .from(clanCofferSyncEvents)
    .where(eq(clanCofferSyncEvents.clanId, clanId))
    .orderBy(desc(clanCofferSyncEvents.id))
    .limit(Math.max(1, Math.min(100, limit)));
}

/** How long a reading waits for a second client before it is only a treasurer's to confirm. */
const CORROBORATION_WINDOW_MS = 15 * 60_000;
/**
 * The largest movement two clients may confirm between them. Corroboration stops one forged client;
 * it cannot stop two people agreeing to lie — so past this, a treasurer always looks.
 */
export const CORROBORATION_MAX_GP = 250_000_000;

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The person behind a seat — but only a MEMBER seat (the in-game roster's word), never a guest one.
 * Corroboration needs two people the clan actually counts as its own, not two characters, and not a
 * guest seat anyone can be admitted to. Null otherwise.
 */
export async function memberPersonOfSeat(tx: Tx, seatId: number | null): Promise<number | null> {
  if (seatId == null) return null;
  // clan-scope: this clan -- by the seat id of an observation already filed under this clan.
  const [row] = await tx
    .select({ playerId: accounts.playerId, kind: clanMemberships.kind, leftAt: clanMemberships.leftAt })
    .from(clanMemberships)
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .where(eq(clanMemberships.id, seatId))
    .limit(1);
  return row && row.kind === 'member' && row.leftAt == null ? row.playerId : null;
}

/**
 * Turn one pending reading into booked money: measured from the last trusted reading, folding in —
 * and closing — every unconfirmed reading since. Shared by corroboration and a treasurer's Confirm,
 * so both book the same thing. Null when the reading is no longer pending.
 */
async function confirmReadingTx(
  tx: Tx,
  clanId: number,
  syncEventId: number,
  settledByUserId: number | null,
  how: string,
  /** Refuse (leave pending) when the booked movement would exceed this — corroboration's ceiling. */
  maxAbs: number = Number.POSITIVE_INFINITY,
): Promise<CofferEntry | null> {
  const [ev] = await tx
    .select()
    .from(clanCofferSyncEvents)
    .where(and(eq(clanCofferSyncEvents.id, syncEventId), eq(clanCofferSyncEvents.clanId, clanId)))
    .limit(1);
  if (!ev?.cofferEntryId) return null;
  const [entry] = await tx.select().from(cofferEntries).where(eq(cofferEntries.id, ev.cofferEntryId)).limit(1);
  if (!entry || entry.status !== 'pending') return null;

  // The last reading anything vouched for: a baseline, a corroboration, or one whose entry was
  // booked (which includes every reading from before corroboration existed).
  const [trusted] = await tx
    .select({ id: clanCofferSyncEvents.id, afterBalance: clanCofferSyncEvents.afterBalance })
    .from(clanCofferSyncEvents)
    .leftJoin(cofferEntries, eq(cofferEntries.id, clanCofferSyncEvents.cofferEntryId))
    .where(
      and(
        eq(clanCofferSyncEvents.clanId, clanId),
        lt(clanCofferSyncEvents.id, ev.id),
        or(
          inArray(clanCofferSyncEvents.outcome, ['baseline', 'corroborated']),
          eq(cofferEntries.status, 'approved'),
        ),
      ),
    )
    .orderBy(desc(clanCofferSyncEvents.id))
    .limit(1);

  // Unconfirmed readings between the trusted one and this: this confirmation accounts for them.
  const folded = await tx
    .select({ entryId: clanCofferSyncEvents.cofferEntryId })
    .from(clanCofferSyncEvents)
    .innerJoin(cofferEntries, eq(cofferEntries.id, clanCofferSyncEvents.cofferEntryId))
    .where(
      and(
        eq(clanCofferSyncEvents.clanId, clanId),
        gt(clanCofferSyncEvents.id, trusted?.id ?? 0),
        lt(clanCofferSyncEvents.id, ev.id),
        eq(cofferEntries.status, 'pending'),
      ),
    );

  const booked = confirmReading(
    trusted ? Number(trusted.afterBalance) : null,
    Number(ev.afterBalance),
    { kind: entry.kind, amount: Number(entry.amount), attributed: entry.clanMemberId != null },
    folded.length,
  );
  if (Math.abs(booked.amount) > maxAbs) return null;
  const now = new Date().toISOString();

  const foldedIds = folded.map((f) => f.entryId!).filter((id) => id != null);
  if (foldedIds.length > 0) {
    await tx
      .update(cofferEntries)
      .set({ status: 'rejected', settledAt: now, settledByUserId, note: 'Folded into a later confirmed coffer reading' })
      .where(and(inArray(cofferEntries.id, foldedIds), eq(cofferEntries.status, 'pending')));
  }

  // Nothing moved relative to trust (e.g. a forged spike and its correction cancel out).
  if (booked.amount === 0) {
    const [closed] = await tx
      .update(cofferEntries)
      .set({ status: 'rejected', settledAt: now, settledByUserId, note: 'No change from the last confirmed coffer balance' })
      .where(and(eq(cofferEntries.id, entry.id), eq(cofferEntries.status, 'pending')))
      .returning();
    return closed ?? null;
  }

  const [row] = await tx
    .update(cofferEntries)
    .set({
      status: 'approved',
      amount: booked.amount,
      kind: booked.kind,
      ...(booked.keepAttribution ? {} : { clanMemberId: null, rsn: null, createdByUserId: null }),
      settledAt: now,
      settledByUserId,
      note: `${entry.note ?? 'In-game coffer reading'} — ${how}`,
    })
    .where(and(eq(cofferEntries.id, entry.id), eq(cofferEntries.status, 'pending')))
    .returning();
  return row ?? null;
}

/**
 * A treasurer confirming (or rejecting) a pending in-game coffer reading from the queue. Null when
 * the entry is not a pending plugin reading of this clan — the caller then tries the other kinds.
 */
export async function settlePhysicalReading(args: {
  clanId: number;
  entryId: number;
  approve: boolean;
  userId: number;
}): Promise<CofferEntry | null> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(1095651924, ${args.clanId})`);
    const [ev] = await tx
      .select({ id: clanCofferSyncEvents.id })
      .from(clanCofferSyncEvents)
      .where(and(eq(clanCofferSyncEvents.clanId, args.clanId), eq(clanCofferSyncEvents.cofferEntryId, args.entryId)))
      .limit(1);
    if (!ev) return null;
    if (!args.approve) {
      const [row] = await tx
        .update(cofferEntries)
        .set({ status: 'rejected', settledAt: new Date().toISOString(), settledByUserId: args.userId })
        .where(and(eq(cofferEntries.id, args.entryId), eq(cofferEntries.status, 'pending')))
        .returning();
      return row ?? null;
    }
    return confirmReadingTx(tx, args.clanId, ev.id, args.userId, 'confirmed by a treasurer');
  });
}

/**
 * Apply one plugin observation exactly once.
 *
 * The advisory transaction lock is per clan. It closes the gap between reading the known physical
 * balance and updating it, which is what lets ten open RuneLite clients report one withdrawal
 * without producing ten ledger rows.
 *
 * A reading that moves money lands PENDING (see cofferSyncDecision, Corroboration). It is booked when
 * a different person's client reports the same balance within the window, or when a treasurer
 * confirms it from the queue. `ledgerEntry` comes back only once something is booked — that is what
 * the route announces.
 */
export async function syncPhysicalCoffer(args: PhysicalCofferObservation): Promise<PhysicalCofferSyncResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(1095651924, ${args.clanId})`);

    const [existing] = await tx
      .select({ outcome: clanCofferSyncEvents.outcome, amount: clanCofferSyncEvents.amount, afterBalance: clanCofferSyncEvents.afterBalance })
      .from(clanCofferSyncEvents)
      .where(and(eq(clanCofferSyncEvents.clanId, args.clanId), eq(clanCofferSyncEvents.eventKey, args.eventKey)))
      .limit(1);
    if (existing) {
      return {
        duplicateEvent: true,
        outcome: existing.outcome as CofferSyncOutcome,
        amount: Number(existing.amount),
        balance: Number(existing.afterBalance),
        ledgerEntry: null,
      };
    }

    const [state] = await tx
      .select({ balance: clanCofferSyncState.balance })
      .from(clanCofferSyncState)
      .where(eq(clanCofferSyncState.clanId, args.clanId))
      .limit(1);
    const decision = decideCofferSync(state ? Number(state.balance) : null, args);
    const now = new Date();
    let pendingEntry: CofferEntry | null = null;
    let booked: CofferEntry | null = null;
    let outcome: string = decision.outcome;

    // The mover's own clan-chat line may have named this movement already: their own reading joins it
    // rather than filing a second entry (lib/cofferBroadcast). Still one person's word — it books when
    // a different member's reading sees the same balance, below.
    const line = decision.ledgerAmount !== 0 && decision.attributeActor
      ? await pendingLineFor(tx, args.clanId, args.clanMemberId, decision.ledgerAmount)
      : null;
    if (line) {
      pendingEntry = line;
    } else if (decision.ledgerAmount !== 0) {
      const attributed = decision.attributeActor;
      const [row] = await tx
        .insert(cofferEntries)
        .values({
          clanId: args.clanId,
          // Coins leaving the coffer are custody whether or not we know whose bank they went to.
          kind: decision.ledgerAmount < 0 ? 'withdrawal' : attributed ? 'donation' : 'adjustment',
          amount: decision.ledgerAmount,
          status: 'pending',
          clanMemberId: attributed ? args.clanMemberId : null,
          rsn: attributed ? args.rsn : null,
          createdByUserId: attributed ? args.userId : null,
          note: decision.outcome === 'reconciled'
            ? `In-game coffer reconciliation observed by ${args.rsn}`
            : attributed
              ? 'Seen in the in-game Clan Coffer'
              : `In-game coffer movement observed by ${args.rsn}; actor not confirmed`,
        })
        .returning();
      pendingEntry = row ?? null;
    } else if (decision.outcome === 'duplicate') {
      // The same balance from another observer. If a DIFFERENT person's reading of it is waiting,
      // this is the second pair of eyes it needed.
      const me = await memberPersonOfSeat(tx, args.clanMemberId);
      const waiting = await tx
        .select({ id: clanCofferSyncEvents.id, observer: clanCofferSyncEvents.clanMemberId, amount: cofferEntries.amount, entry: cofferEntries })
        .from(clanCofferSyncEvents)
        .innerJoin(cofferEntries, eq(cofferEntries.id, clanCofferSyncEvents.cofferEntryId))
        .where(
          and(
            eq(clanCofferSyncEvents.clanId, args.clanId),
            eq(clanCofferSyncEvents.afterBalance, args.afterBalance),
            gte(clanCofferSyncEvents.createdAt, new Date(now.getTime() - CORROBORATION_WINDOW_MS)),
            eq(cofferEntries.status, 'pending'),
          ),
        )
        .orderBy(desc(clanCofferSyncEvents.id))
        .limit(5);
      for (const w of waiting) {
        if (Math.abs(Number(w.amount)) > CORROBORATION_MAX_GP) continue;
        const them = await memberPersonOfSeat(tx, w.observer);
        if (me == null || them == null || me === them) continue;
        // A reading that joined its mover's clan-chat line books as that line: named, custody netted.
        booked = (await isLineEntry(tx, w.entry.id))
          ? (await book(tx, args.clanId, w.entry, `corroborated by ${args.rsn}`)).at(-1) ?? null
          : await confirmReadingTx(tx, args.clanId, w.id, null, `corroborated by ${args.rsn}`, CORROBORATION_MAX_GP);
        if (booked) {
          outcome = 'corroborated';
          break;
        }
      }
    }

    await tx
      .insert(clanCofferSyncState)
      .values({
        clanId: args.clanId,
        balance: decision.nextBalance,
        observedByClanMemberId: args.clanMemberId,
        observedAt: now,
        lastEventKey: args.eventKey,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: clanCofferSyncState.clanId,
        set: {
          balance: decision.nextBalance,
          observedByClanMemberId: args.clanMemberId,
          observedAt: now,
          lastEventKey: args.eventKey,
          updatedAt: now,
        },
      });

    await tx.insert(clanCofferSyncEvents).values({
      clanId: args.clanId,
      eventKey: args.eventKey,
      kind: args.kind,
      outcome,
      amount: decision.ledgerAmount,
      beforeBalance: args.beforeBalance,
      afterBalance: args.afterBalance,
      // Keep the raw chat evidence even when a state gap prevents us from safely attributing the
      // ledger row. `clanMemberId` is the observer; the linked entry is named only when the decision
      // also accepted that evidence.
      actorConfirmed: args.actorConfirmed,
      clanMemberId: args.clanMemberId,
      rsn: args.rsn,
      cofferEntryId: pendingEntry?.id ?? null,
      pluginVersion: args.pluginVersion,
      createdAt: now,
    });

    return {
      duplicateEvent: false,
      outcome: outcome as CofferSyncOutcome,
      amount: decision.ledgerAmount,
      balance: decision.nextBalance,
      ledgerEntry: booked,
    };
  });
}
